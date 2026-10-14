// Hareketler sekmesi: hareket listesi, puanlar ve arşiv.
import { h, today, num, parseDate, GROUPS, groupColor } from '../util.js'
import { state, mutate, records, history } from '../state.js'
import { render, show, button, icon, stars } from '../ui.js'
import { progressRing } from '../rings.js'
import { editExercise, rateExercises } from '../sheets.js'

// Liste filtresi: seçili kas grubu ve arama metni.
let filterGroup = null
let query = ''

export function exercisesView() {
  const active = state.data.exercises.filter((e) => !e.archived)
  const archived = state.data.exercises.filter((e) => e.archived)

  const list = h('section', { class: 'mt-4 space-y-2', 'aria-label': 'Hareket listesi' })
  const fill = () => {
    const q = query.trim().toLocaleLowerCase('tr')
    const rows = active
      .filter((e) => (!filterGroup || e.group === filterGroup) && e.name.toLocaleLowerCase('tr').includes(q))
      .sort((a, b) => a.name.localeCompare(b.name, 'tr'))
    list.replaceChildren(...(rows.length ? rows.map(row) : [h('p', { class: 'py-4 text-center text-sm text-muted' }, 'Bu aramayla hareket yok.')]))
  }
  fill()

  // Kas grupları baloncuk: boyutu gruptaki hareket sayısı; dokununca liste o gruba süzülür.
  const counts = GROUPS.map((g) => [g, active.filter((e) => e.group === g).length]).filter(([, n]) => n)
  const maxN = Math.max(1, ...counts.map(([, n]) => n))
  const bubbles = h(
    'section',
    { class: 'mt-4 flex flex-wrap items-center justify-center gap-2.5', 'aria-label': 'Kas grupları' },
    counts.map(([g, n]) => {
      const size = Math.round(62 + (n / maxN) * 30)
      const on = filterGroup === g
      const c = groupColor(g).hex
      return h(
        'button',
        {
          type: 'button',
          'aria-pressed': on ? 'true' : 'false',
          class: 'flex flex-col items-center justify-center rounded-full',
          style: `width:${size}px;height:${size}px;background:${on ? `${c}26` : '#1f1b2d'};border:${on ? `2px solid ${c}` : '1px solid #2e2942'}`,
          onclick: () => {
            filterGroup = on ? null : g
            render()
          },
        },
        h('span', { class: 'text-[13px] font-semibold' }, g),
        h('span', { class: 'text-[11px] text-muted' }, `${n} hareket`),
      )
    }),
  )

  return h(
    'div',
    {},
    h(
      'header',
      { class: 'flex items-center justify-between' },
      h('h1', { class: 'text-[22px] font-semibold' }, 'Hareketler'),
      h(
        'div',
        { class: 'flex items-center gap-2' },
        h(
          'button',
          { type: 'button', class: 'flex h-11 items-center gap-1.5 rounded-full bg-sun/15 px-4 text-sm font-medium text-sun', onclick: () => rateExercises() },
          '★ Puanla',
        ),
        h(
          'button',
          { type: 'button', 'aria-label': 'Yeni hareket', class: 'flex h-11 w-11 items-center justify-center rounded-full bg-coral', onclick: () => editExercise(null) },
          icon('plus', 20, '#15121f', 2.6),
        ),
      ),
    ),
    h(
      'div',
      { class: 'mt-4' },
      h('input', {
        type: 'search',
        value: query,
        placeholder: 'Hareket ara',
        'aria-label': 'Hareket ara',
        class: 'h-[46px] w-full rounded-full bg-surface px-5 text-[15px] text-text outline-none placeholder:text-zinc-500 focus:ring-2 focus:ring-coral',
        oninput: (ev) => {
          query = ev.target.value
          fill()
        },
      }),
    ),
    bubbles,
    list,
    archived.length
      ? h(
          'details',
          { class: 'mt-3 rounded-[22px] bg-surface' },
          h('summary', { class: 'cursor-pointer px-5 py-4 text-sm text-muted' }, `Arşiv (${archived.length})`),
          h(
            'div',
            { class: 'space-y-1 px-2 pb-2' },
            archived.map((e) =>
              h(
                'div',
                { class: 'flex items-center justify-between rounded-2xl px-3 py-2' },
                h('span', { class: 'text-muted' }, e.name),
                button('Geri al', () => restore(e), 'outline', 'py-2 text-sm'),
              ),
            ),
          ),
        )
      : null,
  )
}

// Satırdaki küçük halka: son yapılışın en iyisinin rekora oranı.
function row(e) {
  const rec = records(e.id)
  const hist = history(e.id)
  const last = hist[hist.length - 1]
  const cardio = e.kind === 'cardio'
  const best = (sets) => Math.max(0, ...sets.map((s) => (cardio ? s.km || 0 : s.weight || 0)))
  const top = cardio ? rec.km : rec.weight
  const ratio = last && top ? best(last.sets) / top : 0
  const right = cardio ? (rec.km ? `${num(rec.km)} km` : '') : rec.weight ? `${num(rec.weight)} kg` : ''
  const meta = [e.muscle, cardio ? 'kardiyo' : `${e.repMin || 8}–${e.repMax || 12} tekrar`, last ? since(last.date) : 'henüz yapılmadı'].filter(Boolean).join(' · ')
  return h(
    'button',
    { type: 'button', class: 'flex w-full items-center gap-3 rounded-[22px] bg-surface px-3.5 py-2.5 text-left active:bg-line', onclick: () => editExercise(e) },
    progressRing(36, 4, ratio, groupColor(e.group).hex),
    h(
      'span',
      { class: 'min-w-0 flex-1' },
      h('span', { class: 'flex items-center gap-2' }, h('span', { class: 'truncate font-medium' }, e.name), e.rating ? stars(e.rating, null, 11) : null),
      h('span', { class: 'block truncate text-xs text-muted' }, meta),
    ),
    h('span', { class: 'shrink-0 text-[15px] font-semibold' }, right),
  )
}

function since(date) {
  const days = Math.round((parseDate(today()) - parseDate(date)) / 86400000)
  return days <= 0 ? 'bugün' : days === 1 ? 'dün' : `${days} gün önce`
}

async function restore(e) {
  try {
    await mutate('PUT', `/api/exercises/${e.id}`, { ...e, archived: false })
    show(`"${e.name}" geri alındı.`)
    render()
  } catch {
    // mutate hatayı gösterdi
  }
}

