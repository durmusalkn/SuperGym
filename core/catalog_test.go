package core

import (
	"os"
	"path/filepath"
	"slices"
	"strings"
	"testing"
)

func TestCatalogIsValid(t *testing.T) {
	names := map[string]bool{}
	for _, c := range catalog {
		key := strings.ToLower(c.name)
		if names[key] {
			t.Errorf("%q iki kez var", c.name)
		}
		names[key] = true
		if !slices.Contains(Groups, c.group) {
			t.Errorf("%q: bilinmeyen grup %q", c.name, c.group)
		}
		if c.muscle != "" && !slices.Contains(Muscles[c.group], c.muscle) {
			t.Errorf("%q: %q grubunda %q hedef kası yok", c.name, c.group, c.muscle)
		}
		if c.kind == KindWeight && c.muscle == "" {
			t.Errorf("%q: ağırlık hareketinin hedef kası boş", c.name)
		}
	}
	for _, g := range Groups {
		if _, ok := Muscles[g]; !ok {
			t.Errorf("%q grubunun hedef kas listesi yok", g)
		}
	}
	// Her programdaki her yer için katalogda en az bir hareket olmalı.
	d := newData()
	for i, p := range builtinPrograms {
		if got := len(d.Templates[i].ExerciseIDs); got != len(p.slots) {
			t.Errorf("%s: %d hareket seçildi, %d olmalı", p.name, got, len(p.slots))
		}
	}
}

func names(d Data, ids []string) []string {
	out := []string{}
	for _, id := range ids {
		for _, e := range d.Exercises {
			if e.ID == id {
				out = append(out, e.Name)
			}
		}
	}
	return out
}

func builtin(t *testing.T, d Data, key string) Template {
	t.Helper()
	for _, tp := range d.Templates {
		if tp.Builtin == key {
			return tp
		}
	}
	t.Fatalf("%s hazır programı yok", key)
	return Template{}
}

func rate(t *testing.T, s *Store, name string, rating int) Data {
	t.Helper()
	for _, e := range s.Data().Exercises {
		if e.Name == name {
			e.Rating = rating
			d, err := s.UpdateExercise(e.ID, e)
			if err != nil {
				t.Fatal(err)
			}
			return d
		}
	}
	t.Fatalf("%q hareketi yok", name)
	return Data{}
}

func TestBuiltinProgramsFollowRatings(t *testing.T) {
	s, _ := newTestStore(t)
	d := s.Data()
	push := names(d, builtin(t, d, "push").ExerciseIDs)
	if push[0] != "Bench Press" || push[1] != "Incline Bench Press" || push[2] != "Shoulder Press" {
		t.Fatalf("puansız Push programı beklenmedik: %v", push)
	}
	legs := names(d, builtin(t, d, "legs").ExerciseIDs)
	if legs[0] != "Squat" || legs[1] != "Romanian Deadlift" || legs[2] != "Leg Press" {
		t.Fatalf("puansız Legs programı beklenmedik: %v", legs)
	}

	// Sevilen hareket seçilir, sevilmeyen (1 puan) dışarıda kalır.
	rate(t, s, "Incline Dumbbell Press", 5)
	d = rate(t, s, "Bench Press", 1)
	push = names(d, builtin(t, d, "push").ExerciseIDs)
	if push[0] != "Dumbbell Press" || push[1] != "Incline Dumbbell Press" || slices.Contains(push, "Bench Press") {
		t.Fatalf("puanlar programa yansımadı: %v", push)
	}

	// Temel hareket yerine, çok sevilse bile yalıtım hareketi ancak temel hareket sevilmiyorsa geçer.
	d = rate(t, s, "Pec Deck", 5)
	if push = names(d, builtin(t, d, "push").ExerciseIDs); push[0] != "Dumbbell Press" {
		t.Fatalf("ilk yere yalıtım hareketi geçti: %v", push)
	}
}

func TestBuiltinProtectedAndFork(t *testing.T) {
	s, _ := newTestStore(t)
	push := builtin(t, s.Data(), "push")
	if _, err := s.UpdateTemplate(push.ID, Template{Name: "X", ExerciseIDs: []string{}}); err == nil {
		t.Fatal("hazır program değiştirildi")
	}
	if _, err := s.DeleteTemplate(push.ID); err == nil {
		t.Fatal("hazır program silindi")
	}
	// İstemci kendi programını hazır program gibi gösteremez.
	d, err := s.AddTemplate(Template{Name: "Sahte", Builtin: "push", ForkOf: "x", ExerciseIDs: []string{push.ExerciseIDs[0]}})
	if err != nil {
		t.Fatal(err)
	}
	if last := d.Templates[len(d.Templates)-1]; last.Builtin != "" || last.ForkOf != "" || last.Name != "Sahte" {
		t.Fatalf("istemcinin verdiği alanlar kabul edildi: %+v", last)
	}

	d, err = s.ForkTemplate(push.ID)
	if err != nil {
		t.Fatal(err)
	}
	fork := d.Templates[len(d.Templates)-1]
	if fork.Name != "Push (kopyam)" || fork.ForkOf != push.ID || fork.Builtin != "" || !slices.Equal(fork.ExerciseIDs, push.ExerciseIDs) {
		t.Fatalf("kopya hatalı: %+v", fork)
	}
	d, _ = s.ForkTemplate(push.ID)
	if got := d.Templates[len(d.Templates)-1].Name; got != "Push (kopyam 2)" {
		t.Fatalf("ikinci kopyanın adı %q", got)
	}

	// Kopya düzenlenebilir; kopyalandığı program bilgisi korunur.
	fork.Name = "Benim Push"
	fork.ExerciseIDs = fork.ExerciseIDs[:2]
	fork.ForkOf = ""
	d, err = s.UpdateTemplate(fork.ID, fork)
	if err != nil {
		t.Fatal(err)
	}
	i := slices.IndexFunc(d.Templates, func(x Template) bool { return x.ID == fork.ID })
	if got := d.Templates[i]; got.Name != "Benim Push" || len(got.ExerciseIDs) != 2 || got.ForkOf != push.ID {
		t.Fatalf("kopya güncellenmedi: %+v", got)
	}

	// Puan değişip hazır program yeniden seçilince kopya etkilenmez.
	d = rate(t, s, "Bench Press", 1)
	if slices.Equal(builtin(t, d, "push").ExerciseIDs, push.ExerciseIDs) {
		t.Fatal("hazır program puana göre güncellenmedi")
	}
	if got := d.Templates[i].ExerciseIDs; !slices.Equal(got, push.ExerciseIDs[:2]) {
		t.Fatalf("kopya değişti: %v", got)
	}
	if _, err := s.ForkTemplate("yok"); err != ErrNotFound {
		t.Fatalf("olmayan program: %v", err)
	}
}

func TestAlarms(t *testing.T) {
	s, _ := newTestStore(t)
	d, _ := s.AddTemplate(Template{Name: "Kendi", ExerciseIDs: []string{builtin(t, s.Data(), "push").ExerciseIDs[0]}})
	own := d.Templates[len(d.Templates)-1].ID
	st := d.Settings
	st.Alarms = []Alarm{
		{Day: 6, Time: "09:00", TemplateID: "builtin-legs", Enabled: true},
		{Day: 2, Time: "18:00", TemplateID: own, Enabled: true},
		{Day: 0, Time: "10:00", Enabled: false},
	}
	d, err := s.PutSettings(st)
	if err != nil {
		t.Fatal(err)
	}
	a := d.Settings.Alarms
	// Pazartesiden başlayarak sıralanır: Salı, Cumartesi, Pazar.
	if len(a) != 3 || a[0].Day != 2 || a[1].Day != 6 || a[2].Day != 0 || a[0].ID == "" || a[0].ID == a[1].ID {
		t.Fatalf("alarmlar: %+v", a)
	}

	// Programı silinen alarm programsız kalır, silinmez.
	d, _ = s.DeleteTemplate(own)
	if d.Settings.Alarms[0].TemplateID != "" || len(d.Settings.Alarms) != 3 {
		t.Fatalf("silinen program alarmda kaldı: %+v", d.Settings.Alarms)
	}

	bad := []func(x *Settings){
		func(x *Settings) { x.Alarms = append(x.Alarms, Alarm{Day: 2, Time: "18:00"}) },
		func(x *Settings) { x.Alarms = append(x.Alarms, Alarm{Day: 7, Time: "18:00"}) },
		func(x *Settings) { x.Alarms = append(x.Alarms, Alarm{Day: 1, Time: "8:00"}) },
		func(x *Settings) { x.PrepMinutes = 500 },
		func(x *Settings) { x.SnoozeMinutes = 90 },
	}
	for i, fn := range bad {
		x := d.Settings
		x.Alarms = slices.Clone(x.Alarms)
		fn(&x)
		if _, err := s.PutSettings(x); err == nil {
			t.Errorf("%d. geçersiz alarm ayarı kabul edildi", i+1)
		}
	}
}

func TestUpgradeV3(t *testing.T) {
	dir := t.TempDir()
	v3 := `{"app":"SuperGym","version":3,"exercises":[
		{"id":"sq","name":"Squat","group":"Bacak","kind":"weight","repMin":5,"repMax":8},
		{"id":"ht","name":"hip thrust","group":"Diğer","kind":"weight"},
		{"id":"my","name":"Benim Hareketim","group":"Kol","kind":"weight"}],
		"workouts":[{"date":"2026-10-14","items":[{"exerciseId":"sq","sets":[{"reps":5,"weight":100}]}]}],
		"templates":[{"id":"t1","name":"Bacak günü","exerciseIds":["sq"]}],"bodyWeights":[],
		"settings":{"restSeconds":90,"backupDays":7,"reminderDays":[2,6],"reminderTime":"18:30","inactiveDays":3}}`
	if err := os.WriteFile(filepath.Join(dir, "supergym.json"), []byte(v3), 0o600); err != nil {
		t.Fatal(err)
	}
	s, err := OpenStore(dir)
	if err != nil {
		t.Fatal(err)
	}
	d := s.Data()
	if d.Version != 4 {
		t.Fatalf("sürüm %d", d.Version)
	}
	// Mevcut hareketler korunur, eksikler eklenir; aynı adlı hareket ikinci kez eklenmez.
	if len(d.Exercises) != len(catalog)+1 {
		t.Fatalf("hareket sayısı %d, %d olmalı", len(d.Exercises), len(catalog)+1)
	}
	sq := d.Exercises[0]
	if sq.ID != "sq" || sq.Muscle != "Ön bacak" || !sq.Compound || sq.RepMin != 5 {
		t.Fatalf("Squat: %+v", sq)
	}
	if ht := d.Exercises[1]; ht.Group != "Diğer" || ht.Muscle != "" {
		t.Fatalf("grubu farklı aynı adlı hareket değiştirildi: %+v", ht)
	}
	// Hatırlatma günleri alarm olur, uzun ara uyarısı kalır.
	st := d.Settings
	if len(st.Alarms) != 2 || st.Alarms[0].Day != 2 || st.Alarms[1].Day != 6 || st.Alarms[0].Time != "18:30" || !st.Alarms[0].Enabled {
		t.Fatalf("alarmlar: %+v", st.Alarms)
	}
	if len(st.ReminderDays) != 0 || st.InactiveDays != 3 || st.PrepMinutes != defaultPrepMinutes || st.SnoozeMinutes != defaultSnooze {
		t.Fatalf("ayarlar: %+v", st)
	}
	if len(d.Templates) != len(builtinPrograms)+1 || d.Templates[len(builtinPrograms)].ID != "t1" {
		t.Fatalf("programlar: %+v", d.Templates)
	}
	if _, err := os.Stat(filepath.Join(dir, "supergym.json.v3-yedek")); err != nil {
		t.Fatal("3. sürüm dosyası saklanmadı")
	}
}

func TestReset(t *testing.T) {
	s, dir := newTestStore(t)
	d := s.Data()
	sq, lp := exerciseID(t, d, "Squat"), exerciseID(t, d, "Leg Press")
	s.PutWorkout(Workout{Date: "2026-10-14", Items: []Item{{ExerciseID: lp, Sets: []Set{{Reps: 5, Weight: 100}}}}})
	s.DeleteExercise(lp) // kullanılmış: arşivlenir
	s.PutBodyWeight(BodyWeight{Date: "2026-10-14", Kg: 80})
	d, _ = s.AddTemplate(Template{Name: "Kendi", ExerciseIDs: []string{sq}})
	st := d.Settings
	st.Alarms = []Alarm{{Day: 2, Time: "18:00", Enabled: true}}
	s.PutSettings(st)
	rate(t, s, "Squat", 5)

	if _, err := s.Reset("bilmem"); err == nil {
		t.Fatal("bilinmeyen sıfırlama kabul edildi")
	}

	d, err := s.Reset(ResetHistory)
	if err != nil {
		t.Fatal(err)
	}
	if len(d.Workouts) != 0 || len(d.BodyWeights) != 0 {
		t.Fatal("geçmiş silinmedi")
	}
	if len(d.Settings.Alarms) != 1 || len(d.Templates) != len(builtinPrograms)+1 {
		t.Fatal("alarmlar ya da programlar silindi")
	}
	for _, e := range d.Exercises {
		if e.ID == lp {
			t.Fatal("arşivlenmiş hareket kaldı")
		}
		if e.ID == sq && e.Rating != 5 {
			t.Fatal("puan silindi")
		}
	}
	if b, err := os.ReadFile(filepath.Join(dir, "supergym.json.sifirlama-oncesi")); err != nil || !strings.Contains(string(b), "2026-10-14") {
		t.Fatal("sıfırlamadan önceki veriler saklanmadı")
	}

	d, err = s.Reset(ResetAll)
	if err != nil {
		t.Fatal(err)
	}
	if len(d.Settings.Alarms) != 0 || len(d.Templates) != len(builtinPrograms) || len(d.Exercises) != len(catalog) {
		t.Fatalf("fabrika ayarlarına dönmedi: %d alarm, %d program, %d hareket", len(d.Settings.Alarms), len(d.Templates), len(d.Exercises))
	}
	reopened, err := OpenStore(dir)
	if err != nil {
		t.Fatal(err)
	}
	if len(reopened.Data().Settings.Alarms) != 0 {
		t.Fatal("sıfırlama diske yazılmadı")
	}
}
