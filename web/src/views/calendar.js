// Takvim: gidilen günler, haftalık özet ve seri.
import { h, today, ymd, parseDate, addDays, weekStart, shortDate, WEEKDAYS_SHORT, MONTHS, num, groupColor } from '../util.js'
import { state, exercise, attendedDates, hasSets, volume } from '../state.js'
import { go, card, groupDot, sectionTitle, empty } from '../ui.js'

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

  const weekVolume = state.data.workouts
    .filter((w) => w.date >= thisWeek && w.date <= t)
    .reduce((n, w) => n + w.items.reduce((m, it) => m + volume(it.sets), 0), 0)

  return {
    week: count(thisWeek, addDays(thisWeek, 6)),
    month: count(t.slice(0, 7) + '-01', t.slice(0, 7) + '-31'),
    streak,
    total: days.size,
    weekVolume,
  }
}

export function calendarView(arg) {
  const month = /^\d{4}-\d{2}$/.test(arg) ? arg : today().slice(0, 7)
  const first = parseDate(`${month}-01`)
  const prevMonth = ymd(new Date(first.getFullYear(), first.getMonth() - 1, 1)).slice(0, 7)
  const nextMonth = ymd(new Date(first.getFullYear(), first.getMonth() + 1, 1)).slice(0, 7)
  const s = stats()
  const t = today()

  const byDate = new Map(state.data.workouts.filter(hasSets).map((w) => [w.date, w]))

  // Pazartesiden başlayan ay ızgarası.
  const cells = []
  const offset = (first.getDay() + 6) % 7
  for (let i = 0; i < offset; i++) cells.push(h('div'))
  const daysInMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate()
  for (let d = 1; d <= daysInMonth; d++) {
    const date = `${month}-${String(d).padStart(2, '0')}`
    const w = byDate.get(date)
    const groups = w ? groupsOf(w) : []
    cells.push(
      h(
        'button',
        {
          type: 'button',
          class: `flex aspect-square flex-col items-center justify-center rounded-xl text-sm ${w ? 'bg-emerald-600/25 font-bold text-emerald-200' : 'text-zinc-300 active:bg-zinc-800'} ${date === t ? 'ring-2 ring-emerald-400' : ''} ${date > t ? 'text-zinc-600' : ''}`,
          onclick: () => go(`#/antrenman/${date}`),
        },
        h('span', {}, d),
        h('span', { class: 'mt-0.5 flex h-1.5 gap-0.5' }, groups.slice(0, 4).map((g) => groupDot(g, 'h-1.5 w-1.5'))),
      ),
    )
  }

  const monthWorkouts = [...byDate.values()].filter((w) => w.date.startsWith(month)).reverse()

  return h(
    'div',
    { class: 'space-y-4' },
    h(
      'div',
      { class: 'grid grid-cols-3 gap-2' },
      stat('Bu hafta', `${s.week} gün`),
      stat('Seri', `${s.streak} hafta`, s.streak >= 2 ? '🔥' : ''),
      stat('Bu ay', `${s.month} gün`),
    ),
    card(
      {},
      h(
        'div',
        { class: 'mb-3 flex items-center justify-between' },
        monthBtn('‹', () => go(`#/takvim/${prevMonth}`, true)),
        h('h2', { class: 'text-lg font-semibold' }, `${MONTHS[first.getMonth()]} ${first.getFullYear()}`),
        monthBtn('›', () => go(`#/takvim/${nextMonth}`, true)),
      ),
      h(
        'div',
        { class: 'grid grid-cols-7 gap-1 text-center text-xs text-zinc-500' },
        [1, 2, 3, 4, 5, 6, 0].map((d) => h('span', { class: 'pb-1' }, WEEKDAYS_SHORT[d])),
      ),
      h('div', { class: 'grid grid-cols-7 gap-1' }, cells),
      month !== t.slice(0, 7)
        ? h('button', { type: 'button', class: 'mt-3 w-full text-sm text-zinc-400', onclick: () => go(`#/takvim/${t.slice(0, 7)}`, true) }, 'Bu aya dön')
        : null,
    ),
    s.weekVolume ? h('p', { class: 'px-1 text-sm text-zinc-400' }, `Bu hafta toplam ${num(Math.round(s.weekVolume))} kg kaldırdın. Toplam ${s.total} antrenman.`) : null,
    sectionTitle(`${MONTHS[first.getMonth()]} antrenmanları`),
    monthWorkouts.length
      ? h(
          'div',
          { class: 'space-y-2' },
          monthWorkouts.map((w) => {
            const groups = groupsOf(w)
            const sets = w.items.reduce((n, it) => n + it.sets.length, 0)
            return h(
              'button',
              { type: 'button', class: 'flex w-full items-center gap-3 rounded-2xl bg-zinc-900 px-4 py-3 text-left active:bg-zinc-800', onclick: () => go(`#/antrenman/${w.date}`) },
              h(
                'div',
                { class: 'w-14 shrink-0 text-center' },
                h('p', { class: 'text-lg font-bold leading-none' }, parseDate(w.date).getDate()),
                h('p', { class: 'text-xs text-zinc-500' }, WEEKDAYS_SHORT[parseDate(w.date).getDay()]),
              ),
              h(
                'div',
                { class: 'min-w-0 flex-1' },
                h('p', { class: 'truncate text-sm' }, groups.join(', ') || shortDate(w.date)),
                h(
                  'p',
                  { class: 'truncate text-xs text-zinc-500' },
                  `${w.items.filter((it) => it.sets.length).length} hareket · ${sets} set · `,
                  w.items
                    .filter((it) => it.sets.length)
                    .map((it) => exercise(it.exerciseId)?.name)
                    .join(', '),
                ),
              ),
              h('span', { class: 'flex gap-1' }, groups.slice(0, 3).map((g) => h('span', { class: 'h-8 w-1 rounded-full', style: `background:${groupColor(g).hex}` }))),
            )
          }),
        )
      : empty('Bu ay henüz antrenman yok.'),
  )
}

const stat = (label, value, icon = '') =>
  h(
    'div',
    { class: 'rounded-2xl bg-zinc-900 px-3 py-3 text-center' },
    h('p', { class: 'text-xs text-zinc-400' }, label),
    h('p', { class: 'mt-1 text-lg font-bold' }, `${value}${icon ? ` ${icon}` : ''}`),
  )

const monthBtn = (text, onclick) =>
  h('button', { type: 'button', class: 'h-9 w-9 rounded-full bg-zinc-800 text-xl leading-none active:bg-zinc-700', onclick }, text)
