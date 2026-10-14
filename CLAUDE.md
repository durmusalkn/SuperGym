# SuperGym — çalışma notları

Telefonda çalışan antrenman takip uygulaması: Go yerel HTTP sunucusu (`core/`) +
düz JavaScript arayüz (`web/`, WebView'de) + ince Android kabuğu (`android/`, Java).
Ayrıntılar `docs/` altında; önce `docs/mimari.md`.

## Komutlar

```sh
cd web && npm ci && npm run build && cd ..   # arayüz → core/dist (go:embed)
go vet ./... && go test ./...                  # testler
go run ./cmd/supergym                          # http://127.0.0.1:8080/?t=<anahtar>
```

Arayüz Go programına gömülür: arayüzü değiştirince `npm run build` ve Go programını
yeniden derle/başlat. APK yalnızca CI'da derlenir (her push'ta, `build-N` ön sürümü).

## Kurallar

- Arayüz metinleri, yorumlar, commit mesajları, belgeler Türkçe.
- Veri kuralları yalnızca `core/model.go` `validateData`'da. Değişiklikler
  `Store.update` üzerinden; her değişiklik API çağrısı verinin tamamını döner.
- Yeni veri alanı: `schemaVersion` artır, `omitempty`, varsayılanı `normalize`/`upgrade`'e,
  kuralı `validateData`'ya, yükseltme testini `core/store_test.go`'ya ekle;
  `docs/veri-modeli.md`'yi güncelle.
- Arayüz: çerçeve yok; `h()`/`svg()` ile DOM, `render()` ile ekran baştan çizilir.
  Yazı yazılan kutularda değişiklikten sonra `render()` çağırma (klavye kapanır).
  Değişiklikler `mutate`/`saveWorkout` ile (sıralı kuyruk).
- Tasarım: Ritim teması (`web/src/style.css` `@theme`): `ink`, `surface`, `line`,
  `text`, `muted`, `coral` (efor), `mint` (dinlenme), `lav`, `sun`. Halkalar
  `web/src/rings.js`. Emoji yok; simgeler `ui.js` `icon()`.
- Android özelliği: `MainActivity.Bridge`'e `@JavascriptInterface` metodu; arayüzde
  `android()?.metot?.()` (bilgisayarda köprü yok, özellik atlanır). İzin/alıcı eklenirse
  manifest ve `docs/android.md`.
- Bir şey değişince ilgili `docs/` belgesini aynı commit'te güncelle.
