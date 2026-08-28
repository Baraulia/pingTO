package main

import (
	"flag"
	"log"
	"net/http"
	"os"
	"time"
)

func main() {
	addr := flag.String("addr", getenv("PINGTO_LOADTEST_ADDR", "127.0.0.1:8788"), "listen address (loopback by default)")
	flag.Parse()
	eng := newEngine()
	srv := &http.Server{
		Addr:              listenAddr(*addr),
		Handler:           newAgentMux(eng),
		ReadHeaderTimeout: 10 * time.Second,
	}
	log.Printf("PingTo loadtest agent on http://%s  POST /v1/runs", srv.Addr)
	log.Fatal(srv.ListenAndServe())
}

func getenv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
