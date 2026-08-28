package main

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"io"
	"net/http"
	"strings"
	"sync"
	"sync/atomic"
	"time"
)

const maxBodyRead = 1 << 20

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
		rn.desired = 1
	}
	e.mu.Lock()
	e.runs[rn.id] = rn
	e.mu.Unlock()
	go e.execute(ctx, rn)
	return e.Snapshot(rn.id), nil
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
	return &Snapshot{
		ID:             rn.id,
		Status:         rn.status,
		Error:          rn.err,
		StartedAt:      rn.started.UnixMilli(),
		ElapsedMS:      elapsed.Milliseconds(),
		Phase:          rn.phase,
		DesiredWorkers: int(atomic.LoadInt32(&rn.desired)),
		Abort:          rn.abort,
		Spec:           rn.spec,
		StatsView:      view,
	}
}

func (e *Engine) execute(ctx context.Context, rn *run) {
	defer close(rn.done)
	client := http.Client{
		Timeout: time.Duration(rn.spec.TimeoutMS) * time.Millisecond,
		Transport: &http.Transport{
			MaxIdleConns:        rn.spec.Workers * 4,
			MaxIdleConnsPerHost: rn.spec.Workers * 4,
			DisableCompression:  true,
		},
	}
	if !rn.spec.FollowRedirects {
		client.CheckRedirect = func(req *http.Request, via []*http.Request) error {
			return http.ErrUseLastResponse
		}
	}

	var remaining atomic.Int64
	remaining.Store(rn.spec.Count)
	pace := &pacer{}

	stopSched := make(chan struct{})
	go e.schedule(ctx, rn, stopSched)

	var wg sync.WaitGroup
	for i := 0; i < rn.spec.Workers; i++ {
		wg.Add(1)
		go func(idx int) {
			defer wg.Done()
			for {
				if ctx.Err() != nil {
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
				if pace.wait(ctx, currentRPS(rn.spec, int(atomic.LoadInt32(&rn.desired)), rn.spec.Workers)) != nil {
					return
				}
				e.fire(ctx, &client, rn)
			}
		}(i)
	}
	wg.Wait()
	close(stopSched)
	e.mu.Lock()
	if rn.abort != "" {
		rn.status = StatusAborted
	} else if rn.endOK.Load() || ctx.Err() == context.DeadlineExceeded {
		rn.status = StatusDone
	} else if ctx.Err() == context.Canceled {
		rn.status = StatusStopped
	} else {
		rn.status = StatusDone
	}
	e.mu.Unlock()
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

type pacer struct {
	mu   sync.Mutex
	next time.Time
}

func (p *pacer) wait(ctx context.Context, rps float64) error {
	if rps <= 0 {
		return ctx.Err()
	}
	p.mu.Lock()
	now := time.Now()
	waitUntil := p.next
	gap := time.Duration(float64(time.Second) / rps)
	if gap < time.Microsecond {
		gap = time.Microsecond
	}
	if waitUntil.After(now) {
		p.next = waitUntil.Add(gap)
		p.mu.Unlock()
		timer := time.NewTimer(waitUntil.Sub(now))
		defer timer.Stop()
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-timer.C:
			return nil
		}
	}
	p.next = now.Add(gap)
	p.mu.Unlock()
	return nil
}

func (e *Engine) fire(ctx context.Context, client *http.Client, rn *run) {
	var body io.Reader
	if rn.spec.Body != "" && rn.spec.Method != "GET" && rn.spec.Method != "HEAD" {
		body = strings.NewReader(rn.spec.Body)
	}
	req, err := http.NewRequestWithContext(ctx, rn.spec.Method, rn.spec.URL, body)
	if err != nil {
		rn.stats.record(0, 0, 0, false, false)
		return
	}
	for k, v := range rn.spec.Headers {
		req.Header.Set(k, v)
	}
	start := time.Now()
	res, err := client.Do(req)
	lat := time.Since(start)
	if err != nil {
		timedOut := ctx.Err() == nil && (strings.Contains(err.Error(), "Timeout") || strings.Contains(err.Error(), "timeout") || strings.Contains(err.Error(), "deadline"))
		if ctx.Err() != nil {
			return
		}
		rn.stats.record(0, lat, 0, timedOut, false)
		return
	}
	n, _ := io.Copy(io.Discard, io.LimitReader(res.Body, maxBodyRead))
	res.Body.Close()
	ok := res.StatusCode < 400
	rn.stats.record(res.StatusCode, lat, n, false, ok)
}

func newID() string {
	var b [8]byte
	_, _ = rand.Read(b[:])
	return hex.EncodeToString(b[:])
}
