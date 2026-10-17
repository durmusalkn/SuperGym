package core

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// fakeGemini, model adına göre verilen durumla cevap veren sahte Gemini API'sidir.
func fakeGemini(t *testing.T, status map[string]int) (*httptest.Server, *[]string) {
	t.Helper()
	var calls []string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		model := strings.TrimSuffix(strings.TrimPrefix(r.URL.Path, "/models/"), ":generateContent")
		calls = append(calls, model)
		if r.Header.Get("x-goog-api-key") != "anahtar" {
			w.WriteHeader(http.StatusBadRequest)
			io.WriteString(w, `{"error":{"message":"API key not valid.","status":"INVALID_ARGUMENT"}}`)
			return
		}
		var req map[string]any
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req["systemInstruction"] == nil {
			t.Errorf("istek eksik: %v %v", err, req)
		}
		if code := status[model]; code != 0 && code != 200 {
			w.WriteHeader(code)
			io.WriteString(w, `{"error":{"message":"yoğun"}}`)
			return
		}
		io.WriteString(w, `{"modelVersion":"`+model+`-1","candidates":[{"content":{"parts":[{"text":"düşünce","thought":true},{"text":" Gidişat iyi. "}]}}]}`)
	}))
	t.Cleanup(srv.Close)
	return srv, &calls
}

func testCoach(t *testing.T, base string) *Coach {
	c := OpenCoach(t.TempDir())
	c.base = base
	c.models = []string{"flash", "lite"}
	return c
}

func TestCoachAsk(t *testing.T) {
	srv, calls := fakeGemini(t, nil)
	c := testCoach(t, srv.URL)
	q := AskRequest{System: "antrenör", Prompt: "nasılım?"}

	if _, err := c.Ask(q); err != ErrNoKey {
		t.Fatalf("anahtarsız: %v", err)
	}
	if err := c.SetKey(" anahtar\n"); err != nil {
		t.Fatal(err)
	}
	if _, err := c.Ask(AskRequest{Prompt: "  "}); err != ErrEmptyPrompt {
		t.Fatalf("boş soru: %v", err)
	}
	res, err := c.Ask(q)
	if err != nil {
		t.Fatal(err)
	}
	if res.Text != "Gidişat iyi." || res.Model != "flash-1" {
		t.Fatalf("cevap: %+v (düşünce parçası atlanmalı)", res)
	}
	if len(*calls) != 1 {
		t.Fatalf("çağrılar: %v", *calls)
	}
}

func TestCoachFallsBackWhenBusy(t *testing.T) {
	for _, code := range []int{503, 429, 404} {
		srv, calls := fakeGemini(t, map[string]int{"flash": code})
		c := testCoach(t, srv.URL)
		c.SetKey("anahtar")
		res, err := c.Ask(AskRequest{System: "a", Prompt: "b"})
		if err != nil || res.Model != "lite-1" || strings.Join(*calls, ",") != "flash,lite" {
			t.Fatalf("%d: %+v %v %v", code, res, err, *calls)
		}
	}

	srv, _ := fakeGemini(t, map[string]int{"flash": 503, "lite": 503})
	c := testCoach(t, srv.URL)
	c.SetKey("anahtar")
	if _, err := c.Ask(AskRequest{System: "a", Prompt: "b"}); err == nil || !strings.Contains(err.Error(), "yoğun") {
		t.Fatalf("ikisi de yoğun: %v", err)
	}
}

func TestCoachBadKeyStops(t *testing.T) {
	srv, calls := fakeGemini(t, nil)
	c := testCoach(t, srv.URL)
	c.SetKey("yanlis")
	_, err := c.Ask(AskRequest{System: "a", Prompt: "b"})
	if err == nil || !strings.Contains(err.Error(), "anahtarı geçersiz") || len(*calls) != 1 {
		t.Fatalf("yanlış anahtar: %v %v", err, *calls)
	}
}

func TestCoachKeyFile(t *testing.T) {
	dir := t.TempDir()
	c := OpenCoach(dir)
	if c.HasKey() {
		t.Fatal("başta anahtar olmamalı")
	}
	if err := c.SetKey("bir anahtar"); err == nil {
		t.Fatal("boşluklu anahtar kabul edilmemeli")
	}
	if err := c.SetKey("anahtar"); err != nil {
		t.Fatal(err)
	}
	if !OpenCoach(dir).HasKey() {
		t.Fatal("anahtar yeniden açılışta okunmalı")
	}
	if fi, err := os.Stat(filepath.Join(dir, "ai-anahtar.txt")); err != nil || fi.Mode().Perm() != 0o600 {
		t.Fatalf("anahtar dosyası: %v %v", fi, err)
	}
	if err := c.SetKey(""); err != nil || OpenCoach(dir).HasKey() {
		t.Fatalf("anahtar silinmeli: %v", err)
	}
}

func TestAIEndpoints(t *testing.T) {
	base, token := startTestServer(t)

	res := do(t, "GET", base+"/api/ai", token, "")
	var st map[string]bool
	json.NewDecoder(res.Body).Decode(&st)
	if res.StatusCode != 200 || st["hasKey"] {
		t.Fatalf("durum: %d %v", res.StatusCode, st)
	}
	if res := do(t, "POST", base+"/api/ai/ask", token, `{"prompt":"selam"}`); res.StatusCode != http.StatusBadRequest {
		t.Fatalf("anahtarsız soru: %d, 400 olmalı", res.StatusCode)
	}
	res = do(t, "PUT", base+"/api/ai/key", token, `{"key":"anahtar"}`)
	b, _ := io.ReadAll(res.Body)
	if res.StatusCode != 200 || strings.Contains(string(b), "anahtar\"") || !strings.Contains(string(b), `"hasKey":true`) {
		t.Fatalf("anahtar kaydı: %d %s (anahtar geri gönderilmemeli)", res.StatusCode, b)
	}
	if res := do(t, "PUT", base+"/api/ai/key", "", `{"key":"x"}`); res.StatusCode != http.StatusUnauthorized {
		t.Fatalf("oturumsuz anahtar kaydı: %d, 401 olmalı", res.StatusCode)
	}
	// Anahtar yedeğe girmez.
	res = do(t, "GET", base+"/api/export", token, "")
	b, _ = io.ReadAll(res.Body)
	if strings.Contains(string(b), "anahtar\"") {
		t.Fatal("anahtar yedekte olmamalı")
	}
}

// Gerçek Gemini API ile deneme: yalnızca GEMINI_API_KEY tanımlıysa çalışır
// (.github/workflows/gemini-test.yml).
func TestCoachLive(t *testing.T) {
	key := os.Getenv("GEMINI_API_KEY")
	if key == "" {
		t.Skip("GEMINI_API_KEY yok")
	}
	c := OpenCoach(t.TempDir())
	if err := c.SetKey(key); err != nil {
		t.Fatal(err)
	}
	res, err := c.Ask(AskRequest{
		System: "Sen kişisel antrenörsün. Kısa ve Türkçe cevap ver.",
		Prompt: "Son antrenmanım: bench press 4x8 62,5 kg (geçen hafta 60 kg). Bu hafta ne yapmalıyım?",
	})
	if err != nil {
		t.Fatal(err)
	}
	t.Logf("%s · %d ms\n%s", res.Model, res.Ms, res.Text)
}
