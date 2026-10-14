# Tasarım: Ritim

Arayüzün tasarım dili **Ritim**. Fikir: antrenman bir döngüdür (efor, nefes, tekrar);
haftalar ve aylar da döngüdür. Bu yüzden her şey çember: setler bir halkanın dilimleri,
dinlenme bir nefes rehberi, takvim bir ay halkası, ilerleme ağaç halkaları, kas dengesi
bir çiçek.

Üç tasarım yönü (Odak, Ritim, Almanak) karşılaştırılarak seçildi; taslaklar bir
tasarım tuvalinde duruyor. Kod tarafındaki tek kaynak `web/src/style.css` ve aşağıdaki
bileşenlerdir.

## Renkler

Tanım: `web/src/style.css` (`@theme`). Tailwind sınıfı olarak kullanılır
(`bg-ink`, `text-muted`, `bg-coral` …).

| Ad | Değer | Kullanım |
| --- | --- | --- |
| `ink` | `#15121f` | Zemin (gece mürekkebi) |
| `surface` | `#1f1b2d` | Kartlar, hap düğmeler, menü |
| `line` | `#2e2942` | Çerçeveler, boş halka dilimleri, ikincil düğmeler |
| `text` | `#eeeaf6` | Metin; seçili sekme zemini |
| `muted` | `#a39db8` | İkincil metin (zeminde ~7:1 kontrast) |
| `coral` | `#ff8a6b` | **Efor**: tamamlanan setler, birincil düğme, vurgu. Üzerindeki metin koyu (`ink`) olmalı. |
| `mint` | `#74e3c8` | **Dinlenme**: nefes ekranı, ısınma setleri, vücut ağırlığı grafiği |
| `lav` | `#b79cff` | Süperset, hareket notu |
| `sun` | `#ffc15e` | Uyarı (bildirim izni kapalı) |

Dinlenme ekranının zemini ayrıdır: `#121a1f` (hafif yeşilimsi gece), kart `#1a262c`,
ikincil metin `#9db5b8`.

Eski ekranlardan kalan `zinc-*` ve `emerald-*` sınıfları aynı dosyada bu paletle
eşleştirilmiştir (zinc → mürekkep tonları, emerald → mercan); yeni kodda tema adları
kullanılmalı.

### Kas grubu renkleri

`web/src/util.js` `GROUP_COLORS`. Takvim noktaları, denge çiçeği, hareket satırlarının
halkası ve gruplar listesinde kullanılır.

| Göğüs | Sırt | Bacak | Omuz | Kol | Karın | Kardiyo | Diğer |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `#ff8a6b` | `#b79cff` | `#ffc15e` | `#74e3c8` | `#f59bc2` | `#8fb8ff` | `#c9e87a` | `#a39db8` |

## Yazı

**Outfit** (değişken kalınlık), `@fontsource-variable/outfit` paketiyle uygulamanın
içine gömülü; internet gerekmez. Latin ve Latin genişletilmiş (Türkçe karakterler) dahil.

| Yer | Boyut / kalınlık |
| --- | --- |
| Antrenman halkasındaki kilo | 76 px, 600 |
| Hareket adı | 30 px, 600 |
| Ekran başlığı | 22 px, 600 |
| Gövde | 14–17 px, 400–500 |
| İkincil | 11–13 px, `muted` |

Rakamlar sayaçlarda `tabular-nums` (eş genişlik) ile yazılır.

## Biçim

- **Yuvarlaklık:** kartlar 28 px, satırlar ve küçük kartlar 20–22 px, düğmeler ve
  giriş kutuları tamamen yuvarlak (hap).
- **Dokunma alanı:** en az 40–44 px; birincil "seti tamamla" 84 px.
- **Menü:** altta yüzen hap; dört sekme, simgeler halkalardan çizilir. Seçili sekme
  açık zeminli.
- **Gölge:** yalnızca yüzen öğelerde (menü, mesaj, dinlenme baloncuğu).

## Bileşenler

| Bileşen | Kod | Açıklama |
| --- | --- | --- |
| Dilimli halka | `rings.js` `segmentRing(boyut, kalınlık, dilimler, etiket)` | Saat 12'den başlar; her dilim `{color, opacity, cls}`. Antrenman halkası (setler), ısınma halkası, boş gün halkası. |
| İlerleme halkası | `rings.js` `progressRing(boyut, kalınlık, oran, renk, iz)` | Yörüngedeki hareketler, hareket satırları, dinlenme baloncuğu. |
| Hap düğme (stepper) | `workout.js` `stepper` | − değer + ; değer elle de yazılabilir. |
| Yuvarlak simge düğmesi | `ui.js` `roundBtn` | 44 px, çerçeveli. |
| Simgeler | `ui.js` `icon(ad)` | Çizgi simgeler: x, plus, check, left, right, up, down, link, trash, note. Emoji kullanılmaz. |
| Düğme | `ui.js` `button(metin, fn, tür)` | `primary` (mercan, koyu yazı), `secondary`, `outline`, `danger`, `ghost`. |
| Kart | `ui.js` `card` | `surface` zemin, 28 px yuvarlak. |
| Alttan açılan panel | `ui.js` `openSheet` | Tam ekran; geri tuşu kapatır. |
| Mesaj | `ui.js` `show` | Üstte açık renkli hap; hata koyu kırmızı. |

## Hareket (animasyon)

`style.css`:

- `nefes`: 10 sn döngü; 0–4 sn büyür (nefes al), 4–10 sn küçülür (nefes ver).
  Dinlenme ekranındaki halkalar; ekrandaki "Nefes al / Nefes ver" yazısı aynı zamana
  göre değişir.
- `nabiz`: 1,6 sn; antrenman halkasında sıradaki setin dilimi.
- `prefers-reduced-motion` açıksa ikisi de durur.

## Ekranlar

| Ekran | Ritim karşılığı |
| --- | --- |
| Antrenman | Seçili hareketin set halkası (yapılanlar dolu mercan, sıradaki nabız, kalanlar boş; iç ince nane halka = ısınma setleri). Altında ad, "geçen sefer", öneri hapı, not hapı, kilo/tekrar hapları, ısınma düğmesi, yuvarlak "seti tamamla". Altta yörünge: günün hareketleri (süpersetler kesikli çerçevede, + ile yeni hareket); sonra girilen setler ve hareket işlemleri. |
| Dinlenme | Tam ekran nefes rehberi: üç iç içe nane halka, kalan süreyi gösteren ince halka, −15 / +15 / Atla, altta sıradaki set kartı. "Küçült" ile menünün üstünde baloncuk. |
| Takvim | Ay halkası: her gün bir nokta; gidilen günler o günün hacmine göre büyür, rengi o günün ilk kas grubu. Ortada hafta serisi. Altta bu haftanın yedi halkası ve ayın antrenmanları. |
| İlerleme | Büyüme halkaları: son 5 ay, en dıştaki en yeni; kalınlık o ayın hacmi (kardiyoda mesafe). Ortada rekor. Altında yorum, özet kutuları, grafik, geçmiş, denge çiçeği (yaprak boyu = set; yapılmayan grup kesikli yaprak), vücut ağırlığı. |
| Hareketler | Arama, kas grubu baloncukları (boyut = hareket sayısı; dokununca süzer), halkalı hareket satırları (halka: son yapılışın rekora oranı), program kartları, ayarlar, hatırlatmalar, yedek. |

## Erişilebilirlik

- Gerçek `<button>`, `<a>`, `<input>`; simge düğmelerinde `aria-label`.
- Halkalarda `role="img"` ve açıklama (örn. "3 setten 1 tanesi tamam"); süs halkaları
  `aria-hidden`.
- Sekmelerde `aria-current="page"`, açma/kapama düğmelerinde `aria-pressed`.
- Mercan zeminde yazı her zaman koyu (`ink`); beyaz yazı yeterli kontrast vermez.
