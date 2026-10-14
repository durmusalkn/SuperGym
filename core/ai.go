package core

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

// Coach, yapay zekâ antrenörüne Gemini API (ücretsiz katman) üzerinden soru sorar.
//
// API anahtarı veri dosyasından ayrı tutulur (ai-anahtar.txt): yedeğe, dışa aktarmaya
// ve içe aktarmaya girmez, ekrana geri gönderilmez.
type Coach struct {
	mu      sync.Mutex
	keyPath string
	key     string
	base    string   // Gemini API adresi (testte sahte sunucu)
	models  []string // sırayla denenir: yoğunluk ya da kota hatasında sıradakine geçilir
	client  *http.Client
}

var (
	ErrNoKey       = errors.New("önce Gemini API anahtarını girin")
	ErrEmptyPrompt = errors.New("soru boş")
)

const geminiBase = "https://generativelanguage.googleapis.com/v1beta"

// coachModels: önce Flash (daha iyi cevap), yoğunsa Flash-Lite. "-latest" adları
// Google'ın o anki sürümüne gider; model adı değişince kodun değişmesi gerekmez.
var coachModels = []string{"gemini-flash-latest", "gemini-flash-lite-latest"}

func OpenCoach(dir string) *Coach {
	c := &Coach{
		keyPath: filepath.Join(dir, "ai-anahtar.txt"),
		base:    geminiBase,
		models:  coachModels,
		client:  &http.Client{Timeout: 60 * time.Second},
	}
	if b, err := os.ReadFile(c.keyPath); err == nil {
		c.key = strings.TrimSpace(string(b))
	}
	return c
}

func (c *Coach) HasKey() bool {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.key != ""
}

// SetKey anahtarı kaydeder; boş anahtar dosyayı siler.
func (c *Coach) SetKey(key string) error {
	key = strings.TrimSpace(key)
	if len(key) > 200 || strings.ContainsAny(key, " \t\r\n") {
		return errors.New("anahtar geçersiz görünüyor")
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	if key == "" {
		if err := os.Remove(c.keyPath); err != nil && !errors.Is(err, os.ErrNotExist) {
			return err
		}
	} else if err := os.WriteFile(c.keyPath, []byte(key), 0o600); err != nil {
		return err
	}
	c.key = key
	return nil
}

type AskRequest struct {
	System string `json:"system"`
	Prompt string `json:"prompt"`
}

type AskResponse struct {
	Text  string `json:"text"`
	Model string `json:"model"` // cevabı veren modelin sürümü (örn. gemini-3.5-flash-lite)
	Ms    int64  `json:"ms"`
}

// Ask soruyu sırayla modellere sorar; yalnızca yoğunluk/kota/sunucu hatasında bir
// sonraki modele geçer. Anahtar ya da istek hatasında hemen döner.
func (c *Coach) Ask(q AskRequest) (AskResponse, error) {
	c.mu.Lock()
	key := c.key
	c.mu.Unlock()
	if key == "" {
		return AskResponse{}, ErrNoKey
	}
	if strings.TrimSpace(q.Prompt) == "" {
		return AskResponse{}, ErrEmptyPrompt
	}
	body, _ := json.Marshal(geminiRequest(q))
	start := time.Now()
	var lastErr error
	for _, model := range c.models {
		res, retry, err := c.generate(key, model, body)
		if err == nil {
			res.Ms = time.Since(start).Milliseconds()
			return res, nil
		}
		lastErr = err
		if !retry {
			break
		}
	}
	return AskResponse{}, lastErr
}

func geminiRequest(q AskRequest) map[string]any {
	req := map[string]any{
		"contents": []any{map[string]any{"role": "user", "parts": []any{map[string]string{"text": q.Prompt}}}},
		"generationConfig": map[string]any{
			"temperature":     0.7,
			"maxOutputTokens": 2048,
		},
	}
	if s := strings.TrimSpace(q.System); s != "" {
		req["systemInstruction"] = map[string]any{"parts": []any{map[string]string{"text": s}}}
	}
	return req
}

// generate tek bir modele sorar. retry: başka modelle denemeye değer mi.
func (c *Coach) generate(key, model string, body []byte) (res AskResponse, retry bool, err error) {
	req, err := http.NewRequest("POST", c.base+"/models/"+model+":generateContent", bytes.NewReader(body))
	if err != nil {
		return res, false, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("x-goog-api-key", key)
	r, err := c.client.Do(req)
	if err != nil {
		return res, true, errors.New("Gemini'ye bağlanılamadı; internet bağlantısını kontrol edin")
	}
	defer r.Body.Close()
	b, _ := io.ReadAll(io.LimitReader(r.Body, 4<<20))

	var out struct {
		ModelVersion string `json:"modelVersion"`
		Candidates   []struct {
			Content struct {
				Parts []struct {
					Text    string `json:"text"`
					Thought bool   `json:"thought"`
				} `json:"parts"`
			} `json:"content"`
			FinishReason string `json:"finishReason"`
		} `json:"candidates"`
		PromptFeedback struct {
			BlockReason string `json:"blockReason"`
		} `json:"promptFeedback"`
		Error struct {
			Message string `json:"message"`
			Status  string `json:"status"`
		} `json:"error"`
	}
	_ = json.Unmarshal(b, &out)

	switch {
	case r.StatusCode == http.StatusOK:
	case r.StatusCode == http.StatusTooManyRequests:
		return res, true, errors.New("ücretsiz kota doldu; biraz sonra tekrar deneyin")
	case r.StatusCode >= 500:
		return res, true, errors.New("Gemini şu an yoğun; biraz sonra tekrar deneyin")
	case r.StatusCode == http.StatusBadRequest && strings.Contains(out.Error.Message, "API key"),
		r.StatusCode == http.StatusForbidden, r.StatusCode == http.StatusUnauthorized:
		return res, false, errors.New("Gemini API anahtarı geçersiz ya da yetkisiz")
	case r.StatusCode == http.StatusNotFound:
		// Model adı kalkmış olabilir; sıradakini dene.
		return res, true, fmt.Errorf("model bulunamadı: %s", model)
	default:
		msg := out.Error.Message
		if msg == "" {
			msg = r.Status
		}
		return res, false, fmt.Errorf("Gemini hatası: %s", msg)
	}

	if out.PromptFeedback.BlockReason != "" || len(out.Candidates) == 0 {
		return res, false, errors.New("Gemini bu soruya cevap vermedi")
	}
	var text strings.Builder
	for _, p := range out.Candidates[0].Content.Parts {
		if !p.Thought {
			text.WriteString(p.Text)
		}
	}
	if strings.TrimSpace(text.String()) == "" {
		return res, false, errors.New("Gemini boş cevap döndü")
	}
	res.Text = strings.TrimSpace(text.String())
	res.Model = out.ModelVersion
	if res.Model == "" {
		res.Model = model
	}
	return res, false, nil
}
