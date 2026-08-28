package main

import (
	"math/rand"
	"sort"
	"strconv"
	"sync"
	"sync/atomic"
	"time"
)

type runStats struct {
	total   atomic.Int64
	ok      atomic.Int64
	fail    atomic.Int64
	timeout atomic.Int64
	bytesIn atomic.Int64
	failStreak atomic.Int64

	codesMu sync.Mutex
	codes   map[int]int64

	latMu  sync.Mutex
	minNS  int64
	maxNS  int64
	sumNS  int64
	sample []int64
	seen   int64
}

const sampleCap = 4096

func newRunStats() *runStats {
	return &runStats{codes: map[int]int64{}, minNS: -1, sample: make([]int64, 0, sampleCap)}
}

func (s *runStats) record(status int, lat time.Duration, n int64, timedOut, ok bool) {
	s.total.Add(1)
	if timedOut {
		s.timeout.Add(1)
	} else if ok {
		s.ok.Add(1)
	} else {
		s.fail.Add(1)
	}
	s.bytesIn.Add(n)
	if timedOut || !ok {
		s.failStreak.Add(1)
	} else {
		s.failStreak.Store(0)
	}
	if status > 0 {
		s.codesMu.Lock()
		s.codes[status]++
		s.codesMu.Unlock()
	}
	ns := lat.Nanoseconds()
	if ns < 0 {
		return
	}
	s.latMu.Lock()
	s.seen++
	if s.minNS < 0 || ns < s.minNS {
		s.minNS = ns
	}
	if ns > s.maxNS {
		s.maxNS = ns
	}
	s.sumNS += ns
	if len(s.sample) < sampleCap {
		s.sample = append(s.sample, ns)
	} else if rand.Int63n(s.seen) < sampleCap {
		s.sample[rand.Intn(sampleCap)] = ns
	}
	s.latMu.Unlock()
}

func (s *runStats) snapshot(elapsed time.Duration) StatsView {
	total := s.total.Load()
	view := StatsView{
		Total:       total,
		OK:          s.ok.Load(),
		Fail:        s.fail.Load(),
		Timeout:     s.timeout.Load(),
		BytesIn:     s.bytesIn.Load(),
		StatusCodes: map[string]int64{},
	}
	if total > 0 {
		view.ErrorRate = float64(view.Fail+view.Timeout) / float64(total)
	}
	sec := elapsed.Seconds()
	if sec > 0 {
		view.RPS = float64(total) / sec
	}
	s.codesMu.Lock()
	for code, n := range s.codes {
		view.StatusCodes[strconv.Itoa(code)] = n
	}
	s.codesMu.Unlock()

	s.latMu.Lock()
	defer s.latMu.Unlock()
	if s.seen == 0 {
		return view
	}
	view.Latency = LatencyView{
		MinMS: float64(s.minNS) / 1e6,
		MaxMS: float64(s.maxNS) / 1e6,
		AvgMS: float64(s.sumNS) / float64(s.seen) / 1e6,
		P50MS: percentile(s.sample, 50),
		P95MS: percentile(s.sample, 95),
		P99MS: percentile(s.sample, 99),
	}
	return view
}

func percentile(sample []int64, p int) float64 {
	if len(sample) == 0 {
		return 0
	}
	cp := append([]int64(nil), sample...)
	sort.Slice(cp, func(i, j int) bool { return cp[i] < cp[j] })
	idx := (p * (len(cp) - 1)) / 100
	return float64(cp[idx]) / 1e6
}

type LatencyView struct {
	MinMS float64 `json:"minMs"`
	MaxMS float64 `json:"maxMs"`
	AvgMS float64 `json:"avgMs"`
	P50MS float64 `json:"p50Ms"`
	P95MS float64 `json:"p95Ms"`
	P99MS float64 `json:"p99Ms"`
}

type StatsView struct {
	Total       int64            `json:"total"`
	OK          int64            `json:"ok"`
	Fail        int64            `json:"fail"`
	Timeout     int64            `json:"timeout"`
	RPS         float64          `json:"rps"`
	BytesIn     int64            `json:"bytesIn"`
	ErrorRate   float64          `json:"errorRate"`
	Latency     LatencyView      `json:"latency"`
	StatusCodes map[string]int64 `json:"statusCodes"`
}
