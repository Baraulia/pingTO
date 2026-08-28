package main

import (
	"math"
	"time"
)

func desiredAt(spec RunSpec, elapsed time.Duration) (desired int, phase string, finished bool) {
	peak := spec.Workers
	if peak < 1 {
		peak = 1
	}
	switch spec.Profile {
	case "ramp":
		ramp := time.Duration(spec.RampMS) * time.Millisecond
		if ramp <= 0 || elapsed >= ramp {
			return peak, "ramp", true
		}
		return scaleWorkers(peak, float64(elapsed)/float64(ramp)), "ramp", false
	case "hold":
		ramp := time.Duration(spec.RampMS) * time.Millisecond
		hold := time.Duration(spec.HoldMS) * time.Millisecond
		if elapsed >= ramp+hold {
			return peak, "hold", true
		}
		if ramp > 0 && elapsed < ramp {
			return scaleWorkers(peak, float64(elapsed)/float64(ramp)), "ramp", false
		}
		return peak, "hold", false
	default:
		return peak, "steady", false
	}
}

func scaleWorkers(peak int, frac float64) int {
	if frac <= 0 {
		return 1
	}
	if frac >= 1 {
		return peak
	}
	n := int(math.Round(frac * float64(peak)))
	if n < 1 {
		n = 1
	}
	if n > peak {
		n = peak
	}
	return n
}

func currentRPS(spec RunSpec, desired, peak int) float64 {
	if spec.RPS <= 0 {
		return 0
	}
	if peak <= 0 || desired >= peak {
		return spec.RPS
	}
	return spec.RPS * float64(desired) / float64(peak)
}

func checkAbort(spec RunSpec, st *runStats, elapsed time.Duration) string {
	if spec.AbortErrorPct <= 0 && spec.AbortP95MS <= 0 && spec.AbortConsecutive <= 0 {
		return ""
	}
	if spec.AbortGraceMS > 0 && elapsed < time.Duration(spec.AbortGraceMS)*time.Millisecond {
		return ""
	}
	total := st.total.Load()
	if spec.AbortAfter > 0 && total < spec.AbortAfter {
		return ""
	}
	if spec.AbortConsecutive > 0 && st.failStreak.Load() >= spec.AbortConsecutive {
		return "consecutive"
	}
	if spec.AbortErrorPct > 0 && total > 0 {
		bad := float64(st.fail.Load() + st.timeout.Load())
		if 100*bad/float64(total) >= spec.AbortErrorPct {
			return "error_rate"
		}
	}
	if spec.AbortP95MS > 0 && total > 0 {
		view := st.snapshot(elapsed)
		if view.Latency.P95MS >= float64(spec.AbortP95MS) {
			return "p95"
		}
	}
	return ""
}
