// Plan sekmesi: programlar, antrenman alarmları, ayarlar, yedek ve sıfırlama.
import { h, today, addDays, shortDate, WEEKDAYS } from '../util.js'
import { state, api, mutate, exercise, findWorkout } from '../state.js'
import { render, show, card, button, input, select, sectionTitle, icon, android } from '../ui.js'
import { editTemplate } from '../sheets.js'

export function planView() {
  return h(
    'div',
    {},
    h('header', {}, h('h1', { class: 'text-[22px] font-semibold' }, 'Plan')),
    templatesSection(),
    alarmsSection(),
    settingsSection(),
    inactiveSection(),
    backupSection(),
    resetSection(),
  )
}

// --- Programlar ---

const TINTS = ['#2a1f2a', '#221f35', '#2a2620', '#1f2a29']

function templateTile(t, k) {
  const n = t.exerciseIds.filter((id) => exercise(id)).length
  return h(
    'button',
    {
      type: 'button',
      class: 'flex h-[74px] flex-col items-center justify-center gap-0.5 rounded-[22px] px-2 active:opacity-80',
      style: `background:${TINTS[k % TINTS.length]}`,
      onclick: () => editTemplate(t),
    },
    h('span', { class: 'max-w-full truncate font-semibold' }, t.name),
    h('span', { class: 'text-xs text-muted' }, `${n} hareket`),
  )
}

function templatesSection() {
  const builtins = state.data.templates.filter((t) => t.builtin)
  const own = state.data.templates.filter((t) => !t.builtin)
  return [
    sectionTitle('Hazır programlar'),
    h('div', { class: 'grid grid-cols-3 gap-2' }, builtins.map(templateTile)),
    h('p', { class: 'mt-2 px-1 text-xs text-muted' }, 'Hareketler puanlarına göre otomatik seçilir. Değiştirmek için programa dokunup kopyasını oluştur.'),
    sectionTitle('Programlarım'),
    h(
      'div',
      { class: 'grid grid-cols-3 gap-2' },
      own.map((t, k) => templateTile(t, k + 1)),
      h(
        'button',
        { type: 'button', 'aria-label': 'Yeni program', class: 'flex h-[74px] items-center justify-center rounded-[22px] border border-dashed border-zinc-600 text-muted', onclick: () => editTemplate(null) },
        icon('plus', 22),
      ),
    ),
    own.length ? null : h('p', { class: 'mt-2 px-1 text-xs text-muted' }, 'Kendi programını sıfırdan oluştur ya da bir hazır programın kopyasını al.'),
  ]
}

export async function saveSettings(change, message = 'Kaydedildi.') {
  try {
    await mutate('PUT', '/api/settings', { ...state.data.settings, ...change })
    if (message) show(message)
    render()
  } catch {
    // mutate hatayı gösterdi
  }
}

// --- Alarmlar ---

// Pazartesiden başlayarak; değerler JavaScript'teki gibi (Pazar = 0).
const DAYS = [1, 2, 3, 4, 5, 6, 0]

function saveAlarms(alarms, message) {
  android()?.requestNotifications?.()
  return saveSettings({ alarms }, message)
}

function addAlarm() {
  const alarms = state.data.settings.alarms
  // Henüz alarmı olmayan ilk gün, 18:00.
  const day = DAYS.find((d) => !alarms.some((a) => a.day === d)) ?? 1
  const time = alarms.some((a) => a.day === day && a.time === '18:00') ? '19:00' : '18:00'
  saveAlarms([...alarms, { day, time, templateId: '', enabled: true }], `${WEEKDAYS[day]} ${time} alarmı eklendi.`)
}

function updateAlarm(id, change) {
  saveAlarms(state.data.settings.alarms.map((a) => (a.id === id ? { ...a, ...change } : a)))
}

function removeAlarm(a) {
  if (!confirm(`${WEEKDAYS[a.day]} ${a.time} alarmı silinsin mi?`)) return
  saveAlarms(state.data.settings.alarms.filter((x) => x.id !== a.id), 'Alarm silindi.')
}

function toggle(on, onchange, label) {
  return h(
    'button',
    {
      type: 'button',
      role: 'switch',
      'aria-checked': on ? 'true' : 'false',
      'aria-label': label,
      class: `relative h-8 w-[52px] shrink-0 rounded-full transition-colors ${on ? 'bg-coral' : 'bg-line'}`,
      onclick: () => onchange(!on),
    },
    h('span', { class: `absolute top-1 h-6 w-6 rounded-full bg-text transition-all ${on ? 'left-[24px]' : 'left-1'}` }),
  )
}

// Alarmın bir sonraki çalacağı tarih.
function nextDate(a) {
  const now = new Date()
  const [hh, mm] = a.time.split(':').map(Number)
  let ahead = (a.day - now.getDay() + 7) % 7
  if (ahead === 0 && hh * 60 + mm <= now.getHours() * 60 + now.getMinutes()) ahead = 7
  return addDays(today(), ahead)
}

// Alarmda görünecek hareketler (Android'deki kuralla aynı): o güne Antrenman sekmesinde
// hareket girildiyse onlar, girilmediyse alarmın programındakiler.
function alarmExercises(a) {
  const entered = (findWorkout(nextDate(a))?.items || []).map((it) => exercise(it.exerciseId)?.name).filter(Boolean)
  if (entered.length) return { names: entered, entered: true }
  const t = state.data.templates.find((x) => x.id === a.templateId)
  return { names: t ? t.exerciseIds.map((id) => exercise(id)?.name).filter(Boolean) : [], entered: false }
}

function alarmRow(a) {
  const programs = [['', 'Program yok'], ...state.data.templates.map((t) => [t.id, t.name])]
  const { names, entered } = alarmExercises(a)
  return h(
    'div',
    { class: `space-y-2 rounded-[22px] bg-line/40 p-3 ${a.enabled ? '' : 'opacity-60'}` },
    h(
      'div',
      { class: 'flex items-center gap-2' },
      select({ value: a.day, 'aria-label': 'Gün', class: 'min-w-0 flex-1 py-2.5', onchange: (ev) => updateAlarm(a.id, { day: Number(ev.target.value) }) }, DAYS.map((d) => [d, WEEKDAYS[d]])),
      h(
        'div',
        { class: 'w-[7.5rem] shrink-0' },
        input({ type: 'time', value: a.time, 'aria-label': 'Gitme saati', class: 'min-w-0 px-3 py-2.5', onchange: (ev) => ev.target.value && updateAlarm(a.id, { time: ev.target.value }) }),
      ),
    ),
    h(
      'div',
      { class: 'flex items-center gap-2' },
      select({ value: a.templateId || '', 'aria-label': 'O günün programı', class: 'min-w-0 flex-1 py-2.5', onchange: (ev) => updateAlarm(a.id, { templateId: ev.target.value }) }, programs),
      toggle(a.enabled, (on) => updateAlarm(a.id, { enabled: on }), 'Alarm açık'),
      h(
        'button',
        { type: 'button', 'aria-label': 'Alarmı sil', class: 'flex h-11 w-9 shrink-0 items-center justify-center rounded-full text-[#ffb3be] active:bg-line', onclick: () => removeAlarm(a) },
        icon('trash', 18),
      ),
    ),
    names.length
      ? h(
          'p',
          { class: 'px-1 text-xs leading-relaxed text-muted' },
          entered ? h('span', { class: 'text-mint' }, `${shortDate(nextDate(a))} için girdiğin: `) : null,
          names.join(' · '),
        )
      : null,
  )
}

// Alarm resmi: telefonda kalır (yedeğe girmez). Büyük fotoğraflar küçültülerek saklanır.
async function pickImage(file) {
  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, 1440 / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    const data = canvas.toDataURL('image/jpeg', 0.86).split(',')[1]
    if (!android().setAlarmImage(data)) throw new Error()
    show('Alarm resmi kaydedildi.')
    render()
  } catch {
    show('Resim okunamadı. Başka bir resim deneyin.', false)
  }
}

// Sıradaki açık alarm (önizlemede saat ve program için).
function nextAlarm() {
  const alarms = state.data.settings.alarms.filter((a) => a.enabled)
  if (!alarms.length) return null
  const now = new Date()
  const minutes = now.getHours() * 60 + now.getMinutes()
  // Şu andan kaç dakika sonra çalacağı (bu haftaki saati geçtiyse gelecek hafta).
  const key = (a) => {
    const [hh, mm] = a.time.split(':').map(Number)
    const diff = ((a.day - now.getDay() + 7) % 7) * 1440 + hh * 60 + mm - minutes
    return diff > 0 ? diff : diff + 7 * 1440
  }
  return alarms.reduce((best, a) => (key(a) < key(best) ? a : best))
}

// Alarm ekranının önizlemesi: fotoğraf ekranı kaplar, saat ve düğmeler kenarlarda.
function alarmPreview(src, onclick) {
  const a = nextAlarm()
  const program = a?.templateId ? state.data.templates.find((t) => t.id === a.templateId)?.name : ''
  const names = a ? alarmExercises(a).names : []
  // Telefondaki gibi: 4'ten fazla hareket iki sütun, sütun sütun numaralı.
  const rows = names.length > 4 ? Math.ceil(names.length / 2) : names.length
  return h(
    'button',
    {
      type: 'button',
      'aria-label': src ? 'Alarm fotoğrafını değiştir' : 'Alarm fotoğrafı seç',
      class: 'relative mx-auto block aspect-[9/16] w-[220px] overflow-hidden rounded-[28px] bg-ink ring-1 ring-line',
      onclick,
    },
    src
      ? h('img', { src, alt: '', class: 'absolute inset-0 h-full w-full object-cover' })
      : h(
          'span',
          { class: 'absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted' },
          h('span', { class: 'flex h-14 w-14 items-center justify-center rounded-full border border-dashed border-zinc-600' }, icon('plus', 22)),
          h('span', { class: 'text-sm' }, 'Fotoğraf seç'),
        ),
    h(
      'span',
      { class: 'absolute inset-x-0 top-0 block bg-gradient-to-b from-black/50 to-transparent px-4 pb-6 pt-3 text-left' },
      h('span', { class: 'block text-2xl font-semibold text-white' }, a ? a.time : '18:00'),
      h('span', { class: 'block truncate text-[11px] text-white/90' }, program ? `Antrenman vakti · ${program}` : 'Antrenman vakti'),
    ),
    h(
      'span',
      { class: 'absolute inset-x-0 bottom-0 block bg-gradient-to-t from-black/80 via-black/50 to-transparent px-2.5 pb-3 pt-8 text-left' },
      names.length
        ? [
            h('span', { class: 'block px-1 pb-1 text-[9px] font-semibold text-white/80' }, 'Bugün yapılacaklar'),
            h(
              'span',
              { class: 'grid grid-flow-col gap-x-2 px-1 pb-2.5 text-[9px] leading-snug text-white', style: `grid-template-rows:repeat(${rows},auto)` },
              names.map((n, i) => h('span', { class: 'truncate' }, `${i + 1}. ${n}`)),
            ),
          ]
        : null,
      h(
        'span',
        { class: 'flex gap-1.5' },
        h('span', { class: 'flex h-8 flex-1 items-center justify-center rounded-full bg-black/40 text-[10px] font-semibold text-white' }, `Ertele ${state.data.settings.snoozeMinutes} dk`),
        h('span', { class: 'flex h-8 flex-[1.6] items-center justify-center rounded-full bg-coral text-[10px] font-semibold text-ink' }, 'Antrenmana girdim'),
      ),
    ),
  )
}

// Ayar satırı: başlık, açıklama ve sağda düğme ya da durum.
const settingRow = (title, detail, action) =>
  h(
    'div',
    { class: 'flex items-center gap-3 border-t border-line pt-4' },
    h('div', { class: 'min-w-0 flex-1' }, h('p', { class: 'text-sm' }, title), h('p', { class: 'text-xs text-zinc-500' }, detail)),
    action,
  )

// Alarm ekranı ve sesi (yalnızca Android uygulamasında).
function alarmScreenSection() {
  const a = android()
  if (!a?.alarmImage) return null
  const src = a.alarmImage()
  const file = h('input', {
    type: 'file',
    accept: 'image/*',
    class: 'hidden',
    onchange: (ev) => {
      const f = ev.target.files[0]
      ev.target.value = ''
      if (f) pickImage(f)
    },
  })
  const overlayOn = a.overlayAllowed ? a.overlayAllowed() : true
  return [
    sectionTitle('Alarm ekranı ve sesi'),
    card(
      { class: 'space-y-4' },
      file,
      alarmPreview(src, () => file.click()),
      h(
        'div',
        { class: 'flex justify-center gap-2' },
        button(src ? 'Fotoğrafı değiştir' : 'Fotoğraf seç', () => file.click(), 'secondary', 'py-2 text-sm'),
        src
          ? button('Kaldır', () => {
              a.clearAlarmImage()
              render()
            }, 'ghost', 'py-2 text-sm')
          : null,
      ),
      h('p', { class: 'text-center text-xs text-zinc-500' }, 'Gitme saatinde bu fotoğraf ekranın tamamını kaplar; uygulama kapalı olsa da açılır.'),
      a.overlayAllowed
        ? settingRow(
            'Telefon elindeyken de tam ekran aç',
            overlayOn
              ? 'Açık: telefonu kullanırken de fotoğraf öne gelir.'
              : 'Kapalıyken telefonu kullanıyorsan fotoğraf yalnızca bildirimde görünür. Açmak için "Diğer uygulamaların üzerinde göster" iznini ver.',
            overlayOn
              ? h('span', { class: 'shrink-0 rounded-full bg-mint/15 px-3 py-1.5 text-xs font-medium text-mint' }, 'Açık')
              : button('Aç', () => a.openOverlaySettings(), 'primary', 'shrink-0 py-2 text-sm'),
          )
        : null,
      a.pickAlarmSound
        ? h(
            'div',
            { class: 'space-y-3 border-t border-line pt-4' },
            h(
              'div',
              { class: 'flex items-center gap-3' },
              h('span', { class: 'flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-coral/15 text-coral' }, icon('bell', 18)),
              h('div', { class: 'min-w-0 flex-1' }, h('p', { class: 'text-sm' }, 'Alarm sesi'), h('p', { class: 'truncate text-xs text-zinc-500' }, a.alarmSoundName())),
            ),
            h(
              'div',
              { class: 'grid grid-cols-2 gap-2' },
              button('Ses listesi', () => a.pickAlarmSound(), 'secondary', 'py-2.5 text-sm'),
              a.alarmSoundFileSupported?.()
                ? button('Kendi müziğim', () => a.pickAlarmSoundFile(), 'secondary', 'py-2.5 text-sm')
                : null,
            ),
            h('p', { class: 'text-xs text-zinc-500' }, 'Ses telefonun alarm ses düzeyiyle çalar. Müzik dosyası telefonun Alarms/SuperGym klasörüne kopyalanır (en fazla 20 MB).'),
          )
        : null,
      a.testAlarm
        ? h('div', { class: 'text-center' }, button('Alarmı dene (10 sn sonra çalar)', () => {
            a.testAlarm()
            show('10 saniye sonra çalacak. Uygulamayı kapatıp deneyebilirsin.')
          }, 'ghost', 'py-1 text-sm'))
        : null,
    ),
  ]
}

// Android, ses seçimi (ya da dosya kopyalama) bitince çağırır.
window.onAlarmSoundChanged = (ok) => {
  show(ok ? 'Alarm sesi değişti.' : 'Ses dosyası eklenemedi. En fazla 20 MB olmalı.', ok)
  render()
}

// İzin uyarıları: bildirim, tam ekran alarm ve tam zamanlı alarm.
function permissionWarnings() {
  const a = android()
  const out = []
  const warn = (text, onclick) =>
    out.push(h('button', { type: 'button', class: 'mt-3 w-full rounded-[20px] bg-sun/10 px-4 py-3 text-left text-sm text-sun', onclick }, text))
  if (a.notificationsAllowed && !a.notificationsAllowed()) {
    warn('Bildirim izni kapalı: alarmlar ve hazırlık bildirimi gelmez. İzin vermek için dokun.', () => a.requestNotifications())
  }
  if (a.fullScreenAllowed && !a.fullScreenAllowed()) {
    warn('Tam ekran bildirim izni kapalı: kilit ekranında resim açılmaz, yalnızca bildirim gelir. Açmak için dokun.', () => a.openFullScreenSettings())
  }
  if (a.exactAlarmsAllowed && !a.exactAlarmsAllowed()) {
    warn('"Alarmlar ve hatırlatıcılar" izni kapalı: alarm birkaç dakika gecikebilir. Açmak için dokun.', () => a.openExactAlarmSettings())
  }
  return out
}

function alarmsSection() {
  const st = state.data.settings
  const nativeOn = !!android()?.syncState
  const anyOn = st.alarms.some((a) => a.enabled)
  return [
    sectionTitle('Antrenman alarmları', st.alarms.length ? button('+ Alarm', addAlarm, 'ghost', 'py-1 text-sm text-coral') : null),
    card(
      {},
      !nativeOn ? h('p', { class: 'mb-3 text-xs text-zinc-500' }, 'Alarmlar yalnızca Android uygulamasında çalar.') : null,
      st.alarms.length
        ? h('div', { class: 'space-y-2' }, st.alarms.map(alarmRow))
        : h(
            'div',
            { class: 'text-center' },
            h('p', { class: 'mb-3 text-sm text-muted' }, 'Her gün için ayrı saat kur: örn. Salı 18:00 Push, Cumartesi 09:00 Legs.'),
            button('Alarm ekle', addAlarm, 'primary'),
          ),
      h(
        'div',
        { class: 'mt-4 grid grid-cols-2 gap-3' },
        h(
          'div',
          { class: 'space-y-1' },
          h('span', { class: 'text-xs text-zinc-400' }, 'Hazırlık bildirimi'),
          select(
            { value: st.prepMinutes, onchange: (ev) => saveSettings({ prepMinutes: Number(ev.target.value) }) },
            [[0, 'Kapalı'], ...[15, 30, 45, 60, 90, 120, 180].map((n) => [n, n < 60 ? `${n} dk önce` : `${n / 60} sa önce`])],
          ),
        ),
        h(
          'div',
          { class: 'space-y-1' },
          h('span', { class: 'text-xs text-zinc-400' }, 'Ertele'),
          select({ value: st.snoozeMinutes, onchange: (ev) => saveSettings({ snoozeMinutes: Number(ev.target.value) }) }, [5, 10, 15, 20, 30].map((n) => [n, `${n} dk`])),
        ),
      ),
      h(
        'p',
        { class: 'mt-3 text-xs text-zinc-500' },
        'Hazırlık bildirimi ve alarm o günün yapılacak hareketlerini gösterir: o güne Antrenman sekmesinde hareket girdiysen onları, girmediysen alarmın programını. Gitme saatinde alarm çalar; "Antrenmana girdim" diyene ya da o gün set girene kadar 5 dakikada bir yeniden çalar (en fazla 2 saat).',
      ),
      nativeOn && anyOn ? permissionWarnings() : null,
    ),
    alarmScreenSection(),
  ]
}

// --- Ayarlar ---

function settingsSection() {
  const options = [
    [0, 'Kapalı'],
    ...[30, 45, 60, 90, 120, 150, 180, 240, 300].map((s) => [s, s < 60 ? `${s} sn` : `${Math.floor(s / 60)} dk${s % 60 ? ` ${s % 60} sn` : ''}`]),
  ]
  return [
    sectionTitle('Ayarlar'),
    card(
      {},
      h(
        'div',
        { class: 'space-y-1' },
        h('span', { class: 'text-sm' }, 'Setler arası dinlenme sayacı'),
        select({ value: state.data.settings.restSeconds, onchange: (ev) => saveSettings({ restSeconds: Number(ev.target.value) }) }, options),
        h('p', { class: 'text-xs text-zinc-500' }, 'Bugünün antrenmanına set eklediğinde başlar, bitince titreşir.'),
      ),
      h(
        'label',
        { class: 'mt-4 flex items-start gap-3' },
        h('input', {
          type: 'checkbox',
          class: 'mt-0.5 h-5 w-5 accent-[#ff8a6b]',
          checked: !!state.data.settings.showRpe,
          onchange: (ev) => saveSettings({ showRpe: ev.target.checked }),
        }),
        h(
          'span',
          {},
          h('span', { class: 'block text-sm' }, 'Setlerde zorluk (RPE) kutusu'),
          h('span', { class: 'block text-xs text-zinc-500' }, '1 = çok kolay, 10 = bir tekrar daha yapamazdın. İsteğe bağlı; boş bırakılabilir.'),
        ),
      ),
    ),
  ]
}

function inactiveSection() {
  const st = state.data.settings
  const nativeOn = !!android()?.syncState
  const save = (change) => {
    android()?.requestNotifications?.()
    saveSettings(change)
  }
  return [
    sectionTitle('Uzun ara uyarısı'),
    card(
      {},
      h(
        'div',
        { class: 'grid grid-cols-2 gap-3' },
        h(
          'div',
          { class: 'space-y-1' },
          h('span', { class: 'text-xs text-zinc-400' }, 'Uyar'),
          select({ value: st.inactiveDays, disabled: !nativeOn, onchange: (ev) => save({ inactiveDays: Number(ev.target.value) }) }, [
            [0, 'Kapalı'],
            ...[2, 3, 4, 5, 7, 10].map((n) => [n, `${n} gün gidilmezse`]),
          ]),
        ),
        h(
          'div',
          { class: 'space-y-1' },
          h('span', { class: 'text-xs text-zinc-400' }, 'Saat'),
          input({ type: 'time', value: st.reminderTime, disabled: !nativeOn, onchange: (ev) => ev.target.value && save({ reminderTime: ev.target.value }) }),
        ),
      ),
      h('p', { class: 'mt-3 text-xs text-zinc-500' }, nativeOn ? 'Bu kadar gündür antrenman girmediysen bu saatte bildirim gelir.' : 'Yalnızca Android uygulamasında çalışır.'),
    ),
  ]
}

// --- Yedek ---

function backupSection() {
  const st = state.data.settings
  const nativeBackup = !!android()?.autoBackup
  return [
    sectionTitle('Yedek'),
    card(
      {},
      h('p', { class: 'mb-3 text-sm text-zinc-400' }, 'Veriler yalnızca bu telefonda durur. Uygulamayı silmeden ya da telefon değiştirmeden önce dışa aktararak yedek al.'),
      h('div', { class: 'grid grid-cols-2 gap-2' }, button('Dışa aktar', exportData, 'secondary'), button('İçe aktar', () => document.getElementById('import-file').click(), 'secondary')),
      h(
        'div',
        { class: 'mt-5 space-y-1 border-t border-line pt-4' },
        h('span', { class: 'text-sm' }, 'Otomatik yedek'),
        select(
          { value: st.backupDays, disabled: !nativeBackup, onchange: (ev) => saveSettings({ backupDays: Number(ev.target.value) }) },
          [
            [0, 'Kapalı'],
            [1, 'Her gün'],
            [3, '3 günde bir'],
            [7, 'Haftada bir'],
            [14, '2 haftada bir'],
          ],
        ),
        h(
          'p',
          { class: 'text-xs text-zinc-500' },
          nativeBackup
            ? `Uygulamayı açtığında süresi dolduysa telefonun İndirilenler/SuperGym klasörüne kaydedilir; uygulama silinse de kalır. Son 8 yedek tutulur.${st.lastBackup ? ` Son otomatik yedek: ${shortDate(st.lastBackup)}.` : ''}`
            : 'Yalnızca Android uygulamasında çalışır.',
        ),
      ),
    ),
  ]
}

// Dışa aktar: Android'de dosya kaydetme ekranını açar, tarayıcıda dosyayı indirir.
async function exportData() {
  const name = `supergym-yedek-${today()}.json`
  try {
    const data = await api('/api/export')
    const text = JSON.stringify(data, null, 2)
    if (android()) {
      android().exportFile(name, text)
    } else {
      const a = document.createElement('a')
      a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
      a.download = name
      a.click()
      setTimeout(() => URL.revokeObjectURL(a.href), 1000)
    }
  } catch (err) {
    show(err.message, false)
  }
}

export async function importData(file) {
  if (!confirm('İçe aktarılan yedek mevcut verilerin yerine geçecek. Devam edilsin mi?')) return
  try {
    const data = await mutate('POST', '/api/import', await file.text())
    show(`Yedek yüklendi: ${data.workouts.length} antrenman, ${data.exercises.length} hareket.`)
    render()
  } catch {
    // mutate hatayı gösterdi
  }
}

// --- Sıfırlama ---

async function reset(scope) {
  const history =
    'Tüm antrenmanlar, setler ve vücut ağırlığı kayıtları silinecek. Hareketler, puanlar, programlar, alarmlar ve ayarlar kalır.\n\nDevam edilsin mi?'
  const all = 'TÜM veriler silinecek: antrenmanlar, kendi hareketlerin, puanlar, programların, alarmlar ve ayarlar. Uygulama ilk kurulum haline döner.\n\nDevam edilsin mi?'
  if (!confirm(scope === 'all' ? all : history)) return
  if (scope === 'all' && !confirm('Emin misin? Bu işlem geri alınamaz.')) return
  try {
    await mutate('POST', '/api/reset', { scope })
    if (scope === 'all') {
      android()?.clearAlarmImage?.()
      android()?.resetAlarmSound?.()
    }
    show(scope === 'all' ? 'Uygulama ilk kurulum haline döndü.' : 'Antrenman geçmişi silindi.')
    render()
  } catch {
    // mutate hatayı gösterdi
  }
}

function resetSection() {
  return [
    sectionTitle('Verileri sıfırla'),
    card(
      {},
      h('p', { class: 'mb-3 text-sm text-zinc-400' }, 'Deneme için girdiğin kayıtları temizle. Silmeden önce istersen Dışa aktar ile yedek al.'),
      h(
        'div',
        { class: 'space-y-2' },
        button('Antrenman geçmişini sil', () => reset('history'), 'danger', 'w-full'),
        h('p', { class: 'px-1 text-xs text-zinc-500' }, 'Setler, antrenmanlar ve vücut ağırlığı silinir; hareketler, puanlar, programlar ve alarmlar kalır.'),
        button('Fabrika ayarlarına dön', () => reset('all'), 'danger', 'mt-2 w-full'),
        h('p', { class: 'px-1 text-xs text-zinc-500' }, 'Her şey silinir, uygulama ilk kurulum haline döner.'),
      ),
    ),
  ]
}
