package core

import (
	"crypto/rand"
	"crypto/subtle"
	"embed"
	"encoding/hex"
	"encoding/json"
	"io"
	"io/fs"
	"net"
	"net/http"
	"time"
)

// dist, Vite ile derlenen arayüzdür (web/ klasöründe `npm run build`).
//
//go:embed all:dist
var dist embed.FS

// TokenHeader, arayüzün her API isteğinde gönderdiği anahtarın başlığıdır.
const TokenHeader = "X-SuperGym-Token"

// Start, verilen klasördeki verilerle yerel sunucuyu başlatır ve açılacak adresi döner.
// addr örn. "127.0.0.1:0" (rastgele boş port) veya "127.0.0.1:8080".
//
// Dönen adres, her açılışta yeniden üretilen bir anahtar içerir (?t=...). API yalnızca
// bu anahtarı bilen arayüze cevap verir; böylece telefondaki başka uygulamalar ya da
// tarayıcıda açık başka siteler verilere erişemez.
func Start(dataDir, addr string) (string, error) {
	store, err := OpenStore(dataDir)
	if err != nil {
		return "", err
	}
	ln, err := net.Listen("tcp", addr)
	if err != nil {
		return "", err
	}
	_, port, _ := net.SplitHostPort(ln.Addr().String())
	token := newToken()
	h := allowHosts(Handler(store, token), ln.Addr().String(), "127.0.0.1:"+port, "localhost:"+port)
	srv := &http.Server{Handler: h, ReadHeaderTimeout: 10 * time.Second}
	go srv.Serve(ln)
	return "http://127.0.0.1:" + port + "/?t=" + token, nil
}

func Handler(store *Store, token string) http.Handler {
	api := http.NewServeMux()

	api.HandleFunc("GET /api/status", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{"warning": store.Warning()})
	})

	api.HandleFunc("GET /api/entries", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, store.Entries())
	})

	api.HandleFunc("POST /api/entries", func(w http.ResponseWriter, r *http.Request) {
		var e Entry
		if err := json.NewDecoder(r.Body).Decode(&e); err != nil {
			writeError(w, http.StatusBadRequest, "geçersiz istek")
			return
		}
		e, err := store.Add(e)
		if err != nil {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		writeJSON(w, http.StatusCreated, e)
	})

	api.HandleFunc("DELETE /api/entries/{id}", func(w http.ResponseWriter, r *http.Request) {
		if err := store.Delete(r.PathValue("id")); err != nil {
			writeError(w, http.StatusNotFound, err.Error())
			return
		}
		w.WriteHeader(http.StatusNoContent)
	})

	api.HandleFunc("GET /api/export", func(w http.ResponseWriter, r *http.Request) {
		b, err := store.Export()
		if err != nil {
			writeError(w, http.StatusInternalServerError, err.Error())
			return
		}
		name := "supergym-yedek-" + time.Now().Format(dateLayout) + ".json"
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Content-Disposition", `attachment; filename="`+name+`"`)
		w.Write(b)
	})

	api.HandleFunc("POST /api/import", func(w http.ResponseWriter, r *http.Request) {
		b, err := io.ReadAll(io.LimitReader(r.Body, 50<<20))
		if err != nil {
			writeError(w, http.StatusBadRequest, "dosya okunamadı")
			return
		}
		n, err := store.Import(b)
		if err != nil {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		writeJSON(w, http.StatusOK, map[string]int{"imported": n})
	})

	api.HandleFunc("/api/", func(w http.ResponseWriter, r *http.Request) {
		writeError(w, http.StatusNotFound, "bulunamadı")
	})

	mux := http.NewServeMux()
	mux.Handle("/api/", requireToken(token, api))
	static, _ := fs.Sub(dist, "dist")
	mux.Handle("/", http.FileServerFS(static))
	return mux
}

// requireToken, anahtarı başlıkta göndermeyen istekleri reddeder. Özel bir başlık
// zorunlu olduğu için başka bir siteden gelen istekler tarayıcı tarafından da engellenir.
func requireToken(token string, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		got := r.Header.Get(TokenHeader)
		if subtle.ConstantTimeCompare([]byte(got), []byte(token)) != 1 {
			writeError(w, http.StatusUnauthorized, "oturum geçersiz, uygulamayı yeniden açın")
			return
		}
		next.ServeHTTP(w, r)
	})
}

// allowHosts, Host başlığı beklenen adreslerden biri olmayan istekleri reddeder
// (DNS rebinding ile dışarıdan erişime karşı).
func allowHosts(next http.Handler, hosts ...string) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		for _, h := range hosts {
			if r.Host == h {
				next.ServeHTTP(w, r)
				return
			}
		}
		http.Error(w, "geçersiz adres", http.StatusMisdirectedRequest)
	})
}

func newToken() string {
	b := make([]byte, 16)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}
