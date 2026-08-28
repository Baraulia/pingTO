package main

import (
	"net/http"
	"strconv"
	"sync"
	"sync/atomic"
)

const maxStoreItems = 200_000

type memStore struct {
	mu       sync.Mutex
	seq      atomic.Int64
	users    map[string]map[string]any
	sessions map[string]map[string]any
}

func newMemStore() *memStore {
	s := &memStore{}
	s.Reset()
	return s
}

var mem = newMemStore()

func (s *memStore) Reset() {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.users = map[string]map[string]any{
		"42": cloneMap(map[string]any{
			"id": "42", "name": "user-42", "email": "user-42@pingto.local",
		}),
	}
	s.sessions = map[string]map[string]any{
		"s-alpha": cloneMap(map[string]any{"id": "s-alpha", "user": "alpha"}),
		"s-beta":  cloneMap(map[string]any{"id": "s-beta", "user": "beta"}),
		"s-gamma": cloneMap(map[string]any{"id": "s-gamma", "user": "gamma"}),
	}
	s.seq.Store(0)
}

func (s *memStore) bucketLocked(kind string) map[string]map[string]any {
	if kind == "sessions" {
		return s.sessions
	}
	return s.users
}

func (s *memStore) Get(kind, id string) (map[string]any, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	row, ok := s.bucketLocked(kind)[id]
	if !ok {
		return nil, false
	}
	return cloneMap(row), true
}

func (s *memStore) List(kind string, limit int) (int, []map[string]any) {
	s.mu.Lock()
	defer s.mu.Unlock()
	b := s.bucketLocked(kind)
	n := len(b)
	if limit <= 0 || limit > n {
		limit = n
	}
	out := make([]map[string]any, 0, limit)
	for _, row := range b {
		if len(out) >= limit {
			break
		}
		out = append(out, cloneMap(row))
	}
	return n, out
}

func (s *memStore) Counts() (users, sessions int) {
	s.mu.Lock()
	defer s.mu.Unlock()
	return len(s.users), len(s.sessions)
}

func (s *memStore) Create(kind string, row map[string]any) (map[string]any, int) {
	s.mu.Lock()
	defer s.mu.Unlock()
	b := s.bucketLocked(kind)
	if len(b) >= maxStoreItems {
		return nil, http.StatusInsufficientStorage
	}
	id := jsonID(row)
	if id == "" {
		id = strconv.FormatInt(s.seq.Add(1), 10)
	}
	if _, exists := b[id]; exists {
		return map[string]any{"id": id, "error": "exists"}, http.StatusConflict
	}
	stored := cloneMap(row)
	stored["id"] = id
	b[id] = stored
	return cloneMap(stored), http.StatusCreated
}

func (s *memStore) Put(kind, id string, row map[string]any) (map[string]any, int) {
	s.mu.Lock()
	defer s.mu.Unlock()
	b := s.bucketLocked(kind)
	_, existed := b[id]
	if !existed && len(b) >= maxStoreItems {
		return nil, http.StatusInsufficientStorage
	}
	stored := cloneMap(row)
	stored["id"] = id
	b[id] = stored
	status := http.StatusOK
	if !existed {
		status = http.StatusCreated
	}
	return cloneMap(stored), status
}

func (s *memStore) Patch(kind, id string, patch map[string]any) (map[string]any, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	b := s.bucketLocked(kind)
	cur, ok := b[id]
	if !ok {
		return nil, false
	}
	stored := cloneMap(cur)
	for k, v := range patch {
		if k == "id" {
			continue
		}
		stored[k] = v
	}
	stored["id"] = id
	b[id] = stored
	return cloneMap(stored), true
}

func (s *memStore) Delete(kind, id string) bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	b := s.bucketLocked(kind)
	if _, ok := b[id]; !ok {
		return false
	}
	delete(b, id)
	return true
}

func jsonID(row map[string]any) string {
	v, ok := row["id"]
	if !ok || v == nil {
		return ""
	}
	switch t := v.(type) {
	case string:
		return t
	case float64:
		if t == float64(int64(t)) {
			return strconv.FormatInt(int64(t), 10)
		}
		return strconv.FormatFloat(t, 'f', -1, 64)
	default:
		return ""
	}
}

func cloneMap(in map[string]any) map[string]any {
	out := make(map[string]any, len(in))
	for k, v := range in {
		out[k] = v
	}
	return out
}
