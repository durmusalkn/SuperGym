# SuperGym

Antrenmanda yapılan hareketleri kaydeden, tamamen telefonda çalışan uygulama.
Bulut yok: veriler telefondaki bir JSON dosyasında tutulur, dışa/içe aktarma ile yedeklenir.

## Yapı

| Klasör | İçerik |
| --- | --- |
| `core/` | Go: yerel HTTP sunucusu, API ve veri deposu |
| `mobile/` | Go: `gomobile bind` ile Android kütüphanesine çevrilen giriş noktası |
| `cmd/supergym/` | Go: bilgisayarda test için çalıştırılabilir program |
| `web/` | Arayüz: Vite + Tailwind (derlenince `core/dist`'e gömülür) |
| `android/` | Arayüzü WebView ile gösteren ince Android kabuğu |

## Bilgisayarda çalıştırma

```sh
cd web && npm install && npm run build && cd ..
go run ./cmd/supergym   # http://127.0.0.1:8080
```

## APK (GitHub Actions)

Her push'ta `.github/workflows/android.yml` APK'yı derler, GitHub Release'e
yükler ve indirme linkini mail atar.

Repo ayarları (Settings > Secrets and variables > Actions):

| Ad | Tür | Açıklama |
| --- | --- | --- |
| `MAIL_TO` | Variable | APK linkinin gönderileceği mail adresi |
| `MAIL_USERNAME` | Secret | Gönderen Gmail adresi |
| `MAIL_PASSWORD` | Secret | O Gmail hesabının uygulama şifresi |
| `KEYSTORE_BASE64`, `KEYSTORE_PASSWORD`, `KEY_ALIAS`, `KEY_PASSWORD` | Secret | İsteğe bağlı gerçek imza anahtarı; yoksa `android/debug.keystore` kullanılır |
