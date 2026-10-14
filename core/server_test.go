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

	decode(do(t, "POST", base+"/api/exercises", token, `{"name":"Kendi Hareketim","group":"Bacak"}`), http.StatusOK)
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
	if res.StatusCode != http.StatusOK || !strings.Contains(string(backup), "Kendi Hareketim") {
		t.Fatalf("dışa aktarma: %d %s", res.StatusCode, backup)
	}
	decode(do(t, "DELETE", base+"/api/workouts/2026-10-14", token, ""), http.StatusOK)
	decode(do(t, "POST", base+"/api/import", token, string(backup)), http.StatusOK)
	if len(d.Workouts) != 1 || d.Settings.RestSeconds != 120 || len(d.Templates) != len(builtinPrograms)+1 {
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

func TestAPIForkAndReset(t *testing.T) {
	base, token := startTestServer(t)
	var d Data
	call := func(method, path, body string, want int) {
		t.Helper()
		res := do(t, method, base+path, token, body)
		b, _ := io.ReadAll(res.Body)
		if res.StatusCode != want {
			t.Fatalf("%s %s: durum %d, %d olmalı: %s", method, path, res.StatusCode, want, b)
		}
		if want == http.StatusOK {
			d = Data{}
			if err := json.Unmarshal(b, &d); err != nil {
				t.Fatal(err)
			}
		}
	}

	call("POST", "/api/templates/builtin-push/fork", "", http.StatusOK)
	if last := d.Templates[len(d.Templates)-1]; last.ForkOf != "builtin-push" {
		t.Fatalf("kopya: %+v", last)
	}
	call("PUT", "/api/templates/builtin-push", `{"name":"X","exerciseIds":[]}`, http.StatusBadRequest)
	call("DELETE", "/api/templates/builtin-push", "", http.StatusBadRequest)
	call("POST", "/api/templates/yok/fork", "", http.StatusNotFound)

	call("PUT", "/api/bodyweights/2026-10-14", `{"kg":80}`, http.StatusOK)
	call("POST", "/api/reset", `{"scope":"history"}`, http.StatusOK)
	if len(d.BodyWeights) != 0 || len(d.Templates) != len(builtinPrograms)+1 {
		t.Fatalf("geçmiş sıfırlama: %+v", d)
	}
	call("POST", "/api/reset", `{"scope":"all"}`, http.StatusOK)
	if len(d.Templates) != len(builtinPrograms) {
		t.Fatal("fabrika ayarlarına dönmedi")
	}
	call("POST", "/api/reset", `{}`, http.StatusBadRequest)
}
