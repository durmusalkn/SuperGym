// Plan sekmesi: programlar, antrenman alarmları, ayarlar, yedek ve sıfırlama.
import { h, today, shortDate, WEEKDAYS } from '../util.js'
import { state, api, mutate, exercise } from '../state.js'
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

function alarmRow(a) {
  const programs = [['', 'Program yok'], ...state.data.templates.map((t) => [t.id, t.name])]
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

function imageCard(nativeOn) {
  if (!nativeOn || !android().alarmImage) return null
  const src = android().alarmImage()
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
  return h(
    'div',
    { class: 'mt-4 flex items-center gap-3 border-t border-line pt-4' },
    file,
    src
      ? h('img', { src, alt: 'Alarm resmi', class: 'h-24 w-[4.5rem] shrink-0 rounded-2xl object-cover' })
      : h('div', { class: 'flex h-24 w-[4.5rem] shrink-0 items-center justify-center rounded-2xl border border-dashed border-zinc-600 text-muted' }, icon('plus', 20)),
    h(
      'div',
      { class: 'min-w-0 flex-1 space-y-2' },
      h('p', { class: 'text-sm' }, 'Alarm resmi'),
      h('p', { class: 'text-xs text-zinc-500' }, 'Gitme saatinde, uygulama kapalı olsa da tam ekran açılır.'),
      h(
        'div',
        { class: 'flex gap-2' },
        button(src ? 'Değiştir' : 'Resim seç', () => file.click(), 'secondary', 'py-2 text-sm'),
        src
          ? button('Kaldır', () => {
              android().clearAlarmImage()
              render()
            }, 'ghost', 'py-2 text-sm')
          : null,
      ),
    ),
  )
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
        'Hazırlık bildirimi o günün programını ve hareketlerini gösterir. Gitme saatinde alarm çalar; "Antrenmana girdim" diyene ya da o gün set girene kadar 5 dakikada bir yeniden çalar (en fazla 2 saat).',
      ),
      imageCard(nativeOn),
      nativeOn && anyOn ? permissionWarnings() : null,
      nativeOn && android().testAlarm
        ? h('div', { class: 'mt-3 text-center' }, button('Alarmı dene (10 sn sonra çalar)', () => {
            android().testAlarm()
            show('10 saniye sonra çalacak. Uygulamayı kapatıp deneyebilirsin.')
          }, 'ghost', 'py-1 text-sm'))
        : null,
    ),
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
    if (scope === 'all') android()?.clearAlarmImage?.()
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
