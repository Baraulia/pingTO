package main

import (
	"bufio"
	"crypto/sha1"
	"encoding/base64"
	"fmt"
	"io"
	"net"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestWebSocketEcho(t *testing.T) {
	srv := httptest.NewServer(newHandler())
	defer srv.Close()

	host := strings.TrimPrefix(srv.URL, "http://")
	conn, err := net.DialTimeout("tcp", host, 3*time.Second)
	if err != nil {
		t.Fatal(err)
	}
	defer conn.Close()
	_ = conn.SetDeadline(time.Now().Add(5 * time.Second))

	key := base64.StdEncoding.EncodeToString([]byte("1234567890abcdef"))
	fmt.Fprintf(conn, "GET /ws/echo HTTP/1.1\r\nHost: %s\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: %s\r\nSec-WebSocket-Version: 13\r\n\r\n", host, key)

	br := bufio.NewReader(conn)
	status, err := br.ReadString('\n')
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(status, "101") {
		t.Fatalf("upgrade %s", status)
	}
	for {
		line, err := br.ReadString('\n')
		if err != nil {
			t.Fatal(err)
		}
		if line == "\r\n" {
			break
		}
	}
	sum := sha1.Sum([]byte(key + wsMagic))
	want := base64.StdEncoding.EncodeToString(sum[:])
	_ = want

	if err := writeMaskedWS(conn, 1, []byte("ping")); err != nil {
		t.Fatal(err)
	}
	opcode, payload, err := readServerWS(br)
	if err != nil {
		t.Fatal(err)
	}
	if opcode != 1 || string(payload) != "ping" {
		t.Fatalf("echo opcode=%d payload=%q", opcode, payload)
	}
}

func writeMaskedWS(w io.Writer, opcode byte, payload []byte) error {
	n := len(payload)
	hdr := []byte{0x80 | opcode, byte(0x80 | n)}
	mask := []byte{1, 2, 3, 4}
	buf := append(hdr, mask...)
	masked := make([]byte, n)
	for i := range payload {
		masked[i] = payload[i] ^ mask[i%4]
	}
	buf = append(buf, masked...)
	_, err := w.Write(buf)
	return err
}

func readServerWS(r *bufio.Reader) (byte, []byte, error) {
	h := make([]byte, 2)
	if _, err := io.ReadFull(r, h); err != nil {
		return 0, nil, err
	}
	opcode := h[0] & 0x0f
	n := int(h[1] & 0x7f)
	payload := make([]byte, n)
	if _, err := io.ReadFull(r, payload); err != nil {
		return 0, nil, err
	}
	return opcode, payload, nil
}
