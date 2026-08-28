package main

import (
	"encoding/json"
	"net/http"
	"strings"
	"time"
)

func newAgentMux(eng *Engine) http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /health", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]any{"ok": true, "service": "pingto-loadtest", "version": "1.0.0"})
	})
	mux.HandleFunc("POST /v1/runs", func(w http.ResponseWriter, r *http.Request) {
		var spec RunSpec
		if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 8<<20)).Decode(&spec); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid json"})
			return
		}
		snap, err := eng.Start(spec)
		if err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusAccepted, snap)
	})
	mux.HandleFunc("GET /v1/runs/{id}", func(w http.ResponseWriter, r *http.Request) {
		snap := eng.Snapshot(r.PathValue("id"))
		if snap == nil {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "run not found"})
			return
		}
		writeJSON(w, http.StatusOK, snap)
	})
	mux.HandleFunc("POST /v1/runs/{id}/stop", func(w http.ResponseWriter, r *http.Request) {
		snap := eng.Stop(r.PathValue("id"))
		if snap == nil {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "run not found"})
			return
		}
		writeJSON(w, http.StatusOK, snap)
	})
	mux.HandleFunc("GET /v1/runs/{id}/events", func(w http.ResponseWriter, r *http.Request) {
		id := r.PathValue("id")
		if eng.Snapshot(id) == nil {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "run not found"})
			return
		}
		flusher, ok := w.(http.Flusher)
		if !ok {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "stream unsupported"})
			return
		}
		w.Header().Set("Content-Type", "text/event-stream")
		w.Header().Set("Cache-Control", "no-cache")
		w.Header().Set("Connection", "keep-alive")
		tick := time.NewTicker(200 * time.Millisecond)
		defer tick.Stop()
		for {
			snap := eng.Snapshot(id)
			if snap == nil {
				return
			}
			payload, _ := json.Marshal(snap)
			_, _ = w.Write([]byte("data: "))
			_, _ = w.Write(payload)
			_, _ = w.Write([]byte("\n\n"))
			flusher.Flush()
			if snap.Status != StatusRunning {
				return
			}
			select {
			case <-r.Context().Done():
				return
			case <-tick.C:
			}
		}
	})
	return withCORS(mux)
}

func withCORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func listenAddr(raw string) string {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return "127.0.0.1:8788"
	}
	if strings.HasPrefix(raw, ":") {
		return "127.0.0.1" + raw
	}
	return raw
}
