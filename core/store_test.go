package core

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func newTestStore(t *testing.T) (*Store, string) {
	t.Helper()
	dir := t.TempDir()
	s, err := OpenStore(dir)
	if err != nil {
		t.Fatal(err)
	}
	return s, dir
}

func TestAddPersists(t *testing.T) {
	s, dir := newTestStore(t)
	e, err := s.Add(Entry{Date: "2026-10-14", Exercise: "Bench Press", Sets: 3, Reps: 8, Weight: 60})
	if err != nil {
		t.Fatal(err)
	}
	if e.ID == "" {
		t.Fatal("kayda ID verilmedi")
	}

	reopened, err := OpenStore(dir)
	if err != nil {
		t.Fatal(err)
	}
	got := reopened.Entries()
	if len(got) != 1 || got[0] != e {
		t.Fatalf("yeniden açınca kayıt farklı: %+v", got)
	}
	if _, err := os.Stat(filepath.Join(dir, "supergym.json.tmp")); !os.IsNotExist(err) {
		t.Fatal("geçici dosya arkada kaldı")
	}
}

func TestAddValidation(t *testing.T) {
	s, _ := newTestStore(t)
	bad := []Entry{
		{Date: "2026-10-14"},
		{Date: "14.10.2026", Exercise: "Squat"},
		{Date: "2026-10-14", Exercise: "Squat", Sets: -1},
		{Date: "2026-10-14", Exercise: "Squat", Weight: -5},
	}
	for _, e := range bad {
		if _, err := s.Add(e); err == nil {
			t.Errorf("geçersiz kayıt kabul edildi: %+v", e)
		}
	}
	if n := len(s.Entries()); n != 0 {
		t.Fatalf("geçersiz kayıtlar eklendi: %d", n)
	}
}

func TestDelete(t *testing.T) {
	s, _ := newTestStore(t)
	a, _ := s.Add(Entry{Date: "2026-10-14", Exercise: "A"})
	b, _ := s.Add(Entry{Date: "2026-10-14", Exercise: "B"})
	if err := s.Delete(a.ID); err != nil {
		t.Fatal(err)
	}
	if got := s.Entries(); len(got) != 1 || got[0].ID != b.ID {
		t.Fatalf("yanlış kayıt silindi: %+v", got)
	}
	if err := s.Delete("yok"); err == nil {
		t.Fatal("olmayan kayıt için hata dönmedi")
	}
}

func TestExportImportRoundTrip(t *testing.T) {
	s, _ := newTestStore(t)
	s.Add(Entry{Date: "2026-10-13", Exercise: "Deadlift", Sets: 5, Reps: 5, Weight: 100, Note: "iyi"})
	s.Add(Entry{Date: "2026-10-14", Exercise: "Squat", Sets: 3, Reps: 10, Weight: 80.5})
	b, err := s.Export()
	if err != nil {
		t.Fatal(err)
	}

	other, _ := newTestStore(t)
	other.Add(Entry{Date: "2026-01-01", Exercise: "Silinecek"})
	n, err := other.Import(b)
	if err != nil {
		t.Fatal(err)
	}
	if n != 2 {
		t.Fatalf("içe aktarılan kayıt sayısı %d, 2 olmalı", n)
	}
	want, got := s.Entries(), other.Entries()
	for i := range want {
		if want[i] != got[i] {
			t.Fatalf("kayıt %d farklı: %+v != %+v", i, got[i], want[i])
		}
	}
}

func TestImportRejects(t *testing.T) {
	cases := map[string]string{
		"JSON değil":     `merhaba`,
		"başka uygulama": `{"app":"BaşkaUygulama","version":1,"entries":[]}`,
		"yeni sürüm":     `{"app":"SuperGym","version":99,"entries":[]}`,
		"geçersiz kayıt": `{"app":"SuperGym","version":1,"entries":[{"date":"2026-10-14","exercise":""}]}`,
		"geçersiz tarih": `{"app":"SuperGym","version":1,"entries":[{"date":"dün","exercise":"Squat"}]}`,
	}
	for name, in := range cases {
		t.Run(name, func(t *testing.T) {
			s, _ := newTestStore(t)
			s.Add(Entry{Date: "2026-10-14", Exercise: "Kalmalı"})
			if _, err := s.Import([]byte(in)); err == nil {
				t.Fatal("hatalı yedek kabul edildi")
			}
			if got := s.Entries(); len(got) != 1 || got[0].Exercise != "Kalmalı" {
				t.Fatalf("reddedilen yedek mevcut verileri değiştirdi: %+v", got)
			}
		})
	}
}

func TestImportFixesDuplicateIDs(t *testing.T) {
	s, _ := newTestStore(t)
	in := `{"app":"SuperGym","version":1,"entries":[
		{"id":"x","date":"2026-10-14","exercise":"A"},
		{"id":"x","date":"2026-10-14","exercise":"B"},
		{"date":"2026-10-14","exercise":"C"}]}`
	if _, err := s.Import([]byte(in)); err != nil {
		t.Fatal(err)
	}
	seen := map[string]bool{}
	for _, e := range s.Entries() {
		if e.ID == "" || seen[e.ID] {
			t.Fatalf("boş ya da tekrarlanan ID: %q", e.ID)
		}
		seen[e.ID] = true
	}
}

func TestCorruptFileIsSetAside(t *testing.T) {
	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, "supergym.json"), []byte(`{"app":"Sup`), 0o600); err != nil {
		t.Fatal(err)
	}
	s, err := OpenStore(dir)
	if err != nil {
		t.Fatalf("bozuk dosya yüzünden açılamadı: %v", err)
	}
	if len(s.Entries()) != 0 {
		t.Fatal("bozuk dosyadan sonra boş başlamalı")
	}
	if !strings.Contains(s.Warning(), "kenara alındı") {
		t.Fatalf("uyarı yok: %q", s.Warning())
	}
	matches, _ := filepath.Glob(filepath.Join(dir, "supergym.json.bozuk-*"))
	if len(matches) != 1 {
		t.Fatalf("bozuk dosya kenara alınmadı: %v", matches)
	}

	// İçe aktarma sonrası uyarı kalkar.
	if _, err := s.Import([]byte(`{"app":"SuperGym","version":1,"entries":[]}`)); err != nil {
		t.Fatal(err)
	}
	if s.Warning() != "" {
		t.Fatal("içe aktarmadan sonra uyarı kalkmadı")
	}
}
