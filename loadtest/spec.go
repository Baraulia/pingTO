package main

import (
	"fmt"
	"net/url"
	"strings"
)

const (
	maxWorkers      = 500_000
	maxDurationMS   = 600_000
	maxCount        = 1_000_000
	maxRPS          = 1_000_000
	maxTimeoutMS    = 120_000
	minTimeoutMS    = 50
	maxAmmo         = 2_000
	rampPeakDwellMS = 2_000
)

var allowedMethods = map[string]bool{
	"GET": true, "POST": true, "PUT": true, "PATCH": true,
	"DELETE": true, "OPTIONS": true, "HEAD": true,
}

// AmmoRound is one cartridge: optional overrides plus optional compensating request.
type AmmoRound struct {
	Method     string            `json:"method,omitempty"`
	URL        string            `json:"url,omitempty"`
	Headers    map[string]string `json:"headers,omitempty"`
	Body       string            `json:"body,omitempty"`
	Compensate *AmmoRound        `json:"compensate,omitempty"`
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
	Ammo             []AmmoRound       `json:"ammo,omitempty"`
	AmmoMode         string            `json:"ammoMode,omitempty"`
	Compensate       *AmmoRound        `json:"compensate,omitempty"`
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
	if s.Workers < 0 {
		return s, fmt.Errorf("workers cannot be negative")
	}
	if s.Workers > maxWorkers {
		s.Workers = maxWorkers
	}
	if s.Workers == 0 && s.RPS <= 0 {
		s.Workers = 256
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
		return s, fmt.Errorf("rps max is %d (machine still has to keep up)", maxRPS)
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
		if s.RPS > 0 {
			s.DurationMS = s.RampMS + rampPeakDwellMS
		}
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
	s.AmmoMode = strings.ToLower(strings.TrimSpace(s.AmmoMode))
	if s.AmmoMode == "" {
		s.AmmoMode = "roundrobin"
	}
	if s.AmmoMode != "roundrobin" && s.AmmoMode != "random" {
		return s, fmt.Errorf("ammoMode must be roundrobin or random")
	}
	if len(s.Ammo) > maxAmmo {
		return s, fmt.Errorf("ammo max is %d", maxAmmo)
	}
	for i := range s.Ammo {
		if err := normalizeAmmo(&s.Ammo[i], false); err != nil {
			return s, fmt.Errorf("ammo[%d]: %w", i, err)
		}
	}
	if s.Compensate != nil {
		if err := normalizeAmmo(s.Compensate, true); err != nil {
			return s, fmt.Errorf("compensate: %w", err)
		}
		if s.Compensate.Method == "" && s.Compensate.URL == "" && s.Compensate.Body == "" {
			s.Compensate = nil
		}
	}
	return s, nil
}

func oomInFlight(spec RunSpec) int {
	if spec.Workers > 0 && spec.Workers < maxWorkers {
		return spec.Workers
	}
	return maxWorkers
}

func normalizeAmmo(a *AmmoRound, requireMethod bool) error {
	a.Method = strings.ToUpper(strings.TrimSpace(a.Method))
	if a.Method != "" && !allowedMethods[a.Method] {
		return fmt.Errorf("method %s is not allowed", a.Method)
	}
	if requireMethod && a.Method == "" && (strings.TrimSpace(a.URL) != "" || a.Body != "") {
		return fmt.Errorf("method is required")
	}
	a.URL = strings.TrimSpace(a.URL)
	if a.URL != "" {
		u, err := url.Parse(a.URL)
		if err != nil || u.Host == "" || (u.Scheme != "http" && u.Scheme != "https") {
			if !strings.Contains(a.URL, "{n}") {
				return fmt.Errorf("url must be http(s)")
			}
		}
	}
	if a.Compensate != nil {
		if err := normalizeAmmo(a.Compensate, true); err != nil {
			return err
		}
	}
	return nil
}
