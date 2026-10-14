# SuperGym

Spor salonunda yapılan hareketleri, setleri ve kiloları kaydeden, tamamen telefonda
çalışan Android uygulaması. Bulut ya da hesap yok: veriler telefondaki bir JSON
dosyasında durur; dışa aktarma ve otomatik yedekle korunur.

Tasarım dili **Ritim**: antrenman bir döngü (efor, nefes, tekrar), bu yüzden her şey
çember. Setler bir halkanın dilimleri, dinlenme bir nefes rehberi, takvim bir ay halkası.

## Özellikler

**Antrenman**
- Her set ayrı kaydedilir: kilo × tekrar (kardiyoda dakika ve km).
- Seçili hareketin setleri bir halka olarak görünür; diğer hareketler altta "yörüngede".
- "Geçen sefer", rekor ve **artırma önerisi** (geçen sefer tüm setlerde hedef tekrarın
  üst sınırına ulaşıldıysa "62,5 kg dene").
- **Isınma setleri** (rekora, hacme, grafiğe sayılmaz), isteğe bağlı **zorluk (RPE)**.
- **Süperset**, hareket sırasını değiştirme, hareket notu, antrenman notu.
- **Programlar** (Push, Pull, Bacak…): tek dokunuşla antrenmana eklenir.
- Antrenman süresi otomatik tutulur.

**Dinlenme**
- Set bitince tam ekran **nefes rehberi** (4 sn al, 6 sn ver) ve sıradaki set.
- Ekran kilitliyken de bildirimde geri sayar; bitince titreşim ve ses.

**Takip**
- **Takvim:** ay halkası, hafta serisi, bu haftanın günleri.
- **İlerleme:** büyüme halkaları (her ay bir halka), grafik (en ağır set, tahmini 1RM,
  hacim, tekrar), geçmiş, **kas grubu dengesi çiçeği**, vücut ağırlığı.

**Telefon**
- Antrenman günü ve "N gündür gitmedin" **hatırlatmaları**.
- **Ana ekran widget'ı:** bu hafta, seri, son antrenman.
- **Otomatik yedek** İndirilenler/SuperGym klasörüne (uygulama silinse de kalır).
- Eski sürümlerin verileri ve yedekleri otomatik olarak yeni yapıya çevrilir.

## Belgeler

| Belge | İçerik |
| --- | --- |
| [docs/kullanim.md](docs/kullanim.md) | Kullanım kılavuzu: kurulum, ekran ekran kullanım |
| [docs/mimari.md](docs/mimari.md) | Katmanlar, açılış, güvenlik, veri akışı, hesaplamalar (öneri, 1RM, seri…) |
| [docs/veri-modeli.md](docs/veri-modeli.md) | `supergym.json` alanları, kurallar, sürümler ve yükseltme |
| [docs/api.md](docs/api.md) | Yerel HTTP API |
| [docs/android.md](docs/android.md) | Android kabuğu: köprü, izinler, bildirim, alarm, widget, yedek |
| [docs/tasarim.md](docs/tasarim.md) | Ritim tasarım sistemi: renkler, yazı, bileşenler |
| [docs/gelistirme.md](docs/gelistirme.md) | Çalıştırma, test, APK, imza, kurallar, telefonda doğrulanacaklar |
| [TODO.md](TODO.md) | Yapılacaklar |

## Yapı

| Klasör | İçerik |
| --- | --- |
| `core/` | Go: yerel HTTP sunucusu, API, veri deposu, doğrulama ve sürüm yükseltme |
| `mobile/` | Go: `gomobile bind` ile Android kütüphanesine çevrilen giriş noktası |
| `cmd/supergym/` | Go: bilgisayarda çalıştırmak için program |
| `web/` | Arayüz: Vite + Tailwind, düz JavaScript (derlenince `core/dist`'e gömülür) |
| `android/` | WebView kabuğu ve Android'e özgü özellikler (Java) |
| `.github/workflows/` | Her push'ta APK derleyen iş akışı |

## Hızlı başlangıç

```sh
cd web && npm ci && npm run build && cd ..
go run ./cmd/supergym
```

Program açılacak adresi yazar (`http://127.0.0.1:8080/?t=...`). Sonundaki `t` her
açılışta üretilen anahtardır; API yalnızca bu anahtarı gönderen arayüze cevap verir.

Testler: `go test ./...` · Ayrıntılar: [docs/gelistirme.md](docs/gelistirme.md)

## APK

Her push'ta GitHub Actions APK'yı derler ve **Releases**'e `build-N` ön sürümü olarak
yükler (`SuperGym-N.apk`). İmza ve mail ayarları: [docs/gelistirme.md](docs/gelistirme.md#apk-ve-sürüm).
