package core

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
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
)

// Store, verileri telefondaki tek bir JSON dosyasında tutar.
type Store struct {
	mu   sync.Mutex
	path string
	data Data
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
		return nil, err
	}
	if s.data.Entries == nil {
		s.data.Entries = []Entry{}
	}
	return s, nil
}

func (s *Store) Entries() []Entry {
	s.mu.Lock()
	defer s.mu.Unlock()
	return append([]Entry(nil), s.data.Entries...)
}

func (s *Store) Add(e Entry) (Entry, error) {
	if e.Exercise == "" {
		return Entry{}, errors.New("hareket adı boş olamaz")
	}
	if e.Date == "" {
		e.Date = time.Now().Format("2006-01-02")
	}
	e.ID = newID()
	s.mu.Lock()
	defer s.mu.Unlock()
	s.data.Entries = append(s.data.Entries, e)
	return e, s.save()
}

func (s *Store) Delete(id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	for i, e := range s.data.Entries {
		if e.ID == id {
			s.data.Entries = append(s.data.Entries[:i], s.data.Entries[i+1:]...)
			return s.save()
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

// Import, mevcut verilerin yerine dosyadaki verileri koyar.
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
	for i := range in.Entries {
		if in.Entries[i].ID == "" {
			in.Entries[i].ID = newID()
		}
	}
	if in.Entries == nil {
		in.Entries = []Entry{}
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	s.data = Data{App: appName, Version: schemaVersion, Entries: in.Entries}
	return len(in.Entries), s.save()
}

// save, yarım yazılmış dosya kalmaması için önce geçici dosyaya yazar.
func (s *Store) save() error {
	b, err := json.MarshalIndent(s.data, "", "  ")
	if err != nil {
		return err
	}
	tmp := s.path + ".tmp"
	if err := os.WriteFile(tmp, b, 0o600); err != nil {
		return err
	}
	return os.Rename(tmp, s.path)
}

func newID() string {
	b := make([]byte, 8)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}
