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
| `Reminders` | Uzun ara uyarısının alarmını kurar; alarm çalınca bildirim gerekip gerekmediğine karar verir. |
| `ReminderReceiver` | Günlük uzun ara alarmı; telefon açılınca (`BOOT_COMPLETED`) ve uygulama güncellenince (`MY_PACKAGE_REPLACED`) uzun ara alarmını ve antrenman alarmlarını yeniden kurar, widget'ı yeniler. |
| `WorkoutAlarms` | Antrenman alarmları: en yakın hazırlık/gitme olayını kurar, hazırlık bildirimi, çalan alarm, 5 dakikada bir tekrar, ertele, "Antrenmana girdim", deneme alarmı. |
| `WorkoutAlarmReceiver` | Antrenman alarmının olayları (zamanı gelen olay, tekrar, ertele, deneme). |
| `AlarmActivity` | Kilit ekranının (ve izin verildiyse diğer uygulamaların) üstünde açılan tam ekran alarm: ekranı kaplayan fotoğraf, "Ertele" ve "Antrenmana girdim". |
| `AlarmImage` | Alarm fotoğrafını uygulamanın klasöründe saklar (`files/alarm_image.jpg`); yedeğe girmez. |
| `AlarmSound` | Alarm sesi: seçilen ses, ses değişince bildirim kanalını yenileme, müzik dosyasını Alarms/SuperGym'e kopyalama. |
| `WidgetProvider` | Ana ekran widget'ı. |
| `NativeState` | Arayüzün gönderdiği antrenman günleri, alarmlar ve hatırlatma ayarları (SharedPreferences `supergym`); tarih hesapları (hafta, seri, son antrenman). |
| `Backup` | Otomatik yedeği İndirilenler/SuperGym klasörüne yazar, eskilerini siler. |
| `Notifications` | Bildirim kanalları ve ortak bildirim ayarları. |
| `Alarms` | Tam zamanlı alarm kurma (izin yoksa birkaç dakika gecikebilen alarma düşer). |

## Köprü: `window.SuperGymAndroid`

Arayüzden çağrılan Java metotları (`MainActivity.Bridge`). Arayüz her çağrıyı
`android()?.metot?.()` biçiminde yapar; köprü yoksa (bilgisayarda) özellik atlanır.

| Metot | Ne yapar | Arayüzde kullanıldığı yer |
| --- | --- | --- |
| `exportFile(ad, içerik)` | "Dosyayı kaydet" ekranını açar; bitince `window.onExportDone(ok)` çağrılır | Plan › Yedek › Dışa aktar |
| `autoBackup(ad, içerik) → boolean` | İndirilenler/SuperGym'e yazar. Android 9 ve öncesinde izin yoksa izin ister ve `false` döner | `main.js` `autoBackup` |
| `startRest(bitişMs)` | Dinlenme alarmını kurar, geri sayan bildirimi gösterir (bitiş zamanı epoch ms) | `timer.js` |
| `cancelRest()` | Alarmı ve bildirimi kaldırır | `timer.js` |
| `restEndsAt() → long` | Sayaç sürüyorsa bitiş zamanı, durdurulmuş/bitmişse 0 (bildirimden "Bitir"e basıldı mı?) | `timer.js` `resume` |
| `vibrate(ms)` | Titreşim | — |
| `keepScreenOn(açık)` | Dinlenme sürerken ekran kararmasın | `timer.js` |
| `requestNotifications()` | Android 13+ bildirim iznini ister | İlk dinlenmede, alarm ya da uzun ara ayarı değişince |
| `notificationsAllowed() → boolean` | Bildirim izni var mı | Plan › Antrenman alarmları uyarısı |
| `syncState(json)` | Antrenman günlerini, alarmları ve hatırlatma ayarlarını kaydeder; uzun ara alarmını ve antrenman alarmlarını yeniden kurar; widget'ı yeniler | `main.js` `syncNative` |
| `setAlarmImage(base64) → boolean` | Alarm fotoğrafını kaydeder (arayüz 1440 px'e küçültülmüş JPEG gönderir) | Plan › Alarm ekranı ve sesi |
| `alarmImage() → string` | Fotoğrafın data URL'si (önizleme için); yoksa boş | aynı |
| `clearAlarmImage()` | Fotoğrafı siler | aynı; fabrika ayarlarına dönünce |
| `alarmSoundName() → string` | Seçili alarm sesinin adı | aynı |
| `pickAlarmSound()` | Telefonun ses listesini açar; seçince `window.onAlarmSoundChanged(true)` | aynı |
| `alarmSoundFileSupported() → boolean` | Kendi müzik dosyası seçilebilir mi (Android 10+) | aynı |
| `pickAlarmSoundFile()` | Ses dosyası seçtirir, Alarms/SuperGym'e kopyalar; bitince `window.onAlarmSoundChanged(ok)` | aynı |
| `resetAlarmSound()` | Telefonun varsayılan alarm sesine döner | Fabrika ayarlarına dönünce |
| `overlayAllowed() → boolean` / `openOverlaySettings()` | "Diğer uygulamaların üzerinde göster" izni (telefon elindeyken de fotoğraf tam ekran açılsın) | aynı |
| `fullScreenAllowed() → boolean` / `openFullScreenSettings()` | Android 14+ tam ekran bildirim izni | Plan › Antrenman alarmları uyarısı |
| `exactAlarmsAllowed() → boolean` / `openExactAlarmSettings()` | "Alarmlar ve hatırlatıcılar" izni | aynı |
| `testAlarm()` | 10 saniye sonra bir kez (tekrarlamadan) çalan deneme alarmı | Plan › Alarm ekranı ve sesi |
| `takeAlarmStart() → string` | "Antrenmana girdim" denildiyse `{"templateId": "…"}` (bir kez), yoksa boş | `main.js` `alarmStart` |

Java'dan arayüze: `window.onExportDone(ok)` (dışa aktarma bitti),
`window.onAppResume()` (uygulama öne geldi; sayaç yeniden kontrol edilir),
`window.onAlarmStart()` (alarmdan "Antrenmana girdim" ile açıldı; arayüz `takeAlarmStart`'ı
okur ve o günün programını bugünün antrenmanına ekler) ve
`window.onAlarmSoundChanged(ok)` (alarm sesi seçildi ya da dosya kopyalandı).

`syncState` gövdesi (yalnızca değiştiğinde gönderilir):

```json
{
  "attended": ["2026-10-13", "2026-10-14"],
  "reminderTime": "18:00", "inactiveDays": 3,
  "prepMinutes": 60, "snoozeMinutes": 10,
  "alarms": [
    { "day": 2, "time": "18:00", "templateId": "builtin-push", "program": "Push",
      "exercises": ["Bench Press", "Incline Bench Press", "Shoulder Press"] }
  ]
}
```

`attended`: son 400 gündeki antrenman günleri. `alarms`: yalnızca açık alarmlar; program
adı ve hareketleri de gönderilir, çünkü hazırlık bildirimi uygulama kapalıyken gelir.

## İzinler

| İzin | Neden | Not |
| --- | --- | --- |
| `INTERNET` | WebView'in telefondaki yerel sunucuya (127.0.0.1) bağlanması | Dışarıya bağlantı yok |
| `VIBRATE` | Dinlenme bitince titreşim | |
| `POST_NOTIFICATIONS` | Dinlenme ve hatırlatma bildirimleri | Android 13+; ilk dinlenmede istenir |
| `USE_EXACT_ALARM` | Sayacın ekran kapalıyken de tam zamanında bitmesi | Android 13+; kurulumda verilir |
| `SCHEDULE_EXACT_ALARM` (`maxSdkVersion 32`) | Aynısı, Android 12 için | |
| `RECEIVE_BOOT_COMPLETED` | Telefon yeniden başlayınca uzun ara ve antrenman alarmlarını kurmak | |
| `USE_FULL_SCREEN_INTENT` | Alarmda fotoğrafın kilit ekranında tam ekran açılması | Android 14+'ta kullanıcı kapatabilir; Plan'da uyarı çıkar |
| `SYSTEM_ALERT_WINDOW` | Telefon kullanılırken de alarm fotoğrafının tam ekran açılması | Kullanıcı Plan › "Telefon elindeyken de tam ekran aç"tan verir; vermezse yalnızca bildirim |
| `WRITE_EXTERNAL_STORAGE` (`maxSdkVersion 28`) | Otomatik yedek, yalnızca Android 9 ve öncesi | Sonrasında izin gerekmez |

## Bildirim kanalları

| Kanal | Önem | İçerik |
| --- | --- | --- |
| `rest_timer` — Dinlenme sayacı | Düşük (sessiz) | Kalan süreyi geri sayan, kaydırılamayan bildirim; "Bitir" düğmesi |
| `rest_done` — Dinlenme bitti | Yüksek | Titreşim ve ses; 60 sn sonra kendiliğinden kalkar |
| `reminders` — Antrenman hatırlatmaları | Varsayılan | Uzun ara uyarısı |
| `workout_prep` — Antrenman hazırlığı | Yüksek | Gitmeden önce o günün programı ve hareketleri |
| `workout_alarm`, `workout_alarm_N` — Antrenman alarmı | Yüksek | Alarm sesi (telefonun alarm ses düzeyiyle), titreşim, tam ekran fotoğraf. Ses değişince eski kanal silinir, sürüm numarası artan yeni kanal açılır (Android 8+'da kanalın sesi sonradan değiştirilemez). |

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

### Antrenman alarmları

1. Arayüz `syncState` ile açık alarmları (gün, saat, program ve hareketleri),
   `prepMinutes` ve `snoozeMinutes`'ı gönderir.
2. `WorkoutAlarms.schedule`: önümüzdeki 8 gündeki olaylardan (her alarm için gitme saati
   ve `prepMinutes` önceki hazırlık) yalnızca **en yakını** kurulur. Gitme olayı
   `setAlarmClock` ile kurulur (durum çubuğunda alarm simgesi; pil tasarrufunda da tam
   zamanında). Olay gerçekleşince bir sonraki kurulur.
3. **Hazırlık:** bugün antrenman girilmediyse o günün programını ve hareketlerini
   gösteren bildirim.
4. **Gitme saati:** bugün antrenman girildiyse çalmaz. Değilse alarm bildirimi
   (`FLAG_INSISTENT`: kaldırılana kadar ses tekrar eder, 60 sn sonra kendiliğinden kalkar)
   tam ekran `AlarmActivity` ile gösterilir. Telefon kilitliyse ya da ekran kapalıysa
   fotoğraf açılır; telefon kullanılırken Android yalnızca üstte bildirim gösterir.
   "Diğer uygulamaların üzerinde göster" izni varsa `AlarmActivity` ayrıca doğrudan açılır.
5. **Tekrar:** 5 dakika sonra yeniden çalmak üzere kurulur. "Antrenmana girdim"e
   basılana, o gün set girilene ya da ilk çalıştan 2 saat geçene kadar tekrarlar.
6. **Ertele:** sesi susturur, `snoozeMinutes` sonra yeniden çalar.
7. **Antrenmana girdim:** alarm susar ve tekrar kurulmaz; uygulama açılır, arayüz
   `takeAlarmStart` ile o günün programını alır ve bugünün antrenmanına ekler.

### Uzun ara uyarısı

1. Arayüz `syncState` ile antrenman günlerini ve ayarları gönderir.
2. `Reminders.schedule`: uzun ara uyarısı kapalıysa alarm kaldırılır; değilse bir
   sonraki `reminderTime`'a alarm kurulur.
3. Alarm çalınca (`Reminders.check`): bugün antrenman girildiyse bildirim yok. Son
   antrenmandan bu yana `inactiveDays` gün geçtiyse "N gündür antrenman yapmadın".
   Sonra ertesi güne yeniden kurulur.

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

Bu klasör uygulama silinse de kalır; geri yüklemek için Plan › Yedek › İçe aktar.

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
