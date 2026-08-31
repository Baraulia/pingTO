package main

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"io"
	"log"
	mrand "math/rand"
	"net"
	"net/http"
	"runtime"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"time"
)

const maxBodyRead = 1 << 20

var bodyBufPool = sync.Pool{New: func() any {
	b := make([]byte, 32*1024)
	return &b
}}

type RunStatus string

const (
	StatusRunning RunStatus = "running"
	StatusDone    RunStatus = "done"
	StatusStopped RunStatus = "stopped"
	StatusAborted RunStatus = "aborted"
	StatusError   RunStatus = "error"
)

type Snapshot struct {
	ID             string    `json:"id"`
	Status         RunStatus `json:"status"`
	Error          string    `json:"error,omitempty"`
	StartedAt      int64     `json:"startedAt"`
	ElapsedMS      int64     `json:"elapsedMs"`
	Phase          string    `json:"phase"`
	DesiredWorkers int       `json:"desiredWorkers"`
	Abort          string    `json:"abort,omitempty"`
	AmmoCount      int       `json:"ammoCount,omitempty"`
	Spec           RunSpec   `json:"spec"`
	StatsView
}

type run struct {
	id      string
	spec    RunSpec
	status  RunStatus
	err     string
	abort   string
	phase   string
	desired int32
	endOK   atomic.Bool
	started time.Time
	cancel  context.CancelFunc
	stats   *runStats
	done    chan struct{}
	ammoSeq atomic.Int64
	inflight atomic.Int64
}

type Engine struct {
	mu   sync.Mutex
	runs map[string]*run
}

func newEngine() *Engine {
	return &Engine{runs: map[string]*run{}}
}

func (e *Engine) Start(spec RunSpec) (*Snapshot, error) {
	spec, err := normalizeSpec(spec)
	if err != nil {
		return nil, err
	}
	e.preemptRunning(2 * time.Second)
	ctx, stop := context.WithCancel(context.Background())
	limitMS := spec.DurationMS
	if spec.Count == 0 && limitMS > 0 {
		var timeoutStop context.CancelFunc
		ctx, timeoutStop = context.WithTimeout(ctx, time.Duration(limitMS)*time.Millisecond)
		prev := stop
		stop = func() {
			prev()
			timeoutStop()
		}
	}
	rn := &run{
		id:       newID(),
		spec:     spec,
		status:   StatusRunning,
		phase:    "steady",
		desired:  int32(spec.Workers),
		started:  time.Now(),
		cancel:   stop,
		stats:    newRunStats(),
		done:     make(chan struct{}),
	}
	if spec.Profile == "ramp" || spec.Profile == "hold" {
		rn.phase = "ramp"
		if spec.RPS > 0 {
			rn.desired = int32(spec.Workers)
		} else {
			rn.desired = 1
		}
	}
	e.mu.Lock()
	e.runs[rn.id] = rn
	e.mu.Unlock()
	log.Printf("run %s started  %s %s  workers=%d  target_rps=%.0f  profile=%s  rampMs=%d holdMs=%d durationMs=%d count=%d  timeoutMs=%d",
		rn.id, spec.Method, spec.URL, spec.Workers, spec.RPS, spec.Profile, spec.RampMS, spec.HoldMS, spec.DurationMS, spec.Count, spec.TimeoutMS)
	go e.execute(ctx, rn)
	return e.Snapshot(rn.id), nil
}

func (e *Engine) preemptRunning(wait time.Duration) {
	e.mu.Lock()
	var waiting []chan struct{}
	for _, rn := range e.runs {
		if rn.status == StatusRunning {
			rn.cancel()
			waiting = append(waiting, rn.done)
		}
	}
	e.mu.Unlock()
	deadline := time.Now().Add(wait)
	for _, done := range waiting {
		left := time.Until(deadline)
		if left < 0 {
			left = 0
		}
		select {
		case <-done:
		case <-time.After(left):
			return
		}
	}
}

func waitGroupTimeout(wg *sync.WaitGroup, d time.Duration) {
	ch := make(chan struct{})
	go func() {
		wg.Wait()
		close(ch)
	}()
	select {
	case <-ch:
	case <-time.After(d):
	}
}

func (e *Engine) Stop(id string) *Snapshot {
	e.mu.Lock()
	rn := e.runs[id]
	e.mu.Unlock()
	if rn == nil {
		return nil
	}
	rn.cancel()
	<-rn.done
	return e.Snapshot(id)
}

func (e *Engine) Snapshot(id string) *Snapshot {
	e.mu.Lock()
	rn := e.runs[id]
	e.mu.Unlock()
	if rn == nil {
		return nil
	}
	elapsed := time.Since(rn.started)
	view := rn.stats.snapshot(elapsed)
	spec := rn.spec
	ammoN := len(spec.Ammo)
	spec.Ammo = nil
	return &Snapshot{
		ID:             rn.id,
		Status:         rn.status,
		Error:          rn.err,
		StartedAt:      rn.started.UnixMilli(),
		ElapsedMS:      elapsed.Milliseconds(),
		Phase:          rn.phase,
		DesiredWorkers: int(rn.inflight.Load()),
		Abort:          rn.abort,
		AmmoCount:      ammoN,
		Spec:           spec,
		StatsView:      view,
	}
}

func (e *Engine) execute(ctx context.Context, rn *run) {
	defer close(rn.done)
	transport, client := newLoadClient(rn.spec)
	defer transport.CloseIdleConnections()
	if !rn.spec.FollowRedirects {
		client.CheckRedirect = func(req *http.Request, via []*http.Request) error {
			return http.ErrUseLastResponse
		}
	}

	var remaining atomic.Int64
	remaining.Store(rn.spec.Count)
	pace := newPacer()
	pace.start(ctx, func() float64 {
		return currentRPS(rn.spec, time.Since(rn.started))
	})

	stopSched := make(chan struct{})
	schedDone := make(chan struct{})
	go func() {
		defer close(schedDone)
		e.schedule(ctx, rn, stopSched)
	}()

	if rn.spec.RPS > 0 {
		e.runOpenLoop(ctx, rn, &client, pace, &remaining)
	} else {
		e.runClosedLoop(ctx, rn, &client, pace, &remaining)
	}

	close(stopSched)
	<-schedDone
	ctxErr := ctx.Err()
	rn.cancel()
	<-pace.done

	e.mu.Lock()
	if rn.abort != "" {
		rn.status = StatusAborted
	} else if rn.endOK.Load() || ctxErr == context.DeadlineExceeded {
		rn.status = StatusDone
	} else if ctxErr == context.Canceled {
		rn.status = StatusStopped
	} else {
		rn.status = StatusDone
	}
	e.mu.Unlock()
}

func dispatcherCount(rps float64) int {
	n := int(rps / 500)
	if n < 16 {
		n = 16
	}
	if n > 512 {
		n = 512
	}
	procs := runtime.GOMAXPROCS(0) * 8
	if procs > n {
		n = procs
	}
	if n > 512 {
		n = 512
	}
	return n
}

// runOpenLoop starts a request for every pacer token. In-flight count follows
// RPS×latency (Little's law) up to maxWorkers only as an OOM guard.
func (e *Engine) runOpenLoop(ctx context.Context, rn *run, client *http.Client, pace *pacer, remaining *atomic.Int64) {
	oom := int64(oomInFlight(rn.spec))
	var inflight sync.WaitGroup
	var disp sync.WaitGroup
	for i := 0; i < dispatcherCount(rn.spec.RPS); i++ {
		disp.Add(1)
		go func() {
			defer disp.Done()
			for {
				if ctx.Err() != nil {
					return
				}
				if rn.spec.Count > 0 && remaining.Load() <= 0 {
					return
				}
				if rn.spec.Count > 0 {
					left := remaining.Add(-1)
					if left < 0 {
						return
					}
				}
				if pace.wait(ctx, currentRPS(rn.spec, time.Since(rn.started))) != nil {
					return
				}
				for {
					if ctx.Err() != nil {
						return
					}
					if rn.inflight.Load() < oom {
						break
					}
					runtime.Gosched()
				}
				inflight.Add(1)
				go func() {
					defer inflight.Done()
					e.fire(ctx, client, rn)
				}()
			}
		}()
	}
	disp.Wait()
	waitGroupTimeout(&inflight, 2*time.Second)
}

func (e *Engine) runClosedLoop(ctx context.Context, rn *run, client *http.Client, pace *pacer, remaining *atomic.Int64) {
	var wg sync.WaitGroup
	for i := 0; i < rn.spec.Workers; i++ {
		wg.Add(1)
		go func(idx int) {
			defer wg.Done()
			for {
				if ctx.Err() != nil {
					return
				}
				if rn.spec.Count > 0 && remaining.Load() <= 0 {
					return
				}
				if int32(idx) >= atomic.LoadInt32(&rn.desired) {
					timer := time.NewTimer(20 * time.Millisecond)
					select {
					case <-ctx.Done():
						timer.Stop()
						return
					case <-timer.C:
					}
					continue
				}
				if rn.spec.Count > 0 {
					left := remaining.Add(-1)
					if left < 0 {
						return
					}
				}
				if pace.wait(ctx, currentRPS(rn.spec, time.Since(rn.started))) != nil {
					return
				}
				e.fire(ctx, client, rn)
			}
		}(i)
	}
	wg.Wait()
}

func (e *Engine) schedule(ctx context.Context, rn *run, stop <-chan struct{}) {
	tick := time.NewTicker(50 * time.Millisecond)
	defer tick.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-stop:
			return
		case <-tick.C:
			elapsed := time.Since(rn.started)
			desired, phase, finished := desiredAt(rn.spec, elapsed)
			atomic.StoreInt32(&rn.desired, int32(desired))
			rn.phase = phase
			if reason := checkAbort(rn.spec, rn.stats, elapsed); reason != "" {
				rn.abort = reason
				rn.cancel()
				return
			}
			if finished {
				rn.endOK.Store(true)
				rn.cancel()
				return
			}
		}
	}
}

func newLoadClient(spec RunSpec) (*http.Transport, http.Client) {
	n := spec.Workers
	if n < 8192 {
		n = 8192
	}
	idle := n * 2
	if idle > 8192 {
		idle = 8192
	}
	transport := &http.Transport{
		Proxy:                 http.ProxyFromEnvironment,
		DialContext:           (&net.Dialer{Timeout: 30 * time.Second, KeepAlive: 30 * time.Second}).DialContext,
		ForceAttemptHTTP2:     false,
		MaxIdleConns:          idle,
		MaxIdleConnsPerHost:   idle,
		IdleConnTimeout:       90 * time.Second,
		TLSHandshakeTimeout:   10 * time.Second,
		ExpectContinueTimeout: 1 * time.Second,
		DisableCompression:    true,
		DisableKeepAlives:     false,
	}
	client := http.Client{
		Timeout:   time.Duration(spec.TimeoutMS) * time.Millisecond,
		Transport: transport,
	}
	return transport, client
}

func (e *Engine) fire(ctx context.Context, client *http.Client, rn *run) {
	rn.inflight.Add(1)
	defer rn.inflight.Add(-1)
	seq := rn.ammoSeq.Add(1)
	method, rawURL, body, headers, comp := pickShot(rn, seq)
	ok := e.doHTTP(ctx, client, rn, method, rawURL, body, headers, true)
	if !ok || ctx.Err() != nil || comp == nil {
		return
	}
	cMethod := firstNonEmpty(comp.Method, "DELETE")
	cURL := firstNonEmpty(comp.URL, rn.spec.URL)
	cBody := comp.Body
	cHeaders := mergeHeaders(rn.spec.Headers, comp.Headers)
	okComp := e.doHTTP(ctx, client, rn, cMethod, applyN(cURL, seq), applyN(cBody, seq), cHeaders, false)
	if okComp {
		rn.stats.compOK.Add(1)
	} else if ctx.Err() == nil {
		rn.stats.compFail.Add(1)
	}
}

func pickShot(rn *run, seq int64) (method, rawURL, body string, headers map[string]string, comp *AmmoRound) {
	method = rn.spec.Method
	rawURL = rn.spec.URL
	body = rn.spec.Body
	headers = rn.spec.Headers
	comp = rn.spec.Compensate
	n := len(rn.spec.Ammo)
	if n == 0 {
		return method, applyN(rawURL, seq), applyN(body, seq), headers, comp
	}
	idx := int((seq - 1) % int64(n))
	if rn.spec.AmmoMode == "random" {
		idx = mrand.Intn(n)
	}
	a := rn.spec.Ammo[idx]
	if a.Method != "" {
		method = a.Method
	}
	if a.URL != "" {
		rawURL = a.URL
	}
	if a.Body != "" {
		body = a.Body
	}
	headers = mergeHeaders(headers, a.Headers)
	if a.Compensate != nil {
		comp = a.Compensate
	}
	return method, applyN(rawURL, seq), applyN(body, seq), headers, comp
}

func mergeHeaders(base, extra map[string]string) map[string]string {
	if len(extra) == 0 {
		return base
	}
	out := map[string]string{}
	for k, v := range base {
		out[k] = v
	}
	for k, v := range extra {
		out[k] = v
	}
	return out
}

func applyN(s string, n int64) string {
	if s == "" || !strings.Contains(s, "{n}") {
		return s
	}
	return strings.ReplaceAll(s, "{n}", strconv.FormatInt(n, 10))
}

func firstNonEmpty(a, b string) string {
	if strings.TrimSpace(a) != "" {
		return a
	}
	return b
}

func (e *Engine) doHTTP(ctx context.Context, client *http.Client, rn *run, method, rawURL, bodyRaw string, headers map[string]string, countRPS bool) bool {
	var body io.Reader
	if bodyRaw != "" && method != "GET" && method != "HEAD" {
		body = strings.NewReader(bodyRaw)
	}
	req, err := http.NewRequestWithContext(ctx, method, rawURL, body)
	if err != nil {
		if countRPS {
			rn.stats.record(0, 0, 0, false, false, true)
		}
		return false
	}
	for k, v := range headers {
		req.Header.Set(k, v)
	}
	start := time.Now()
	res, err := client.Do(req)
	lat := time.Since(start)
	if err != nil {
		if ctx.Err() != nil {
			return false
		}
		timedOut := strings.Contains(err.Error(), "Timeout") || strings.Contains(err.Error(), "timeout") || strings.Contains(err.Error(), "deadline")
		if countRPS {
			rn.stats.record(0, lat, 0, timedOut, false, true)
		}
		return false
	}
	bufp := bodyBufPool.Get().(*[]byte)
	n, _ := io.CopyBuffer(io.Discard, io.LimitReader(res.Body, maxBodyRead), *bufp)
	bodyBufPool.Put(bufp)
	res.Body.Close()
	ok := res.StatusCode < 400
	if countRPS {
		rn.stats.record(res.StatusCode, lat, n, false, ok, true)
	}
	return ok
}

func newID() string {
	var b [8]byte
	_, _ = rand.Read(b[:])
	return hex.EncodeToString(b[:])
}
