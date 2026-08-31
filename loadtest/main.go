package main

import (
	"flag"
	"fmt"
	"log"
	"net/http"
	"os"
	"runtime"
	"strings"
	"time"
)

func main() {
	log.SetFlags(log.LstdFlags | log.LUTC | log.Lmsgprefix)
	log.SetPrefix("pingto-loadtest ")
	addr := flag.String("addr", getenv("PINGTO_LOADTEST_ADDR", "127.0.0.1:8788"), "listen address (loopback by default)")
	flag.Parse()
	enableHighResSleep()
	listen := listenAddr(*addr)
	fmt.Fprint(os.Stderr, safetyBanner(listen))
	eng := newEngine()
	srv := &http.Server{
		Addr:              listen,
		Handler:           newAgentMux(eng),
		ReadHeaderTimeout: 10 * time.Second,
		MaxHeaderBytes:    1 << 20,
	}
	log.Printf("ready  POST http://%s/v1/runs  GET /health", srv.Addr)
	log.Fatal(srv.ListenAndServe())
}

const pingtoLogo = `
                 ___
             ___/   \___
            /     o     \
            \___     ___/
                \___/

      ____  _              _____
     |  _ \(_)_ __   __ _|_   _|__
     | |_) | | '_ \ / _' | | |/ _ \
     |  __/| | | | | (_| | | | (_) |
     |_|   |_|_| |_|\__, | |_|\___/
                    |___/
`

func safetyBanner(listen string) string {
	exposure := `LOOPBACK ONLY — other machines on the LAN or Internet cannot
      open this port. Traffic leaves this host only if YOU start
      a run against a remote URL.`
	if !isLoopbackAddr(listen) {
		exposure = `WARNING: this address is NOT loopback. Anyone who can reach
      this host can start load tests (no API key). Bind 127.0.0.1
      unless you fully trust the network.`
	}

	var b strings.Builder
	b.WriteString(pingtoLogo)
	fmt.Fprintf(&b, `
------------------------------------------------------------------------
  load agent — safety
------------------------------------------------------------------------

  What this is
      A local HTTP load generator for the PingTo Chrome extension.
      Not a public SaaS, not a botnet, not a remote-control implant.

  Listen
      http://%s

  Network
      %s

  Authentication
      None, because the default bind is localhost.
      Do not port-forward, tunnel, or firewall-open this port.

  CORS
      Access-Control-Allow-Origin * is only so the extension on this PC
      can call the agent. It is not an invitation to expose the agent.

  Who can start a run
      Only a client that can reach this listen address (normally PingTo
      on this machine). The agent does not poll the internet, does not
      phone home, and does not download jobs.

  What a run does
      HTTP(S) requests to the URL(s) in that run spec only.
      No shell, no writing bodies to disk, no eval of remote scripts,
      no credential harvesting.

  Secrets
      Headers and bodies stay in memory for that run. They are not
      written to disk or to these logs. Do not paste production secrets
      into a shared spec.

  Telemetry
      None. No crash reports, analytics, or usage pings.

  Caps
      Target RPS up to %.0f (what you ask, not a throughput promise).
      In-flight OOM guard %d goroutines — not a client quota you set.
      %d s duration  ·  %d requests  ·  ammo %d

  Target req/s
      Open-loop: each rate-limiter token starts a request immediately.
      In-flight count = RPS × latency, grown by the machine until RAM/CPU
      give out. 100k or 1M req/s is allowed; a single process rarely
      sustains that against real HTTP.

  This process
      pid %d    %s    GOMAXPROCS=%d    %s/%s

  Stop
      Ctrl+C ends the process.
      POST /v1/runs/{id}/stop ends one run.
      Closing this window stops generation.

  Legal
      Only load-test systems you own or have permission to test.
      High RPS against third-party hosts can be abuse.

------------------------------------------------------------------------

`, listen, exposure, float64(maxRPS), maxWorkers, maxDurationMS/1000, maxCount, maxAmmo,
		os.Getpid(), runtime.Version(), runtime.GOMAXPROCS(0), runtime.GOOS, runtime.GOARCH)
	return b.String()
}

func getenv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
