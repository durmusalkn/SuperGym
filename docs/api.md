# API

Go sunucusunun HTTP API'si (`core/server.go`). Yalnızca telefonun içinden
(`127.0.0.1`) ve yalnızca arayüz tarafından kullanılır.

## Genel kurallar

- Her istekte `X-SuperGym-Token: <anahtar>` başlığı zorunlu. Anahtar her açılışta
  yeniden üretilir ve sayfa adresinde (`?t=…`) gelir. Yoksa ya da yanlışsa: `401`.
- `Host` başlığı `127.0.0.1:<port>` ya da `localhost:<port>` olmalı; değilse `421`.
- Gövde JSON'dur, en fazla 1 MB (içe aktarmada 50 MB).
- **Değişiklik yapan her istek, başarılıysa verinin tamamını döner** (`200`, biçimi
  [veri-modeli.md](veri-modeli.md)). Arayüz ekranını bu cevapla yeniler. `/api/ai…`
  uç noktaları veriye dokunmaz; kendi cevaplarını döner.
- Hata cevabı: `{"error": "açıklama"}`. Doğrulama hatası `400`, kayıt yoksa `404`.
- Bilinmeyen `/api/…` adresi: `404`.

## Uç noktalar

| Yöntem ve adres | Gövde | Ne yapar |
| --- | --- | --- |
| `GET /api/status` | — | `{"warning": "…"}`: açılışta veri dosyası bozuk bulunduysa açıklaması, değilse boş |
| `GET /api/data` | — | Verinin tamamı |
| `POST /api/exercises` | `Exercise` (`id` yok sayılır) | Yeni hareket ekler |
| `PUT /api/exercises/{id}` | `Exercise` (tamamı) | Hareketi değiştirir (ad, grup, tür, arşiv, not, hedef aralık). Kullanılmış hareketin türü değişmez. |
| `DELETE /api/exercises/{id}` | — | Kullanılmışsa arşivler, değilse siler; her durumda programlardan çıkarır |
| `PUT /api/workouts/{date}` | `{"items": […], "note": "", "start": "", "end": ""}` | O günün antrenmanını verilenle **değiştirir**. Hareketi ve notu yoksa günü siler. |
| `DELETE /api/workouts/{date}` | — | Günü siler (`404`: o gün kayıt yok) |
| `POST /api/templates` | `{"name": "Push", "exerciseIds": […]}` | Program ekler |
| `PUT /api/templates/{id}` | aynı | Programı değiştirir (hazır programda `400`) |
| `DELETE /api/templates/{id}` | — | Programı siler (hazır programda `400`) |
| `POST /api/templates/{id}/fork` | — | Programın bağımsız kopyasını ekler ("Push (kopyam)", `forkOf` ile) |
| `POST /api/reset` | `{"scope": "history"}` ya da `{"scope": "all"}` | `history`: antrenmanları ve vücut ağırlığını (ve arşivlenmiş hareketleri) siler. `all`: ilk kurulum haline döner. Silmeden önceki dosya `supergym.json.sifirlama-oncesi` olarak saklanır. |
| `PUT /api/bodyweights/{date}` | `{"kg": 80.6}` | O günün vücut ağırlığını kaydeder (varsa değiştirir) |
| `DELETE /api/bodyweights/{date}` | — | Kaydı siler |
| `PUT /api/settings` | `Settings` (tamamı) | Ayarları değiştirir |
| `GET /api/export` | — | Yedek dosyası (girintili JSON, `exportedAt` ile). `Content-Disposition: attachment; filename="supergym-yedek-YYYY-AA-GG.json"` |
| `GET /api/ai` | — | `{"hasKey": true}`: Gemini API anahtarı kayıtlı mı (anahtarın kendisi hiç gönderilmez) |
| `PUT /api/ai/key` | `{"key": "…"}` | Anahtarı `ai-anahtar.txt`'ye kaydeder; boşsa siler. `{"hasKey": …}` döner. |
| `POST /api/ai/ask` | `{"system": "…", "prompt": "…"}` | Gemini'ye sorar: `{"text": "…", "model": "gemini-3.5-flash-lite", "ms": 1140}`. Anahtar yoksa ya da soru boşsa `400`; Gemini hatasında (yoğun, kota, geçersiz anahtar, internet yok) `502`. |
| `POST /api/import` | Yedek dosyasının içeriği | Mevcut verinin **yerine** koyar. 1.–4. sürüm yedekleri kabul edilir ve yükseltilir. Tek bir hata varsa hiçbir şey değişmez. |

`PUT` istekleri kaydın tamamını değiştirir; gönderilmeyen alanlar silinir. Bu yüzden
arayüz bir alanı değiştirirken kaydın geri kalanını da gönderir
(örn. `{...ayarlar, restSeconds: 120}`).

## Örnek

```sh
T=…anahtar…
curl -s -X PUT "http://127.0.0.1:8080/api/workouts/2026-10-14" \
  -H "X-SuperGym-Token: $T" \
  -d '{"items":[{"exerciseId":"a1b2c3d4e5f60718","sets":[{"reps":8,"weight":62.5}]}]}'
```

Bilgisayarda çalıştırınca (`go run ./cmd/supergym`) anahtar, program çıktısındaki
adreste yazar.
