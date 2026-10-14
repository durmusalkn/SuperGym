import './style.css'
import { h } from './util.js'
import { state, api, reload, setErrorHandler } from './state.js'
import { route, setRender, show } from './ui.js'
import { workoutView } from './views/workout.js'
import { calendarView } from './views/calendar.js'
import { progressView } from './views/progress.js'
import { exercisesView, importData } from './views/exercises.js'

const TABS = [
  { id: 'antrenman', label: 'Antrenman', icon: '🏋️', view: workoutView },
  { id: 'takvim', label: 'Takvim', icon: '📅', view: calendarView },
  { id: 'ilerleme', label: 'İlerleme', icon: '📈', view: progressView },
  { id: 'hareketler', label: 'Hareketler', icon: '📋', view: exercisesView },
]

const view = document.getElementById('view')
const nav = document.getElementById('nav')

function render() {
  if (!state.data) return
  const { tab, arg } = route()
  const current = TABS.find((t) => t.id === tab) || TABS[0]
  view.replaceChildren(current.view(arg))
  nav.replaceChildren(
    h(
      'div',
      { class: 'mx-auto grid max-w-md grid-cols-4' },
      TABS.map((t) =>
        h(
          'a',
          {
            href: `#/${t.id}`,
            class: `flex flex-col items-center gap-0.5 py-2 text-[11px] ${t === current ? 'text-emerald-400' : 'text-zinc-400'}`,
          },
          h('span', { class: `text-xl ${t === current ? '' : 'opacity-60 grayscale'}` }, t.icon),
          t.label,
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

async function start() {
  const { warning } = await api('/api/status')
  await reload()
  render()
  if (warning) show(warning, false, true)
}

start().catch((err) => show(err.message, false, true))
