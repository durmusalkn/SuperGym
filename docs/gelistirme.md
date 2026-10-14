# Geliştirme

## Gerekenler

| Araç | Sürüm | Ne için |
| --- | --- | --- |
| Go | `go.mod`'daki sürüm (1.26) | Çekirdek, testler, gomobile |
| Node.js | 22 | Arayüzü derlemek (Vite + Tailwind) |
| JDK | 17 | Android derlemesi (yalnızca CI'da gerekir) |
| Android SDK + NDK, Gradle 8.11 | — | APK (CI'da hazır; yerelde zorunlu değil) |

`gomobile` ve `gobind` `go.mod`'da `tool` olarak tanımlı: `go install tool`.

## Bilgisayarda çalıştırma

```sh
cd web && npm ci && npm run build && cd ..   # arayüzü core/dist'e derler
go run ./cmd/supergym                          # -addr 127.0.0.1:8080 -data data
```

Program açılacak adresi yazar: `http://127.0.0.1:8080/?t=<anahtar>`. Veriler `data/`
klasörüne yazılır (git'e girmez).

**Önemli:** arayüz Go programının içine gömülür (`go:embed`). Arayüzü değiştirince
`npm run build`'den sonra Go programını da **yeniden derlemek/başlatmak** gerekir.

### Arayüz üzerinde çalışırken

Go programı açıkken:

```sh
cd web && npm run dev
```

ve `http://localhost:5173/?t=<aynı anahtar>` adresini aç. Vite, `/api` isteklerini
8080'deki Go programına yönlendirir; değişiklikler anında görünür.

Telefon boyutu için tarayıcının geliştirici araçlarında 390×844 kullan. Android
köprüsü olmadığı için bildirim, alarm, widget ve otomatik yedek bilgisayarda çalışmaz
(arayüz bunları atlar).

## Testler

```sh
go vet ./... && go test ./...
```

`core/store_test.go` ve `core/server_test.go` şunları kapsar: veri kalıcılığı,
doğrulama (reddedilen isteğin veriyi değiştirmemesi), hareket silme/arşivleme, 1. ve 2.
sürümden yükseltme, dışa/içe aktarma, bozuk dosyanın kenara alınması, API'nin anahtar
ve Host denetimi.

### Arayüzü uçtan uca denemek

Depoda hazır bir arayüz testi yok. Değişikliklerden sonra şu yöntemle denendi:

1. Örnek bir veri dosyası (gerekirse eski sürümde) hazırla, Go programını o klasörle başlat.
2. Playwright ile 390×844 tarayıcıda sayfayı aç; sahte bir `window.SuperGymAndroid`
   nesnesi tanımla (`page.addInitScript`) ve köprü çağrılarını kaydet.
3. Akışları sür: hareket ekleme, set (ısınma dahil), dinlenme ekranı, küçültme, geri
   tuşu, süperset, sekmeler; konsol hatalarını ve köprü çağrılarını kontrol et; ekran
   görüntülerini incele.

### Android Java kodunu yerelde derleyerek kontrol etmek

Android SDK kurmadan, Java kodunun Android 15 API'sine karşı derlenip derlenmediği
Robolectric'in tam framework jar'ıyla kontrol edilebilir:

```sh
curl -o android-all.jar https://repo1.maven.org/maven2/org/robolectric/android-all/15-robolectric-13954326/android-all-15-robolectric-13954326.jar
# R ve mobile.Mobile için küçük taslak sınıflar yazıp:
javac --release 17 -cp android-all.jar -d out Mobile.java R.java android/app/src/main/java/com/supergym/app/*.java
```

`R` taslağı `res/` altındaki dosya ve `@+id` adlarından üretilebilir. Bu kontrol
kaynak dosyalarını (XML, manifest) doğrulamaz; onlar yalnızca CI'daki Gradle
derlemesinde denetlenir.

## APK ve sürüm

`.github/workflows/android.yml` **her push'ta** (her dalda) çalışır:

1. Arayüzü derler (`npm ci && npm run build`).
2. Go testleri (`go vet`, `go test`).
3. `gomobile bind -target=android/arm64 -androidapi 24` → `android/app/libs/supergym.aar`.
4. İmza anahtarı Secret'ta varsa hazırlar.
5. `gradle assembleRelease`.
6. APK'yı Actions "Artifacts"a ve **ön sürüm (pre-release)** olarak Releases'e yükler:
   etiket `build-<çalıştırma numarası>`, dosya `SuperGym-<numara>.apk`.
7. `MAIL_TO` tanımlıysa indirme linkini mail atar.

`versionCode` = çalıştırma numarası, `versionName` = `0.1.<numara>`.

### Gemini API denemesi

`.github/workflows/gemini-test.yml` yapay zekâ antrenörü için Gemini API'nin ücretsiz
katmanını dener: kullanılabilir modelleri listeler ve örnek bir antrenman özetiyle
`gemini-flash-lite-latest` ile `gemini-flash-latest`'e soru sorar. Yalnızca dosyanın
kendisi değişince ya da Actions'tan elle çalışır. Anahtar Secret'taki
`GEMINI_API_KEY`'dir; depo herkese açık olduğundan anahtar APK'ya ya da depoya
**yazılmaz**.

### Kalıcı imza anahtarı

Secret yoksa her derleme geçici bir debug anahtarıyla imzalanır ve yeni APK eskisinin
üzerine kurulamaz. Kalıcı anahtar için (bir kez):

```sh
keytool -genkeypair -v -keystore supergym.keystore -alias supergym \
  -keyalg RSA -keysize 2048 -validity 10000
base64 -w0 supergym.keystore   # çıktıyı KEYSTORE_BASE64 olarak kaydet
```

GitHub › Settings › Secrets and variables › Actions: `KEYSTORE_BASE64`,
`KEYSTORE_PASSWORD`, `KEY_ALIAS`, `KEY_PASSWORD`. Anahtar dosyasını güvenli bir yerde
sakla; kaybolursa güncellemeler yine üzerine kurulamaz. Depoya **koyma**.

### Mail

Variables: `MAIL_TO`. Secrets: `MAIL_USERNAME` (Gmail adresi), `MAIL_PASSWORD`
(o hesabın uygulama şifresi). Gmail `.apk` eklerini engellediği için mailde yalnızca link vardır.

## Kurallar ve alışkanlıklar

- Arayüz metinleri, kod yorumları, commit mesajları ve belgeler **Türkçe**.
- Veri kurallarının tek yeri Go'daki `validateData`'dır; arayüzdeki denetimler yalnızca
  kullanıcıya erken haber vermek içindir.
- Yeni veri alanı → şema sürümü ve yükseltme yolu: [veri-modeli.md](veri-modeli.md#sürümler-ve-yükseltme).
- Yeni Android özelliği → `MainActivity.Bridge`'e `@JavascriptInterface` metodu, arayüzde
  `android()?.metot?.()` ile isteğe bağlı çağrı; gerekiyorsa manifest izni ve
  [android.md](android.md) güncellemesi.
- Renk ve biçim için tema adlarını kullan (`bg-surface`, `text-muted`, `bg-coral` …):
  [tasarim.md](tasarim.md).
- Arayüzde çerçeve yok: `h()` ile DOM kurulur, ekran `render()` ile baştan çizilir.
  Yazı yazılan kutularda değişiklikten sonra ekranı yeniden çizme (klavye kapanır).
- Dallar: her iş ayrı bir dalda, `main`'e pull request ile.

## Telefonda doğrulanması gerekenler

Bilgisayarda denenemeyen ve yeni bir APK'dan sonra telefonda bakılması gerekenler:

- [ ] Android 15'te üstteki durum çubuğu ve alttaki gezinme çubuğuyla çakışma yok; klavye açılınca kutular görünür kalıyor.
- [ ] Dinlenme: ekran kilitliyken bildirimde geri sayım; bitince titreşim ve ses; bildirimdeki "Bitir".
- [ ] İlk dinlenmede bildirim izni isteniyor.
- [ ] Hatırlatma seçili gün ve saatte geliyor; o gün antrenman girildiyse gelmiyor; telefon yeniden başlayınca da çalışıyor.
- [ ] Widget ekleniyor, değerler doğru, dokununca uygulama açılıyor.
- [ ] Otomatik yedek İndirilenler/SuperGym'de görünüyor ve içe aktarılabiliyor.
- [ ] Dışa aktar / içe aktar dosya ekranları.
- [ ] Geri tuşu: panel kapanıyor, dinlenme küçülüyor, sekmeler arasında geri gidiliyor.
