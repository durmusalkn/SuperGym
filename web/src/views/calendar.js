// Takvim (Ritim): ayın günleri bir halkanın üzerinde; gidilen günler o günün hacmine göre
// büyüyen noktalar. Ortada hafta serisi, altta bu haftanın halkaları.
import { h, today, ymd, parseDate, addDays, weekStart, WEEKDAYS, WEEKDAYS_SHORT, MONTHS, num, groupColor, hoursMinutes } from '../util.js'
import { state, exercise, attendedDates, hasSets, volume, workoutMinutes } from '../state.js'
import { go, roundBtn, empty } from '../ui.js'

// Bir antrenmanda çalışılan kas grupları (sırayla, tekrarsız).
function groupsOf(w) {
  const out = []
  for (const it of w.items) {
    const g = exercise(it.exerciseId)?.group
    if (it.sets.length && g && !out.includes(g)) out.push(g)
  }
  return out
}

export function stats() {
  const days = attendedDates()
  const t = today()
  const thisWeek = weekStart(t)
  const count = (from, to) => [...days].filter((d) => d >= from && d <= to).length

  // Seri: art arda en az bir gün gidilen hafta sayısı. İçinde bulunulan hafta henüz
  // bitmediği için boşsa seriyi bozmaz.
  let streak = 0
  let week = count(thisWeek, addDays(thisWeek, 6)) ? thisWeek : addDays(thisWeek, -7)
  while (count(week, addDays(week, 6))) {
    streak++
    week = addDays(week, -7)
  }
  return { week: count(thisWeek, addDays(thisWeek, 6)), streak, total: days.size }
}

const SIZE = 310
const RADIUS = 133

export function calendarView(arg) {
  const month = /^\d{4}-\d{2}$/.test(arg) ? arg : today().slice(0, 7)
  const first = parseDate(`${month}-01`)
  const prevMonth = ymd(new Date(first.getFullYear(), first.getMonth() - 1, 1)).slice(0, 7)
  const nextMonth = ymd(new Date(first.getFullYear(), first.getMonth() + 1, 1)).slice(0, 7)
  const daysInMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate()
  const t = today()
  const s = stats()

  const byDate = new Map(state.data.workouts.filter(hasSets).map((w) => [w.date, w]))
  const monthWorkouts = [...byDate.values()].filter((w) => w.date.startsWith(month))
  const volumes = monthWorkouts.map((w) => w.items.reduce((n, it) => n + volume(it.sets), 0))
  const maxVol = Math.max(1, ...volumes)

  // Halkadaki günler: saat 12'den başlayıp saat yönünde.
  const pos = (d, r) => {
    const a = -Math.PI / 2 + ((d - 1) / daysInMonth) * Math.PI * 2
    return [SIZE / 2 + r * Math.cos(a), SIZE / 2 + r * Math.sin(a)]
  }
  const dots = []
  for (let d = 1; d <= daysInMonth; d++) {
    const date = `${month}-${String(d).padStart(2, '0')}`
    const w = byDate.get(date)
    const vol = w ? w.items.reduce((n, it) => n + volume(it.sets), 0) : 0
    const size = w ? Math.round(14 + (vol / maxVol) * 12) : 9
    const [x, y] = pos(d, RADIUS)
    const color = w ? groupColor(groupsOf(w)[0]).hex : date > t ? '#221e31' : '#3a3452'
    dots.push(
      h('button', {
        type: 'button',
        'aria-label': `${d} ${MONTHS[first.getMonth()]}${w ? ', antrenman var' : ''}`,
        class: 'absolute rounded-full',
        style: `left:${x - 18}px;top:${y - 18}px;width:36px;height:36px;display:flex;align-items:center;justify-content:center;padding:0`,
        onclick: () => go(`#/antrenman/${date}`),
      }, h('span', {
        class: 'block rounded-full',
        style: `width:${size}px;height:${size}px;background:${color};${date === t ? 'box-shadow:0 0 0 3px #15121f,0 0 0 5px #eeeaf6' : ''}`,
      })),
    )
  }
  const labels = [1, 8, 15, 22, 29].filter((d) => d <= daysInMonth).map((d) => {
    const [x, y] = pos(d, RADIUS - 28)
    return h('span', { class: 'absolute w-6 text-center text-[11px] text-muted', style: `left:${x - 12}px;top:${y - 8}px`, 'aria-hidden': 'true' }, d)
  })

  const monthCount = monthWorkouts.length
  const ring = h(
    'section',
    { class: 'relative mx-auto mt-5', style: `width:${SIZE}px;height:${SIZE}px`, 'aria-label': `${MONTHS[first.getMonth()]}: ${monthCount} antrenman` },
    h('div', { class: 'absolute rounded-full border border-line', style: `inset:${SIZE / 2 - RADIUS}px` }),
    dots,
    labels,
    h(
      'div',
      { class: 'pointer-events-none absolute inset-0 flex flex-col items-center justify-center' },
      h('span', { class: 'text-[64px] font-semibold leading-none' }, s.streak),
      h('span', { class: 'text-[15px] text-muted' }, 'haftalık seri'),
      h('span', { class: 'mt-2.5 text-[13px] text-coral' }, `${month === t.slice(0, 7) ? 'bu ay' : MONTHS[first.getMonth()]} ${monthCount} gün`),
    ),
  )

  // Bu haftanın günleri: gidilen günler dolu daire, bugün çerçeveli.
  const ws = weekStart(t)
  const days = attendedDates()
  const week = h(
    'section',
    { class: 'mt-5 grid grid-cols-7 gap-1.5', 'aria-label': `Bu hafta ${s.week} gün` },
    Array.from({ length: 7 }, (_, k) => {
      const date = addDays(ws, k)
      const on = days.has(date)
      return h(
        'button',
        { type: 'button', class: 'flex flex-col items-center gap-1.5', onclick: () => go(`#/antrenman/${date}`), 'aria-label': `${WEEKDAYS[parseDate(date).getDay()]}${on ? ', gidildi' : ''}` },
        h('span', {
          class: 'block h-[38px] w-[38px] rounded-full',
          style: on ? 'background:#ff8a6b' : `border:2px solid ${date === t ? '#eeeaf6' : '#2e2942'}`,
        }),
        h('span', { class: `text-xs ${date === t ? 'text-text' : 'text-muted'}` }, WEEKDAYS_SHORT[parseDate(date).getDay()]),
      )
    }),
  )

  const list = [...monthWorkouts].reverse()
  return h(
    'div',
    {},
    h(
      'header',
      { class: 'flex items-center justify-between' },
      roundBtn('left', () => go(`#/takvim/${prevMonth}`, true), 'Önceki ay'),
      h('h1', { class: 'text-[22px] font-semibold' }, `${MONTHS[first.getMonth()]} ${first.getFullYear()}`),
      roundBtn('right', () => go(`#/takvim/${nextMonth}`, true), 'Sonraki ay'),
    ),
    ring,
    month !== t.slice(0, 7) ? h('div', { class: 'text-center' }, h('button', { type: 'button', class: 'py-1 text-sm text-muted', onclick: () => go(`#/takvim/${t.slice(0, 7)}`, true) }, 'Bu aya dön')) : null,
    week,
    h('p', { class: 'mt-6 px-1 text-sm text-muted' }, `Toplam ${s.total} antrenman`),
    list.length
      ? h(
          'section',
          { class: 'mt-3 space-y-2', 'aria-label': 'Bu ayın antrenmanları' },
          list.map((w) => {
            const groups = groupsOf(w)
            const vol = w.items.reduce((n, it) => n + volume(it.sets), 0)
            const min = workoutMinutes(w)
            const d = parseDate(w.date)
            return h(
              'button',
              { type: 'button', class: 'flex w-full items-center gap-3 rounded-[22px] bg-surface px-4 py-3 text-left active:bg-line', onclick: () => go(`#/antrenman/${w.date}`) },
              h('span', { class: 'flex gap-1' }, groups.slice(0, 3).map((g) => h('span', { class: 'block h-2.5 w-2.5 rounded-full', style: `background:${groupColor(g).hex}` }))),
              h(
                'span',
                { class: 'min-w-0 flex-1' },
                h('span', { class: 'block truncate font-medium' }, `${w.date === t ? 'Bugün' : `${d.getDate()} ${WEEKDAYS[d.getDay()]}`} · ${groups.join(', ')}`),
              ),
              h('span', { class: 'shrink-0 text-[13px] text-muted' }, [min ? hoursMinutes(min) : null, vol ? `${num(Math.round(vol))} kg` : null].filter(Boolean).join(' · ')),
            )
          }),
        )
      : empty('Bu ay henüz antrenman yok.'),
  )
}
