package main

import (
	"math/rand/v2"
	"net/http"
	"strconv"
	"sync/atomic"
	"time"
)

var cpuSink atomic.Uint64

func simulateWork(r *http.Request) {
	extra := 0
	if raw := r.URL.Query().Get("delay"); raw != "" {
		extra, _ = strconv.Atoi(raw)
		if extra < 0 {
			extra = 0
		}
	}
	baseMS := 0
	if baseLatencyMS != nil {
		baseMS = *baseLatencyMS
	}
	if baseMS <= 0 && extra <= 0 {
		return
	}
	var jitter time.Duration
	if baseMS > 0 {
		jitter = time.Duration(rand.IntN(8)) * time.Millisecond
		busy(2 * time.Millisecond)
	}
	time.Sleep(time.Duration(baseMS)*time.Millisecond + jitter + time.Duration(extra)*time.Millisecond)
}

func busy(d time.Duration) {
	end := time.Now().Add(d)
	x := uint64(time.Now().UnixNano())
	for time.Now().Before(end) {
		x = x*1664525 + 1013904223
	}
	cpuSink.Store(x)
}
