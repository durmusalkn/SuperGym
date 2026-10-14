// Bilgisayarda test için: go run ./cmd/supergym
package main

import (
	"flag"
	"log"

	"github.com/durmusalkn/supergym/core"
)

func main() {
	addr := flag.String("addr", "127.0.0.1:8080", "dinlenecek adres")
	data := flag.String("data", "data", "verilerin tutulacağı klasör")
	flag.Parse()

	url, err := core.Start(*data, *addr)
	if err != nil {
		log.Fatal(err)
	}
	log.Printf("SuperGym çalışıyor, tarayıcıda açın: %s", url)
	select {}
}
