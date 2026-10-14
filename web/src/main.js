import './style.css'
import { h, svg, today, addDays } from './util.js'
import { state, api, mutate, reload, setErrorHandler, attendedDates, exercise } from './state.js'
import { route, setRender, show, android, go } from './ui.js'
import { workoutView, applyTemplate } from './views/workout.js'
import { calendarView } from './views/calendar.js'
import { progressView } from './views/progress.js'
import { exercisesView } from './views/exercises.js'
import { planView, importData } from './views/plan.js'

const TABS = [
  { id: 'antrenman', label: 'Antrenman', view: workoutView, icon: [['circle', 12, 12, 8], ['circle', 12, 12, 3]] },
  { id: 'takvim', label: 'Takvim', view: calendarView, icon: [['circle', 12, 12, 8, '3 3'], ['dot', 12, 4, 1.6]] },
  { id: 'ilerleme', label: 'İlerleme', view: progressView, icon: [['circle', 12, 12, 9], ['circle', 12, 12, 5.5], ['circle', 12, 12, 2]] },
  { id: 'hareketler', label: 'Hareketler', view: exercisesView, icon: [['circle', 7, 7, 3], ['circle', 17, 7, 3], ['circle', 7, 17, 3], ['circle', 17, 17, 3]] },
  { id: 'plan', label: 'Plan', view: planView, icon: [['circle', 12, 13, 8], ['path', 'M12 9v4l2.5 2.5M5 4.5L3 6.5M19 4.5l2 2']] },
]

// Sekme simgeleri: halkalardan çizilir.
function tabIcon(parts, color) {
  return svg(
    'svg',
    { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', stroke: color, 'stroke-width': 2, 'stroke-linecap': 'round', 'aria-hidden': 'true' },
    parts.map(([kind, cx, cy, r, dash]) =>
      kind === 'path'
        ? svg('path', { d: cx })
        : kind === 'dot'
          ? svg('circle', { cx, cy, r, fill: color, stroke: 'none' })
          : svg('circle', { cx, cy, r, 'stroke-dasharray': dash }),
    ),
  )
}

const view = document.getElementById('view')
const nav = document.getElementById('nav')

// Antrenman günleri, alarmlar ve hatırlatma ayarları Android'e bildirilir (alarmlar,
// hatırlatmalar ve ana ekran widget'ı uygulama kapalıyken bunları kullanır). Alarmın
// programı ve hareketleri de gönderilir: hazırlık bildirimi bunları gösterir.
// Yalnızca değişince gönderilir.
let lastSync = ''
function syncNative() {
  if (!android()?.syncState) return
  const from = addDays(today(), -400)
  const st = state.data.settings
  const alarms = st.alarms
    .filter((a) => a.enabled)
    .map((a) => {
      const t = state.data.templates.find((x) => x.id === a.templateId)
      return {
        day: a.day,
        time: a.time,
        templateId: t ? t.id : '',
        program: t ? t.name : '',
        exercises: t ? t.exerciseIds.map((id) => exercise(id)?.name).filter(Boolean) : [],
      }
    })
  const json = JSON.stringify({
    attended: [...attendedDates()].filter((d) => d >= from).sort(),
    reminderTime: st.reminderTime,
    inactiveDays: st.inactiveDays,
    alarms,
    prepMinutes: st.prepMinutes,
    snoozeMinutes: st.snoozeMinutes,
  })
  if (json === lastSync) return
  lastSync = json
  android().syncState(json)
}

function render() {
  if (!state.data) return
  syncNative()
  const { tab, arg } = route()
  const current = TABS.find((t) => t.id === tab) || TABS[0]
  view.replaceChildren(current.view(arg))
  nav.replaceChildren(
    h(
      'div',
      { class: 'flex gap-0.5 rounded-full bg-surface p-1.5 shadow-lg shadow-black/40' },
      TABS.map((t) =>
        h(
          'a',
          {
            href: `#/${t.id}`,
            'aria-label': t.label,
            'aria-current': t === current ? 'page' : null,
            class: `flex h-12 w-[60px] items-center justify-center rounded-full ${t === current ? 'bg-text' : 'active:bg-line'}`,
          },
          tabIcon(t.icon, t === current ? '#15121f' : '#a39db8'),
        ),
      ),
    ),
  )
}
setRender(render)

let lastTab = route().tab
window.addEventListener('hashchange', () => {
  const { tab } = route()
  if (tab !== lastTab) window.scrollTo(0, 0)
  lastTab = tab
  render()
})

// Kaydetme başarısız olursa ekrandaki veri sunucudakiyle yeniden eşitlenir.
setErrorHandler(async (err) => {
  show(err.message, false)
  try {
    await reload()
    render()
  } catch {
    // bağlantı yoksa mesaj zaten gösterildi
  }
})

// Android uygulaması dışa aktarmada kaydetme bitince bunu çağırır.
window.onExportDone = (ok) => show(ok ? 'Yedek kaydedildi.' : 'Yedek kaydedilemedi.', ok)

document.getElementById('import-file').onchange = (ev) => {
  const file = ev.target.files[0]
  ev.target.value = ''
  if (file) importData(file)
}

// Otomatik yedek: ayarlanan aralık dolduysa uygulama açılınca telefonun İndirilenler/SuperGym
// klasörüne yedek alınır (yalnızca Android uygulamasında).
let backingUp = false
async function autoBackup() {
  const st = state.data?.settings
  if (backingUp || !android()?.autoBackup || !st?.backupDays || !state.data.workouts.length) return
  if (st.lastBackup && st.lastBackup > addDays(today(), -st.backupDays)) return
  backingUp = true
  try {
    const data = await api('/api/export')
    if (android().autoBackup(`supergym-otomatik-${today()}.json`, JSON.stringify(data, null, 2))) {
      await mutate('PUT', '/api/settings', { ...state.data.settings, lastBackup: today() })
      // Yalnızca ayarların göründüğü sekmede yenile (başka sekmede yazılanı bozmasın).
      if (route().tab === 'hareketler') render()
    }
  } catch {
    // Bir sonraki açılışta tekrar denenir.
  } finally {
    backingUp = false
  }
}
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    autoBackup()
    alarmStart()
    // Telefonun ayarlarından dönünce (izin, ses) Plan'daki durum yenilensin.
    if (route().tab === 'plan') render()
  }
})

// Alarm ekranında "Antrenmana girdim" denince uygulama açılır: o günün programı bugünün
// antrenmanına eklenir.
function alarmStart() {
  const raw = state.data && android()?.takeAlarmStart?.()
  if (!raw) return
  let templateId = ''
  try {
    templateId = JSON.parse(raw).templateId || ''
  } catch {
    // programsız başla
  }
  const t = state.data.templates.find((x) => x.id === templateId)
  go(`#/antrenman/${today()}`)
  if (t) applyTemplate(today(), t)
  show(t ? `İyi antrenmanlar! ${t.name} hazır.` : 'İyi antrenmanlar!')
}
window.onAlarmStart = alarmStart

async function start() {
  const { warning } = await api('/api/status')
  await reload()
  render()
  if (warning) show(warning, false, true)
  autoBackup()
  alarmStart()
}

start().catch((err) => show(err.message, false, true))
