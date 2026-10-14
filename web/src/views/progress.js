// İlerleme: hareket bazında grafik ve rekorlar, vücut ağırlığı.
import { h, svg, today, addDays, shortDate, parseDate, num, parseNum, isValidDate, GROUPS, groupColor } from '../util.js'
import { state, mutate, exercise, history as exHistory, records, oneRM, volume, workSets } from '../state.js'
import { go, render, show, card, button, input, select, sectionTitle, empty } from '../ui.js'
import { setsSummary } from './workout.js'

// Grafikte gösterilebilecek ölçüler.
const METRICS = {
  weight: [
    ['max', 'En ağır set', (sets) => Math.max(...sets.map((s) => s.weight || 0)), 'kg'],
    ['1rm', 'Tahmini 1RM', (sets) => Math.max(...sets.map(oneRM)), 'kg'],
    ['volume', 'Hacim', (sets) => volume(sets), 'kg'],
    ['reps', 'Toplam tekrar', (sets) => sets.reduce((n, s) => n + (s.reps || 0), 0), ''],
  ],
  cardio: [
    ['km', 'Mesafe', (sets) => sets.reduce((n, s) => n + (s.km || 0), 0), 'km'],
    ['minutes', 'Süre', (sets) => sets.reduce((n, s) => n + (s.minutes || 0), 0), 'dk'],
  ],
}

let metric = { weight: 'max', cardio: 'km' }

export function progressView(arg) {
  const withHistory = state.data.exercises.filter((e) => exHistory(e.id).length)
  const selected = exercise(arg) && exHistory(arg).length ? exercise(arg) : null

  // Seçilmemişse en son yapılan hareketi göster (ısınma dışında seti olan).
  if (!selected && withHistory.length) {
    const hasWork = (it) => workSets(it.sets).length > 0
    const lastWorkout = [...state.data.workouts].reverse().find((w) => w.items.some(hasWork))
    const id = lastWorkout?.items.find(hasWork)?.exerciseId
    if (id && exHistory(id).length) {
      history.replaceState(history.state, '', `#/ilerleme/${id}`)
      return progressView(id)
    }
  }

  const options = GROUPS.flatMap((g) =>
    withHistory
      .filter((e) => e.group === g)
      .sort((a, b) => a.name.localeCompare(b.name, 'tr'))
      .map((e) => [e.id, `${e.name}${e.archived ? ' (arşiv)' : ''}`]),
  )

  return h(
    'div',
    { class: 'space-y-4' },
    h('h1', { class: 'text-xl font-bold' }, 'İlerleme'),
    balance(),
    sectionTitle('Hareket'),
    selected
      ? [
          select({ value: selected.id, onchange: (ev) => go(`#/ilerleme/${ev.target.value}`, true) }, options),
          exerciseProgress(selected),
        ]
      : card({}, empty('Henüz kayıtlı set yok. Antrenman ekledikçe ilerlemen burada görünecek.')),
    bodyWeight(),
  )
}

// Kas grubu dengesi: son 7 ya da 30 günde her gruba yapılan asıl set sayısı.
let balanceDays = 7

function balance() {
  const from = addDays(today(), -(balanceDays - 1))
  const counts = Object.fromEntries(GROUPS.map((g) => [g, 0]))
  for (const w of state.data.workouts) {
    if (w.date < from || w.date > today()) continue
    for (const it of w.items) {
      const g = exercise(it.exerciseId)?.group
      if (g) counts[g] += workSets(it.sets).length
    }
  }
  const total = Object.values(counts).reduce((a, b) => a + b, 0)
  const maxCount = Math.max(1, ...Object.values(counts))
  // Kardiyo ve "Diğer" hiç yapılmadıysa listede gösterilmez.
  const groups = GROUPS.filter((g) => counts[g] || !['Kardiyo', 'Diğer'].includes(g))

  return card(
    {},
    h(
      'div',
      { class: 'mb-3 flex items-center justify-between' },
      h('h2', { class: 'font-semibold' }, 'Kas grubu dengesi'),
      h(
        'div',
        { class: 'flex gap-1' },
        [7, 30].map((d) =>
          h(
            'button',
            {
              type: 'button',
              class: `rounded-full px-3 py-1 text-xs ${balanceDays === d ? 'bg-emerald-600 text-white' : 'bg-zinc-800 text-zinc-300'}`,
              onclick: () => {
                balanceDays = d
                render()
              },
            },
            `${d} gün`,
          ),
        ),
      ),
    ),
    total
      ? h(
          'div',
          { class: 'space-y-1.5' },
          groups.map((g) =>
            h(
              'div',
              { class: 'grid grid-cols-[4.5rem_1fr_2rem] items-center gap-2 text-sm' },
              h('span', { class: counts[g] ? 'text-zinc-300' : 'text-zinc-500' }, g),
              h(
                'div',
                { class: 'h-3 overflow-hidden rounded-full bg-zinc-800' },
                h('div', { class: 'h-full rounded-full', style: `width:${(counts[g] / maxCount) * 100}%;background:${groupColor(g).hex}` }),
              ),
              h('span', { class: `text-right tabular-nums ${counts[g] ? '' : 'text-zinc-600'}` }, counts[g]),
            ),
          ),
          h('p', { class: 'pt-1 text-xs text-zinc-500' }, `Son ${balanceDays} günde gruplara yapılan set sayısı (ısınma hariç). Boş kalan grubu ihmal ediyor olabilirsin.`),
        )
      : h('p', { class: 'text-sm text-zinc-500' }, `Son ${balanceDays} günde set yok.`),
  )
}

function exerciseProgress(ex) {
  const kind = ex.kind === 'cardio' ? 'cardio' : 'weight'
  const hist = exHistory(ex.id)
  const rec = records(ex.id)
  const [, label, fn, unit] = METRICS[kind].find((m) => m[0] === metric[kind]) || METRICS[kind][0]
  const points = hist.map((x) => ({ date: x.date, value: fn(x.sets) }))

  const recordCards =
    kind === 'weight'
      ? [
          stat('Rekor', rec.weight ? `${num(rec.weight)} kg` : '—', rec.weightDate ? shortDate(rec.weightDate) : ''),
          stat('Tahmini 1RM', rec.oneRM ? `${num(Math.round(rec.oneRM * 2) / 2)} kg` : '—', 'Epley formülü'),
          stat('Antrenman', `${rec.sessions}`, `ilki ${shortDate(hist[0].date)}`),
        ]
      : [
          stat('En uzun', rec.km ? `${num(rec.km)} km` : '—', rec.kmDate ? shortDate(rec.kmDate) : ''),
          stat('En uzun süre', rec.minutes ? `${num(rec.minutes)} dk` : '—', ''),
          stat('Antrenman', `${rec.sessions}`, `ilki ${shortDate(hist[0].date)}`),
        ]

  return [
    h('div', { class: 'grid grid-cols-3 gap-2' }, recordCards),
    card(
      {},
      h(
        'div',
        { class: 'mb-3 flex flex-wrap gap-1.5' },
        METRICS[kind].map(([key, text]) =>
          h(
            'button',
            {
              type: 'button',
              class: `rounded-full px-3 py-1 text-xs ${metric[kind] === key ? 'bg-emerald-600 text-white' : 'bg-zinc-800 text-zinc-300'}`,
              onclick: () => {
                metric[kind] = key
                render()
              },
            },
            text,
          ),
        ),
      ),
      chart(points, unit),
      h('p', { class: 'mt-1 text-center text-xs text-zinc-500' }, `${label}${unit ? ` (${unit})` : ''}, antrenman başına`),
    ),
    sectionTitle('Geçmiş'),
    h(
      'div',
      { class: 'divide-y divide-zinc-800 overflow-hidden rounded-2xl bg-zinc-900' },
      [...hist]
        .reverse()
        .slice(0, 30)
        .map((x) =>
          h(
            'button',
            { type: 'button', class: 'flex w-full gap-3 px-4 py-3 text-left text-sm active:bg-zinc-800', onclick: () => go(`#/antrenman/${x.date}`) },
            h('span', { class: 'w-16 shrink-0 text-zinc-400' }, shortDate(x.date)),
            h('span', { class: 'flex-1' }, setsSummary(x.sets, kind === 'cardio')),
          ),
        ),
    ),
  ]
}

const stat = (label, value, sub) =>
  h(
    'div',
    { class: 'rounded-2xl bg-zinc-900 px-2 py-3 text-center' },
    h('p', { class: 'text-xs text-zinc-400' }, label),
    h('p', { class: 'mt-1 text-lg font-bold leading-tight' }, value),
    sub ? h('p', { class: 'text-[11px] text-zinc-500' }, sub) : null,
  )

// Basit çizgi grafik: yatay eksen zaman, dikey eksen değer.
export function chart(points, unit, color = '#10b981') {
  if (points.length < 2) {
    return h('p', { class: 'py-8 text-center text-sm text-zinc-500' }, points.length ? 'Grafik için en az iki kayıt gerekiyor.' : 'Kayıt yok.')
  }
  const W = 320
  const H = 160
  const P = { l: 36, r: 10, t: 10, b: 22 }
  const times = points.map((p) => parseDate(p.date).getTime())
  const values = points.map((p) => p.value)
  const [t0, t1] = [Math.min(...times), Math.max(...times)]
  let [v0, v1] = [Math.min(...values), Math.max(...values)]
  if (v0 === v1) [v0, v1] = [v0 - 1, v1 + 1]
  const pad = (v1 - v0) * 0.1
  v0 = Math.max(0, v0 - pad)
  v1 += pad
  const x = (t) => P.l + ((t - t0) / (t1 - t0 || 1)) * (W - P.l - P.r)
  const y = (v) => P.t + (1 - (v - v0) / (v1 - v0)) * (H - P.t - P.b)
  const coords = points.map((p, i) => [x(times[i]), y(p.value)])

  const grid = [v0, (v0 + v1) / 2, v1].map((v) => [
    svg('line', { x1: P.l, x2: W - P.r, y1: y(v), y2: y(v), stroke: '#27272a', 'stroke-width': 1 }),
    svg('text', { x: P.l - 4, y: y(v) + 3, 'text-anchor': 'end', 'font-size': 9, fill: '#71717a' }, num(Math.round(v * 10) / 10)),
  ])
  return svg(
    'svg',
    { viewBox: `0 0 ${W} ${H}`, class: 'w-full', role: 'img', 'aria-label': 'İlerleme grafiği' },
    grid,
    svg('polyline', { points: coords.map((c) => c.join(',')).join(' '), fill: 'none', stroke: color, 'stroke-width': 2, 'stroke-linejoin': 'round' }),
    coords.map(([cx, cy], i) =>
      svg('circle', { cx, cy, r: 3, fill: color }, svg('title', {}, `${shortDate(points[i].date)}: ${num(points[i].value)} ${unit}`)),
    ),
    svg('text', { x: P.l, y: H - 6, 'font-size': 9, fill: '#71717a' }, shortDate(points[0].date)),
    svg('text', { x: W - P.r, y: H - 6, 'text-anchor': 'end', 'font-size': 9, fill: '#71717a' }, shortDate(points[points.length - 1].date)),
  )
}

function bodyWeight() {
  const list = state.data.bodyWeights
  const last = list[list.length - 1]
  const kg = input({ inputmode: 'decimal', placeholder: 'kg', value: last ? String(last.kg).replace('.', ',') : '' })
  const date = input({ type: 'date', value: today(), max: today() })

  async function save() {
    const value = parseNum(kg.value)
    if (!value) return show('Kilonu gir.', false)
    if (!isValidDate(date.value)) return show('Tarihi seç.', false)
    try {
      await mutate('PUT', `/api/bodyweights/${date.value}`, { kg: value })
      show('Kaydedildi.')
      render()
    } catch {
      // mutate hatayı gösterdi
    }
  }
  async function remove(d) {
    if (!confirm(`${shortDate(d)} kaydı silinsin mi?`)) return
    try {
      await mutate('DELETE', `/api/bodyweights/${d}`)
      render()
    } catch {
      // mutate hatayı gösterdi
    }
  }

  const diff = list.length >= 2 ? last.kg - list[0].kg : 0
  return [
    sectionTitle('Vücut ağırlığı'),
    card(
      {},
      h('div', { class: 'grid grid-cols-[1fr_1.3fr_auto] gap-2' }, kg, date, button('Kaydet', save)),
      list.length
        ? h(
            'p',
            { class: 'mt-3 text-sm text-zinc-400' },
            `Son: ${num(last.kg)} kg (${shortDate(last.date)})`,
            list.length >= 2 ? ` · başlangıçtan ${diff > 0 ? '+' : ''}${num(Math.round(diff * 10) / 10)} kg` : '',
          )
        : null,
      list.length >= 2 ? h('div', { class: 'mt-3' }, chart(list.map((b) => ({ date: b.date, value: b.kg })), 'kg', '#38bdf8')) : null,
      list.length
        ? h(
            'div',
            { class: 'mt-3 divide-y divide-zinc-800' },
            [...list]
              .reverse()
              .slice(0, 8)
              .map((b) =>
                h(
                  'div',
                  { class: 'flex items-center justify-between py-2 text-sm' },
                  h('span', { class: 'text-zinc-400' }, shortDate(b.date)),
                  h('span', { class: 'flex-1 px-4' }, `${num(b.kg)} kg`),
                  h('button', { type: 'button', class: 'px-2 text-zinc-500', onclick: () => remove(b.date) }, '✕'),
                ),
              ),
          )
        : null,
    ),
  ]
}
