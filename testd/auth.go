package main

import (
	"crypto/md5"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"encoding/hex"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"
)

const (
	userPass = "pingto"
	apiKey   = "pingto-key"
	bearer   = "pingto-token"
	oauthID  = "pingto"
	oauthSec = "pingto-secret"
	realm    = "pingto"
)

type authCode struct {
	Challenge string
	Created   time.Time
}

var (
	codes   = map[string]authCode{}
	codesMu sync.Mutex
	tokens  = map[string]time.Time{}
	tokMu   sync.Mutex
)

func handleBearer(w http.ResponseWriter, r *http.Request) {
	got := strings.TrimSpace(strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer"))
	got = strings.TrimSpace(got)
	if !tokenOK(got) {
		writeJSON(w, http.StatusUnauthorized, map[string]any{"error": "invalid bearer"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "auth": "bearer"})
}

func handleBasic(w http.ResponseWriter, r *http.Request) {
	u, p, ok := r.BasicAuth()
	if !ok || u != userPass || p != userPass {
		w.Header().Set("WWW-Authenticate", `Basic realm="pingto"`)
		writeJSON(w, http.StatusUnauthorized, map[string]any{"error": "invalid basic"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "auth": "basic", "user": u})
}

func handleDigest(w http.ResponseWriter, r *http.Request) {
	h := r.Header.Get("Authorization")
	if !strings.HasPrefix(strings.ToLower(h), "digest ") {
		nonce := randomHex(16)
		w.Header().Set("WWW-Authenticate", fmt.Sprintf(
			`Digest realm="%s", qop="auth", nonce="%s", opaque="%s", algorithm=MD5`,
			realm, nonce, randomHex(8),
		))
		writeJSON(w, http.StatusUnauthorized, map[string]any{"error": "digest required"})
		return
	}
	params := parseKVAuth(strings.TrimSpace(h[7:]))
	uri := r.URL.RequestURI()
	ha1 := md5hex(userPass + ":" + realm + ":" + userPass)
	ha2 := md5hex(r.Method + ":" + uri)
	var expected string
	if params["qop"] == "auth" {
		expected = md5hex(strings.Join([]string{ha1, params["nonce"], params["nc"], params["cnonce"], params["qop"], ha2}, ":"))
	} else {
		expected = md5hex(ha1 + ":" + params["nonce"] + ":" + ha2)
	}
	if subtle.ConstantTimeCompare([]byte(expected), []byte(params["response"])) != 1 || params["username"] != userPass {
		writeJSON(w, http.StatusUnauthorized, map[string]any{"error": "digest mismatch"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "auth": "digest"})
}

func handleAPIKey(w http.ResponseWriter, r *http.Request) {
	key := r.Header.Get("X-API-Key")
	if key == "" {
		key = r.URL.Query().Get("api_key")
	}
	if key != apiKey {
		writeJSON(w, http.StatusUnauthorized, map[string]any{"error": "invalid api key"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "auth": "apikey"})
}

func handleOAuthAuthorize(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	if q.Get("client_id") != oauthID {
		writeJSON(w, http.StatusBadRequest, map[string]any{"error": "invalid_client"})
		return
	}
	redirect := q.Get("redirect_uri")
	if redirect == "" {
		writeJSON(w, http.StatusBadRequest, map[string]any{"error": "missing redirect_uri"})
		return
	}
	code := randomHex(16)
	codesMu.Lock()
	codes[code] = authCode{Challenge: q.Get("code_challenge"), Created: time.Now()}
	codesMu.Unlock()
	u, err := url.Parse(redirect)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"error": "bad redirect"})
		return
	}
	qq := u.Query()
	qq.Set("code", code)
	if st := q.Get("state"); st != "" {
		qq.Set("state", st)
	}
	u.RawQuery = qq.Encode()
	http.Redirect(w, r, u.String(), http.StatusFound)
}

func handleOAuthToken(w http.ResponseWriter, r *http.Request) {
	_ = r.ParseForm()
	grant := r.FormValue("grant_type")
	id, sec := r.FormValue("client_id"), r.FormValue("client_secret")
	if u, p, ok := r.BasicAuth(); ok {
		if id == "" {
			id = u
		}
		if sec == "" {
			sec = p
		}
	}
	if id != oauthID || (sec != "" && sec != oauthSec) {
		writeJSON(w, http.StatusUnauthorized, map[string]any{"error": "invalid_client"})
		return
	}
	switch grant {
	case "client_credentials":
		tok := issueToken()
		writeJSON(w, http.StatusOK, map[string]any{
			"access_token": tok, "token_type": "Bearer", "expires_in": 3600, "scope": r.FormValue("scope"),
		})
	case "authorization_code":
		code := r.FormValue("code")
		verifier := r.FormValue("code_verifier")
		codesMu.Lock()
		rec, ok := codes[code]
		delete(codes, code)
		codesMu.Unlock()
		if !ok || time.Since(rec.Created) > 10*time.Minute {
			writeJSON(w, http.StatusBadRequest, map[string]any{"error": "invalid_grant"})
			return
		}
		if rec.Challenge != "" && s256(verifier) != rec.Challenge {
			writeJSON(w, http.StatusBadRequest, map[string]any{"error": "invalid_pkce"})
			return
		}
		tok := issueToken()
		writeJSON(w, http.StatusOK, map[string]any{
			"access_token": tok, "token_type": "Bearer", "expires_in": 3600, "refresh_token": issueToken(),
		})
	case "refresh_token":
		if r.FormValue("refresh_token") == "" {
			writeJSON(w, http.StatusBadRequest, map[string]any{"error": "invalid_grant"})
			return
		}
		tok := issueToken()
		writeJSON(w, http.StatusOK, map[string]any{"access_token": tok, "token_type": "Bearer", "expires_in": 3600})
	default:
		writeJSON(w, http.StatusBadRequest, map[string]any{"error": "unsupported_grant_type"})
	}
}

func handleOAuthResource(w http.ResponseWriter, r *http.Request) {
	got := strings.TrimSpace(strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer"))
	got = strings.TrimSpace(got)
	if !issuedOK(got) && got != bearer {
		writeJSON(w, http.StatusUnauthorized, map[string]any{"error": "invalid oauth token"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "auth": "oauth2"})
}

func tokenOK(got string) bool {
	return got == bearer || issuedOK(got)
}

func issuedOK(got string) bool {
	tokMu.Lock()
	defer tokMu.Unlock()
	exp, ok := tokens[got]
	return ok && time.Now().Before(exp)
}

func issueToken() string {
	t := randomHex(24)
	tokMu.Lock()
	tokens[t] = time.Now().Add(time.Hour)
	tokMu.Unlock()
	return t
}

func parseKVAuth(s string) map[string]string {
	out := map[string]string{}
	for _, part := range strings.Split(s, ",") {
		part = strings.TrimSpace(part)
		k, v, ok := strings.Cut(part, "=")
		if !ok {
			continue
		}
		out[strings.ToLower(strings.TrimSpace(k))] = strings.Trim(v, `"`)
	}
	return out
}

func md5hex(s string) string {
	sum := md5.Sum([]byte(s))
	return hex.EncodeToString(sum[:])
}

func s256(verifier string) string {
	sum := sha256.Sum256([]byte(verifier))
	return base64.RawURLEncoding.EncodeToString(sum[:])
}

func randomHex(n int) string {
	b := make([]byte, n)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}
