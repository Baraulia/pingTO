package main

import (
	"testing"
	"time"
)

func TestCheckAbortConsecutiveIgnoresTransportErrors(t *testing.T) {
	st := newRunStats()
	spec := RunSpec{AbortConsecutive: 5, AbortAfter: 1}
	for i := 0; i < 40; i++ {
		st.record(0, time.Millisecond, 0, false, false, true)
	}
	if got := checkAbort(spec, st, time.Second); got != "" {
		t.Fatalf("transport errors should not trip consecutive abort, got %q", got)
	}
	if st.codes[0] != 40 {
		t.Fatalf("want 40 network outcomes, got %d", st.codes[0])
	}
	for i := 0; i < 5; i++ {
		st.record(503, time.Millisecond, 0, false, false, true)
	}
	if got := checkAbort(spec, st, time.Second); got != "consecutive" {
		t.Fatalf("HTTP 503 streak: got %q", got)
	}
}

func TestCheckAbortConsecutiveTimeouts(t *testing.T) {
	st := newRunStats()
	spec := RunSpec{AbortConsecutive: 3, AbortAfter: 1}
	for i := 0; i < 3; i++ {
		st.record(0, time.Second, 0, true, false, true)
	}
	if got := checkAbort(spec, st, time.Second); got != "consecutive" {
		t.Fatalf("timeouts: got %q", got)
	}
}

func TestCheckAbortErrorRateStillSeesTransport(t *testing.T) {
	st := newRunStats()
	spec := RunSpec{AbortErrorPct: 20, AbortAfter: 10}
	for i := 0; i < 8; i++ {
		st.record(200, time.Millisecond, 10, false, true, true)
	}
	for i := 0; i < 3; i++ {
		st.record(0, time.Millisecond, 0, false, false, true)
	}
	if got := checkAbort(spec, st, time.Second); got != "error_rate" {
		t.Fatalf("got %q", got)
	}
}

func TestCheckAbortSuccessResetsHTTPStreak(t *testing.T) {
	st := newRunStats()
	spec := RunSpec{AbortConsecutive: 3, AbortAfter: 1}
	st.record(500, time.Millisecond, 0, false, false, true)
	st.record(500, time.Millisecond, 0, false, false, true)
	st.record(200, time.Millisecond, 10, false, true, true)
	st.record(500, time.Millisecond, 0, false, false, true)
	if got := checkAbort(spec, st, time.Second); got != "" {
		t.Fatalf("streak should reset on 200, got %q", got)
	}
}
