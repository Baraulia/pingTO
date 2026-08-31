package main

import (
	"net/http"
	"testing"
	"time"
)

func TestSimulateWorkSkippedAtZeroLatency(t *testing.T) {
	zero := 0
	baseLatencyMS = &zero
	req, _ := http.NewRequest(http.MethodGet, "http://127.0.0.1/json", nil)
	start := time.Now()
	for i := 0; i < 20; i++ {
		simulateWork(req)
	}
	if time.Since(start) > 20*time.Millisecond {
		t.Fatalf("zero latency should not sleep/busy, took %s", time.Since(start))
	}
}

func TestSimulateWorkHonorsDelayQuery(t *testing.T) {
	zero := 0
	baseLatencyMS = &zero
	req, _ := http.NewRequest(http.MethodGet, "http://127.0.0.1/json?delay=40", nil)
	start := time.Now()
	simulateWork(req)
	if time.Since(start) < 30*time.Millisecond {
		t.Fatalf("expected delay, took %s", time.Since(start))
	}
}
