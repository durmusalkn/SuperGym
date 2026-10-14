package core

import (
	"encoding/json"
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

	if res := do(t, "GET", base+"/api/data", "", ""); res.StatusCode != http.StatusUnauthorized {
		t.Fatalf("anahtarsız istek: %d, 401 olmalı", res.StatusCode)
	}
	if res := do(t, "GET", base+"/api/data", "yanlis", ""); res.StatusCode != http.StatusUnauthorized {
		t.Fatalf("yanlış anahtar: %d, 401 olmalı", res.StatusCode)
	}
	// Başka bir sitenin göndermeye çalışabileceği içe aktarma isteği.
	evil := `{"app":"SuperGym","version":2}`
	if res := do(t, "POST", base+"/api/import", "", evil); res.StatusCode != http.StatusUnauthorized {
		t.Fatalf("anahtarsız içe aktarma: %d, 401 olmalı", res.StatusCode)
	}
	if res := do(t, "GET", base+"/api/data", token, ""); res.StatusCode != http.StatusOK {
		t.Fatalf("doğru anahtar: %d, 200 olmalı", res.StatusCode)
	}
}

func TestAPIFlow(t *testing.T) {
	base, token := startTestServer(t)

	var d Data
	decode := func(res *http.Response, want int) {
		t.Helper()
		b, _ := io.ReadAll(res.Body)
		if res.StatusCode != want {
			t.Fatalf("durum %d, %d olmalı: %s", res.StatusCode, want, b)
		}
		if want == http.StatusOK {
			if err := json.Unmarshal(b, &d); err != nil {
				t.Fatal(err)
			}
		}
	}

	decode(do(t, "GET", base+"/api/data", token, ""), http.StatusOK)
	if len(d.Exercises) == 0 || d.Workouts == nil {
		t.Fatalf("ilk veri eksik: %+v", d)
	}

	decode(do(t, "POST", base+"/api/exercises", token, `{"name":"Hip Thrust","group":"Bacak"}`), http.StatusOK)
	id := d.Exercises[len(d.Exercises)-1].ID
	decode(do(t, "POST", base+"/api/exercises", token, `{"name":""}`), http.StatusBadRequest)

	decode(do(t, "PUT", base+"/api/workouts/2026-10-14", token,
		`{"items":[{"exerciseId":"`+id+`","sets":[{"reps":10,"weight":60},{"reps":8,"weight":70}]}]}`), http.StatusOK)
	if len(d.Workouts) != 1 || d.Workouts[0].Date != "2026-10-14" || len(d.Workouts[0].Items[0].Sets) != 2 {
		t.Fatalf("antrenman kaydedilmedi: %+v", d.Workouts)
	}
	decode(do(t, "PUT", base+"/api/workouts/dun", token, `{"items":[]}`), http.StatusBadRequest)

	decode(do(t, "POST", base+"/api/templates", token, `{"name":"Bacak","exerciseIds":["`+id+`"]}`), http.StatusOK)
	decode(do(t, "PUT", base+"/api/bodyweights/2026-10-14", token, `{"kg":80}`), http.StatusOK)
	decode(do(t, "PUT", base+"/api/settings", token, `{"restSeconds":120}`), http.StatusOK)
	decode(do(t, "DELETE", base+"/api/templates/yok", token, ""), http.StatusNotFound)

	res := do(t, "GET", base+"/api/export", token, "")
	backup, _ := io.ReadAll(res.Body)
	if res.StatusCode != http.StatusOK || !strings.Contains(string(backup), "Hip Thrust") {
		t.Fatalf("dışa aktarma: %d %s", res.StatusCode, backup)
	}
	decode(do(t, "DELETE", base+"/api/workouts/2026-10-14", token, ""), http.StatusOK)
	decode(do(t, "POST", base+"/api/import", token, string(backup)), http.StatusOK)
	if len(d.Workouts) != 1 || d.Settings.RestSeconds != 120 || len(d.Templates) != 1 {
		t.Fatalf("içe aktarma verileri geri getirmedi: %+v", d)
	}
}

func TestRejectsForeignHost(t *testing.T) {
	base, token := startTestServer(t)
	req, _ := http.NewRequest("GET", base+"/api/data", nil)
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
