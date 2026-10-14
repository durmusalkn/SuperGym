package core

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"
)

// Entry, antrenmanda yapılan tek bir hareketin kaydıdır.
type Entry struct {
	ID       string  `json:"id"`
	Date     string  `json:"date"` // YYYY-MM-DD
	Exercise string  `json:"exercise"`
	Sets     int     `json:"sets"`
	Reps     int     `json:"reps"`
	Weight   float64 `json:"weight"`
	Note     string  `json:"note,omitempty"`
}

// Data, dışa/içe aktarılan dosyanın tamamıdır.
type Data struct {
	App        string  `json:"app"`
	Version    int     `json:"version"`
	ExportedAt string  `json:"exportedAt,omitempty"`
	Entries    []Entry `json:"entries"`
}

const (
	appName       = "SuperGym"
	schemaVersion = 1
	dateLayout    = "2006-01-02"
)

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
	s := &Store{
		path: filepath.Join(dir, "supergym.json"),
		data: Data{App: appName, Version: schemaVersion, Entries: []Entry{}},
	}
	b, err := os.ReadFile(s.path)
	if errors.Is(err, os.ErrNotExist) {
		return s, nil
	}
	if err != nil {
		return nil, err
	}
	if err := json.Unmarshal(b, &s.data); err != nil {
		// Bozuk dosya yüzünden uygulama hiç açılamaz hale gelmesin: dosyayı silmeden
		// kenara al ve boş verilerle devam et.
		bad := s.path + ".bozuk-" + time.Now().Format("20060102-150405")
		if err := os.Rename(s.path, bad); err != nil {
			return nil, err
		}
		s.data = Data{App: appName, Version: schemaVersion, Entries: []Entry{}}
		s.warning = "Veri dosyası okunamadı ve kenara alındı (" + filepath.Base(bad) +
			"). Yedeğiniz varsa İçe aktar ile geri yükleyin."
		return s, nil
	}
	if s.data.Entries == nil {
		s.data.Entries = []Entry{}
	}
	return s, nil
}

// Warning, açılışta veri dosyasıyla ilgili bir sorun olduysa açıklamasını döner.
func (s *Store) Warning() string {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.warning
}

func (s *Store) Entries() []Entry {
	s.mu.Lock()
	defer s.mu.Unlock()
	// Boş listede de JSON'da null değil [] dönsün.
	return append([]Entry{}, s.data.Entries...)
}

func (s *Store) Add(e Entry) (Entry, error) {
	if e.Date == "" {
		e.Date = time.Now().Format(dateLayout)
	}
	if err := validate(e); err != nil {
		return Entry{}, err
	}
	e.ID = newID()
	s.mu.Lock()
	defer s.mu.Unlock()
	entries := append(append([]Entry(nil), s.data.Entries...), e)
	return e, s.replace(entries)
}

func (s *Store) Delete(id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	for i, e := range s.data.Entries {
		if e.ID == id {
			entries := append(append([]Entry(nil), s.data.Entries[:i]...), s.data.Entries[i+1:]...)
			return s.replace(entries)
		}
	}
	return errors.New("kayıt bulunamadı")
}

func (s *Store) Export() ([]byte, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	out := s.data
	out.ExportedAt = time.Now().Format(time.RFC3339)
	return json.MarshalIndent(out, "", "  ")
}

// Import, mevcut verilerin yerine dosyadaki verileri koyar. Dosyada tek bir
// geçersiz kayıt bile varsa hiçbir şey değiştirilmez.
func (s *Store) Import(b []byte) (int, error) {
	var in Data
	if err := json.Unmarshal(b, &in); err != nil {
		return 0, errors.New("dosya okunamadı: geçerli bir JSON değil")
	}
	if in.App != appName {
		return 0, errors.New("bu dosya bir SuperGym yedeği değil")
	}
	if in.Version > schemaVersion {
		return 0, errors.New("yedek, uygulamanın daha yeni bir sürümüyle alınmış")
	}
	seen := make(map[string]bool, len(in.Entries))
	for i := range in.Entries {
		e := &in.Entries[i]
		if err := validate(*e); err != nil {
			return 0, fmt.Errorf("%d. kayıt geçersiz: %w", i+1, err)
		}
		if e.ID == "" || seen[e.ID] {
			e.ID = newID()
		}
		seen[e.ID] = true
	}
	if in.Entries == nil {
		in.Entries = []Entry{}
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if err := s.replace(in.Entries); err != nil {
		return 0, err
	}
	s.warning = ""
	return len(in.Entries), nil
}

func validate(e Entry) error {
	if e.Exercise == "" {
		return errors.New("hareket adı boş olamaz")
	}
	if _, err := time.Parse(dateLayout, e.Date); err != nil {
		return errors.New("tarih YYYY-AA-GG biçiminde olmalı")
	}
	if e.Sets < 0 || e.Reps < 0 || e.Weight < 0 {
		return errors.New("set, tekrar ve kilo negatif olamaz")
	}
	return nil
}

// replace, kayıtları önce diske yazar; yazma başarılı olursa bellekteki veriyi
// günceller. Böylece bellek ile dosya hiçbir zaman birbirinden ayrışmaz.
func (s *Store) replace(entries []Entry) error {
	next := Data{App: appName, Version: schemaVersion, Entries: entries}
	b, err := json.MarshalIndent(next, "", "  ")
	if err != nil {
		return err
	}
	if err := writeFileAtomic(s.path, b); err != nil {
		return err
	}
	s.data = next
	return nil
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
