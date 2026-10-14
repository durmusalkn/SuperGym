// İlerleme (Ritim): büyüme halkaları (her ay bir halka, kalınlığı o ayın hacmi), grafik,
// kas grubu dengesi çiçeği ve vücut ağırlığı.
import { h, svg, today, addDays, shortDate, parseDate, num, parseNum, isValidDate, GROUPS, MONTHS, groupColor } from '../util.js'
import { state, mutate, exercise, history as exHistory, records, oneRM, volume, workSets } from '../state.js'
import { go, render, show, card, button, input, select, sectionTitle, empty, icon } from '../ui.js'
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
let balanceDays = 7

const pillToggle = (on, text, onclick) =>
  h('button', { type: 'button', 'aria-pressed': on ? 'true' : 'false', class: `rounded-full px-3.5 py-1.5 text-sm ${on ? 'bg-text text-ink' : 'text-muted ring-1 ring-line'}`, onclick }, text)

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
    {},
    h(
      'header',
      { class: 'flex items-center justify-between gap-3' },
      h('h1', { class: 'text-[22px] font-semibold' }, 'Büyüme halkaları'),
      selected
        ? select(
            { value: selected.id, 'aria-label': 'Hareket', class: '!w-auto max-w-[55%] !rounded-full !bg-transparent !py-2.5 text-sm ring-1 ring-line', onchange: (ev) => go(`#/ilerleme/${ev.target.value}`, true) },
            options,
          )
        : null,
    ),
    selected ? exerciseProgress(selected) : card({ class: 'mt-5' }, empty('Henüz kayıtlı set yok. Antrenman ekledikçe halkaların burada büyüyecek.')),
    flower(),
    bodyWeight(),
  )
}

// Son 5 ay, en dıştaki en yeni. Kalınlık o ayın hacmi (kardiyoda mesafe).
function growthRings(ex, hist) {
  const cardio = ex.kind === 'cardio'
  const now = parseDate(today())
  const months = Array.from({ length: 5 }, (_, k) => {
    const d = new Date(now.getFullYear(), now.getMonth() - k, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const sessions = hist.filter((x) => x.date.startsWith(key))
    const amount = sessions.reduce((n, x) => n + (cardio ? x.sets.reduce((m, s) => m + (s.km || 0), 0) : volume(x.sets)), 0)
    const best = sessions.length ? Math.max(...sessions.flatMap((x) => x.sets.map((s) => (cardio ? s.km || 0 : s.weight || 0)))) : 0
    return { name: MONTHS[d.getMonth()], amount, best }
  })
  const maxAmount = Math.max(1, ...months.map((m) => m.amount))
  let size = 220
  const rings = months.map((m, k) => {
    const width = m.amount ? Math.round(4 + (m.amount / maxAmount) * 12) : 2
    const color = k === 0 ? '#ff8a6b' : `rgba(255,138,107,${m.amount ? 0.62 - k * 0.11 : 0.18})`
    const ring = h('div', { class: 'absolute rounded-full', style: `left:${(220 - size) / 2}px;top:${(220 - size) / 2}px;width:${size}px;height:${size}px;border:${width}px solid ${color}` })
    size -= width * 2 + 6
    return ring
  })
  const thickest = months.reduce((a, b) => (b.amount > a.amount ? b : a), months[0])
  return { rings, months, thickest }
}

function exerciseProgress(ex) {
  const kind = ex.kind === 'cardio' ? 'cardio' : 'weight'
  const cardio = kind === 'cardio'
  const hist = exHistory(ex.id)
  const rec = records(ex.id)
  const { rings, months, thickest } = growthRings(ex, hist)
  const unitBest = cardio ? 'km' : 'kg'

  const firstBest = Math.max(...hist[0].sets.map((s) => (cardio ? s.km || 0 : s.weight || 0)))
  const recordValue = cardio ? rec.km : rec.weight
  const gain = recordValue - firstBest
  const insight = thickest.amount
    ? [
        `${thickest.name} halkası en kalın: ${ex.name}'te en çok ${cardio ? 'mesafeyi' : 'hacmi'} o ay yaptın.`,
        gain > 0 ? [' İlk kayıttan bu yana ', h('span', { class: 'font-semibold text-coral' }, `+${num(gain)} ${unitBest}`), '.'] : '',
      ]
    : 'Son 5 ayda bu hareket yapılmadı.'

  const [, label, fn, unit] = METRICS[kind].find((m) => m[0] === metric[kind]) || METRICS[kind][0]
  const points = hist.map((x) => ({ date: x.date, value: fn(x.sets) }))

  return [
    h(
      'section',
      { class: 'mt-5 flex items-center justify-center gap-4', 'aria-label': 'Aylara göre halkalar: her halka bir ay, kalınlığı o ayın hacmi' },
      h(
        'div',
        { class: 'relative h-[220px] w-[220px] shrink-0' },
        rings,
        h(
          'div',
          { class: 'absolute inset-0 flex flex-col items-center justify-center' },
          h('span', { class: 'text-4xl font-semibold leading-none' }, recordValue ? num(recordValue) : '—'),
          h('span', { class: 'text-xs text-muted' }, cardio ? 'km en uzun' : 'kg rekor'),
        ),
      ),
      h(
        'ul',
        { class: 'space-y-2' },
        months.map((m, k) =>
          h(
            'li',
            {},
            h('span', { class: `block text-[13px] ${k === 0 ? 'text-coral' : 'text-zinc-300'}` }, m.name),
            h('span', { class: 'block text-[11px] text-muted' }, m.best ? `en iyi ${num(m.best)} ${unitBest}` : '—'),
          ),
        ),
      ),
    ),
    h('p', { class: 'mt-4 rounded-[20px] bg-surface px-4 py-3 text-sm leading-relaxed text-zinc-300' }, insight),
    h(
      'div',
      { class: 'mt-3 grid grid-cols-3 gap-2' },
      cardio
        ? [stat('En uzun süre', rec.minutes ? `${num(rec.minutes)} dk` : '—'), stat('Antrenman', rec.sessions), stat('İlk kayıt', shortDate(hist[0].date))]
        : [stat('Tahmini 1RM', rec.oneRM ? `${num(Math.round(rec.oneRM * 2) / 2)} kg` : '—'), stat('Antrenman', rec.sessions), stat('İlk kayıt', shortDate(hist[0].date))],
    ),
    card(
      { class: 'mt-3' },
      h(
        'div',
        { class: 'mb-3 flex flex-wrap gap-1.5' },
        METRICS[kind].map(([key, text]) =>
          pillToggle(metric[kind] === key, text, () => {
            metric[kind] = key
            render()
          }),
        ),
      ),
      chart(points, unit),
      h('p', { class: 'mt-1 text-center text-xs text-muted' }, `${label}${unit ? ` (${unit})` : ''}, antrenman başına`),
    ),
    h(
      'details',
      { class: 'mt-3 rounded-[22px] bg-surface' },
      h('summary', { class: 'cursor-pointer px-5 py-4 text-sm text-zinc-300' }, `Geçmiş · ${hist.length} antrenman`),
      h(
        'div',
        { class: 'px-2 pb-2' },
        [...hist]
          .reverse()
          .slice(0, 30)
          .map((x) =>
            h(
              'button',
              { type: 'button', class: 'flex w-full gap-3 rounded-2xl px-3 py-2.5 text-left text-sm active:bg-line', onclick: () => go(`#/antrenman/${x.date}`) },
              h('span', { class: 'w-14 shrink-0 text-muted' }, shortDate(x.date)),
              h('span', { class: 'flex-1' }, setsSummary(x.sets, cardio)),
            ),
          ),
      ),
    ),
  ]
}

const stat = (label, value) =>
  h('div', { class: 'rounded-[20px] bg-surface px-2 py-3 text-center' }, h('p', { class: 'text-[11px] text-muted' }, label), h('p', { class: 'mt-0.5 font-semibold' }, value))

// Kas grubu dengesi çiçeği: her yaprak bir grup, boyu son 7/30 günde yapılan set sayısı.
function flower() {
  const from = addDays(today(), -(balanceDays - 1))
  const counts = Object.fromEntries(GROUPS.map((g) => [g, 0]))
  for (const w of state.data.workouts) {
    if (w.date < from || w.date > today()) continue
    for (const it of w.items) {
      const g = exercise(it.exerciseId)?.group
      if (g) counts[g] += workSets(it.sets).length
    }
  }
  const groups = GROUPS.filter((g) => counts[g] || !['Kardiyo', 'Diğer'].includes(g))
  const maxCount = Math.max(1, ...groups.map((g) => counts[g]))
  const total = groups.reduce((n, g) => n + counts[g], 0)
  const neglected = groups.filter((g) => !counts[g] && g !== 'Kardiyo' && g !== 'Diğer')

  const S = 170
  const petals = groups.map((g, k) => {
    // Yapılmayan grup boş (çerçeveli) kısa bir yaprak olarak görünür.
    // Yapraklar merkezden biraz açıkta başlar; yapılmayan grup kesikli kısa bir yaprak.
    const len = counts[g] ? Math.round(26 + (counts[g] / maxCount) * 44) : 22
    const gap = 12
    const c = groupColor(g).hex
    return h('div', {
      class: 'absolute rounded-full',
      style: `left:${S / 2 - 11}px;top:${S / 2 - gap - len}px;width:22px;height:${len}px;transform-origin:11px ${len + gap}px;transform:rotate(${(360 / groups.length) * k}deg);${counts[g] ? `background:${c}` : `border:2px dashed ${c}80`}`,
    })
  })

  return [
    sectionTitle(
      'Denge çiçeği',
      h('div', { class: 'flex gap-1.5' }, [7, 30].map((d) => pillToggle(balanceDays === d, `${d} gün`, () => { balanceDays = d; render() }))),
    ),
    h(
      'section',
      { class: 'flex items-center gap-4', 'aria-label': `Kas grubu dengesi, son ${balanceDays} gün` },
      h(
        'div',
        { class: 'relative shrink-0', style: `width:${S}px;height:${S}px` },
        petals,
        h('div', { class: 'absolute h-4 w-4 rounded-full bg-ink ring-[3px] ring-line', style: `left:${S / 2 - 8}px;top:${S / 2 - 8}px` }),
      ),
      h(
        'div',
        {},
        h('p', { class: 'text-sm text-muted' }, total ? `Son ${balanceDays} gün · yaprak boyu = set` : `Son ${balanceDays} günde set yok`),
        h(
          'ul',
          { class: 'mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[13px]' },
          groups.map((g) =>
            h('li', { class: `flex items-center gap-1.5 ${counts[g] ? '' : 'text-muted'}` }, h('span', { class: 'h-2 w-2 rounded-full', style: `background:${groupColor(g).hex}` }), `${g} ${counts[g]}`),
          ),
        ),
        total && neglected.length ? h('p', { class: 'mt-2 text-xs text-coral' }, `${neglected.join(', ')} ihmal ediliyor`) : null,
      ),
    ),
  ]
}

// Basit çizgi grafik: yatay eksen zaman, dikey eksen değer.
export function chart(points, unit, color = '#ff8a6b') {
  if (points.length < 2) {
    return h('p', { class: 'py-8 text-center text-sm text-muted' }, points.length ? 'Grafik için en az iki kayıt gerekiyor.' : 'Kayıt yok.')
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
    svg('line', { x1: P.l, x2: W - P.r, y1: y(v), y2: y(v), stroke: '#2e2942', 'stroke-width': 1 }),
    svg('text', { x: P.l - 4, y: y(v) + 3, 'text-anchor': 'end', 'font-size': 9, fill: '#a39db8' }, num(Math.round(v * 10) / 10)),
  ])
  return svg(
    'svg',
    { viewBox: `0 0 ${W} ${H}`, class: 'w-full', role: 'img', 'aria-label': 'İlerleme grafiği' },
    grid,
    svg('polyline', { points: coords.map((c) => c.join(',')).join(' '), fill: 'none', stroke: color, 'stroke-width': 2.5, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }),
    coords.map(([cx, cy], i) =>
      svg('circle', { cx, cy, r: i === coords.length - 1 ? 5 : 3, fill: i === coords.length - 1 ? color : '#15121f', stroke: color, 'stroke-width': 2 }, svg('title', {}, `${shortDate(points[i].date)}: ${num(points[i].value)} ${unit}`)),
    ),
    svg('text', { x: P.l, y: H - 6, 'font-size': 9, fill: '#a39db8' }, shortDate(points[0].date)),
    svg('text', { x: W - P.r, y: H - 6, 'text-anchor': 'end', 'font-size': 9, fill: '#a39db8' }, shortDate(points[points.length - 1].date)),
  )
}

function bodyWeight() {
  const list = state.data.bodyWeights
  const last = list[list.length - 1]
  const kg = input({ inputmode: 'decimal', placeholder: 'kg', 'aria-label': 'Vücut ağırlığı (kg)', value: last ? String(last.kg).replace('.', ',') : '' })
  const date = input({ type: 'date', value: today(), max: today(), 'aria-label': 'Tarih' })

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
      h('div', { class: 'grid grid-cols-[4.75rem_minmax(0,1fr)_auto] gap-2' }, kg, date, button('Kaydet', save, 'primary', 'px-4')),
      list.length
        ? h(
            'p',
            { class: 'mt-3 text-sm text-muted' },
            `Son: ${num(last.kg)} kg (${shortDate(last.date)})`,
            list.length >= 2 ? ` · başlangıçtan ${diff > 0 ? '+' : ''}${num(Math.round(diff * 10) / 10)} kg` : '',
          )
        : null,
      list.length >= 2 ? h('div', { class: 'mt-3' }, chart(list.map((b) => ({ date: b.date, value: b.kg })), 'kg', '#74e3c8')) : null,
      list.length
        ? h(
            'div',
            { class: 'mt-2' },
            [...list]
              .reverse()
              .slice(0, 6)
              .map((b) =>
                h(
                  'div',
                  { class: 'flex items-center justify-between py-1.5 text-sm' },
                  h('span', { class: 'text-muted' }, shortDate(b.date)),
                  h('span', { class: 'flex-1 px-4' }, `${num(b.kg)} kg`),
                  h('button', { type: 'button', 'aria-label': 'Sil', class: 'flex h-9 w-9 items-center justify-center rounded-full text-muted active:bg-line', onclick: () => remove(b.date) }, icon('x', 14)),
                ),
              ),
          )
        : null,
    ),
  ]
}
