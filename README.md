# SuperGym

Antrenmanda yapılan hareketleri kaydeden, tamamen telefonda çalışan uygulama.
Bulut yok: veriler telefondaki bir JSON dosyasında tutulur, dışa/içe aktarma ile yedeklenir.

## Özellikler

- **Antrenman:** günün hareketleri, her set ayrı (kg × tekrar; kardiyoda dakika ve km).
  Yeni set kutuları son setle ya da geçen seferin değerleriyle dolu gelir.
- **Geçen sefer ve rekor:** her harekette son yapılış ve en ağır set gösterilir; rekor kırılınca 🏆.
- **Dinlenme sayacı:** bugünün antrenmanına set eklenince başlar, bitince titreşir (süresi Ayarlar'dan).
- **Takvim:** gidilen günler ve çalışılan kas grupları; haftalık/aylık gün sayısı ve hafta serisi.
- **İlerleme:** hareket başına grafik (en ağır set, tahmini 1RM, hacim, tekrar) ve geçmiş; vücut ağırlığı takibi.
- **Hareketler:** hazır liste + kendi hareketlerin; kullanılmış hareket silinince arşivlenir, geçmiş bozulmaz.
- **Programlar:** "Push", "Bacak günü" gibi şablonlar; antrenmana tek dokunuşla eklenir.
- **Isınma seti ve zorluk (RPE):** set numarasına dokununca ısınma seti olur (rekora ve grafiğe sayılmaz);
  RPE kutusu Ayarlar'dan açılır.
- **Artırma önerisi:** geçen sefer tüm setlerde hedef tekrarın üst sınırına ulaşıldıysa ağırlık artışı önerilir
  (hedef aralık ve artış hareket ayarlarında).
- **Süperset ve sıralama:** iki hareket bağlanınca dinlenme gruptaki son hareketten sonra başlar; ↑/↓ ile sıra değişir.
- **Antrenman süresi ve hareket notu:** ilk/son setin saati otomatik tutulur; harekete kalıcı not eklenebilir.
- **Kas grubu dengesi:** son 7/30 günde hangi gruba kaç set yapıldığı.
- **Android:** dinlenme sayacı arka planda bildirimle sürer; antrenman günü / uzun ara hatırlatmaları;
  ana ekran widget'ı (bu hafta, seri, son antrenman); İndirilenler/SuperGym klasörüne otomatik yedek.
- **Yedek:** dışa/içe aktarma. Eski sürümün verileri ve yedekleri otomatik olarak yeni yapıya çevrilir
  (çevrilmeden önceki dosya `supergym.json.v1-yedek` olarak saklanır).

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
go run ./cmd/supergym
```

Program, açılması gereken adresi yazar (örn. `http://127.0.0.1:8080/?t=...`).
Sonundaki `t` her açılışta yeniden üretilen bir anahtardır: API yalnızca bu anahtarı
gönderen arayüze cevap verir, böylece telefondaki başka uygulamalar ya da tarayıcıda
açık başka siteler verilere erişemez.

Arayüz üzerinde çalışırken Go programı açıkken `cd web && npm run dev` çalıştırın ve
Vite'ın adresini aynı anahtarla açın: `http://localhost:5173/?t=...`

Testler: `go test ./...`

## APK (GitHub Actions)

Her push'ta `.github/workflows/android.yml` APK'yı derler, GitHub Release'e
yükler ve indirme linkini mail atar.

Repo ayarları (Settings > Secrets and variables > Actions):

| Ad | Tür | Açıklama |
| --- | --- | --- |
| `MAIL_TO` | Variable | APK linkinin gönderileceği mail adresi |
| `MAIL_USERNAME` | Secret | Gönderen Gmail adresi |
| `MAIL_PASSWORD` | Secret | O Gmail hesabının uygulama şifresi |
| `KEYSTORE_BASE64`, `KEYSTORE_PASSWORD`, `KEY_ALIAS`, `KEY_PASSWORD` | Secret | İmza anahtarı (bkz. `TODO.md`); yoksa geçici debug anahtarı kullanılır |
