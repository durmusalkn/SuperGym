package core

import (
	"encoding/json"
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

func exerciseID(t *testing.T, d Data, name string) string {
	t.Helper()
	for _, e := range d.Exercises {
		if e.Name == name {
			return e.ID
		}
	}
	t.Fatalf("%q hareketi yok", name)
	return ""
}

func TestFreshStoreHasDefaults(t *testing.T) {
	s, dir := newTestStore(t)
	d := s.Data()
	if len(d.Exercises) != len(defaultExercises) {
		t.Fatalf("hazır hareket sayısı %d, %d olmalı", len(d.Exercises), len(defaultExercises))
	}
	if d.Settings.RestSeconds != defaultRestSeconds {
		t.Fatalf("dinlenme süresi %d", d.Settings.RestSeconds)
	}
	// Yeniden açınca hareketler (ve ID'leri) aynı kalmalı.
	reopened, err := OpenStore(dir)
	if err != nil {
		t.Fatal(err)
	}
	if exerciseID(t, reopened.Data(), "Squat") != exerciseID(t, d, "Squat") {
		t.Fatal("yeniden açınca hareket ID'si değişti")
	}
}

func TestWorkoutPersists(t *testing.T) {
	s, dir := newTestStore(t)
	bench := exerciseID(t, s.Data(), "Bench Press")
	w := Workout{Date: "2026-10-14", Items: []Item{{ExerciseID: bench, Sets: []Set{
		{Reps: 10, Weight: 60}, {Reps: 8, Weight: 65}, {Reps: 6, Weight: 70},
	}}}}
	if _, err := s.PutWorkout(w); err != nil {
		t.Fatal(err)
	}
	reopened, err := OpenStore(dir)
	if err != nil {
		t.Fatal(err)
	}
	got := reopened.Data().Workouts
	if len(got) != 1 || len(got[0].Items[0].Sets) != 3 || got[0].Items[0].Sets[2].Weight != 70 {
		t.Fatalf("yeniden açınca antrenman farklı: %+v", got)
	}
	if _, err := os.Stat(filepath.Join(dir, "supergym.json.tmp")); !os.IsNotExist(err) {
		t.Fatal("geçici dosya arkada kaldı")
	}

	// Aynı güne tekrar yazmak değiştirir, yenisini eklemez.
	w.Items[0].Sets = w.Items[0].Sets[:1]
	d, _ := s.PutWorkout(w)
	if len(d.Workouts) != 1 || len(d.Workouts[0].Items[0].Sets) != 1 {
		t.Fatalf("antrenman değiştirilmedi: %+v", d.Workouts)
	}
	// Hareketi kalmayan gün silinir.
	d, _ = s.PutWorkout(Workout{Date: "2026-10-14"})
	if len(d.Workouts) != 0 {
		t.Fatalf("boş antrenman silinmedi: %+v", d.Workouts)
	}
}

func TestWorkoutsSortedByDate(t *testing.T) {
	s, _ := newTestStore(t)
	sq := exerciseID(t, s.Data(), "Squat")
	for _, date := range []string{"2026-10-14", "2026-10-01", "2026-10-07"} {
		s.PutWorkout(Workout{Date: date, Items: []Item{{ExerciseID: sq}}})
	}
	var dates []string
	for _, w := range s.Data().Workouts {
		dates = append(dates, w.Date)
	}
	if strings.Join(dates, ",") != "2026-10-01,2026-10-07,2026-10-14" {
		t.Fatalf("sıralı değil: %v", dates)
	}
}

func TestValidationLeavesDataUnchanged(t *testing.T) {
	s, _ := newTestStore(t)
	sq := exerciseID(t, s.Data(), "Squat")
	before, _ := json.Marshal(s.Data())

	bad := []func() (Data, error){
		func() (Data, error) {
			return s.PutWorkout(Workout{Date: "14.10.2026", Items: []Item{{ExerciseID: sq}}})
		},
		func() (Data, error) {
			return s.PutWorkout(Workout{Date: "2026-10-14", Items: []Item{{ExerciseID: "yok"}}})
		},
		func() (Data, error) {
			return s.PutWorkout(Workout{Date: "2026-10-14", Items: []Item{{ExerciseID: sq, Sets: []Set{{Reps: -1}}}}})
		},
		func() (Data, error) {
			return s.PutWorkout(Workout{Date: "2026-10-14", Items: []Item{{ExerciseID: sq, Sets: []Set{{Weight: -5}}}}})
		},
		func() (Data, error) { return s.AddExercise(Exercise{Name: "  "}) },
		func() (Data, error) { return s.AddExercise(Exercise{Name: "squat"}) }, // aynı ad
		func() (Data, error) { return s.AddExercise(Exercise{Name: "X", Kind: "yüzme"}) },
		func() (Data, error) { return s.AddTemplate(Template{Name: "Push", ExerciseIDs: []string{"yok"}}) },
		func() (Data, error) { return s.AddTemplate(Template{Name: ""}) },
		func() (Data, error) { return s.PutBodyWeight(BodyWeight{Date: "2026-10-14", Kg: 0}) },
		func() (Data, error) { return s.PutSettings(Settings{RestSeconds: -1}) },
		func() (Data, error) { return s.UpdateExercise("yok", Exercise{Name: "A"}) },
		func() (Data, error) { return s.DeleteWorkout("2026-01-01") },
	}
	for i, fn := range bad {
		if _, err := fn(); err == nil {
			t.Errorf("%d. geçersiz istek kabul edildi", i+1)
		}
	}
	after, _ := json.Marshal(s.Data())
	if string(before) != string(after) {
		t.Fatal("reddedilen istekler verileri değiştirdi")
	}
}

func TestAddExerciseDefaults(t *testing.T) {
	s, _ := newTestStore(t)
	d, err := s.AddExercise(Exercise{Name: " Hip Thrust ", Group: "uydurma", ID: "elle"})
	if err != nil {
		t.Fatal(err)
	}
	e := d.Exercises[len(d.Exercises)-1]
	if e.Name != "Hip Thrust" || e.Group != "Diğer" || e.Kind != KindWeight || e.ID == "elle" || e.ID == "" {
		t.Fatalf("beklenmeyen hareket: %+v", e)
	}
}

func TestDeleteExercise(t *testing.T) {
	s, _ := newTestStore(t)
	d := s.Data()
	sq, lp := exerciseID(t, d, "Squat"), exerciseID(t, d, "Leg Press")
	s.PutWorkout(Workout{Date: "2026-10-14", Items: []Item{{ExerciseID: sq, Sets: []Set{{Reps: 5, Weight: 100}}}}})
	s.AddTemplate(Template{Name: "Bacak", ExerciseIDs: []string{sq, lp}})

	// Kullanılmamış hareket tamamen silinir ve programdan çıkar.
	d, err := s.DeleteExercise(lp)
	if err != nil {
		t.Fatal(err)
	}
	for _, e := range d.Exercises {
		if e.ID == lp {
			t.Fatal("kullanılmamış hareket silinmedi")
		}
	}
	if ids := d.Templates[0].ExerciseIDs; len(ids) != 1 || ids[0] != sq {
		t.Fatalf("program güncellenmedi: %v", ids)
	}

	// Kullanılmış hareket arşivlenir, antrenman bozulmaz.
	d, err = s.DeleteExercise(sq)
	if err != nil {
		t.Fatal(err)
	}
	found := false
	for _, e := range d.Exercises {
		if e.ID == sq {
			found = e.Archived
		}
	}
	if !found {
		t.Fatal("kullanılmış hareket arşivlenmedi")
	}
	if len(d.Workouts[0].Items) != 1 {
		t.Fatal("arşivleme antrenmanı bozdu")
	}
	if len(d.Templates[0].ExerciseIDs) != 0 {
		t.Fatal("arşivlenen hareket programda kaldı")
	}

	// Arşivden geri alınabilir; kullanılmış hareketin türü değişmez.
	e := Exercise{Name: "Squat", Group: "Bacak", Kind: KindWeight}
	if d, err = s.UpdateExercise(sq, e); err != nil {
		t.Fatal(err)
	}
	e.Kind = KindCardio
	if _, err = s.UpdateExercise(sq, e); err == nil {
		t.Fatal("kullanılmış hareketin türü değişti")
	}
}

func TestMigrateV1(t *testing.T) {
	dir := t.TempDir()
	v1 := `{"app":"SuperGym","version":1,"entries":[
		{"id":"a","date":"2026-10-13","exercise":"Bench Press","sets":3,"reps":10,"weight":60},
		{"id":"b","date":"2026-10-13","exercise":"Kendi Hareketim","sets":0,"reps":12,"weight":20,"note":"iyi"},
		{"id":"c","date":"2026-10-14","exercise":"bench press","sets":2,"reps":8,"weight":65}]}`
	if err := os.WriteFile(filepath.Join(dir, "supergym.json"), []byte(v1), 0o600); err != nil {
		t.Fatal(err)
	}
	s, err := OpenStore(dir)
	if err != nil {
		t.Fatal(err)
	}
	d := s.Data()
	if d.Version != schemaVersion {
		t.Fatalf("sürüm %d", d.Version)
	}
	bench, mine := exerciseID(t, d, "Bench Press"), exerciseID(t, d, "Kendi Hareketim")
	if len(d.Exercises) != len(defaultExercises)+1 {
		t.Fatalf("hareket sayısı %d", len(d.Exercises))
	}
	if len(d.Workouts) != 2 {
		t.Fatalf("antrenman sayısı %d, 2 olmalı", len(d.Workouts))
	}
	w := d.Workouts[0]
	if w.Date != "2026-10-13" || len(w.Items) != 2 {
		t.Fatalf("ilk gün: %+v", w)
	}
	if w.Items[0].ExerciseID != bench || len(w.Items[0].Sets) != 3 || w.Items[0].Sets[0] != (Set{Reps: 10, Weight: 60}) {
		t.Fatalf("3x10x60 üç sete dönüşmedi: %+v", w.Items[0])
	}
	if w.Items[1].ExerciseID != mine || len(w.Items[1].Sets) != 1 || w.Items[1].Note != "iyi" {
		t.Fatalf("set sayısı 0 olan kayıt: %+v", w.Items[1])
	}
	if d.Workouts[1].Items[0].ExerciseID != bench {
		t.Fatal("küçük/büyük harf farkı yeni hareket oluşturdu")
	}

	// Eski dosya saklanmış ve yeni dosya güncel sürümde olmalı.
	if b, err := os.ReadFile(filepath.Join(dir, "supergym.json.v1-yedek")); err != nil || string(b) != v1 {
		t.Fatalf("eski dosya saklanmadı: %v", err)
	}
	reopened, err := OpenStore(dir)
	if err != nil {
		t.Fatal(err)
	}
	if len(reopened.Data().Workouts) != 2 {
		t.Fatal("çevrilen veri kaydedilmedi")
	}
}

func TestExportImportRoundTrip(t *testing.T) {
	s, _ := newTestStore(t)
	sq := exerciseID(t, s.Data(), "Squat")
	s.PutWorkout(Workout{Date: "2026-10-14", Note: "zor", Items: []Item{{ExerciseID: sq, Sets: []Set{{Reps: 5, Weight: 102.5}}}}})
	s.AddTemplate(Template{Name: "Bacak", ExerciseIDs: []string{sq}})
	s.PutBodyWeight(BodyWeight{Date: "2026-10-14", Kg: 80.4})
	s.PutSettings(Settings{RestSeconds: 120})
	b, err := s.Export()
	if err != nil {
		t.Fatal(err)
	}

	other, _ := newTestStore(t)
	if _, err := other.Import(b); err != nil {
		t.Fatal(err)
	}
	want, _ := json.Marshal(s.Data())
	got, _ := json.Marshal(other.Data())
	if string(want) != string(got) {
		t.Fatalf("içe aktarılan veri farklı:\n%s\n%s", got, want)
	}
}

func TestImportRejects(t *testing.T) {
	cases := map[string]string{
		"JSON değil":         `merhaba`,
		"başka uygulama":     `{"app":"BaşkaUygulama","version":2}`,
		"yeni sürüm":         `{"app":"SuperGym","version":99}`,
		"v1 geçersiz kayıt":  `{"app":"SuperGym","version":1,"entries":[{"date":"2026-10-14","exercise":""}]}`,
		"v1 geçersiz tarih":  `{"app":"SuperGym","version":1,"entries":[{"date":"dün","exercise":"Squat"}]}`,
		"bilinmeyen hareket": `{"app":"SuperGym","version":2,"exercises":[],"workouts":[{"date":"2026-10-14","items":[{"exerciseId":"x"}]}]}`,
		"tekrarlanan ID": `{"app":"SuperGym","version":2,"exercises":[
			{"id":"x","name":"A","kind":"weight"},{"id":"x","name":"B","kind":"weight"}]}`,
	}
	for name, in := range cases {
		t.Run(name, func(t *testing.T) {
			s, _ := newTestStore(t)
			s.AddExercise(Exercise{Name: "Kalmalı"})
			before, _ := json.Marshal(s.Data())
			if _, err := s.Import([]byte(in)); err == nil {
				t.Fatal("hatalı yedek kabul edildi")
			}
			after, _ := json.Marshal(s.Data())
			if string(before) != string(after) {
				t.Fatal("reddedilen yedek mevcut verileri değiştirdi")
			}
		})
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
	if len(s.Data().Workouts) != 0 {
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
