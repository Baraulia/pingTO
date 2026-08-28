package main

import (
	"encoding/json"
	"io"
	"net/http"
	"strings"
)

func registerResource(mux *http.ServeMux, base, kind string) {
	mux.HandleFunc("GET "+base, func(w http.ResponseWriter, r *http.Request) {
		handleList(w, r, kind)
	})
	mux.HandleFunc("POST "+base, func(w http.ResponseWriter, r *http.Request) {
		handleCreate(w, r, kind, base)
	})
	mux.HandleFunc("GET "+base+"/{id}", func(w http.ResponseWriter, r *http.Request) {
		handleGet(w, r, kind)
	})
	mux.HandleFunc("PUT "+base+"/{id}", func(w http.ResponseWriter, r *http.Request) {
		handlePut(w, r, kind)
	})
	mux.HandleFunc("PATCH "+base+"/{id}", func(w http.ResponseWriter, r *http.Request) {
		handlePatch(w, r, kind)
	})
	mux.HandleFunc("DELETE "+base+"/{id}", func(w http.ResponseWriter, r *http.Request) {
		handleDelete(w, r, kind)
	})
}

func handleList(w http.ResponseWriter, r *http.Request, kind string) {
	count, items := mem.List(kind, 50)
	writeJSON(w, http.StatusOK, map[string]any{"count": count, "items": items})
}

func handleGet(w http.ResponseWriter, r *http.Request, kind string) {
	id := r.PathValue("id")
	row, ok := mem.Get(kind, id)
	if !ok {
		writeJSON(w, http.StatusNotFound, map[string]any{"error": "not found", "id": id})
		return
	}
	writeJSON(w, http.StatusOK, row)
}

func handleCreate(w http.ResponseWriter, r *http.Request, kind, base string) {
	row, err := readJSONObject(r)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"error": "invalid json", "detail": err.Error()})
		return
	}
	stored, status := mem.Create(kind, row)
	if status != http.StatusCreated {
		if status == http.StatusConflict {
			writeJSON(w, status, map[string]any{"error": "exists", "id": stored["id"]})
			return
		}
		writeJSON(w, status, map[string]any{"error": "store full"})
		return
	}
	id, _ := stored["id"].(string)
	w.Header().Set("Location", strings.TrimSuffix(base, "/")+"/"+id)
	writeJSON(w, http.StatusCreated, stored)
}

func handlePut(w http.ResponseWriter, r *http.Request, kind string) {
	id := r.PathValue("id")
	row, err := readJSONObject(r)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"error": "invalid json", "detail": err.Error()})
		return
	}
	stored, status := mem.Put(kind, id, row)
	if status == http.StatusInsufficientStorage {
		writeJSON(w, status, map[string]any{"error": "store full"})
		return
	}
	writeJSON(w, status, stored)
}

func handlePatch(w http.ResponseWriter, r *http.Request, kind string) {
	id := r.PathValue("id")
	patch, err := readJSONObject(r)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"error": "invalid json", "detail": err.Error()})
		return
	}
	stored, ok := mem.Patch(kind, id, patch)
	if !ok {
		writeJSON(w, http.StatusNotFound, map[string]any{"error": "not found", "id": id})
		return
	}
	writeJSON(w, http.StatusOK, stored)
}

func handleDelete(w http.ResponseWriter, r *http.Request, kind string) {
	id := r.PathValue("id")
	if !mem.Delete(kind, id) {
		writeJSON(w, http.StatusNotFound, map[string]any{"error": "not found", "id": id})
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func handleStats(w http.ResponseWriter, r *http.Request) {
	users, sessions := mem.Counts()
	writeJSON(w, http.StatusOK, map[string]any{"users": users, "sessions": sessions})
}

func handleReset(w http.ResponseWriter, r *http.Request) {
	mem.Reset()
	users, sessions := mem.Counts()
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "users": users, "sessions": sessions})
}

func readJSONObject(r *http.Request) (map[string]any, error) {
	raw, err := io.ReadAll(io.LimitReader(r.Body, 2<<20))
	if err != nil {
		return nil, err
	}
	var row map[string]any
	if err := json.Unmarshal(raw, &row); err != nil {
		return nil, err
	}
	if row == nil {
		row = map[string]any{}
	}
	return row, nil
}
