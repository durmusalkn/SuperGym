# Veri modeli

Tüm veri tek bir JSON dosyasındadır: Android'de uygulamanın kendi klasöründe
(`files/supergym.json`), bilgisayarda `-data` ile verilen klasörde (varsayılan `data/`).
Dışa aktarılan yedek dosyası da aynı biçimdedir (ek olarak `exportedAt` alanı taşır).

Tanımlar: `core/model.go`. Doğrulama: `validateData`. Varsayılanlar ve düzeltmeler:
`normalize`. Sürüm yükseltme: `upgrade`, `migrateV1`.

Şu anki sürüm: **4** (`schemaVersion`).

## Dosyanın tamamı (`Data`)

```json
{
  "app": "SuperGym",
  "version": 4,
  "exportedAt": "2026-10-14T18:40:00+03:00",
  "exercises": [ … ],
  "workouts": [ … ],
  "templates": [ … ],
  "bodyWeights": [ … ],
  "settings": { … }
}
```

| Alan | Açıklama |
| --- | --- |
| `app` | Her zaman `"SuperGym"`. Başka değerdeki dosya içe aktarılmaz. |
| `version` | Şema sürümü. Uygulamanınkinden büyükse dosya reddedilir ("daha yeni bir sürümle alınmış"). |
| `exportedAt` | Yalnızca dışa aktarılan dosyada; okurken yok sayılır. |

## Hareket (`exercises[]`)

```json
{ "id": "a1b2c3d4e5f60718", "name": "Bench Press", "group": "Göğüs", "muscle": "Göğüs",
  "compound": true, "rating": 4, "kind": "weight",
  "note": "Kürek kemikleri sıkı", "repMin": 8, "repMax": 12, "increment": 2.5 }
```

| Alan | Tür | Kural |
| --- | --- | --- |
| `id` | metin | Boş olamaz, benzersiz. Sunucu üretir (8 rastgele bayt, onaltılık). |
| `name` | metin | Boş olamaz, en fazla 60 karakter, büyük/küçük harf farkı gözetmeden benzersiz. Baştaki/sondaki boşluk silinir. |
| `group` | metin | `Göğüs`, `Sırt`, `Bacak`, `Omuz`, `Kol`, `Karın`, `Kardiyo`, `Diğer`. Bilinmeyen değer `Diğer` olur. |
| `muscle` | metin | Hedef kas; grubun kaslarından biri (`core.Muscles`, örn. Göğüs: `Göğüs`, `Üst göğüs`, `Alt göğüs`). Grupla uyuşmayan değer boşaltılır. Hazır programlar hareketleri buna göre seçer. |
| `compound` | mantıksal | Çok eklemli temel hareket (hazır listeden gelir, arayüzde değiştirilmez); programlarda önce gelir. |
| `rating` | tam sayı | Kullanıcının puanı: 0 (puanlanmadı) ya da 1–5. |
| `kind` | metin | `weight` (kilo × tekrar) ya da `cardio` (dakika, km). Boşsa `weight`. |
| `archived` | mantıksal | Arşivlenmiş hareket listelerde görünmez, geçmişte görünür. |
| `note` | metin | En fazla 500 karakter. Antrenmanda hareketin altında görünür. |
| `repMin`, `repMax` | tam sayı | Artırma önerisinin hedef aralığı. 0–100, `repMin ≤ repMax`. Ağırlık hareketinde ikisi de 0 ise 8–12 olur. |
| `increment` | sayı | Önerideki ağırlık artışı (kg). 0–50. Ağırlık hareketinde 0 ise 2,5 olur. |

**Silme kuralı:** hareket bir antrenmanda kullanılmışsa silinmez, **arşivlenir**
(geçmiş bozulmasın diye). Her iki durumda da programlardan çıkarılır. Kullanılmış bir
hareketin türü (`kind`) değiştirilemez.

**Hazır liste:** tüm kas grupları için yaklaşık 110 hareket (`core/catalog.go`,
`catalog`); her hedef kasta en yaygın hareketler önce gelir. İlk açılışta eklenir.
4. sürüme yükseltirken listede olup verilerde olmayanlar eklenir; aynı adda (büyük/küçük
harf farkı gözetmeden) bir hareket varsa yenisi eklenmez, grubu uyuyorsa hedef kası doldurulur.

## Antrenman (`workouts[]`)

Her gün için **en fazla bir** antrenman vardır. Liste tarihe göre sıralı tutulur.

```json
{
  "date": "2026-10-14",
  "start": "2026-10-14T15:05:12.000Z",
  "end": "2026-10-14T15:53:40.000Z",
  "note": "Omuz biraz ağrıdı",
  "items": [
    {
      "exerciseId": "a1b2c3d4e5f60718",
      "linkNext": true,
      "sets": [
        { "reps": 10, "weight": 40, "warmup": true },
        { "reps": 8, "weight": 62.5, "rpe": 8 },
        { "reps": 8, "weight": 62.5 }
      ]
    },
    { "exerciseId": "…", "sets": [ { "minutes": 20, "km": 3.5 } ] }
  ]
}
```

| Alan | Kural |
| --- | --- |
| `date` | `YYYY-AA-GG`, gerçek bir tarih, dosyada benzersiz. |
| `start`, `end` | RFC 3339 zaman ya da boş. İlk ve son setin girildiği an (yalnızca bugünün antrenmanında tutulur). |
| `note` | Antrenman notu. |
| `items[].exerciseId` | Var olan bir hareket olmalı (arşivlenmiş olabilir). |
| `items[].linkNext` | `true` ise bu hareket listedeki bir sonrakiyle **süperset**. Ardışık bağlar bir grup oluşturur. |
| `items[].note` | 1. sürümden gelen eski notlar burada durur. |

Hareketi ve notu kalmayan gün kaydedilirken silinir.

### Set

| Alan | Kural |
| --- | --- |
| `reps` | Tam sayı, 0–10000 |
| `weight` | kg, 0–2000 |
| `minutes` | Kardiyo süresi, 0–1440 |
| `km` | Kardiyo mesafesi, 0–1000 |
| `warmup` | `true` ise ısınma seti: rekora, hacme, grafiğe, "geçen sefer"e ve öneriye sayılmaz |
| `rpe` | Zorluk; 0 (girilmedi) ya da 1–10 (arayüz yarım puana yuvarlar) |

Sayılar sonlu ve negatif olmayan değerler olmalı. Boş alanlar dosyaya yazılmaz.

## Program (`templates[]`)

```json
{ "id": "…", "name": "Push (kopyam)", "exerciseIds": ["…", "…"], "forkOf": "builtin-push" }
```

`name` boş olamaz; `exerciseIds` var olan hareketleri göstermeli. `id` boş ya da
tekrarlıysa yeni üretilir. Program uygulanınca listedeki hareketler (arşivlenmiş olanlar
ve antrenmanda zaten olanlar hariç) sırayla eklenir.

| Alan | Anlamı |
| --- | --- |
| `builtin` | Doluysa hazır programdır (`push`, `pull`, `legs`, `upper`, `lower`, `fullbody`); `id`'si `builtin-<anahtar>`. |
| `forkOf` | Kopyalandığı programın `id`'si (yalnızca bilgi; kopya asıl programdan bağımsızdır). |

**Hazır programlar** her kaydetmede `normalize` içinde (`syncBuiltins`) yeniden
oluşturulur ve listenin başına konur. Her programın sıralı "yerleri" vardır (örn. Push:
temel göğüs, üst göğüs, ön omuz, yan omuz, göğüs yalıtım, iki triceps). Her yer için o
kaslardan bir ağırlık hareketi seçilir: puan (puansız = 3) en önemlisi, yerin istediği
türde (temel/yalıtım) hareket 2,5 puan avantaj alır, 1 puanlı hareket ancak başka seçenek
yoksa seçilir; eşitlikte hazır listede önce gelen kazanır. Hazır program API'den
değiştirilemez ve silinemez; `POST /api/templates/{id}/fork` kopyasını oluşturur.

## Vücut ağırlığı (`bodyWeights[]`)

```json
{ "date": "2026-10-14", "kg": 80.6 }
```

Her gün en fazla bir kayıt; `kg` 0'dan büyük, en çok 500. Tarihe göre sıralı.

## Ayarlar (`settings`)

| Alan | Varsayılan | Kural | Anlamı |
| --- | --- | --- | --- |
| `restSeconds` | 90 | 0–3600 | Dinlenme süresi; 0 = sayaç kapalı |
| `showRpe` | `false` | — | Setlerde zorluk (RPE) kutusu |
| `backupDays` | 7 | 0–60 | Otomatik yedek aralığı (gün); 0 = kapalı |
| `lastBackup` | — | tarih | Son başarılı otomatik yedek |
| `reminderDays` | `[]` | 0–6, sıralı, tekrarsız | Eski sürümün hatırlatma günleri; 4. sürümde alarmlara çevrilip boşaltılır |
| `reminderTime` | `"18:00"` | `SS:DD` | Uzun ara uyarısının saati |
| `inactiveDays` | 0 | 0–30 | Bu kadar gün antrenman yoksa uyar; 0 = kapalı |
| `alarms` | `[]` | en fazla 21; aynı gün ve saatte iki alarm olamaz | Antrenman alarmları (aşağıda) |
| `prepMinutes` | 60 | 0–240 | Hazırlık bildirimi gitme saatinden kaç dakika önce; 0 = kapalı |
| `snoozeMinutes` | 10 | 1–60 | Ertele düğmesinin süresi |

### Alarm (`settings.alarms[]`)

```json
{ "id": "…", "day": 2, "time": "18:00", "templateId": "builtin-push", "enabled": true }
```

| Alan | Kural |
| --- | --- |
| `day` | 0 = Pazar … 6 = Cumartesi |
| `time` | Gitme saati, `SS:DD` |
| `templateId` | O günün programı ya da boş. Program silinirse boşaltılır. |
| `enabled` | Kapalı alarm saklanır ama çalmaz. |

Alarmlar pazartesiden başlayarak güne, sonra saate göre sıralanır. Alarm fotoğrafı ve
sesi veride değil, telefonda tutulur (yedeğe girmez; bkz. [android.md](android.md)).

## Sürümler ve yükseltme

Dosya açılırken ve içe aktarılırken `upgrade` çalışır. Eski sürümde bir dosya
açıldığında, **çevrilmeden önceki hali** `supergym.json.v<sürüm>-yedek` adıyla
saklanır, sonra yeni sürüm yazılır.

| Sürüm | Değişiklik | Yükseltmede ne olur |
| --- | --- | --- |
| 1 | Tek tablo: `entries[]` (`date`, `exercise` adı, `sets` sayısı, `reps`, `weight`, `note`) | Hazır hareket listesi oluşturulur; adı listede olmayan hareketler (büyük/küçük harf farkı gözetmeden) `Diğer` grubunda eklenir. Aynı günün kayıtları tek antrenman olur. "3 set × 10 × 60 kg" üç ayrı sete dönüşür (set sayısı 0 ise 1 set). Aynı gün aynı hareket tek kalemde birleşir, notlar o kaleme eklenir. |
| 2 | Hareket listesi, set bazında antrenmanlar, programlar, vücut ağırlığı, `restSeconds` | — |
| 3 | Isınma seti, RPE, süperset, antrenman saatleri, hareket notu ve hedef aralığı, yedek ve hatırlatma ayarları | `backupDays` = 7, `reminderTime` = 18:00; ağırlık hareketlerine 8–12 / 2,5 kg verilir. |
| 4 | Hedef kas, puan, hazır programlar ve kopyalar, antrenman alarmları | Hazır listede olup verilerde olmayan hareketler eklenir; `reminderDays`'teki her gün `reminderTime`'da çalan açık bir alarm olur; `prepMinutes` = 60, `snoozeMinutes` = 10. |

**Yeni sürüm eklerken:** `schemaVersion`'ı artır, yeni alanları geriye uyumlu ekle
(`omitempty`), varsayılanları `normalize`'a ya da `upgrade` içindeki
`if in.Version < N` bloğuna yaz, kuralları `validateData`'ya ekle ve
`core/store_test.go`'ya bir yükseltme testi yaz.

## Hatalı dosyalar

- **Dosya okunamıyor ya da geçersiz** (bozuk JSON, başka uygulamanın dosyası, kurallara
  uymayan veri): uygulama yine açılır. Dosya `supergym.json.bozuk-<tarih-saat>` adıyla
  kenara alınır, boş veriyle başlanır ve arayüzde kalıcı bir uyarı gösterilir. Uyarı,
  bir yedek içe aktarılınca kalkar.
- **İçe aktarma**: dosyada tek bir geçersiz kayıt bile varsa hiçbir şey değişmez ve
  hatanın yeri söylenir (örn. "3. kayıt geçersiz: …").
- **Yazma**: önce `supergym.json.tmp`'ye yazılır, diske işlenir (fsync), sonra asıl
  dosyanın yerine konur; yarım yazılmış dosya kalmaz.
