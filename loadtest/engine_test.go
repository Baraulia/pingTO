package main

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"runtime"
	"strings"
	"testing"
	"time"
)

func TestNormalizeSpec(t *testing.T) {
	_, err := normalizeSpec(RunSpec{URL: "ftp://x"})
	if err == nil {
		t.Fatal("expected url error")
	}
	s, err := normalizeSpec(RunSpec{URL: "http://127.0.0.1/x", Count: 10, Workers: 2})
	if err != nil {
		t.Fatal(err)
	}
	if s.Method != "GET" || s.TimeoutMS != 10000 {
		t.Fatalf("defaults: %+v", s)
	}
	if s.Workers != 2 {
		t.Fatalf("explicit workers %d", s.Workers)
	}
	auto, err := normalizeSpec(RunSpec{URL: "http://127.0.0.1/x", Count: 10, RPS: 10000})
	if err != nil {
		t.Fatal(err)
	}
	if auto.Workers != 0 {
		t.Fatalf("rps run should not invent a client cap, got %d", auto.Workers)
	}
	big, err := normalizeSpec(RunSpec{URL: "http://127.0.0.1/x", DurationMS: 1000, RPS: 100000})
	if err != nil {
		t.Fatal(err)
	}
	if big.RPS != 100000 {
		t.Fatalf("100k rps rejected: %v", big.RPS)
	}
}

func TestEngineCount(t *testing.T) {
	var n int
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		n++
		w.WriteHeader(200)
		_, _ = w.Write([]byte(`{"ok":true}`))
	}))
	defer srv.Close()

	eng := newEngine()
	snap, err := eng.Start(RunSpec{URL: srv.URL, Count: 40, Workers: 8, TimeoutMS: 2000})
	if err != nil {
		t.Fatal(err)
	}
	deadline := time.Now().Add(5 * time.Second)
	for {
		cur := eng.Snapshot(snap.ID)
		if cur.Status != StatusRunning {
			if cur.Total != 40 || cur.OK != 40 {
				t.Fatalf("got total=%d ok=%d status=%s", cur.Total, cur.OK, cur.Status)
			}
			break
		}
		if time.Now().After(deadline) {
			t.Fatal("timeout waiting for run")
		}
		time.Sleep(20 * time.Millisecond)
	}
	if n != 40 {
		t.Fatalf("handler hits %d", n)
	}
}

func TestEngineStop(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		time.Sleep(30 * time.Millisecond)
		w.WriteHeader(204)
	}))
	defer srv.Close()
	eng := newEngine()
	snap, err := eng.Start(RunSpec{URL: srv.URL, DurationMS: 5000, Workers: 4, TimeoutMS: 1000})
	if err != nil {
		t.Fatal(err)
	}
	time.Sleep(80 * time.Millisecond)
	stopped := eng.Stop(snap.ID)
	if stopped.Status != StatusStopped {
		t.Fatalf("status %s", stopped.Status)
	}
	if stopped.Total < 1 {
		t.Fatal("expected some requests")
	}
}

func TestEngineSecondStartDoesNotHang(t *testing.T) {
	block := make(chan struct{})
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		select {
		case <-block:
		case <-r.Context().Done():
		}
		w.WriteHeader(200)
	}))
	defer srv.Close()
	eng := newEngine()
	first, err := eng.Start(RunSpec{URL: srv.URL, DurationMS: 150, RPS: 80, TimeoutMS: 5000})
	if err != nil {
		t.Fatal(err)
	}
	time.Sleep(40 * time.Millisecond)
	began := time.Now()
	second, err := eng.Start(RunSpec{URL: srv.URL, Count: 4, Workers: 2, TimeoutMS: 2000})
	if err != nil {
		t.Fatal(err)
	}
	if time.Since(began) > 4*time.Second {
		t.Fatalf("second start blocked %s", time.Since(began))
	}
	if second.ID == "" || second.ID == first.ID {
		t.Fatalf("want a new run, got first=%s second=%s", first.ID, second.ID)
	}
	close(block)
	cur := waitStatus(t, eng, second.ID, 3*time.Second)
	if cur.Status != StatusDone {
		t.Fatalf("status %s", cur.Status)
	}
}

func TestAgentHTTP(t *testing.T) {
	target := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(201)
	}))
	defer target.Close()
	eng := newEngine()
	agent := httptest.NewServer(newAgentMux(eng))
	defer agent.Close()

	res, err := http.Get(agent.URL + "/health")
	if err != nil {
		t.Fatal(err)
	}
	body, _ := io.ReadAll(res.Body)
	res.Body.Close()
	if res.StatusCode != 200 || !strings.Contains(string(body), "pingto-loadtest") {
		t.Fatalf("health %d %s", res.StatusCode, body)
	}

	payload, _ := json.Marshal(RunSpec{URL: target.URL, Count: 5, Workers: 2, TimeoutMS: 1000})
	res, err = http.Post(agent.URL+"/v1/runs", "application/json", strings.NewReader(string(payload)))
	if err != nil {
		t.Fatal(err)
	}
	var started Snapshot
	if err := json.NewDecoder(res.Body).Decode(&started); err != nil {
		t.Fatal(err)
	}
	res.Body.Close()
	if started.ID == "" {
		t.Fatal("missing id")
	}

	deadline := time.Now().Add(3 * time.Second)
	for {
		res, err = http.Get(agent.URL + "/v1/runs/" + started.ID)
		if err != nil {
			t.Fatal(err)
		}
		var cur Snapshot
		_ = json.NewDecoder(res.Body).Decode(&cur)
		res.Body.Close()
		if cur.Status == StatusDone {
			if cur.Total != 5 {
				t.Fatalf("total %d", cur.Total)
			}
			break
		}
		if time.Now().After(deadline) {
			t.Fatal("run did not finish")
		}
		time.Sleep(20 * time.Millisecond)
	}
}

func TestFireRespectsCancel(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		<-r.Context().Done()
	}))
	defer srv.Close()
	ctx, cancel := context.WithTimeout(context.Background(), 50*time.Millisecond)
	defer cancel()
	eng := newEngine()
	rn := &run{spec: RunSpec{Method: "GET", URL: srv.URL, TimeoutMS: 2000}, stats: newRunStats(), done: make(chan struct{})}
	client := http.Client{Timeout: 2 * time.Second}
	eng.fire(ctx, &client, rn)
}

func TestDesiredAtRamp(t *testing.T) {
	spec := RunSpec{Profile: "ramp", Workers: 10, RampMS: 1000}
	n, phase, done := desiredAt(spec, 0)
	if n != 1 || phase != "ramp" || done {
		t.Fatalf("start %+v %s %v", n, phase, done)
	}
	n, _, done = desiredAt(spec, 500*time.Millisecond)
	if n != 5 || done {
		t.Fatalf("mid %d done=%v", n, done)
	}
	n, _, done = desiredAt(spec, 1000*time.Millisecond)
	if n != 10 || !done {
		t.Fatalf("peak %d done=%v", n, done)
	}
}

func TestDesiredAtHold(t *testing.T) {
	spec := RunSpec{Profile: "hold", Workers: 8, RampMS: 100, HoldMS: 400}
	_, phase, done := desiredAt(spec, 50*time.Millisecond)
	if phase != "ramp" || done {
		t.Fatalf("warmup %s %v", phase, done)
	}
	n, phase, done := desiredAt(spec, 200*time.Millisecond)
	if n != 8 || phase != "hold" || done {
		t.Fatalf("hold %d %s %v", n, phase, done)
	}
	_, _, done = desiredAt(spec, 500*time.Millisecond)
	if !done {
		t.Fatal("should finish")
	}
}

func waitStatus(t *testing.T, eng *Engine, id string, timeout time.Duration) *Snapshot {
	t.Helper()
	deadline := time.Now().Add(timeout)
	for {
		cur := eng.Snapshot(id)
		if cur.Status != StatusRunning {
			return cur
		}
		if time.Now().After(deadline) {
			t.Fatal("timeout waiting for run")
		}
		time.Sleep(15 * time.Millisecond)
	}
}

func TestEngineRampThenStop(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(200)
	}))
	defer srv.Close()
	eng := newEngine()
	snap, err := eng.Start(RunSpec{URL: srv.URL, Profile: "ramp", Workers: 6, RampMS: 250, TimeoutMS: 1000})
	if err != nil {
		t.Fatal(err)
	}
	cur := waitStatus(t, eng, snap.ID, 3*time.Second)
	if cur.Status != StatusDone {
		t.Fatalf("status %s abort=%s", cur.Status, cur.Abort)
	}
	if cur.ElapsedMS < 150 || cur.ElapsedMS > 900 {
		t.Fatalf("elapsed %d", cur.ElapsedMS)
	}
	if cur.Total < 1 {
		t.Fatal("expected traffic during ramp")
	}
}

func TestEngineHold(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(200)
	}))
	defer srv.Close()
	eng := newEngine()
	snap, err := eng.Start(RunSpec{URL: srv.URL, Profile: "hold", Workers: 4, RampMS: 80, HoldMS: 180, TimeoutMS: 1000})
	if err != nil {
		t.Fatal(err)
	}
	cur := waitStatus(t, eng, snap.ID, 3*time.Second)
	if cur.Status != StatusDone {
		t.Fatalf("status %s", cur.Status)
	}
	if cur.ElapsedMS < 180 || cur.ElapsedMS > 900 {
		t.Fatalf("elapsed %d", cur.ElapsedMS)
	}
}

func TestEngineAbortErrorRate(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(503)
	}))
	defer srv.Close()
	eng := newEngine()
	snap, err := eng.Start(RunSpec{
		URL: srv.URL, Count: 5000, Workers: 8, TimeoutMS: 1000,
		AbortErrorPct: 20, AbortAfter: 15, AbortGraceMS: 0,
	})
	if err != nil {
		t.Fatal(err)
	}
	cur := waitStatus(t, eng, snap.ID, 3*time.Second)
	if cur.Status != StatusAborted || cur.Abort != "error_rate" {
		t.Fatalf("got status=%s abort=%s total=%d", cur.Status, cur.Abort, cur.Total)
	}
}

func TestAmmoNAndCompensate(t *testing.T) {
	var posts, deletes int
	var seen strings.Builder
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodPost {
			posts++
			buf, _ := io.ReadAll(r.Body)
			seen.Write(buf)
			seen.WriteByte('|')
			w.WriteHeader(201)
			return
		}
		if r.Method == http.MethodDelete {
			deletes++
			w.WriteHeader(204)
			return
		}
		w.WriteHeader(405)
	}))
	defer srv.Close()
	eng := newEngine()
	snap, err := eng.Start(RunSpec{
		Method: "POST", URL: srv.URL + "/items/{n}", Body: `{"id":{n}}`,
		Count: 8, Workers: 2, TimeoutMS: 1000,
		Compensate: &AmmoRound{Method: "DELETE", URL: srv.URL + "/items/{n}"},
	})
	if err != nil {
		t.Fatal(err)
	}
	cur := waitStatus(t, eng, snap.ID, 3*time.Second)
	if cur.Status != StatusDone || cur.OK != 8 {
		t.Fatalf("status=%s ok=%d", cur.Status, cur.OK)
	}
	if posts != 8 || deletes != 8 {
		t.Fatalf("posts=%d deletes=%d", posts, deletes)
	}
	if cur.CompensateOK != 8 {
		t.Fatalf("compensateOk=%d", cur.CompensateOK)
	}
	if !strings.Contains(seen.String(), `{"id":1}`) {
		t.Fatalf("ammo body %s", seen.String())
	}
}

func TestDeleteAmmoRestoreCompensate(t *testing.T) {
	var deletes, posts int
	bodies := map[string]int{}
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodDelete {
			deletes++
			w.WriteHeader(204)
			return
		}
		if r.Method == http.MethodPost {
			posts++
			buf, _ := io.ReadAll(r.Body)
			bodies[string(buf)]++
			w.WriteHeader(201)
			return
		}
		w.WriteHeader(405)
	}))
	defer srv.Close()
	eng := newEngine()
	snap, err := eng.Start(RunSpec{
		Method: "GET", URL: srv.URL, Count: 4, Workers: 1, TimeoutMS: 1000,
		Ammo: []AmmoRound{
			{
				Method: "DELETE", URL: srv.URL + "/sessions/s-alpha",
				Compensate: &AmmoRound{Method: "POST", URL: srv.URL + "/sessions", Body: `{"id":"s-alpha"}`},
			},
			{
				Method: "DELETE", URL: srv.URL + "/sessions/s-beta",
				Compensate: &AmmoRound{Method: "POST", URL: srv.URL + "/sessions", Body: `{"id":"s-beta"}`},
			},
		},
	})
	if err != nil {
		t.Fatal(err)
	}
	cur := waitStatus(t, eng, snap.ID, 3*time.Second)
	if cur.Status != StatusDone || cur.OK != 4 {
		t.Fatalf("status=%s ok=%d", cur.Status, cur.OK)
	}
	if deletes != 4 || posts != 4 {
		t.Fatalf("deletes=%d posts=%d", deletes, posts)
	}
	if bodies[`{"id":"s-alpha"}`] != 2 || bodies[`{"id":"s-beta"}`] != 2 {
		t.Fatalf("bodies %#v", bodies)
	}
	if cur.CompensateOK != 4 {
		t.Fatalf("compensateOk=%d", cur.CompensateOK)
	}
}

func TestListenAddrLoopback(t *testing.T) {
	if listenAddr("") != "127.0.0.1:8788" || listenAddr(":9") != "127.0.0.1:9" {
		t.Fatal(listenAddr(""), listenAddr(":9"))
	}
	if !isLoopbackAddr("127.0.0.1:8788") || !isLoopbackAddr("[::1]:8788") {
		t.Fatal("loopback")
	}
	if isLoopbackAddr("0.0.0.0:8788") || isLoopbackAddr("192.168.1.2:8788") {
		t.Fatal("non-loopback treated as loopback")
	}
}

func TestWorkersForRPS(t *testing.T) {
	if oomInFlight(RunSpec{RPS: 10000}) != maxWorkers {
		t.Fatalf("oom guard %d", oomInFlight(RunSpec{RPS: 10000}))
	}
	if oomInFlight(RunSpec{Workers: 50}) != 50 {
		t.Fatal("explicit cap")
	}
}

func TestCurrentRPSRampByTime(t *testing.T) {
	spec := RunSpec{Profile: "ramp", RPS: 1000, RampMS: 1000, Workers: 10}
	if v := currentRPS(spec, 0); v != 0 {
		t.Fatalf("start %v", v)
	}
	mid := currentRPS(spec, 500*time.Millisecond)
	if mid < 490 || mid > 510 {
		t.Fatalf("mid %v", mid)
	}
	if currentRPS(spec, time.Second) != 1000 {
		t.Fatalf("peak %v", currentRPS(spec, time.Second))
	}
}

func TestDesiredAtRampKeepsPoolWhenRPSSet(t *testing.T) {
	spec := RunSpec{Profile: "ramp", Workers: 80, RampMS: 1000, RPS: 500}
	n, phase, done := desiredAt(spec, 100*time.Millisecond)
	if n != 80 || phase != "ramp" || done {
		t.Fatalf("got n=%d phase=%s done=%v", n, phase, done)
	}
	_, phase, done = desiredAt(spec, 1000*time.Millisecond)
	if phase != "hold" || done {
		t.Fatalf("at peak %s done=%v", phase, done)
	}
	_, _, done = desiredAt(spec, time.Duration(1000+rampPeakDwellMS)*time.Millisecond)
	if !done {
		t.Fatal("should finish after peak dwell")
	}
}

func TestEngineApproachesTargetRPS(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(200)
	}))
	defer srv.Close()
	eng := newEngine()
	snap, err := eng.Start(RunSpec{
		URL: srv.URL, Profile: "constant", DurationMS: 800, RPS: 400, TimeoutMS: 2000,
	})
	if err != nil {
		t.Fatal(err)
	}
	cur := waitStatus(t, eng, snap.ID, 4*time.Second)
	if cur.Status != StatusDone {
		t.Fatalf("status %s", cur.Status)
	}
	if cur.RPSMax < 280 {
		t.Fatalf("expected to approach 400 rps, rpsMax=%.1f total=%d workers=%d", cur.RPSMax, cur.Total, cur.Spec.Workers)
	}
}

func TestPacerStopsWhenCanceled(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	p := newPacer()
	p.start(ctx, func() float64 { return 5000 })
	time.Sleep(15 * time.Millisecond)
	cancel()
	select {
	case <-p.done:
	case <-time.After(2 * time.Second):
		t.Fatal("pacer goroutine did not park")
	}
}

func TestCountRunParksSpareWorkers(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(200)
	}))
	defer srv.Close()
	time.Sleep(20 * time.Millisecond)
	before := runtime.NumGoroutine()
	eng := newEngine()
	snap, err := eng.Start(RunSpec{URL: srv.URL, Count: 8, Workers: 64, TimeoutMS: 1000})
	if err != nil {
		t.Fatal(err)
	}
	cur := waitStatus(t, eng, snap.ID, 3*time.Second)
	if cur.Status != StatusDone || cur.Total != 8 {
		t.Fatalf("status=%s total=%d", cur.Status, cur.Total)
	}
	time.Sleep(80 * time.Millisecond)
	after := runtime.NumGoroutine()
	if after > before+12 {
		t.Fatalf("goroutines still running after count run: before=%d after=%d", before, after)
	}
}
