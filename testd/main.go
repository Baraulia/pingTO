package main

import (
	"encoding/json"
	"flag"
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"
)

var (
	listenAddr    = flag.String("addr", envOr("PINGTO_ADDR", ":8787"), "listen address")
	baseLatencyMS = flag.Int("latency", envInt("PINGTO_LATENCY_MS", 8), "base handler latency in ms (plus jitter and 2ms CPU)")
)

func main() {
	flag.Parse()
	mux := http.NewServeMux()
	mux.HandleFunc("/", handleCatalog)
	mux.HandleFunc("GET /health", handleHealth)
	mux.HandleFunc("/echo", handleEcho)
	mux.HandleFunc("GET /users/{id}", handleUser)
	mux.HandleFunc("GET /query", handleQuery)
	mux.HandleFunc("GET /headers", handleHeaders)
	mux.HandleFunc("/json", handleJSON)
	mux.HandleFunc("POST /form", handleForm)
	mux.HandleFunc("POST /multipart", handleMultipart)
	mux.HandleFunc("/binary", handleBinary)
	mux.HandleFunc("GET /text", handleText)
	mux.HandleFunc("GET /html", handleHTML)
	mux.HandleFunc("GET /xml", handleXML)
	mux.HandleFunc("GET /status/{code}", handleStatus)
	mux.HandleFunc("GET /delay/{ms}", handleDelay)
	mux.HandleFunc("GET /redirect/{n}", handleRedirect)
	mux.HandleFunc("POST /redirect-keep", handleRedirectKeep)
	mux.HandleFunc("HEAD /head", handleHead)
	mux.HandleFunc("GET /cookies", handleCookiesGet)
	mux.HandleFunc("POST /cookies", handleCookiesSet)
	mux.HandleFunc("GET /auth/bearer", handleBearer)
	mux.HandleFunc("GET /auth/basic", handleBasic)
	mux.HandleFunc("GET /auth/digest", handleDigest)
	mux.HandleFunc("GET /auth/apikey", handleAPIKey)
	mux.HandleFunc("GET /oauth/authorize", handleOAuthAuthorize)
	mux.HandleFunc("POST /oauth/token", handleOAuthToken)
	mux.HandleFunc("GET /auth/oauth", handleOAuthResource)
	mux.HandleFunc("POST /graphql", handleGraphQL)
	mux.HandleFunc("GET /ws/echo", handleWS)
	mux.HandleFunc("GET /sse", handleSSE)
	mux.HandleFunc("GET /bytes/{n}", handleBytes)
	mux.HandleFunc("GET /slow-json", handleSlowJSON)

	srv := &http.Server{
		Addr:              *listenAddr,
		Handler:           withWork(mux),
		ReadHeaderTimeout: 10 * time.Second,
	}
	log.Printf("PingTo testd on http://127.0.0.1%s  latency=%dms  GET / for catalog", httpAddrPort(*listenAddr), *baseLatencyMS)
	log.Fatal(srv.ListenAndServe())
}

func withWork(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Headers", "Authorization, Content-Type, X-API-Key")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		if r.URL.Path != "/ws/echo" && r.URL.Path != "/sse" && r.URL.Path != "/health" && !strings.HasPrefix(r.URL.Path, "/delay/") {
			simulateWork(r)
		}
		next.ServeHTTP(w, r)
	})
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	enc := json.NewEncoder(w)
	enc.SetIndent("", "  ")
	_ = enc.Encode(v)
}

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func envInt(key string, fallback int) int {
	if v := os.Getenv(key); v != "" {
		n, err := strconv.Atoi(v)
		if err == nil {
			return n
		}
	}
	return fallback
}
