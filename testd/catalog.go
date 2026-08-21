package main

import "net/http"

type catalog struct {
	Name     string         `json:"name"`
	Listen   string         `json:"listen"`
	BaseURL  string         `json:"base_url"`
	Accounts map[string]any `json:"accounts"`
	Routes   []routeDoc     `json:"routes"`
}

type routeDoc struct {
	Method string `json:"method"`
	Path   string `json:"path"`
	Use    string `json:"use"`
}

func handleCatalog(w http.ResponseWriter, r *http.Request) {
	if r.URL.Path != "/" {
		writeJSON(w, http.StatusNotFound, map[string]any{"error": "not found", "hint": "GET / for catalog"})
		return
	}
	writeJSON(w, http.StatusOK, catalog{
		Name:    "PingTo testd",
		Listen:  *listenAddr,
		BaseURL: displayBase(*listenAddr),
		Accounts: map[string]any{
			"basic":           map[string]string{"username": "pingto", "password": "pingto"},
			"digest":          map[string]string{"username": "pingto", "password": "pingto", "realm": "pingto"},
			"bearer":          "pingto-token",
			"api_key":         "pingto-key",
			"api_key_header":  "X-API-Key",
			"oauth_client_id": "pingto",
			"oauth_secret":    "pingto-secret",
		},
		Routes: []routeDoc{
			{"GET", "/", "Catalog and credentials"},
			{"GET", "/health", "Liveness"},
			{"ANY", "/echo", "Echo method, query, headers, body"},
			{"GET", "/users/{id}", "Path params"},
			{"GET", "/query", "Query string echo"},
			{"GET", "/headers", "Incoming headers"},
			{"POST|PUT|PATCH", "/json", "JSON body echo"},
			{"POST", "/form", "x-www-form-urlencoded"},
			{"POST", "/multipart", "multipart fields and files"},
			{"POST|PUT", "/binary", "Raw binary body"},
			{"GET", "/text", "Plain text"},
			{"GET", "/html", "HTML for Preview tab"},
			{"GET", "/xml", "XML for pretty view"},
			{"GET", "/status/{code}", "Fixed HTTP status"},
			{"GET", "/delay/{ms}", "Sleep then 200 — timeout/cancel"},
			{"GET", "/redirect/{n}", "302 chain of n hops"},
			{"POST", "/redirect-keep", "307 keep method/body"},
			{"HEAD", "/head", "Empty body"},
			{"OPTIONS", "/echo", "CORS preflight"},
			{"GET", "/cookies", "List cookies"},
			{"POST", "/cookies", "Set cookie name/value from JSON or query"},
			{"GET", "/auth/bearer", "Authorization: Bearer pingto-token"},
			{"GET", "/auth/basic", "Basic pingto:pingto"},
			{"GET", "/auth/digest", "Digest MD5 qop=auth"},
			{"GET", "/auth/apikey", "Header X-API-Key or query api_key"},
			{"GET", "/oauth/authorize", "Auth code + PKCE redirect"},
			{"POST", "/oauth/token", "client_credentials or authorization_code"},
			{"GET", "/auth/oauth", "Bearer issued by /oauth/token"},
			{"POST", "/graphql", "Introspection + ping/user/users"},
			{"GET", "/ws/echo", "WebSocket echo"},
			{"GET", "/sse", "Server-Sent Events"},
			{"GET", "/bytes/{n}", "Payload of n bytes (max 3MiB)"},
			{"GET", "/slow-json", "JSON after work — tests tab"},
		},
	})
}

func displayBase(addr string) string {
	if addr == "" {
		return "http://127.0.0.1:8787"
	}
	if addr[0] == ':' {
		return "http://127.0.0.1" + addr
	}
	return "http://" + addr
}

func httpAddrPort(addr string) string {
	if addr == "" {
		return ":8787"
	}
	if addr[0] == ':' {
		return addr
	}
	if i := lastColon(addr); i >= 0 {
		return addr[i:]
	}
	return ":" + addr
}

func lastColon(s string) int {
	for i := len(s) - 1; i >= 0; i-- {
		if s[i] == ':' {
			return i
		}
	}
	return -1
}
