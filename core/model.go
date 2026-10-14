package core

import (
	"errors"
	"fmt"
	"math"
	"slices"
	"sort"
	"strings"
	"time"
)

// Exercise, hareket listesindeki bir harekettir. Kullanılmış bir hareket silinince
// geçmiş antrenmanlar bozulmasın diye kaybolmaz, arşivlenir.
type Exercise struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	Group    string `json:"group"`
	Kind     string `json:"kind"` // KindWeight veya KindCardio
	Archived bool   `json:"archived,omitempty"`
	Note     string `json:"note,omitempty"` // form ipuçları, makine ayarı vb.
	// Artırma önerisi için hedef tekrar aralığı ve ağırlık artışı (ağırlık hareketlerinde).
	RepMin    int     `json:"repMin,omitempty"`
	RepMax    int     `json:"repMax,omitempty"`
	Increment float64 `json:"increment,omitempty"`
}

// Set, bir hareketin tek bir setidir. Ağırlık hareketlerinde Reps/Weight,
// kardiyoda Minutes/Km kullanılır.
type Set struct {
	Reps    int     `json:"reps,omitempty"`
	Weight  float64 `json:"weight,omitempty"`
	Minutes float64 `json:"minutes,omitempty"`
	Km      float64 `json:"km,omitempty"`
	Warmup  bool    `json:"warmup,omitempty"` // ısınma seti: rekor, hacim ve grafiğe sayılmaz
	RPE     float64 `json:"rpe,omitempty"`    // zorluk 1-10 (0: girilmedi)
}

// Item, bir antrenmanda yapılan hareket ve setleridir.
type Item struct {
	ExerciseID string `json:"exerciseId"`
	Sets       []Set  `json:"sets"`
	Note       string `json:"note,omitempty"`
	LinkNext   bool   `json:"linkNext,omitempty"` // sonraki hareketle süperset
}

// Workout, bir günün antrenmanıdır. Her gün için en fazla bir antrenman olur.
type Workout struct {
	Date  string `json:"date"` // YYYY-MM-DD
	Items []Item `json:"items"`
	Note  string `json:"note,omitempty"`
	Start string `json:"start,omitempty"` // ilk setin zamanı (RFC 3339)
	End   string `json:"end,omitempty"`   // son setin zamanı (RFC 3339)
}

// Template, hazır programdır (örn. "Push"): seçilince hareketleri antrenmana eklenir.
type Template struct {
	ID          string   `json:"id"`
	Name        string   `json:"name"`
	ExerciseIDs []string `json:"exerciseIds"`
}

type BodyWeight struct {
	Date string  `json:"date"`
	Kg   float64 `json:"kg"`
}

type Settings struct {
	RestSeconds  int    `json:"restSeconds"`          // 0: dinlenme sayacı kapalı
	ShowRPE      bool   `json:"showRpe,omitempty"`    // setlerde zorluk (RPE) kutusu
	BackupDays   int    `json:"backupDays"`           // otomatik yedek aralığı (gün), 0: kapalı
	LastBackup   string `json:"lastBackup,omitempty"` // son otomatik yedeğin tarihi
	ReminderDays []int  `json:"reminderDays"`         // hatırlatma günleri (0: Pazar … 6: Cumartesi)
	ReminderTime string `json:"reminderTime"`         // hatırlatma saati, SS:DD
	InactiveDays int    `json:"inactiveDays"`         // bu kadar gün gidilmezse hatırlat, 0: kapalı
}

// Data, verilerin tamamıdır; dışa/içe aktarılan dosya da budur.
type Data struct {
	App         string       `json:"app"`
	Version     int          `json:"version"`
	ExportedAt  string       `json:"exportedAt,omitempty"`
	Exercises   []Exercise   `json:"exercises"`
	Workouts    []Workout    `json:"workouts"`
	Templates   []Template   `json:"templates"`
	BodyWeights []BodyWeight `json:"bodyWeights"`
	Settings    Settings     `json:"settings"`
}

const (
	appName       = "SuperGym"
	schemaVersion = 3
	dateLayout    = "2006-01-02"

	KindWeight = "weight"
	KindCardio = "cardio"

	defaultRestSeconds  = 90
	defaultBackupDays   = 7
	defaultReminderTime = "18:00"
	defaultRepMin       = 8
	defaultRepMax       = 12
	defaultIncrement    = 2.5
)

// Groups, kas gruplarıdır. Arayüz de aynı listeyi kullanır.
var Groups = []string{"Göğüs", "Sırt", "Bacak", "Omuz", "Kol", "Karın", "Kardiyo", "Diğer"}

// İlk açılışta hazır gelen hareketler. Kullanıcı istediğini silebilir.
var defaultExercises = []struct{ name, group, kind string }{
	{"Bench Press", "Göğüs", KindWeight},
	{"Incline Bench Press", "Göğüs", KindWeight},
	{"Dumbbell Press", "Göğüs", KindWeight},
	{"Pec Deck", "Göğüs", KindWeight},
	{"Lat Pulldown", "Sırt", KindWeight},
	{"Barbell Row", "Sırt", KindWeight},
	{"Seated Cable Row", "Sırt", KindWeight},
	{"Deadlift", "Sırt", KindWeight},
	{"Barfiks", "Sırt", KindWeight},
	{"Squat", "Bacak", KindWeight},
	{"Leg Press", "Bacak", KindWeight},
	{"Leg Extension", "Bacak", KindWeight},
	{"Leg Curl", "Bacak", KindWeight},
	{"Calf Raise", "Bacak", KindWeight},
	{"Shoulder Press", "Omuz", KindWeight},
	{"Lateral Raise", "Omuz", KindWeight},
	{"Face Pull", "Omuz", KindWeight},
	{"Biceps Curl", "Kol", KindWeight},
	{"Hammer Curl", "Kol", KindWeight},
	{"Triceps Pushdown", "Kol", KindWeight},
	{"Crunch", "Karın", KindWeight},
	{"Leg Raise", "Karın", KindWeight},
	{"Koşu Bandı", "Kardiyo", KindCardio},
	{"Bisiklet", "Kardiyo", KindCardio},
	{"Eliptik", "Kardiyo", KindCardio},
}

func newData() Data {
	d := Data{
		App:         appName,
		Version:     schemaVersion,
		Exercises:   []Exercise{},
		Workouts:    []Workout{},
		Templates:   []Template{},
		BodyWeights: []BodyWeight{},
		Settings: Settings{
			RestSeconds:  defaultRestSeconds,
			BackupDays:   defaultBackupDays,
			ReminderDays: []int{},
			ReminderTime: defaultReminderTime,
		},
	}
	for _, e := range defaultExercises {
		d.Exercises = append(d.Exercises, Exercise{ID: newID(), Name: e.name, Group: e.group, Kind: e.kind})
	}
	return d
}

// legacyEntry, 1. sürümdeki tek satırlık kayıttır (set sayısı × tekrar × kilo).
type legacyEntry struct {
	Date     string  `json:"date"`
	Exercise string  `json:"exercise"`
	Sets     int     `json:"sets"`
	Reps     int     `json:"reps"`
	Weight   float64 `json:"weight"`
	Note     string  `json:"note,omitempty"`
}

// fileData, diskteki ya da içe aktarılan dosyanın her iki sürümü de okunabilsin diye
// Data'ya eski "entries" alanını ekler.
type fileData struct {
	Data
	Entries []legacyEntry `json:"entries"`
}

// upgrade, dosyayı güncel sürüme çevirir ve eksik alanları doldurur.
func upgrade(in fileData) (Data, error) {
	if in.App != appName {
		return Data{}, errors.New("bu dosya bir SuperGym yedeği değil")
	}
	if in.Version > schemaVersion {
		return Data{}, errors.New("yedek, uygulamanın daha yeni bir sürümüyle alınmış")
	}
	if in.Version < 2 {
		return migrateV1(in.Entries)
	}
	d := in.Data
	d.ExportedAt = ""
	if in.Version < 3 {
		// 3. sürümde gelen ayarların varsayılanları.
		d.Settings.BackupDays = defaultBackupDays
		d.Settings.ReminderTime = defaultReminderTime
	}
	normalize(&d)
	return d, validateData(d)
}

// migrateV1, eski kayıtları hazır hareket listesinin üzerine taşır: aynı gündeki kayıtlar
// tek antrenman olur, "3 set × 10 × 60 kg" üç ayrı sete dönüşür.
func migrateV1(entries []legacyEntry) (Data, error) {
	d := newData()
	byName := map[string]string{}
	for _, e := range d.Exercises {
		byName[strings.ToLower(e.Name)] = e.ID
	}
	byDate := map[string]*Workout{}
	var dates []string
	for i, e := range entries {
		name := strings.TrimSpace(e.Exercise)
		if name == "" {
			return Data{}, fmt.Errorf("%d. kayıt geçersiz: hareket adı boş olamaz", i+1)
		}
		if !validDate(e.Date) {
			return Data{}, fmt.Errorf("%d. kayıt geçersiz: tarih YYYY-AA-GG biçiminde olmalı", i+1)
		}
		if e.Sets < 0 || e.Reps < 0 || e.Weight < 0 {
			return Data{}, fmt.Errorf("%d. kayıt geçersiz: set, tekrar ve kilo negatif olamaz", i+1)
		}
		id, ok := byName[strings.ToLower(name)]
		if !ok {
			id = newID()
			byName[strings.ToLower(name)] = id
			d.Exercises = append(d.Exercises, Exercise{ID: id, Name: name, Group: "Diğer", Kind: KindWeight})
		}
		w := byDate[e.Date]
		if w == nil {
			w = &Workout{Date: e.Date, Items: []Item{}}
			byDate[e.Date] = w
			dates = append(dates, e.Date)
		}
		idx := slices.IndexFunc(w.Items, func(it Item) bool { return it.ExerciseID == id })
		if idx < 0 {
			w.Items = append(w.Items, Item{ExerciseID: id, Sets: []Set{}})
			idx = len(w.Items) - 1
		}
		it := &w.Items[idx]
		for range max(e.Sets, 1) {
			it.Sets = append(it.Sets, Set{Reps: e.Reps, Weight: e.Weight})
		}
		if e.Note != "" {
			it.Note = strings.TrimSpace(strings.Join([]string{it.Note, e.Note}, " "))
		}
	}
	for _, date := range dates {
		d.Workouts = append(d.Workouts, *byDate[date])
	}
	normalize(&d)
	return d, validateData(d)
}

// normalize, boş listeleri doldurur, metinleri kırpar ve sıralar.
func normalize(d *Data) {
	d.App, d.Version = appName, schemaVersion
	if d.Exercises == nil {
		d.Exercises = []Exercise{}
	}
	for i := range d.Exercises {
		e := &d.Exercises[i]
		e.Name = strings.TrimSpace(e.Name)
		if !slices.Contains(Groups, e.Group) {
			e.Group = "Diğer"
		}
		if e.Kind == "" {
			e.Kind = KindWeight
		}
		e.Note = strings.TrimSpace(e.Note)
		if e.Kind == KindWeight {
			if e.RepMin == 0 && e.RepMax == 0 {
				e.RepMin, e.RepMax = defaultRepMin, defaultRepMax
			}
			if e.Increment == 0 {
				e.Increment = defaultIncrement
			}
		}
	}
	if d.Workouts == nil {
		d.Workouts = []Workout{}
	}
	for i := range d.Workouts {
		w := &d.Workouts[i]
		w.Note = strings.TrimSpace(w.Note)
		if w.Items == nil {
			w.Items = []Item{}
		}
		for j := range w.Items {
			if w.Items[j].Sets == nil {
				w.Items[j].Sets = []Set{}
			}
		}
	}
	sort.SliceStable(d.Workouts, func(i, j int) bool { return d.Workouts[i].Date < d.Workouts[j].Date })
	if d.Templates == nil {
		d.Templates = []Template{}
	}
	seen := map[string]bool{}
	for i := range d.Templates {
		t := &d.Templates[i]
		t.Name = strings.TrimSpace(t.Name)
		if t.ExerciseIDs == nil {
			t.ExerciseIDs = []string{}
		}
		if t.ID == "" || seen[t.ID] {
			t.ID = newID()
		}
		seen[t.ID] = true
	}
	if d.BodyWeights == nil {
		d.BodyWeights = []BodyWeight{}
	}
	if d.Settings.ReminderDays == nil {
		d.Settings.ReminderDays = []int{}
	}
	slices.Sort(d.Settings.ReminderDays)
	d.Settings.ReminderDays = slices.Compact(d.Settings.ReminderDays)
	if d.Settings.ReminderTime == "" {
		d.Settings.ReminderTime = defaultReminderTime
	}
	sort.SliceStable(d.BodyWeights, func(i, j int) bool { return d.BodyWeights[i].Date < d.BodyWeights[j].Date })
}

// validateData, verilerin tamamını denetler. Her değişiklik ve içe aktarma diske
// yazılmadan önce buradan geçer; böylece dosyada tutarsız veri oluşmaz.
func validateData(d Data) error {
	ids := map[string]Exercise{}
	names := map[string]bool{}
	for _, e := range d.Exercises {
		if e.ID == "" {
			return errors.New("hareketin ID'si boş olamaz")
		}
		if _, dup := ids[e.ID]; dup {
			return fmt.Errorf("aynı ID'ye sahip iki hareket var: %s", e.ID)
		}
		if e.Name == "" {
			return errors.New("hareket adı boş olamaz")
		}
		if len([]rune(e.Name)) > 60 {
			return errors.New("hareket adı en fazla 60 karakter olabilir")
		}
		if names[strings.ToLower(e.Name)] {
			return fmt.Errorf("%q adında bir hareket zaten var", e.Name)
		}
		if e.Kind != KindWeight && e.Kind != KindCardio {
			return fmt.Errorf("bilinmeyen hareket türü: %q", e.Kind)
		}
		if len([]rune(e.Note)) > 500 {
			return errors.New("hareket notu en fazla 500 karakter olabilir")
		}
		if e.RepMin < 0 || e.RepMax > 100 || e.RepMin > e.RepMax {
			return fmt.Errorf("%s: hedef tekrar aralığı geçersiz", e.Name)
		}
		if !validNumber(e.Increment) || e.Increment < 0 || e.Increment > 50 {
			return fmt.Errorf("%s: ağırlık artışı 0 ile 50 kg arasında olmalı", e.Name)
		}
		ids[e.ID] = e
		names[strings.ToLower(e.Name)] = true
	}

	dates := map[string]bool{}
	for _, w := range d.Workouts {
		if !validDate(w.Date) {
			return fmt.Errorf("geçersiz antrenman tarihi: %q", w.Date)
		}
		if dates[w.Date] {
			return fmt.Errorf("%s için iki antrenman var", w.Date)
		}
		dates[w.Date] = true
		for _, t := range []string{w.Start, w.End} {
			if _, err := time.Parse(time.RFC3339, t); t != "" && err != nil {
				return fmt.Errorf("%s: geçersiz antrenman saati", w.Date)
			}
		}
		for _, it := range w.Items {
			e, ok := ids[it.ExerciseID]
			if !ok {
				return fmt.Errorf("%s antrenmanında bilinmeyen hareket var", w.Date)
			}
			for _, s := range it.Sets {
				if err := validateSet(s); err != nil {
					return fmt.Errorf("%s, %s: %w", w.Date, e.Name, err)
				}
			}
		}
	}

	for _, t := range d.Templates {
		if t.Name == "" {
			return errors.New("program adı boş olamaz")
		}
		for _, id := range t.ExerciseIDs {
			if _, ok := ids[id]; !ok {
				return fmt.Errorf("%q programında bilinmeyen hareket var", t.Name)
			}
		}
	}

	bwDates := map[string]bool{}
	for _, b := range d.BodyWeights {
		if !validDate(b.Date) {
			return fmt.Errorf("geçersiz tarih: %q", b.Date)
		}
		if bwDates[b.Date] {
			return fmt.Errorf("%s için iki vücut ağırlığı kaydı var", b.Date)
		}
		bwDates[b.Date] = true
		if !validNumber(b.Kg) || b.Kg <= 0 || b.Kg > 500 {
			return errors.New("vücut ağırlığı 0 ile 500 kg arasında olmalı")
		}
	}

	st := d.Settings
	if st.RestSeconds < 0 || st.RestSeconds > 3600 {
		return errors.New("dinlenme süresi 0 ile 3600 saniye arasında olmalı")
	}
	if st.BackupDays < 0 || st.BackupDays > 60 {
		return errors.New("yedek aralığı 0 ile 60 gün arasında olmalı")
	}
	if st.LastBackup != "" && !validDate(st.LastBackup) {
		return errors.New("son yedek tarihi geçersiz")
	}
	for _, day := range st.ReminderDays {
		if day < 0 || day > 6 {
			return errors.New("hatırlatma günü geçersiz")
		}
	}
	if _, err := time.Parse("15:04", st.ReminderTime); err != nil {
		return errors.New("hatırlatma saati SS:DD biçiminde olmalı")
	}
	if st.InactiveDays < 0 || st.InactiveDays > 30 {
		return errors.New("hatırlatma için gün sayısı 0 ile 30 arasında olmalı")
	}
	return nil
}

func validateSet(s Set) error {
	if s.Reps < 0 || s.Reps > 10000 {
		return errors.New("tekrar 0 ile 10000 arasında olmalı")
	}
	for _, v := range []float64{s.Weight, s.Minutes, s.Km} {
		if !validNumber(v) || v < 0 {
			return errors.New("kilo, süre ve mesafe negatif olamaz")
		}
	}
	if s.Weight > 2000 || s.Minutes > 1440 || s.Km > 1000 {
		return errors.New("değer çok büyük")
	}
	if s.RPE != 0 && (s.RPE < 1 || s.RPE > 10) {
		return errors.New("zorluk (RPE) 1 ile 10 arasında olmalı")
	}
	return nil
}

func validNumber(v float64) bool { return !math.IsNaN(v) && !math.IsInf(v, 0) }

func validDate(s string) bool {
	_, err := time.Parse(dateLayout, s)
	return err == nil
}
