package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/cookiejar"
	"net/http/httptest"
	"net/url"
	"os"
	"strings"
	"testing"
	"time"
)

func TestMain(m *testing.M) {
	zero := 0
	baseLatencyMS = &zero
	os.Exit(m.Run())
}

func testServer(t *testing.T) *httptest.Server {
	t.Helper()
	mem.Reset()
	srv := httptest.NewServer(newHandler())
	t.Cleanup(srv.Close)
	return srv
}

func getJSON(t *testing.T, srv *httptest.Server, path string) (int, map[string]any) {
	t.Helper()
	return doJSON(t, srv, http.MethodGet, path, "", nil)
}

func doJSON(t *testing.T, srv *httptest.Server, method, path, body string, headers map[string]string) (int, map[string]any) {
	t.Helper()
	req, err := http.NewRequest(method, srv.URL+path, strings.NewReader(body))
	if err != nil {
		t.Fatal(err)
	}
	for k, v := range headers {
		req.Header.Set(k, v)
	}
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer res.Body.Close()
	raw, _ := io.ReadAll(res.Body)
	out := map[string]any{}
	trim := bytes.TrimSpace(raw)
	if len(trim) > 0 && trim[0] == '{' {
		if err := json.Unmarshal(raw, &out); err != nil {
			t.Fatalf("json %s: %v\n%s", path, err, raw)
		}
	}
	return res.StatusCode, out
}

func TestCatalogAndHealth(t *testing.T) {
	srv := testServer(t)
	code, body := getJSON(t, srv, "/")
	if code != 200 || body["name"] != "PingTo testd" {
		t.Fatalf("catalog %d %#v", code, body)
	}
	code, body = getJSON(t, srv, "/health")
	if code != 200 || body["ok"] != true {
		t.Fatalf("health %d %#v", code, body)
	}
	code, _ = getJSON(t, srv, "/no-such-route")
	if code != 404 {
		t.Fatalf("missing route want 404 got %d", code)
	}
}

func TestEchoQueryHeadersJSONForm(t *testing.T) {
	srv := testServer(t)
	code, body := doJSON(t, srv, http.MethodPost, "/echo?foo=1", "hello", map[string]string{"X-Test": "yes"})
	if code != 200 || body["body"] != "hello" || body["method"] != "POST" {
		t.Fatalf("echo %#v", body)
	}
	q := body["query"].(map[string]any)
	foo, _ := q["foo"].([]any)
	if len(foo) != 1 || fmt.Sprint(foo[0]) != "1" {
		t.Fatalf("query %#v", q)
	}

	code, body = getJSON(t, srv, "/users/42")
	if code != 200 || body["id"] != "42" || body["name"] != "user-42" {
		t.Fatalf("user %#v", body)
	}

	code, body = getJSON(t, srv, "/query?a=1&b=2")
	if code != 200 {
		t.Fatal(code)
	}

	code, body = doJSON(t, srv, http.MethodGet, "/headers", "", map[string]string{"X-PingTo-Test": "yes"})
	headers := body["headers"].(map[string]any)
	if !strings.Contains(fmt.Sprint(headers["X-Pingto-Test"])+fmt.Sprint(headers["X-PingTo-Test"]), "yes") {
		t.Fatalf("headers %#v", headers)
	}

	code, body = doJSON(t, srv, http.MethodPost, "/json", `{"name":"ada"}`, map[string]string{"Content-Type": "application/json"})
	if code != 200 {
		t.Fatal(code)
	}
	code, _ = doJSON(t, srv, http.MethodPost, "/json", `{`, map[string]string{"Content-Type": "application/json"})
	if code != 400 {
		t.Fatalf("bad json want 400 got %d", code)
	}

	code, body = doJSON(t, srv, http.MethodPost, "/form", "a=1&b=hello", map[string]string{"Content-Type": "application/x-www-form-urlencoded"})
	if code != 200 {
		t.Fatal(body)
	}
}

func TestMultipartBinaryTextHTMLXMLStatus(t *testing.T) {
	srv := testServer(t)
	var buf bytes.Buffer
	w := multipart.NewWriter(&buf)
	_ = w.WriteField("title", "demo")
	fw, _ := w.CreateFormFile("file", "a.txt")
	_, _ = fw.Write([]byte("hi"))
	_ = w.Close()
	req, _ := http.NewRequest(http.MethodPost, srv.URL+"/multipart", &buf)
	req.Header.Set("Content-Type", w.FormDataContentType())
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer res.Body.Close()
	if res.StatusCode != 200 {
		t.Fatal(res.Status)
	}

	code, body := doJSON(t, srv, http.MethodPost, "/binary", "abc", map[string]string{"Content-Type": "application/octet-stream"})
	if code != 200 || body["bytes"] != float64(3) {
		t.Fatalf("binary %#v", body)
	}

	res, err = http.Get(srv.URL + "/text")
	if err != nil {
		t.Fatal(err)
	}
	raw, _ := io.ReadAll(res.Body)
	res.Body.Close()
	if !strings.Contains(string(raw), "pingto text body") {
		t.Fatalf("text %s", raw)
	}

	res, _ = http.Get(srv.URL + "/html")
	raw, _ = io.ReadAll(res.Body)
	res.Body.Close()
	if !strings.Contains(string(raw), "PingTo preview") {
		t.Fatalf("html %s", raw)
	}

	res, _ = http.Get(srv.URL + "/xml")
	if res.Header.Get("Content-Type") == "" || !strings.Contains(res.Header.Get("Content-Type"), "xml") {
		t.Fatalf("xml ct %s", res.Header.Get("Content-Type"))
	}
	res.Body.Close()

	code, body = getJSON(t, srv, "/status/404")
	if code != 404 || body["ok"] != false {
		t.Fatalf("status %#v", body)
	}
	code, _ = getJSON(t, srv, "/status/999")
	if code != 400 {
		t.Fatalf("bad status code %d", code)
	}
}

func TestDelayRedirectHeadCookiesBytesSlow(t *testing.T) {
	srv := testServer(t)
	start := time.Now()
	code, body := getJSON(t, srv, "/delay/50")
	if code != 200 || body["slept_ms"] != float64(50) {
		t.Fatalf("delay %#v", body)
	}
	if time.Since(start) < 40*time.Millisecond {
		t.Fatal("delay too fast")
	}

	client := &http.Client{
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			return http.ErrUseLastResponse
		},
	}
	res, err := client.Get(srv.URL + "/redirect/3")
	if err != nil {
		t.Fatal(err)
	}
	res.Body.Close()
	if res.StatusCode != 302 || !strings.Contains(res.Header.Get("Location"), "/redirect/2") {
		t.Fatalf("redirect %d %s", res.StatusCode, res.Header.Get("Location"))
	}

	follow, _ := http.Get(srv.URL + "/redirect/3")
	raw, _ := io.ReadAll(follow.Body)
	follow.Body.Close()
	if follow.StatusCode != 200 || !strings.Contains(string(raw), `"done"`) {
		t.Fatalf("follow %d %s", follow.StatusCode, raw)
	}

	req, _ := http.NewRequest(http.MethodPost, srv.URL+"/redirect-keep", strings.NewReader("keep-me"))
	res, err = http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	raw, _ = io.ReadAll(res.Body)
	res.Body.Close()
	if res.StatusCode != 200 || !strings.Contains(string(raw), "keep-me") {
		t.Fatalf("307 keep %d %s", res.StatusCode, raw)
	}

	req, _ = http.NewRequest(http.MethodHead, srv.URL+"/head", nil)
	res, err = http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	if res.StatusCode != 200 || res.Header.Get("X-PingTo") != "head" {
		t.Fatalf("head %d %s", res.StatusCode, res.Header.Get("X-PingTo"))
	}
	res.Body.Close()

	jar, _ := cookiejar.New(nil)
	c := &http.Client{Jar: jar}
	_, err = c.Post(srv.URL+"/cookies?name=sid&value=abc", "text/plain", nil)
	if err != nil {
		t.Fatal(err)
	}
	res, err = c.Get(srv.URL + "/cookies")
	if err != nil {
		t.Fatal(err)
	}
	raw, _ = io.ReadAll(res.Body)
	res.Body.Close()
	if !strings.Contains(string(raw), "sid") || !strings.Contains(string(raw), "abc") {
		t.Fatalf("cookies %s", raw)
	}

	res, _ = http.Get(srv.URL + "/bytes/32")
	raw, _ = io.ReadAll(res.Body)
	res.Body.Close()
	if len(raw) != 32 {
		t.Fatalf("bytes %d", len(raw))
	}

	code, body = getJSON(t, srv, "/slow-json")
	if code != 200 || body["message"] != "slow-json" {
		t.Fatalf("slow %#v", body)
	}
}

func TestCORSOptions(t *testing.T) {
	srv := testServer(t)
	req, _ := http.NewRequest(http.MethodOptions, srv.URL+"/echo", nil)
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	res.Body.Close()
	if res.StatusCode != 204 {
		t.Fatalf("options %d", res.StatusCode)
	}
	if res.Header.Get("Access-Control-Allow-Origin") != "*" {
		t.Fatal(res.Header.Get("Access-Control-Allow-Origin"))
	}
}

func TestAuthSuite(t *testing.T) {
	srv := testServer(t)
	code, _ := getJSON(t, srv, "/auth/bearer")
	if code != 401 {
		t.Fatal(code)
	}
	code, body := doJSON(t, srv, http.MethodGet, "/auth/bearer", "", map[string]string{"Authorization": "Bearer pingto-token"})
	if code != 200 || body["auth"] != "bearer" {
		t.Fatalf("bearer %#v", body)
	}

	req, _ := http.NewRequest(http.MethodGet, srv.URL+"/auth/basic", nil)
	req.SetBasicAuth("pingto", "pingto")
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	res.Body.Close()
	if res.StatusCode != 200 {
		t.Fatal(res.Status)
	}

	code, _ = doJSON(t, srv, http.MethodGet, "/auth/apikey", "", map[string]string{"X-API-Key": "pingto-key"})
	if code != 200 {
		t.Fatal(code)
	}
	code, _ = getJSON(t, srv, "/auth/apikey?api_key=pingto-key")
	if code != 200 {
		t.Fatal(code)
	}
	code, _ = getJSON(t, srv, "/auth/apikey")
	if code != 401 {
		t.Fatal(code)
	}

	if err := digestRoundTrip(t, srv, "Authorization"); err != nil {
		t.Fatal(err)
	}
	if err := digestRoundTrip(t, srv, "X-Digest-Authorization"); err != nil {
		t.Fatal(err)
	}
	code, body = doJSON(t, srv, http.MethodGet, "/auth/digest", "", map[string]string{
		"X-Digest-User": "pingto",
		"X-Digest-Pass": "pingto",
	})
	if code != 200 || body["auth"] != "digest" {
		t.Fatalf("digest creds %#v code %d", body, code)
	}
}

func digestRoundTrip(t *testing.T, srv *httptest.Server, headerName string) error {
	t.Helper()
	req, _ := http.NewRequest(http.MethodGet, srv.URL+"/auth/digest", nil)
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	chal := res.Header.Get("X-WWW-Authenticate")
	if chal == "" {
		chal = res.Header.Get("WWW-Authenticate")
	}
	io.Copy(io.Discard, res.Body)
	res.Body.Close()
	if res.StatusCode != 401 || !strings.HasPrefix(strings.ToLower(chal), "digest ") {
		return fmt.Errorf("challenge %d %s", res.StatusCode, chal)
	}
	params := parseKVAuth(strings.TrimSpace(chal[7:]))
	uri := "/auth/digest"
	ha1 := md5hex("pingto:pingto:pingto")
	ha2 := md5hex("GET:" + uri)
	nc, cnonce := "00000001", "0a1b2c3d"
	resp := md5hex(strings.Join([]string{ha1, params["nonce"], nc, cnonce, "auth", ha2}, ":"))
	header := fmt.Sprintf(`Digest username="pingto", realm="%s", nonce="%s", uri="%s", qop=auth, nc=%s, cnonce="%s", response="%s", opaque="%s", algorithm=MD5`,
		params["realm"], params["nonce"], uri, nc, cnonce, resp, params["opaque"])
	code, body := doJSON(t, srv, http.MethodGet, uri, "", map[string]string{headerName: header})
	if code != 200 || body["auth"] != "digest" {
		return fmt.Errorf("digest %s %#v code %d", headerName, body, code)
	}
	return nil
}

func TestOAuthAndGraphQL(t *testing.T) {
	srv := testServer(t)
	form := url.Values{
		"grant_type":    {"client_credentials"},
		"client_id":     {"pingto"},
		"client_secret": {"pingto-secret"},
		"scope":         {"api"},
	}
	res, err := http.PostForm(srv.URL+"/oauth/token", form)
	if err != nil {
		t.Fatal(err)
	}
	raw, _ := io.ReadAll(res.Body)
	res.Body.Close()
	var tok map[string]any
	_ = json.Unmarshal(raw, &tok)
	if res.StatusCode != 200 || tok["access_token"] == nil {
		t.Fatalf("token %s", raw)
	}
	token := tok["access_token"].(string)
	code, body := doJSON(t, srv, http.MethodGet, "/auth/oauth", "", map[string]string{"Authorization": "Bearer " + token})
	if code != 200 || body["auth"] != "oauth2" {
		t.Fatalf("oauth resource %#v", body)
	}

	code, body = doJSON(t, srv, http.MethodGet, "/auth/oauth", "", map[string]string{"Authorization": "Bearer pingto-token"})
	if code != 200 {
		t.Fatal(code)
	}

	client := &http.Client{
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			return http.ErrUseLastResponse
		},
	}
	res, err = client.Get(srv.URL + "/oauth/authorize?client_id=pingto&redirect_uri=http://127.0.0.1/cb&state=xyz")
	if err != nil {
		t.Fatal(err)
	}
	loc := res.Header.Get("Location")
	res.Body.Close()
	if res.StatusCode != 302 || !strings.Contains(loc, "code=") || !strings.Contains(loc, "state=xyz") {
		t.Fatalf("authorize %d %s", res.StatusCode, loc)
	}

	code, body = doJSON(t, srv, http.MethodPost, "/graphql", `{"query":"query { ping }"}`, map[string]string{"Content-Type": "application/json"})
	if code != 200 {
		t.Fatal(code)
	}
	data := body["data"].(map[string]any)
	if data["ping"] != "pong" {
		t.Fatalf("gql %#v", body)
	}
	code, body = doJSON(t, srv, http.MethodPost, "/graphql", `{"query":"query { users { id name } }"}`, map[string]string{"Content-Type": "application/json"})
	users := body["data"].(map[string]any)["users"].([]any)
	if len(users) != 2 {
		t.Fatalf("users %#v", body)
	}
	code, body = doJSON(t, srv, http.MethodPost, "/graphql", `{"query":"query IntrospectionQuery { __schema { queryType { name } } }"}`, map[string]string{"Content-Type": "application/json"})
	if body["data"].(map[string]any)["__schema"] == nil {
		t.Fatalf("intro %#v", body)
	}
}

func TestSSE(t *testing.T) {
	srv := testServer(t)
	res, err := http.Get(srv.URL + "/sse")
	if err != nil {
		t.Fatal(err)
	}
	defer res.Body.Close()
	if !strings.Contains(res.Header.Get("Content-Type"), "text/event-stream") {
		t.Fatal(res.Header.Get("Content-Type"))
	}
	raw, err := io.ReadAll(res.Body)
	if err != nil {
		t.Fatal(err)
	}
	if strings.Count(string(raw), "data:") < 8 {
		t.Fatalf("sse %s", raw)
	}
}

func TestInMemoryCRUD(t *testing.T) {
	srv := testServer(t)

	code, body := getJSON(t, srv, "/users/42")
	if code != 200 || body["email"] != "user-42@pingto.local" {
		t.Fatalf("seed user %#v", body)
	}
	code, _ = getJSON(t, srv, "/users/missing")
	if code != 404 {
		t.Fatalf("missing user %d", code)
	}

	code, body = doJSON(t, srv, http.MethodPost, "/v1/users", `{"id":"7","email":"a@b.c","name":"Ada"}`, map[string]string{"Content-Type": "application/json"})
	if code != 201 || body["id"] != "7" {
		t.Fatalf("create %d %#v", code, body)
	}
	code, body = doJSON(t, srv, http.MethodPost, "/v1/users", `{"id":"7","email":"dup@b.c"}`, map[string]string{"Content-Type": "application/json"})
	if code != 409 {
		t.Fatalf("dup want 409 got %d %#v", code, body)
	}

	code, _ = doJSON(t, srv, http.MethodDelete, "/v1/users/7", "", nil)
	if code != 204 {
		t.Fatalf("delete %d", code)
	}
	code, _ = doJSON(t, srv, http.MethodDelete, "/v1/users/7", "", nil)
	if code != 404 {
		t.Fatalf("delete missing %d", code)
	}

	code, body = getJSON(t, srv, "/v1/sessions/s-alpha")
	if code != 200 || body["user"] != "alpha" {
		t.Fatalf("session %#v", body)
	}
	code, _ = doJSON(t, srv, http.MethodDelete, "/v1/sessions/s-alpha", "", nil)
	if code != 204 {
		t.Fatal(code)
	}
	code, body = doJSON(t, srv, http.MethodPost, "/v1/sessions", `{"id":"s-alpha","user":"alpha"}`, map[string]string{"Content-Type": "application/json"})
	if code != 201 {
		t.Fatalf("restore %d %#v", code, body)
	}

	code, _ = doJSON(t, srv, http.MethodDelete, "/users/42", "", nil)
	if code != 204 {
		t.Fatal(code)
	}
	code, body = doJSON(t, srv, http.MethodPost, "/v1/reset", "", nil)
	if code != 200 || body["ok"] != true {
		t.Fatalf("reset %#v", body)
	}
	code, _ = getJSON(t, srv, "/users/42")
	if code != 200 {
		t.Fatalf("reseed %d", code)
	}
	code, body = getJSON(t, srv, "/v1/stats")
	if code != 200 || body["users"] != float64(1) || body["sessions"] != float64(3) {
		t.Fatalf("stats %#v", body)
	}
}
