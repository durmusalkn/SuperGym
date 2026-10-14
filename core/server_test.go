package core

import (
	"io"
	"net/http"
	"net/url"
	"strings"
	"testing"
)

func startTestServer(t *testing.T) (base, token string) {
	t.Helper()
	u, err := Start(t.TempDir(), "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	parsed, err := url.Parse(u)
	if err != nil {
		t.Fatal(err)
	}
	token = parsed.Query().Get("t")
	if len(token) < 32 {
		t.Fatalf("adreste anahtar yok: %s", u)
	}
	return "http://" + parsed.Host, token
}

func do(t *testing.T, method, u, token, body string) *http.Response {
	t.Helper()
	req, err := http.NewRequest(method, u, strings.NewReader(body))
	if err != nil {
		t.Fatal(err)
	}
	if token != "" {
		req.Header.Set(TokenHeader, token)
	}
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { res.Body.Close() })
	return res
}

func TestAPIRequiresToken(t *testing.T) {
	base, token := startTestServer(t)

	if res := do(t, "GET", base+"/api/entries", "", ""); res.StatusCode != http.StatusUnauthorized {
		t.Fatalf("anahtarsız istek: %d, 401 olmalı", res.StatusCode)
	}
	if res := do(t, "GET", base+"/api/entries", "yanlis", ""); res.StatusCode != http.StatusUnauthorized {
		t.Fatalf("yanlış anahtar: %d, 401 olmalı", res.StatusCode)
	}
	// Başka bir sitenin göndermeye çalışabileceği içe aktarma isteği.
	evil := `{"app":"SuperGym","version":1,"entries":[]}`
	if res := do(t, "POST", base+"/api/import", "", evil); res.StatusCode != http.StatusUnauthorized {
		t.Fatalf("anahtarsız içe aktarma: %d, 401 olmalı", res.StatusCode)
	}
	if res := do(t, "GET", base+"/api/entries", token, ""); res.StatusCode != http.StatusOK {
		t.Fatalf("doğru anahtar: %d, 200 olmalı", res.StatusCode)
	}
}

func TestAPIFlow(t *testing.T) {
	base, token := startTestServer(t)

	res := do(t, "GET", base+"/api/entries", token, "")
	if b, _ := io.ReadAll(res.Body); strings.TrimSpace(string(b)) != "[]" {
		t.Fatalf("boş liste [] olmalı, gelen: %s", b)
	}

	res = do(t, "POST", base+"/api/entries", token, `{"date":"2026-10-14","exercise":"Bench Press","sets":3,"reps":8,"weight":60}`)
	if res.StatusCode != http.StatusCreated {
		t.Fatalf("ekleme: %d", res.StatusCode)
	}
	res = do(t, "POST", base+"/api/entries", token, `{"date":"2026-10-14","exercise":""}`)
	if res.StatusCode != http.StatusBadRequest {
		t.Fatalf("boş hareket adı: %d, 400 olmalı", res.StatusCode)
	}

	res = do(t, "GET", base+"/api/export", token, "")
	backup, _ := io.ReadAll(res.Body)
	if res.StatusCode != http.StatusOK || !strings.Contains(string(backup), "Bench Press") {
		t.Fatalf("dışa aktarma: %d %s", res.StatusCode, backup)
	}
	res = do(t, "POST", base+"/api/import", token, string(backup))
	if res.StatusCode != http.StatusOK {
		t.Fatalf("içe aktarma: %d", res.StatusCode)
	}
}

func TestRejectsForeignHost(t *testing.T) {
	base, token := startTestServer(t)
	req, _ := http.NewRequest("GET", base+"/api/entries", nil)
	req.Header.Set(TokenHeader, token)
	req.Host = "kotu-site.example:80"
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	res.Body.Close()
	if res.StatusCode != http.StatusMisdirectedRequest {
		t.Fatalf("yabancı Host: %d, 421 olmalı", res.StatusCode)
	}
}

func TestStaticWithoutToken(t *testing.T) {
	base, _ := startTestServer(t)
	if res := do(t, "GET", base+"/", "", ""); res.StatusCode != http.StatusOK {
		t.Fatalf("arayüz anahtarsız açılmalı: %d", res.StatusCode)
	}
}
