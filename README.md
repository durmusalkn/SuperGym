# SuperGym

Spor salonunda yapılan hareketleri, setleri ve kiloları kaydeden, tamamen telefonda
çalışan Android uygulaması. Bulut ya da hesap yok: veriler telefondaki bir JSON
dosyasında durur; dışa aktarma ve otomatik yedekle korunur.

Tasarım dili **Ritim**: antrenman bir döngü (efor, nefes, tekrar), bu yüzden her şey
çember. Setler bir halkanın dilimleri, dinlenme bir nefes rehberi, takvim bir ay halkası.

## Özellikler

- **Antrenman:** günün hareketleri, her set ayrı (kg × tekrar; kardiyoda dakika ve km).
  Yeni set kutuları son setle ya da geçen seferin değerleriyle dolu gelir.
- **Geçen sefer ve rekor:** her harekette son yapılış ve en ağır set gösterilir; rekor kırılınca 🏆.
- **Dinlenme sayacı:** bugünün antrenmanına set eklenince başlar, bitince titreşir (süresi Ayarlar'dan).
- **Takvim:** gidilen günler ve çalışılan kas grupları; haftalık/aylık gün sayısı ve hafta serisi.
- **İlerleme:** hareket başına grafik (en ağır set, tahmini 1RM, hacim, tekrar) ve geçmiş; vücut ağırlığı takibi.
- **Hareketler:** tüm kas grupları için ~110 hareketlik hazır liste (hedef kasıyla: üst göğüs, kanat, arka bacak…)
  + kendi hareketlerin; kullanılmış hareket silinince arşivlenir, geçmiş bozulmaz.
- **Puan:** hareketlere 1-5 yıldız ("★ Puanla" ile hızlıca); 1 puanlı hareketler programlara seçilmez.
- **Programlar:** hazır Push, Pull, Legs, Upper, Lower ve Full Body programlarının hareketleri puanlarına ve
  hedef kaslara göre otomatik seçilir. Hazır programlar değiştirilemez; kopyası (fork) oluşturulup düzenlenir,
  kopya asıl programdan bağımsızdır. Kendi programların da antrenmana tek dokunuşla eklenir.
- **Antrenman alarmları (Plan sekmesi):** her gün için ayrı saat ve program (örn. Salı 18:00 Push, Cumartesi
  09:00 Legs). Gitme saatinden önce o günün hareketlerini gösteren hazırlık bildirimi; gitme saatinde uygulama
  kapalıyken de yüklediğin resim tam ekran açılır ve alarm çalar. "Antrenmana girdim" denene ya da o gün set
  girilene kadar 5 dakikada bir tekrar çalar (en fazla 2 saat); erteleme de var. Alarm sesi telefonun
  seslerinden ya da kendi müzik dosyandan seçilir; izin verilirse fotoğraf telefon elindeyken de öne gelir.
  "Antrenmana girdim" uygulamayı o günün programıyla açar.
- **Verileri sıfırla:** yalnızca antrenman geçmişi (hareketler, puanlar, programlar ve alarmlar kalır) ya da
  fabrika ayarları.
- **Isınma seti ve zorluk (RPE):** set numarasına dokununca ısınma seti olur (rekora ve grafiğe sayılmaz);
  RPE kutusu Ayarlar'dan açılır.
- **Artırma önerisi:** geçen sefer tüm setlerde hedef tekrarın üst sınırına ulaşıldıysa ağırlık artışı önerilir
  (hedef aralık ve artış hareket ayarlarında).
- **Süperset ve sıralama:** iki hareket bağlanınca dinlenme gruptaki son hareketten sonra başlar; ↑/↓ ile sıra değişir.
- **Antrenman süresi ve hareket notu:** ilk/son setin saati otomatik tutulur; harekete kalıcı not eklenebilir.
- **Kas grubu dengesi:** son 7/30 günde hangi gruba kaç set yapıldığı.
- **Android:** dinlenme sayacı arka planda bildirimle sürer; uzun ara hatırlatması;
  ana ekran widget'ı (bu hafta, seri, son antrenman); İndirilenler/SuperGym klasörüne otomatik yedek.
- **Yedek:** dışa/içe aktarma. Eski sürümün verileri ve yedekleri otomatik olarak yeni yapıya çevrilir
  (çevrilmeden önceki dosya `supergym.json.vN-yedek` olarak saklanır). 4. sürümde eksik hazır hareketler
  eklenir, eski "antrenman günlerim" hatırlatmaları aynı saatte çalan alarmlara dönüşür. Alarm resmi yedeğe girmez.

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
