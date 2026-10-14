package core

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"slices"
	"strconv"
	"strings"
	"sync"
	"time"
)

// ErrNotFound, istenen kayıt yoksa döner.
var ErrNotFound = errors.New("kayıt bulunamadı")

// Store, verileri telefondaki tek bir JSON dosyasında tutar.
type Store struct {
	mu      sync.Mutex
	path    string
	data    Data
	warning string
}

func OpenStore(dir string) (*Store, error) {
	if err := os.MkdirAll(dir, 0o700); err != nil {
		return nil, err
	}
	s := &Store{path: filepath.Join(dir, "supergym.json")}
	b, err := os.ReadFile(s.path)
	if errors.Is(err, os.ErrNotExist) {
		// İlk açılış: hazır hareket listesiyle başla.
		return s, s.write(newData())
	}
	if err != nil {
		return nil, err
	}
	var in fileData
	err = json.Unmarshal(b, &in)
	var d Data
	if err == nil {
		d, err = upgrade(in)
	}
	if err != nil {
		// Bozuk dosya yüzünden uygulama hiç açılamaz hale gelmesin: dosyayı silmeden
		// kenara al ve boş verilerle devam et.
		bad := s.path + ".bozuk-" + time.Now().Format("20060102-150405")
		if err := os.Rename(s.path, bad); err != nil {
			return nil, err
		}
		s.warning = "Veri dosyası okunamadı ve kenara alındı (" + filepath.Base(bad) +
			"). Yedeğiniz varsa İçe aktar ile geri yükleyin."
		return s, s.write(newData())
	}
	if in.Version < schemaVersion {
		// Eski sürümün dosyası çevrilmeden önce olduğu gibi saklanır.
		if err := writeFileAtomic(s.path+".v"+strconv.Itoa(max(in.Version, 1))+"-yedek", b); err != nil {
			return nil, err
		}
		return s, s.write(d)
	}
	s.data = d
	return s, nil
}

// Warning, açılışta veri dosyasıyla ilgili bir sorun olduysa açıklamasını döner.
func (s *Store) Warning() string {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.warning
}

// Data, verilerin bir kopyasını döner.
func (s *Store) Data() Data {
	s.mu.Lock()
	defer s.mu.Unlock()
	return clone(s.data)
}

// update, verilerin bir kopyası üzerinde fn'i çalıştırır; sonuç geçerliyse diske yazar.
// fn ya da doğrulama hata verirse hiçbir şey değişmez.
func (s *Store) update(fn func(d *Data) error) (Data, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	next := clone(s.data)
	if err := fn(&next); err != nil {
		return Data{}, err
	}
	normalize(&next)
	if err := validateData(next); err != nil {
		return Data{}, err
	}
	if err := s.write(next); err != nil {
		return Data{}, err
	}
	return clone(next), nil
}

func (s *Store) AddExercise(e Exercise) (Data, error) {
	return s.update(func(d *Data) error {
		e.ID = newID()
		e.Archived = false
		d.Exercises = append(d.Exercises, e)
		return nil
	})
}

// UpdateExercise, hareketin adını, grubunu, türünü ve arşiv durumunu değiştirir.
// Kullanılmış bir hareketin türü değiştirilemez (setleri anlamsızlaşır).
func (s *Store) UpdateExercise(id string, e Exercise) (Data, error) {
	return s.update(func(d *Data) error {
		i := slices.IndexFunc(d.Exercises, func(x Exercise) bool { return x.ID == id })
		if i < 0 {
			return ErrNotFound
		}
		old := d.Exercises[i]
		if e.Kind == "" {
			e.Kind = old.Kind
		}
		if e.Kind != old.Kind && used(*d, id) {
			return errors.New("antrenmanlarda kullanılmış bir hareketin türü değiştirilemez")
		}
		e.ID = id
		d.Exercises[i] = e
		return nil
	})
}

// DeleteExercise, hareketi programlardan çıkarır. Antrenmanlarda kullanılmışsa geçmiş
// bozulmasın diye arşivler, kullanılmamışsa tamamen siler.
func (s *Store) DeleteExercise(id string) (Data, error) {
	return s.update(func(d *Data) error {
		i := slices.IndexFunc(d.Exercises, func(x Exercise) bool { return x.ID == id })
		if i < 0 {
			return ErrNotFound
		}
		for j := range d.Templates {
			d.Templates[j].ExerciseIDs = slices.DeleteFunc(d.Templates[j].ExerciseIDs,
				func(x string) bool { return x == id })
		}
		if used(*d, id) {
			d.Exercises[i].Archived = true
		} else {
			d.Exercises = slices.Delete(d.Exercises, i, i+1)
		}
		return nil
	})
}

// PutWorkout, o günün antrenmanını verilenle değiştirir. Hiç hareket yoksa günü siler.
func (s *Store) PutWorkout(w Workout) (Data, error) {
	return s.update(func(d *Data) error {
		if !validDate(w.Date) {
			return errors.New("tarih YYYY-AA-GG biçiminde olmalı")
		}
		d.Workouts = slices.DeleteFunc(d.Workouts, func(x Workout) bool { return x.Date == w.Date })
		if len(w.Items) > 0 || strings.TrimSpace(w.Note) != "" {
			d.Workouts = append(d.Workouts, w)
		}
		return nil
	})
}

func (s *Store) DeleteWorkout(date string) (Data, error) {
	return s.update(func(d *Data) error {
		n := len(d.Workouts)
		d.Workouts = slices.DeleteFunc(d.Workouts, func(x Workout) bool { return x.Date == date })
		if len(d.Workouts) == n {
			return ErrNotFound
		}
		return nil
	})
}

func (s *Store) AddTemplate(t Template) (Data, error) {
	return s.update(func(d *Data) error {
		t.ID = newID()
		d.Templates = append(d.Templates, t)
		return nil
	})
}

func (s *Store) UpdateTemplate(id string, t Template) (Data, error) {
	return s.update(func(d *Data) error {
		i := slices.IndexFunc(d.Templates, func(x Template) bool { return x.ID == id })
		if i < 0 {
			return ErrNotFound
		}
		t.ID = id
		d.Templates[i] = t
		return nil
	})
}

func (s *Store) DeleteTemplate(id string) (Data, error) {
	return s.update(func(d *Data) error {
		n := len(d.Templates)
		d.Templates = slices.DeleteFunc(d.Templates, func(x Template) bool { return x.ID == id })
		if len(d.Templates) == n {
			return ErrNotFound
		}
		return nil
	})
}

// PutBodyWeight, o günün vücut ağırlığını kaydeder (varsa değiştirir).
func (s *Store) PutBodyWeight(b BodyWeight) (Data, error) {
	return s.update(func(d *Data) error {
		d.BodyWeights = slices.DeleteFunc(d.BodyWeights, func(x BodyWeight) bool { return x.Date == b.Date })
		d.BodyWeights = append(d.BodyWeights, b)
		return nil
	})
}

func (s *Store) DeleteBodyWeight(date string) (Data, error) {
	return s.update(func(d *Data) error {
		n := len(d.BodyWeights)
		d.BodyWeights = slices.DeleteFunc(d.BodyWeights, func(x BodyWeight) bool { return x.Date == date })
		if len(d.BodyWeights) == n {
			return ErrNotFound
		}
		return nil
	})
}

func (s *Store) PutSettings(st Settings) (Data, error) {
	return s.update(func(d *Data) error {
		d.Settings = st
		return nil
	})
}

func (s *Store) Export() ([]byte, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	out := clone(s.data)
	out.ExportedAt = time.Now().Format(time.RFC3339)
	return json.MarshalIndent(out, "", "  ")
}

// Import, mevcut verilerin yerine dosyadaki verileri koyar. Eski sürümün yedekleri de
// kabul edilir ve çevrilir. Dosyada tek bir geçersiz kayıt bile varsa hiçbir şey değişmez.
func (s *Store) Import(b []byte) (Data, error) {
	var in fileData
	if err := json.Unmarshal(b, &in); err != nil {
		return Data{}, errors.New("dosya okunamadı: geçerli bir JSON değil")
	}
	d, err := upgrade(in)
	if err != nil {
		return Data{}, err
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if err := s.write(d); err != nil {
		return Data{}, err
	}
	s.warning = ""
	return clone(d), nil
}

// write, veriyi önce diske yazar; yazma başarılı olursa bellekteki veriyi günceller.
// Böylece bellek ile dosya hiçbir zaman birbirinden ayrışmaz.
func (s *Store) write(d Data) error {
	b, err := json.MarshalIndent(d, "", "  ")
	if err != nil {
		return err
	}
	if err := writeFileAtomic(s.path, b); err != nil {
		return err
	}
	s.data = d
	return nil
}

func used(d Data, exerciseID string) bool {
	for _, w := range d.Workouts {
		for _, it := range w.Items {
			if it.ExerciseID == exerciseID {
				return true
			}
		}
	}
	return false
}

// clone, verilerin derin kopyasını döner (değişiklikler başarısız olursa asıl veri
// etkilenmesin diye).
func clone(d Data) Data {
	b, err := json.Marshal(d)
	if err != nil {
		panic(err)
	}
	var out Data
	if err := json.Unmarshal(b, &out); err != nil {
		panic(err)
	}
	return out
}

// writeFileAtomic, yarım yazılmış dosya kalmaması için önce geçici dosyaya yazar,
// diske işlendiğinden emin olur (fsync) ve sonra asıl dosyanın yerine koyar.
func writeFileAtomic(path string, b []byte) error {
	tmp := path + ".tmp"
	f, err := os.OpenFile(tmp, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, 0o600)
	if err != nil {
		return err
	}
	if _, err := f.Write(b); err != nil {
		f.Close()
		return err
	}
	if err := f.Sync(); err != nil {
		f.Close()
		return err
	}
	if err := f.Close(); err != nil {
		return err
	}
	if err := os.Rename(tmp, path); err != nil {
		return err
	}
	// Yeniden adlandırmanın da kalıcı olması için klasörü de diske işle.
	if d, err := os.Open(filepath.Dir(path)); err == nil {
		d.Sync()
		d.Close()
	}
	return nil
}

func newID() string {
	b := make([]byte, 8)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}
