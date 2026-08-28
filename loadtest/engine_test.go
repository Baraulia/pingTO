package main

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
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
