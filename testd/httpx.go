package main

import (
	"encoding/json"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"
)

func handleHealth(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "ts": time.Now().UnixMilli()})
}

func handleEcho(w http.ResponseWriter, r *http.Request) {
	body, _ := io.ReadAll(io.LimitReader(r.Body, 2<<20))
	writeJSON(w, http.StatusOK, map[string]any{
		"method":  r.Method,
		"url":     r.URL.String(),
		"query":   queryMap(r),
		"headers": headerMap(r.Header),
		"body":    string(body),
		"bytes":   len(body),
	})
}

func handleUser(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	writeJSON(w, http.StatusOK, map[string]any{
		"id":    id,
		"name":  "user-" + id,
		"email": "user-" + id + "@pingto.local",
	})
}

func handleQuery(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{"query": queryMap(r)})
}

func handleHeaders(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{"headers": headerMap(r.Header)})
}

func handleJSON(w http.ResponseWriter, r *http.Request) {
	raw, _ := io.ReadAll(io.LimitReader(r.Body, 2<<20))
	var parsed any
	if err := json.Unmarshal(raw, &parsed); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"error": "invalid json", "detail": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"method": r.Method, "json": parsed})
}

func handleForm(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseForm(); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"form": r.PostForm})
}

func handleMultipart(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseMultipartForm(8 << 20); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"error": err.Error()})
		return
	}
	files := map[string]any{}
	if r.MultipartForm != nil {
		for name, fhs := range r.MultipartForm.File {
			list := make([]map[string]any, 0, len(fhs))
			for _, fh := range fhs {
				list = append(list, map[string]any{"filename": fh.Filename, "size": fh.Size, "type": fh.Header.Get("Content-Type")})
			}
			files[name] = list
		}
	}
	writeJSON(w, http.StatusOK, map[string]any{"fields": r.PostForm, "files": files})
}

func handleBinary(w http.ResponseWriter, r *http.Request) {
	raw, _ := io.ReadAll(io.LimitReader(r.Body, 2<<20))
	writeJSON(w, http.StatusOK, map[string]any{
		"bytes":        len(raw),
		"content_type": r.Header.Get("Content-Type"),
	})
}

func handleText(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte("pingto text body\nline 2\n"))
}

func handleHTML(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte(`<!doctype html><html><body style="font-family:sans-serif"><h1>PingTo preview</h1><p>HTML Preview tab.</p></body></html>`))
}

func handleXML(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/xml; charset=utf-8")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte(`<?xml version="1.0"?><root><item id="1">alpha</item><item id="2">beta</item></root>`))
}

func handleStatus(w http.ResponseWriter, r *http.Request) {
	code, err := strconv.Atoi(r.PathValue("code"))
	if err != nil || code < 100 || code > 599 {
		code = 400
	}
	writeJSON(w, code, map[string]any{"status": code, "ok": code >= 200 && code < 300})
}

func handleDelay(w http.ResponseWriter, r *http.Request) {
	ms, _ := strconv.Atoi(r.PathValue("ms"))
	if ms < 0 {
		ms = 0
	}
	if ms > 60000 {
		ms = 60000
	}
	select {
	case <-r.Context().Done():
		return
	case <-time.After(time.Duration(ms) * time.Millisecond):
	}
	writeJSON(w, http.StatusOK, map[string]any{"slept_ms": ms})
}

func handleRedirect(w http.ResponseWriter, r *http.Request) {
	n, _ := strconv.Atoi(r.PathValue("n"))
	if n <= 1 {
		writeJSON(w, http.StatusOK, map[string]any{"done": true, "hops": 1})
		return
	}
	next := "/redirect/" + strconv.Itoa(n-1)
	http.Redirect(w, r, next, http.StatusFound)
}

func handleRedirectKeep(w http.ResponseWriter, r *http.Request) {
	http.Redirect(w, r, "/echo", http.StatusTemporaryRedirect)
}

func handleHead(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("X-PingTo", "head")
	w.WriteHeader(http.StatusOK)
}

func handleCookiesGet(w http.ResponseWriter, r *http.Request) {
	list := make([]map[string]string, 0)
	for _, c := range r.Cookies() {
		list = append(list, map[string]string{"name": c.Name, "value": c.Value})
	}
	writeJSON(w, http.StatusOK, map[string]any{"cookies": list})
}

func handleCookiesSet(w http.ResponseWriter, r *http.Request) {
	name := r.URL.Query().Get("name")
	value := r.URL.Query().Get("value")
	if name == "" {
		var body struct {
			Name  string `json:"name"`
			Value string `json:"value"`
		}
		_ = json.NewDecoder(io.LimitReader(r.Body, 1<<16)).Decode(&body)
		name, value = body.Name, body.Value
	}
	if name == "" {
		name, value = "pingto", "ok"
	}
	http.SetCookie(w, &http.Cookie{Name: name, Value: value, Path: "/", HttpOnly: false})
	writeJSON(w, http.StatusOK, map[string]any{"set": name, "value": value})
}

func handleBytes(w http.ResponseWriter, r *http.Request) {
	n, _ := strconv.Atoi(r.PathValue("n"))
	if n < 0 {
		n = 0
	}
	if n > 3<<20 {
		n = 3 << 20
	}
	w.Header().Set("Content-Type", "application/octet-stream")
	w.WriteHeader(http.StatusOK)
	buf := make([]byte, 4096)
	for i := range buf {
		buf[i] = 'A'
	}
	left := n
	for left > 0 {
		chunk := len(buf)
		if chunk > left {
			chunk = left
		}
		_, _ = w.Write(buf[:chunk])
		left -= chunk
	}
}

func handleSlowJSON(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{
		"ok":      true,
		"code":    200,
		"message": "slow-json",
		"items":   []string{"a", "b", "c"},
	})
}

func queryMap(r *http.Request) map[string][]string {
	return r.URL.Query()
}

func headerMap(h http.Header) map[string]string {
	out := make(map[string]string, len(h))
	for k, v := range h {
		out[k] = strings.Join(v, ", ")
	}
	return out
}
