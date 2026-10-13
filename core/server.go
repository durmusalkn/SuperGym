package core

import (
	"embed"
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

// Start, verilen klasördeki verilerle yerel sunucuyu başlatır ve adresini döner.
// addr örn. "127.0.0.1:0" (rastgele boş port) veya "127.0.0.1:8080".
func Start(dataDir, addr string) (string, error) {
	store, err := OpenStore(dataDir)
	if err != nil {
		return "", err
	}
	ln, err := net.Listen("tcp", addr)
	if err != nil {
		return "", err
	}
	srv := &http.Server{Handler: Handler(store), ReadHeaderTimeout: 10 * time.Second}
	go srv.Serve(ln)
	return "http://" + ln.Addr().String() + "/", nil
}

func Handler(store *Store) http.Handler {
	mux := http.NewServeMux()

	mux.HandleFunc("GET /api/entries", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, store.Entries())
	})

	mux.HandleFunc("POST /api/entries", func(w http.ResponseWriter, r *http.Request) {
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

	mux.HandleFunc("DELETE /api/entries/{id}", func(w http.ResponseWriter, r *http.Request) {
		if err := store.Delete(r.PathValue("id")); err != nil {
			writeError(w, http.StatusNotFound, err.Error())
			return
		}
		w.WriteHeader(http.StatusNoContent)
	})

	mux.HandleFunc("GET /api/export", func(w http.ResponseWriter, r *http.Request) {
		b, err := store.Export()
		if err != nil {
			writeError(w, http.StatusInternalServerError, err.Error())
			return
		}
		name := "supergym-yedek-" + time.Now().Format("2006-01-02") + ".json"
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Content-Disposition", `attachment; filename="`+name+`"`)
		w.Write(b)
	})

	mux.HandleFunc("POST /api/import", func(w http.ResponseWriter, r *http.Request) {
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

	static, _ := fs.Sub(dist, "dist")
	mux.Handle("/", http.FileServerFS(static))
	return mux
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}
