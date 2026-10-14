# Mimari

SuperGym, telefonun içinde çalışan küçük bir web uygulamasıdır. Üç katmanı vardır:

```
┌──────────────────────────── Android uygulaması (APK) ────────────────────────────┐
│                                                                                  │
│  MainActivity (Java)                                                             │
│   ├─ WebView ─────────── http://127.0.0.1:<port>/?t=<anahtar> ──┐                │
│   │    └─ Arayüz (web/, Vite + Tailwind, düz JavaScript)         │                │
│   │         └─ window.SuperGymAndroid  ◄── JavaScript köprüsü    │ HTTP           │
│   └─ Bildirim, alarm, widget, yedek (Java sınıfları)             │                │
│                                                                   ▼               │
│  Go kütüphanesi (gomobile ile .aar) ── core.Start ── yerel HTTP sunucusu          │
│                                                     ├─ /api/*  (anahtar zorunlu)  │
│                                                     ├─ /       (gömülü arayüz)    │
│                                                     └─ Store → files/supergym.json│
└──────────────────────────────────────────────────────────────────────────────────┘
```

- **Go çekirdeği (`core/`)**: verinin tek sahibi. Doğrulama, sürüm yükseltme, dosyaya
  yazma ve API burada. Derlenmiş arayüzü (`core/dist`) `go:embed` ile içine gömer.
- **Arayüz (`web/`)**: çerçevesiz düz JavaScript. Ekranları her değişiklikte baştan
  çizer; veriyi yalnızca API üzerinden değiştirir.
- **Android kabuğu (`android/`)**: WebView'i açar ve web'in yapamadıklarını yapar:
  dosya kaydetme/seçme, bildirim, alarm, titreşim, ana ekran widget'ı, otomatik yedek.

Bulut ya da hesap yoktur; veri yalnızca telefonda durur. İnternet izni telefonun kendi
içindeki sunucuya (127.0.0.1) bağlanmak (`res/xml/network_security_config.xml` şifresiz
trafiğe yalnızca 127.0.0.1 için izin verir) ve kullanıcı isterse yapay zekâ antrenörünün
Gemini API'ye soru sorması içindir.

## Yapay zekâ antrenörü (deneme)

Aynı soru (son 4 haftanın özeti, `web/src/coach.js` `coachPrompt`) üç yolla sorulur:

| Yol | Nerede | İnternet | Not |
| --- | --- | --- | --- |
| Gemini API (ücretsiz katman) | `core/ai.go` `Coach`; `POST /api/ai/ask` | Gerekir | Go sunucusu HTTPS ile sorar. Önce `gemini-flash-latest`, yoğunluk/kota/bulunamadı hatasında `gemini-flash-lite-latest`. Anahtar `files/ai-anahtar.txt` (yedeğe girmez, ekrana geri gönderilmez). |
| Gemini Nano | `Nano.java` (ML Kit GenAI Prompt API) | Gerekmez | Telefonun içindeki model; yalnızca destekleyen telefonlarda. |
| Gemini uygulaması | `MainActivity.Bridge.askGeminiApp` | Gemini uygulaması kullanır | Soru paylaşılır; cevap SuperGym'e dönmez. Kullanıcının Gemini aboneliği burada geçerli. |

Go'nun Android'de internete çıkması: DNS için cgo çözümleyicisi (Android'de Go'nun
varsayılanı), sertifikalar için `/system/etc/security/cacerts`.

## Açılış

1. `MainActivity.onCreate` → `Mobile.start(getFilesDir())` (gomobile ile üretilen sınıf).
2. `mobile.Start` sunucuyu `sync.Once` ile **bir kez** başlatır; ekran yeniden
   oluşturulursa aynı adresi döner.
3. `core.Start(dataDir, "127.0.0.1:0")`:
   - `OpenStore` ile `supergym.json` okunur (yoksa hazır hareket listesiyle oluşturulur,
     eskiyse yükseltilir, bozuksa kenara alınır; bkz. [veri-modeli.md](veri-modeli.md)).
   - Rastgele boş bir porta bağlanılır, 16 baytlık rastgele bir anahtar üretilir.
   - `http://127.0.0.1:<port>/?t=<anahtar>` döner.
4. WebView bu adresi açar. Arayüz anahtarı adresten okur ve her API isteğinde
   `X-SuperGym-Token` başlığıyla gönderir.
5. Arayüz `GET /api/status` (bozuk dosya uyarısı var mı) ve `GET /api/data` (tüm veri)
   ile açılır, ardından otomatik yedeği kontrol eder.

## Güvenlik

Telefondaki başka uygulamalar da 127.0.0.1'e bağlanabilir; tarayıcıda açık bir site
de oraya istek atmayı deneyebilir. Bu yüzden:

| Önlem | Nerede | Ne işe yarar |
| --- | --- | --- |
| Her açılışta yeni anahtar, `X-SuperGym-Token` başlığı zorunlu | `core/server.go` `requireToken` | Anahtarı bilmeyen hiçbir şey API'ye erişemez. Karşılaştırma sabit zamanlıdır. |
| Özel başlık zorunluluğu | aynı | Başka bir siteden gelen istekte tarayıcı bu başlığı ön kontrol olmadan gönderemez. |
| `Host` başlığı denetimi | `allowHosts` | DNS rebinding ile dışarıdan erişimi engeller (yanlış Host → 421). |
| Arayüz dosyaları anahtarsız | `/` | Sayfa açılabilir ama veri okunamaz. |
| İstek boyutu sınırı | `withBody` (1 MB), içe aktarma (50 MB) | Aşırı büyük istekler reddedilir. |

`android:allowBackup="false"`: veri dosyası Google yedeğine gitmez. Yedek kullanıcının
kendi kontrolündedir (dışa aktarma ve otomatik yedek).

## Veri akışı

### Sunucu tarafı (`core/store.go`)

Her değişiklik aynı yoldan geçer:

```
update(fn):  kopya = clone(veri) → fn(kopya) → normalize(kopya) → validateData(kopya)
             → dosyaya yaz (geçici dosya + fsync + rename + klasör fsync) → bellekteki veri = kopya
```

- `fn` ya da doğrulama hata verirse **hiçbir şey değişmez** (ne bellek ne dosya).
- Dosyaya yazma başarısız olursa bellek de değişmez; ikisi asla ayrışmaz.
- Değişiklik yapan her API çağrısı verinin **tamamını** döner.

### Arayüz tarafı (`web/src/state.js`)

- `state.data` sunucudaki verinin kopyasıdır.
- `mutate(method, path, body)` istekleri **sırayla** gönderir (art arda iki set
  düzenlemesi karışmasın diye). Her cevap güncel veridir, ama yalnızca sıradaki
  **son** cevap `state.data`'yı değiştirir; böylece henüz gönderilmemiş yerel
  değişiklikler ezilmez.
- Antrenman değişiklikleri önce yerelde yapılır (`saveWorkout`), ekran hemen çizilir,
  istek arkadan gider. Hata olursa mesaj gösterilir ve veri sunucudan yeniden yüklenir.
- Set kutularında (`editSet`) değer değişince ekran yeniden çizilmez; aksi halde
  klavye kapanır ve yazılan kaybolur.

## Arayüzün yapısı (`web/src/`)

| Dosya | İçerik |
| --- | --- |
| `main.js` | Sekmeler, yüzen menü, sayfa geçişleri, otomatik yedek, Android'e durum bildirimi (`syncNative`) |
| `state.js` | API, değişiklik kuyruğu, veriden türetilen her şey: geçmiş, rekor, hacim, 1RM, artırma önerisi |
| `ui.js` | Ortak parçalar: mesaj, alttan açılan panel, düğme, giriş kutusu, simgeler, sayfa yönlendirme |
| `util.js` | `h()`/`svg()` DOM yardımcıları, tarih ve sayı biçimleri, kas grubu renkleri |
| `rings.js` | Ritim tasarımının halkaları (`segmentRing`, `progressRing`) |
| `timer.js` | Dinlenme: tam ekran nefes görünümü, küçük baloncuk, Android alarmıyla eşgüdüm |
| `sheets.js` | Paneller: hareket seçme, hareket düzenleme, program düzenleme ve kopyalama, hızlı puanlama |
| `views/workout.js` | Antrenman ekranı |
| `views/calendar.js` | Takvim ekranı (ve hafta serisi hesabı) |
| `views/progress.js` | İlerleme ekranı (büyüme halkaları, grafik, denge çiçeği, vücut ağırlığı) |
| `views/exercises.js` | Hareketler ekranı (liste, puanlar, arşiv) |
| `views/plan.js` | Plan ekranı (programlar, antrenman alarmları, alarm ekranı ve sesi, ayarlar, uzun ara uyarısı, yedek, sıfırlama) |
| `style.css` | Tailwind, tema renkleri, Outfit yazı tipi, animasyonlar |

**Neden çerçeve yok?** Uygulama küçük, telefonda çalışıyor ve çevrimdışı. `h(etiket,
özellikler, ...çocuklar)` yardımcısı ve her değişiklikte ekranı baştan çizmek yeterli;
derlenmiş arayüz yazı tipiyle birlikte yaklaşık 140 KB (JavaScript ~60 KB).

### Sayfa adresleri (hash)

| Adres | Ekran |
| --- | --- |
| `#/antrenman` · `#/antrenman/2026-10-14` | Antrenman (tarih yoksa bugün) |
| `#/takvim` · `#/takvim/2026-10` | Takvim (ay yoksa bu ay) |
| `#/ilerleme` · `#/ilerleme/<hareket-id>` | İlerleme (hareket yoksa en son yapılan) |
| `#/hareketler` | Hareketler |
| `#/plan` | Programlar, alarmlar, ayarlar, yedek |

Sekme değişince geçmişe adım eklenir; telefonun geri tuşu önceki sekmeye döner. Gün ve
ay değiştirme oklarında adım eklenmez (`go(adres, true)`). Alttan açılan paneller ve tam
ekran dinlenme de geçmişe adım ekler; geri tuşu onları kapatır/küçültür.

## Hesaplamalar

Hepsi arayüzde, kayıtlı veriden her seferinde yeniden hesaplanır (ayrıca saklanmaz).

| Hesap | Kural | Kod |
| --- | --- | --- |
| Asıl setler | Isınma setleri (`warmup`) çıkarılır. Rekor, hacim, grafik, "geçen sefer" ve öneri yalnızca asıl setleri kullanır. | `workSets` |
| Geçmiş | Hareketin asıl seti olan günleri, eskiden yeniye | `history` |
| Geçen sefer | Verilen tarihten önceki son yapılış | `lastBefore` |
| Tahmini 1RM | Epley: `kilo × (1 + tekrar/30)`; tek tekrarda kilonun kendisi | `oneRM` |
| Hacim | `Σ tekrar × kilo` (asıl setler) | `volume` |
| Rekor | En ağır set (kardiyoda en uzun mesafe); istenirse belirli bir gün hariç | `records` |
| Artırma önerisi | Aşağıda | `suggestion` |
| Hedef set sayısı | `max(bugün yapılan + 1, geçen seferki set sayısı)`; geçmiş yoksa 3 (kardiyoda 1). Antrenman halkasının dilim sayısı budur. | `target` (workout.js) |
| Gidilen gün | En az bir set girilmiş gün (ısınma dahil) | `attendedDates` |
| Hafta serisi | Bu haftadan geriye, en az bir gün gidilen art arda haftalar. Bu hafta henüz boşsa seriyi bozmaz, geçen haftadan sayılır. Haftalar pazartesi başlar. | `stats` (calendar.js), `NativeState.streakWeeks` (Java) |
| Antrenman süresi | İlk setin saati (`start`) ile son setin saati (`end`) arası. Yalnızca bugünün antrenmanına set eklenirken tutulur. | `workoutMinutes` |

### Artırma önerisi (çift aşamalı ilerleme)

Her ağırlık hareketinin bir hedef tekrar aralığı (`repMin`–`repMax`, varsayılan 8–12)
ve artış miktarı (`increment`, varsayılan 2,5 kg) vardır. Geçen seferki **en ağır
kilodaki** setlere bakılır:

- Hepsi `repMax`'a ulaştıysa → **kiloyu artır**: `en ağır + increment`, hedef `repMin` tekrar.
- Ulaşmadıysa → **aynı kilo**, hedef en iyi tekrarın bir fazlası (en çok `repMax`).
- Vücut ağırlığıyla yapılan hareketlerde (kilo 0) tüm setler `repMax`'a ulaştıysa
  "ağırlık eklemeyi dene" denir.

Öneri, o harekette bugün henüz asıl set girilmemişse gösterilir ve kutular öneriyle dolu gelir.

### Set tamamlanınca ne olur? (`addSet`, workout.js)

1. Set eklenir; bugünse antrenmanın başlangıç/bitiş saati güncellenir.
2. Önceki günlerin rekoru geçildiyse (ısınma değilse, hareket ilk kez yapılmıyorsa)
   "Yeni rekor" mesajı çıkar.
3. **Sıradaki hareket seçilir:**
   - Hareket bir süpersetin son halkası değilse (`linkNext`) → gruptaki bir sonraki
     hareket; **dinlenme başlamaz**.
   - Değilse: grubun ilk hareketi hedef set sayısına ulaşmadıysa → grubun başına döner
     (yeni tur); ulaştıysa → sıradaki hareket.
   - Isınma setinden sonra seçili hareket değişmez.
4. Bugünün antrenmanıysa ve süpersetin ortası değilse **dinlenme başlar**; ekranda
   sıradaki set (ısınmadan sonra asıl set değeri) gösterilir.

## Android ile arayüz arasındaki bağ

Arayüz, Android'e özgü her şeyi `window.SuperGymAndroid` köprüsü üzerinden ister ve
köprü yoksa (bilgisayarda tarayıcıda) o özelliği sessizce atlar
(`android()?.metot?.()`). Ayrıntılar: [android.md](android.md).
