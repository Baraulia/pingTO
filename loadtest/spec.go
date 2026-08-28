package main

import (
	"fmt"
	"net/url"
	"strings"
)

const (
	maxWorkers    = 200
	maxDurationMS = 600_000
	maxCount      = 1_000_000
	maxRPS        = 10_000
	maxTimeoutMS  = 120_000
	minTimeoutMS  = 50
)

var allowedMethods = map[string]bool{
	"GET": true, "POST": true, "PUT": true, "PATCH": true,
	"DELETE": true, "OPTIONS": true, "HEAD": true,
}

// RunSpec is the JSON body of POST /v1/runs.
type RunSpec struct {
	Method           string            `json:"method"`
	URL              string            `json:"url"`
	Headers          map[string]string `json:"headers"`
	Body             string            `json:"body"`
	Workers          int               `json:"workers"`
	DurationMS       int               `json:"durationMs"`
	Count            int64             `json:"count"`
	RPS              float64           `json:"rps"`
	TimeoutMS        int               `json:"timeoutMs"`
	FollowRedirects  bool              `json:"followRedirects"`
	Profile          string            `json:"profile"`
	RampMS           int               `json:"rampMs"`
	HoldMS           int               `json:"holdMs"`
	AbortErrorPct    float64           `json:"abortErrorPct"`
	AbortP95MS       int               `json:"abortP95Ms"`
	AbortConsecutive int64             `json:"abortConsecutive"`
	AbortAfter       int64             `json:"abortAfter"`
	AbortGraceMS     int               `json:"abortGraceMs"`
}

func normalizeSpec(s RunSpec) (RunSpec, error) {
	s.Method = strings.ToUpper(strings.TrimSpace(s.Method))
	if s.Method == "" {
		s.Method = "GET"
	}
	if !allowedMethods[s.Method] {
		return s, fmt.Errorf("method %s is not allowed", s.Method)
	}
	s.URL = strings.TrimSpace(s.URL)
	u, err := url.Parse(s.URL)
	if err != nil || u.Host == "" || (u.Scheme != "http" && u.Scheme != "https") {
		return s, fmt.Errorf("url must be http(s)")
	}
	if s.Workers <= 0 {
		s.Workers = 10
	}
	if s.Workers > maxWorkers {
		return s, fmt.Errorf("workers max is %d", maxWorkers)
	}
	if s.TimeoutMS <= 0 {
		s.TimeoutMS = 10_000
	}
	if s.TimeoutMS < minTimeoutMS || s.TimeoutMS > maxTimeoutMS {
		return s, fmt.Errorf("timeoutMs must be between %d and %d", minTimeoutMS, maxTimeoutMS)
	}
	if s.DurationMS < 0 || s.DurationMS > maxDurationMS {
		return s, fmt.Errorf("durationMs max is %d", maxDurationMS)
	}
	if s.Count < 0 || s.Count > maxCount {
		return s, fmt.Errorf("count max is %d", maxCount)
	}
	if s.RPS < 0 || s.RPS > maxRPS {
		return s, fmt.Errorf("rps max is %d", maxRPS)
	}
	if s.RampMS < 0 || s.RampMS > maxDurationMS {
		return s, fmt.Errorf("rampMs max is %d", maxDurationMS)
	}
	if s.HoldMS < 0 || s.HoldMS > maxDurationMS {
		return s, fmt.Errorf("holdMs max is %d", maxDurationMS)
	}
	s.Profile = strings.ToLower(strings.TrimSpace(s.Profile))
	if s.Profile == "" {
		s.Profile = "constant"
	}
	switch s.Profile {
	case "constant":
		if s.Count == 0 && s.DurationMS == 0 {
			s.DurationMS = 10_000
		}
	case "ramp":
		if s.RampMS <= 0 {
			s.RampMS = 10_000
		}
		s.HoldMS = 0
		s.DurationMS = s.RampMS
	case "hold":
		if s.RampMS == 0 {
			s.RampMS = 1_000
		}
		if s.HoldMS <= 0 {
			s.HoldMS = 10_000
		}
		if s.RampMS+s.HoldMS > maxDurationMS {
			return s, fmt.Errorf("rampMs+holdMs max is %d", maxDurationMS)
		}
		s.DurationMS = s.RampMS + s.HoldMS
	default:
		return s, fmt.Errorf("profile must be constant, ramp, or hold")
	}
	if s.AbortErrorPct < 0 || s.AbortErrorPct > 100 {
		return s, fmt.Errorf("abortErrorPct must be 0–100")
	}
	if s.AbortP95MS < 0 || s.AbortP95MS > maxTimeoutMS {
		return s, fmt.Errorf("abortP95Ms max is %d", maxTimeoutMS)
	}
	if s.AbortConsecutive < 0 || s.AbortConsecutive > 100_000 {
		return s, fmt.Errorf("abortConsecutive is too large")
	}
	if s.AbortAfter < 0 || s.AbortAfter > maxCount {
		return s, fmt.Errorf("abortAfter is too large")
	}
	if s.AbortGraceMS < 0 || s.AbortGraceMS > maxDurationMS {
		return s, fmt.Errorf("abortGraceMs max is %d", maxDurationMS)
	}
	if s.Headers == nil {
		s.Headers = map[string]string{}
	}
	return s, nil
}
