# Android

Android uygulaması (`android/`) ince bir kabuktur: Go sunucusunu başlatır, arayüzü
WebView'de gösterir ve web'in yapamadıklarını yapar.

- Paket: `com.supergym.app` · `minSdk 24` (Android 7) · `targetSdk 35` (Android 15)
- Go kütüphanesi `gomobile bind` ile `android/app/libs/supergym.aar` olarak üretilir
  (yalnızca `arm64`; CI'da). Depoda tutulmaz.
- Kod: `android/app/src/main/java/com/supergym/app/`

## Sınıflar

| Sınıf | Görevi |
| --- | --- |
| `MainActivity` | Sunucuyu başlatır, WebView'i açar, `SuperGymAndroid` köprüsünü tanımlar; dosya kaydetme/seçme; Android 15 kenardan kenara ekranda sistem çubukları ve klavye kadar boşluk bırakır; ekranda mı bilgisini tutar (`isVisible`). |
| `RestTimer` | Dinlenme sayacının Android tarafı: alarm, geri sayan bildirim, bitiş bildirimi, titreşim. |
| `RestAlarmReceiver` | Dinlenme alarmı çalınca ve bildirimdeki "Bitir"e basılınca çağrılır. |
| `Reminders` | Hatırlatma alarmını kurar; alarm çalınca bildirim gerekip gerekmediğine karar verir. |
| `ReminderReceiver` | Günlük hatırlatma alarmı; telefon açılınca (`BOOT_COMPLETED`) ve uygulama güncellenince (`MY_PACKAGE_REPLACED`) alarmı yeniden kurar, widget'ı yeniler. |
| `WidgetProvider` | Ana ekran widget'ı. |
| `NativeState` | Arayüzün gönderdiği antrenman günleri ve hatırlatma ayarları (SharedPreferences `supergym`); tarih hesapları (hafta, seri, son antrenman). |
| `Backup` | Otomatik yedeği İndirilenler/SuperGym klasörüne yazar, eskilerini siler. |
| `Notifications` | Bildirim kanalları ve ortak bildirim ayarları. |
| `Alarms` | Tam zamanlı alarm kurma (izin yoksa birkaç dakika gecikebilen alarma düşer). |

## Köprü: `window.SuperGymAndroid`

Arayüzden çağrılan Java metotları (`MainActivity.Bridge`). Arayüz her çağrıyı
`android()?.metot?.()` biçiminde yapar; köprü yoksa (bilgisayarda) özellik atlanır.

| Metot | Ne yapar | Arayüzde kullanıldığı yer |
| --- | --- | --- |
| `exportFile(ad, içerik)` | "Dosyayı kaydet" ekranını açar; bitince `window.onExportDone(ok)` çağrılır | Hareketler › Yedek › Dışa aktar |
| `autoBackup(ad, içerik) → boolean` | İndirilenler/SuperGym'e yazar. Android 9 ve öncesinde izin yoksa izin ister ve `false` döner | `main.js` `autoBackup` |
| `startRest(bitişMs)` | Dinlenme alarmını kurar, geri sayan bildirimi gösterir (bitiş zamanı epoch ms) | `timer.js` |
| `cancelRest()` | Alarmı ve bildirimi kaldırır | `timer.js` |
| `restEndsAt() → long` | Sayaç sürüyorsa bitiş zamanı, durdurulmuş/bitmişse 0 (bildirimden "Bitir"e basıldı mı?) | `timer.js` `resume` |
| `vibrate(ms)` | Titreşim | — |
| `keepScreenOn(açık)` | Dinlenme sürerken ekran kararmasın | `timer.js` |
| `requestNotifications()` | Android 13+ bildirim iznini ister | İlk dinlenmede, hatırlatma ayarı değişince |
| `notificationsAllowed() → boolean` | Bildirim izni var mı | Hatırlatmalar bölümündeki uyarı |
| `syncState(json)` | Antrenman günlerini ve hatırlatma ayarlarını kaydeder; hatırlatma alarmını yeniden kurar; widget'ı yeniler | `main.js` `syncNative` |

Java'dan arayüze: `window.onExportDone(ok)` (dışa aktarma bitti) ve
`window.onAppResume()` (uygulama öne geldi; sayaç yeniden kontrol edilir).

`syncState` gövdesi (yalnızca değiştiğinde gönderilir):

```json
{ "attended": ["2026-10-13", "2026-10-14"], "reminderDays": [1, 3, 5], "reminderTime": "18:00", "inactiveDays": 3 }
```

`attended`: son 400 gündeki antrenman günleri.

## İzinler

| İzin | Neden | Not |
| --- | --- | --- |
| `INTERNET` | WebView'in telefondaki yerel sunucuya (127.0.0.1) bağlanması | Dışarıya bağlantı yok |
| `VIBRATE` | Dinlenme bitince titreşim | |
| `POST_NOTIFICATIONS` | Dinlenme ve hatırlatma bildirimleri | Android 13+; ilk dinlenmede istenir |
| `USE_EXACT_ALARM` | Sayacın ekran kapalıyken de tam zamanında bitmesi | Android 13+; kurulumda verilir |
| `SCHEDULE_EXACT_ALARM` (`maxSdkVersion 32`) | Aynısı, Android 12 için | |
| `RECEIVE_BOOT_COMPLETED` | Telefon yeniden başlayınca hatırlatma alarmını kurmak | |
| `WRITE_EXTERNAL_STORAGE` (`maxSdkVersion 28`) | Otomatik yedek, yalnızca Android 9 ve öncesi | Sonrasında izin gerekmez |

## Bildirim kanalları

| Kanal | Önem | İçerik |
| --- | --- | --- |
| `rest_timer` — Dinlenme sayacı | Düşük (sessiz) | Kalan süreyi geri sayan, kaydırılamayan bildirim; "Bitir" düğmesi |
| `rest_done` — Dinlenme bitti | Yüksek | Titreşim ve ses; 60 sn sonra kendiliğinden kalkar |
| `reminders` — Antrenman hatırlatmaları | Varsayılan | Antrenman günü ve uzun ara uyarıları |

Kullanıcı kanalları telefonun Ayarlar › Uygulamalar › SuperGym › Bildirimler
bölümünden ayrı ayrı kapatabilir.

## Akışlar

### Dinlenme sayacı

1. Arayüz set eklenince `startRest(bitiş)` çağırır (`timer.js`).
2. `RestTimer.start`: bitiş zamanı `rest_end` olarak saklanır, `RestAlarmReceiver`'a
   tam zamanlı alarm kurulur, kronometresi geriye sayan bildirim gösterilir.
3. Süre dolunca alarm `RestTimer.finished`'ı çağırır:
   uygulama ekrandaysa yalnızca titrer; değilse yüksek önemli "Dinlenme bitti" bildirimi.
4. −15 / +15 düğmeleri `startRest`'i yeni bitiş zamanıyla tekrar çağırır; "Atla" ve
   bildirimdeki "Bitir" `cancelRest`'e denk gelir.
5. Uygulama öne gelince arayüz `restEndsAt()`'e bakar: 0 ise ve süre dolmamışsa sayaç
   bildirimden durdurulmuştur, arayüz de kapatır.

Arayüzdeki sayaç süreyi bitiş zamanından hesaplar; uygulama arka plandan dönünce
doğru süreyle devam eder.

### Hatırlatmalar

1. Arayüz `syncState` ile antrenman günlerini ve ayarları gönderir.
2. `Reminders.schedule`: gün seçilmemiş ve uzun ara uyarısı kapalıysa alarm kaldırılır;
   değilse bir sonraki `reminderTime`'a alarm kurulur.
3. Alarm çalınca (`Reminders.check`): bugün antrenman girildiyse bildirim yok. Bugün
   seçili günlerdense "Bugün antrenman günü"; değilse ve son antrenmandan bu yana
   `inactiveDays` gün geçtiyse "N gündür antrenman yapmadın". Sonra ertesi güne
   yeniden kurulur.

### Widget

`WidgetProvider` üç bilgi gösterir: bu hafta kaç gün (pazartesiden itibaren), hafta
serisi, son antrenman (Bugün / Dün / N gün önce). Saatte bir
(`res/xml/widget_info.xml` `updatePeriodMillis`), her `syncState`'te ve günlük
hatırlatma alarmında yenilenir. Dokununca uygulama açılır.

### Otomatik yedek

1. Arayüz açılışta ve uygulama her öne geldiğinde kontrol eder (`main.js`):
   `backupDays` > 0, en az bir antrenman var ve son yedekten bu yana `backupDays` gün geçti.
2. `GET /api/export` ile yedek alınır, `autoBackup("supergym-otomatik-YYYY-AA-GG.json", …)`.
3. Android 10+: MediaStore ile **İndirilenler/SuperGym** klasörüne yazılır (izin gerekmez).
   Android 9 ve öncesi: aynı klasöre doğrudan, depolama izniyle.
4. En yeni 8 otomatik yedek tutulur, eskileri silinir (yalnızca uygulamanın kendi
   oluşturduğu `supergym-otomatik-*` dosyaları).
5. Başarılıysa `settings.lastBackup` bugün olur. Başarısızsa bir sonraki açılışta denenir.

Bu klasör uygulama silinse de kalır; geri yüklemek için Hareketler › Yedek › İçe aktar.

## Ekran

- **Kenardan kenara (Android 15):** `targetSdk 35` uygulamayı ekranın tamamına çizer.
  `MainActivity`, WebView'i bir `FrameLayout`'a koyup durum çubuğu, gezinme çubuğu ve
  klavye kadar iç boşluk verir.
- **Geri tuşu:** WebView'de geri gidilebiliyorsa geri gider (açık panel kapanır, tam
  ekran dinlenme küçülür, önceki sekmeye dönülür); gidilemiyorsa uygulama kapanır.
- `launchMode="singleTask"`: bildirime ya da widget'a dokununca açık uygulama öne gelir,
  yeniden başlamaz.

## İmza

Secret tanımlı değilse her APK, o derlemede üretilen geçici debug anahtarıyla
imzalanır ve eski sürümün üzerine kurulamaz. Kalıcı anahtar için: [../TODO.md](../TODO.md)
ve [gelistirme.md](gelistirme.md#apk-ve-sürüm).
