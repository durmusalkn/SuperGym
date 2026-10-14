// Package mobile, gomobile ile Android kütüphanesine (.aar) çevrilen pakettir.
package mobile

import (
	"sync"

	"github.com/durmusalkn/supergym/core"
)

var (
	once sync.Once
	url  string
	err  error
)

// Start, sunucuyu bir kez başlatır; ekran yeniden açıldığında aynı adresi döner.
func Start(dataDir string) (string, error) {
	once.Do(func() {
		url, err = core.Start(dataDir, "127.0.0.1:0")
	})
	return url, err
}
