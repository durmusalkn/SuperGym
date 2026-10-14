// Antrenman ekranı (Ritim): seçili hareketin setleri bir halkanın dilimleri, diğer
// hareketler altta yörüngedeki daireler.
import { h, today, addDays, longDate, shortDate, relativeDay, isValidDate, num, parseNum, hoursMinutes, clock, WEEKDAYS, parseDate } from '../util.js'
import { state, exercise, workoutFor, saveWorkout, lastBefore, records, volume, workSets, suggestion, workoutMinutes } from '../state.js'
import { go, render, show, button, icon, roundBtn } from '../ui.js'
import { pickExercise, editTemplate, editExercise } from '../sheets.js'
import { startRest } from '../timer.js'
import { segmentRing, progressRing } from '../rings.js'

// Her gün için seçili hareketin sırası.
const activeByDate = {}

// Kutuda gösterilecek sayı: 0 ise boş, ondalık ayırıcı virgül.
const field = (n) => (n ? String(n).replace('.', ',') : '')
const round2 = (v) => Math.round(v * 100) / 100

export function setsSummary(sets, cardio) {
  if (cardio) return sets.map((s) => [s.minutes ? `${num(s.minutes)} dk` : '', s.km ? `${num(s.km)} km` : ''].filter(Boolean).join(' ')).join(' · ')
  // Aynı setler art arda ise "3×60 kg × 12" gibi kısalt.
  const parts = []
  for (const s of sets) {
    const last = parts[parts.length - 1]
    if (last && last.reps === s.reps && last.weight === s.weight && last.rpe === s.rpe) last.n++
    else parts.push({ ...s, n: 1 })
  }
  return parts.map((p) => `${p.n > 1 ? `${p.n}×` : ''}${p.weight ? `${num(p.weight)} kg × ` : ''}${p.reps || 0}${p.rpe ? ` @${num(p.rpe)}` : ''}`).join(' · ')
}

function summaryText(w) {
  const sets = w.items.reduce((n, it) => n + workSets(it.sets).length, 0)
  if (!sets) return ''
  const parts = []
  const min = workoutMinutes(w)
  if (min) parts.push(hoursMinutes(min))
  else if (w.start) parts.push(`başlangıç ${clock(w.start)}`)
  const vol = w.items.reduce((n, it) => n + volume(it.sets), 0)
  if (vol) parts.push(`${num(Math.round(vol))} kg`)
  parts.push(`${w.items.length} hareket · ${sets} set`)
  return parts.join(' · ')
}

// Hedef set sayısı: geçen seferki kadar (en az 3; kardiyoda 1), yapılan aşılınca bir fazlası.
function target(date, it) {
  const ex = exercise(it.exerciseId)
  const done = workSets(it.sets).length
  const last = lastBefore(ex.id, date)
  return Math.max(done + 1, last?.sets.length || (ex.kind === 'cardio' ? 1 : 3))
}

// Yörüngedeki kısaltma: iki kelimenin baş harfleri; tek kelimede ilk iki harf ("Sq").
const initials = (name) => {
  const words = name.split(/\s+/).filter(Boolean)
  if (words.length === 1) return words[0].slice(0, 2).replace(/^./, (c) => c.toLocaleUpperCase('tr'))
  return words
    .slice(0, 2)
    .map((p) => p[0].toLocaleUpperCase('tr'))
    .join('')
}

// Süperset grubu: birbirine bağlı ardışık hareketler.
function groupStart(items, i) {
  while (i > 0 && items[i - 1].linkNext) i--
  return i
}
function groupEnd(items, i) {
  while (i < items.length - 1 && items[i].linkNext) i++
  return i
}

function activeIndex(date, w) {
  const n = w.items.length
  let i = activeByDate[date]
  if (i == null || i >= n) {
    // Varsayılan: henüz seti olmayan ilk hareket, yoksa sonuncusu.
    i = w.items.findIndex((it) => !it.sets.length)
    if (i < 0) i = n - 1
  }
  return Math.max(0, i)
}

export function workoutView(arg) {
  const date = isValidDate(arg) ? arg : today()
  const w = workoutFor(date)
  const rel = relativeDay(date)
  const summary = summaryText(w)

  const header = h(
    'header',
    { class: 'flex items-center justify-between gap-3' },
    h(
      'button',
      { type: 'button', class: 'min-w-0 text-left', onclick: () => go(`#/takvim/${date.slice(0, 7)}`) },
      h('p', { class: 'text-[22px] font-semibold leading-tight' }, rel || WEEKDAYS[parseDate(date).getDay()]),
      h('p', { id: 'day-summary', class: 'mt-0.5 truncate text-[13px] text-muted' }, summary || longDate(date)),
    ),
    h(
      'div',
      { class: 'flex gap-2' },
      roundBtn('left', () => go(`#/antrenman/${addDays(date, -1)}`, true), 'Önceki gün'),
      roundBtn('right', () => go(`#/antrenman/${addDays(date, 1)}`, true), 'Sonraki gün'),
    ),
  )

  const backToToday =
    date !== today() ? h('div', { class: 'mt-2 text-center' }, button('Bugüne dön', () => go(`#/antrenman/${today()}`, true), 'ghost', 'py-1 text-sm')) : null

  if (!w.items.length) return h('div', {}, header, backToToday, emptyDay(date, w))

  const i = activeIndex(date, w)
  return h(
    'div',
    { class: 'flex flex-col items-center' },
    h('div', { class: 'w-full' }, header, backToToday),
    focus(date, i),
    orbit(date, i),
    setList(date, i),
    itemActions(date, i),
    dayFooter(date, w),
  )
}

function emptyDay(date, w) {
  const templates = state.data.templates
  return h(
    'div',
    { class: 'flex flex-col items-center' },
    h(
      'div',
      { class: 'relative mt-8 flex h-[260px] w-[260px] items-center justify-center' },
      h('div', { class: 'absolute inset-0' }, segmentRing(260, 14, [{ color: '#2e2942' }])),
      h(
        'button',
        {
          type: 'button',
          class: 'relative flex flex-col items-center gap-2 rounded-full p-6',
          onclick: () => pickExercise((e) => addExercise(date, e.id), new Set()),
        },
        h('span', { class: 'flex h-16 w-16 items-center justify-center rounded-full bg-coral text-ink' }, icon('plus', 28, '#15121f', 2.6)),
        h('span', { class: 'text-lg font-medium' }, 'Hareket ekle'),
      ),
    ),
    h('p', { class: 'mt-4 text-sm text-muted' }, date === today() ? 'Bugün henüz kayıt yok.' : 'Bu gün için kayıt yok.'),
    templates.length
      ? h(
          'div',
          { class: 'mt-6 w-full' },
          h('p', { class: 'mb-3 text-center text-sm text-muted' }, 'Programdan başla'),
          h(
            'div',
            { class: 'grid grid-cols-3 gap-2' },
            templates.map((t) =>
              h(
                'button',
                { type: 'button', class: 'flex h-[74px] flex-col items-center justify-center gap-0.5 rounded-[22px] bg-surface active:bg-line', onclick: () => applyTemplate(date, t) },
                h('span', { class: 'max-w-full truncate px-2 font-semibold' }, t.name),
                h('span', { class: 'text-xs text-muted' }, `${t.exerciseIds.length} hareket`),
              ),
            ),
          ),
        )
      : null,
    w.note ? dayFooter(date, w) : null,
  )
}

// Seçili hareket: set halkası, bilgiler, kilo/tekrar ve "seti tamamla".
function focus(date, i) {
  const w = workoutFor(date)
  const it = w.items[i]
  const ex = exercise(it.exerciseId)
  const cardio = ex.kind === 'cardio'
  const last = lastBefore(ex.id, date)
  const rec = records(ex.id, date)
  const tip = suggestion(ex, date)
  const work = workSets(it.sets)
  const warm = it.sets.length - work.length
  const goal = target(date, it)
  const rpeOn = !cardio && state.data.settings.showRpe

  // Kutular: bu hareketin son setiyle, yoksa öneriyle ya da geçen seferin ilk setiyle dolu gelir.
  const prev = (!work.length && tip ? { weight: tip.weight, reps: tip.reps } : it.sets[it.sets.length - 1]) || last?.sets[0] || {}
  let warmup = false

  const big = h('span', { class: 'text-[76px] font-semibold leading-none tracking-tight tabular-nums' })
  const unit = h('span', { class: 'text-lg text-muted' })
  const setLabel = h('span', { class: 'text-[13px] tracking-wide text-muted' })
  const refresh = () => {
    const a = A.get()
    const b = B.get()
    big.textContent = num(a) || '0'
    unit.textContent = cardio ? `dk · ${num(b)} km` : `kg × ${b || 0} tekrar`
    setLabel.textContent = warmup ? 'Isınma seti' : `Set ${work.length + 1} / ${goal}`
    warmBtn.className = `rounded-full px-4 py-2 text-sm ${warmup ? 'bg-mint/15 text-mint ring-1 ring-mint/60' : 'text-muted ring-1 ring-line'}`
  }
  const A = cardio
    ? stepper(prev.minutes, 1, 'dk', 'Süre', refresh)
    : stepper(prev.weight, ex.increment || 2.5, 'kg', 'Kilo', refresh)
  const B = cardio ? stepper(prev.km, 0.5, 'km', 'Mesafe', refresh) : stepper(prev.reps, 1, '', 'Tekrar', refresh, true)
  const R = rpeOn ? stepper(0, 0.5, '', 'Zorluk (RPE)', refresh, false, 'RPE') : null
  const warmBtn = h(
    'button',
    {
      type: 'button',
      onclick: () => {
        warmup = !warmup
        refresh()
      },
    },
    'Isınma seti',
  )

  // Halka: dilimler hedef set sayısı; yapılanlar dolu, sıradaki nabız gibi atar. İç ince
  // halka ısınma setleri.
  const segments = Array.from({ length: goal }, (_, k) =>
    k < work.length ? { color: '#ff8a6b' } : k === work.length ? { color: '#ff8a6b', opacity: 0.35, cls: 'nabiz' } : { color: '#2e2942' },
  )
  const ring = h(
    'div',
    { class: 'relative mt-5 h-[270px] w-[270px]' },
    h('div', { class: 'absolute inset-0' }, segmentRing(270, 14, segments, `${goal} setten ${work.length} tanesi tamam`)),
    warm ? h('div', { class: 'absolute inset-[22px]' }, segmentRing(226, 4, Array.from({ length: warm }, () => ({ color: '#74e3c8' })))) : null,
    h('div', { class: 'absolute inset-0 flex flex-col items-center justify-center' }, setLabel, big, unit),
  )

  const info = []
  if (last) info.push(`Geçen sefer ${setsSummary(last.sets, cardio)}`)
  else info.push('İlk kez yapılıyor')
  if (warm) info.push('ince halka: ısınma')

  let pill = null
  if (tip && !work.length) {
    pill = h('p', { class: `mt-3 rounded-full px-4 py-2 text-sm font-medium ${tip.increase ? 'bg-[#2a1f2a] text-coral' : 'bg-surface text-zinc-300'}` }, tip.text)
  } else if (!cardio && rec.weight) {
    pill = h('p', { class: 'mt-3 rounded-full bg-surface px-4 py-2 text-sm text-zinc-300' }, `Rekor ${num(rec.weight)} kg · ${shortDate(rec.weightDate)}`)
  }

  const view = h(
    'section',
    { class: 'flex w-full flex-col items-center', 'aria-label': ex.name },
    ring,
    h('h1', { class: 'mt-4 text-center text-[30px] font-semibold leading-tight tracking-tight' }, ex.name),
    h('p', { class: 'mt-1 text-center text-sm text-muted' }, info.join(' · ')),
    pill,
    ex.note
      ? h(
          'button',
          { type: 'button', class: 'mt-2 flex max-w-full items-center gap-2 rounded-full bg-lav/10 px-4 py-2 text-left text-sm text-lav', onclick: () => editExercise(ex) },
          icon('note', 16),
          h('span', { class: 'truncate' }, ex.note),
        )
      : null,
    h('div', { class: 'mt-5 flex flex-wrap justify-center gap-3' }, A.el, B.el, R?.el),
    h('div', { class: 'mt-3' }, cardio ? null : warmBtn),
    h(
      'button',
      {
        type: 'button',
        'aria-label': 'Seti tamamla',
        class: 'mt-5 flex h-[84px] w-[84px] items-center justify-center rounded-full bg-coral shadow-[0_0_0_10px_rgba(255,138,107,0.14)] active:scale-95',
        onclick: () => {
          const set = cardio ? { minutes: A.get(), km: B.get() } : { weight: A.get(), reps: Math.round(B.get()) }
          if (warmup) set.warmup = true
          if (R?.get()) set.rpe = Math.min(10, Math.max(1, Math.round(R.get() * 2) / 2))
          addSet(date, i, set)
        },
      },
      icon('check', 34, '#15121f', 2.6),
    ),
    h('p', { class: 'mt-2 text-sm text-muted' }, 'Seti tamamla'),
  )
  refresh()
  return view
}

// − değer + düğmeli hap. Değer elle de yazılabilir.
function stepper(value, step, unitText, label, onChange, integer = false, placeholder = '') {
  const inp = h('input', {
    inputmode: integer ? 'numeric' : 'decimal',
    value: field(value),
    placeholder,
    'aria-label': label,
    class: `bg-transparent text-center text-[17px] font-semibold outline-none placeholder:text-muted ${unitText ? 'w-14' : 'w-12'}`,
  })
  const get = () => parseNum(inp.value)
  const set = (v) => {
    v = Math.max(0, integer ? Math.round(v) : round2(v))
    inp.value = field(v)
    onChange()
  }
  inp.oninput = onChange
  inp.onchange = () => set(get())
  const btn = (text, d, aria) =>
    h(
      'button',
      { type: 'button', 'aria-label': aria, class: 'h-10 w-10 shrink-0 rounded-full bg-line text-xl active:opacity-70', onclick: () => set(get() + d) },
      text,
    )
  const el = h(
    'div',
    { class: 'flex h-[52px] items-center gap-1 rounded-full bg-surface px-1.5' },
    btn('−', -step, `${label} azalt`),
    h('label', { class: 'flex items-baseline' }, inp, unitText ? h('span', { class: 'text-sm text-muted' }, unitText) : null),
    btn('+', step, `${label} artır`),
  )
  return { el, get }
}

// Yörünge: günün hareketleri. Süpersetler kesikli bir çerçevede; halka o hareketin set ilerlemesi.
function orbit(date, active) {
  const w = workoutFor(date)
  const nodes = []
  for (let i = 0; i < w.items.length; ) {
    const end = groupEnd(w.items, i)
    const members = []
    for (let k = i; k <= end; k++) {
      if (k > i) members.push(h('span', { class: 'h-0.5 w-2.5 shrink-0 bg-zinc-600' }))
      members.push(orbitNode(date, k, active))
    }
    nodes.push(end > i ? h('div', { class: 'flex shrink-0 items-center rounded-full border border-dashed border-zinc-600 p-1' }, members) : members)
    i = end + 1
  }
  nodes.push(
    h(
      'button',
      {
        type: 'button',
        'aria-label': 'Hareket ekle',
        class: 'flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-dashed border-zinc-600 text-muted',
        onclick: () => pickExercise((e) => addExercise(date, e.id), new Set(w.items.map((it) => it.exerciseId))),
      },
      icon('plus', 20),
    ),
  )
  return h('nav', { 'aria-label': 'Hareketler', class: 'no-scrollbar -mx-5 mt-7 flex max-w-[100vw] items-center gap-2.5 overflow-x-auto px-5 py-1' }, nodes)
}

function orbitNode(date, k, active) {
  const it = workoutFor(date).items[k]
  const ex = exercise(it.exerciseId)
  const ratio = workSets(it.sets).length / target(date, it)
  const on = k === active
  return h(
    'button',
    {
      type: 'button',
      'aria-label': ex.name,
      'aria-current': on ? 'true' : null,
      class: 'relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full',
      onclick: () => {
        activeByDate[date] = k
        render()
        window.scrollTo({ top: 0, behavior: 'smooth' })
      },
    },
    h('span', { class: 'absolute inset-0' }, progressRing(48, 3, on ? 1 : ratio, on ? '#ff8a6b' : '#d9d4e6', on ? '#ff8a6b' : '#2e2942')),
    h('span', { class: `relative text-[13px] ${on ? 'font-semibold text-text' : 'text-muted'}` }, initials(ex.name)),
  )
}

// Seçili hareketin girilmiş setleri: kutular doğrudan düzenlenebilir; numaraya dokununca
// ısınma seti olur ya da geri döner.
function setList(date, i) {
  const it = workoutFor(date).items[i]
  if (!it.sets.length) return null
  const ex = exercise(it.exerciseId)
  const cardio = ex.kind === 'cardio'
  const rec = records(ex.id, date)
  const rpeOn = !cardio && state.data.settings.showRpe
  const [keyA, keyB] = cardio ? ['minutes', 'km'] : ['weight', 'reps']

  // Önceki günlerin rekorunu geçen ilk set (ilk kez yapılan harekette rekor gösterilmez).
  let prIndex = -1
  if (!cardio && rec.sessions) {
    let best = rec.weight
    it.sets.forEach((s, j) => {
      if (!s.warmup && (s.weight || 0) > best) [best, prIndex] = [s.weight, j]
    })
  }

  const box = 'w-full min-w-0 rounded-xl bg-line/60 px-2 py-2 text-center text-base outline-none focus:ring-2 focus:ring-coral'
  let workNo = 0
  const rows = it.sets.map((s, j) => {
    const no = s.warmup ? 'I' : ++workNo
    return h(
      'div',
      { class: `grid items-center gap-2 rounded-2xl bg-surface p-2 ${rpeOn ? 'grid-cols-[2.5rem_1fr_1fr_3.25rem_2.5rem]' : 'grid-cols-[2.5rem_1fr_1fr_2.5rem]'}` },
      h(
        'button',
        {
          type: 'button',
          'aria-label': 'Isınma seti yap/geri al',
          class: `relative h-10 w-10 rounded-full text-sm font-semibold ${s.warmup ? 'bg-mint/15 text-mint' : 'bg-line text-text'}`,
          onclick: () => toggleWarmup(date, i, j),
        },
        no,
        j === prIndex ? h('span', { class: 'absolute -right-1 -top-1 rounded-full bg-coral px-1 text-[9px] font-bold text-ink' }, 'PR') : null,
      ),
      cellInput(box, s[keyA], 'decimal', cardio ? 'dk' : 'kg', (v) => editSet(date, i, j, keyA, v)),
      cellInput(box, s[keyB], cardio ? 'decimal' : 'numeric', cardio ? 'km' : 'tekrar', (v) => editSet(date, i, j, keyB, v)),
      rpeOn ? cellInput(box, s.rpe, 'decimal', 'RPE', (v) => editSet(date, i, j, 'rpe', v)) : null,
      h(
        'button',
        { type: 'button', 'aria-label': 'Seti sil', class: 'flex h-10 w-10 items-center justify-center rounded-full text-muted active:bg-line', onclick: () => removeSet(date, i, j) },
        icon('x', 16),
      ),
    )
  })
  return h(
    'section',
    { class: 'mt-7 w-full', 'aria-label': 'Girilen setler' },
    h('h2', { class: 'mb-2 px-1 text-sm font-medium text-muted' }, `${ex.name} · setler`),
    h('div', { class: 'space-y-2' }, rows),
  )
}

function cellInput(cls, value, mode, label, onchange) {
  return h('input', { inputmode: mode, value: field(value), 'aria-label': label, placeholder: label, class: `${cls} placeholder:text-zinc-600`, onchange: (ev) => onchange(ev.target.value) })
}

// Seçili hareket için: sıra, süperset, not, çıkar.
function itemActions(date, i) {
  const w = workoutFor(date)
  const it = w.items[i]
  const ex = exercise(it.exerciseId)
  const chip = (content, onclick, label, extra = '') =>
    h('button', { type: 'button', 'aria-label': label, class: `flex h-10 items-center gap-1.5 rounded-full px-3.5 text-sm ring-1 ring-line active:bg-surface ${extra}`, onclick }, content)
  return h(
    'div',
    { class: 'mt-4 flex w-full flex-wrap justify-center gap-2' },
    i > 0 ? chip(icon('up', 16), () => moveItem(date, i, -1), 'Yukarı taşı') : null,
    i < w.items.length - 1 ? chip(icon('down', 16), () => moveItem(date, i, 1), 'Aşağı taşı') : null,
    i < w.items.length - 1
      ? chip([icon('link', 16), it.linkNext ? 'Süperset · ayır' : 'Sonrakiyle süperset'], () => toggleLink(date, i), 'Süperset', it.linkNext ? 'bg-lav/15 text-lav ring-lav/50' : '')
      : null,
    chip([icon('note', 16), ex.note ? 'Not' : 'Not ekle'], () => editExercise(ex), 'Hareket notu'),
    chip([icon('trash', 16), 'Çıkar'], () => removeItem(date, i), 'Hareketi çıkar', 'text-[#ffb3be]'),
  )
}

function dayFooter(date, w) {
  const note = h('textarea', {
    rows: 2,
    placeholder: 'Antrenman notu (isteğe bağlı)',
    class: 'w-full rounded-[22px] bg-surface px-4 py-3 text-sm text-text outline-none placeholder:text-zinc-500 focus:ring-2 focus:ring-coral',
    onchange: (ev) => {
      const cur = workoutFor(date)
      cur.note = ev.target.value.trim()
      saveWorkout(cur)
    },
  })
  note.value = w.note || ''
  return h(
    'div',
    { class: 'mt-8 w-full space-y-3' },
    note,
    w.items.length
      ? h('div', { class: 'text-center' }, button('Bu antrenmanı program olarak kaydet', () => editTemplate(null, w.items.map((it) => it.exerciseId)), 'ghost', 'py-1 text-sm'))
      : null,
  )
}

// --- Değişiklikler ---

function addExercise(date, exId) {
  const w = workoutFor(date)
  let i = w.items.findIndex((it) => it.exerciseId === exId)
  if (i < 0) {
    w.items.push({ exerciseId: exId, sets: [] })
    i = w.items.length - 1
    saveWorkout(w)
  }
  activeByDate[date] = i
  render()
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

function applyTemplate(date, t) {
  const w = workoutFor(date)
  for (const id of t.exerciseIds) {
    const ex = exercise(id)
    if (ex && !ex.archived && !w.items.some((it) => it.exerciseId === id)) w.items.push({ exerciseId: id, sets: [] })
  }
  activeByDate[date] = 0
  saveWorkout(w)
  render()
}

function addSet(date, i, set) {
  const w = workoutFor(date)
  const it = w.items[i]
  const ex = exercise(it.exerciseId)
  if (ex.kind === 'cardio' ? !set.minutes && !set.km : !set.reps) {
    return show(ex.kind === 'cardio' ? 'Süre ya da mesafe girin.' : 'Tekrar sayısını girin.', false)
  }
  const rec = records(ex.id, date)
  const bestToday = Math.max(0, ...workSets(it.sets).map((s) => s.weight || 0))
  it.sets.push(set)
  // Bugünün antrenmanında süre tutulur: ilk set başlangıç, son set bitiş.
  const isToday = date === today()
  if (isToday) {
    const now = new Date().toISOString()
    w.start ||= now
    w.end = now
  }
  saveWorkout(w)

  // Sıradaki hareket: süpersette gruptaki bir sonraki; grup bitince ya da tek harekette,
  // hedef set sayısına ulaşıldıysa sıradaki hareket, ulaşılmadıysa grubun başı.
  const items = w.items
  const end = groupEnd(items, i)
  const inSuperset = i < end
  let next = i
  if (inSuperset) next = i + 1
  else {
    const start = groupStart(items, i)
    if (workSets(items[start].sets).length < target(date, items[start])) next = start
    else if (items[i + 1]) next = i + 1
  }
  if (!set.warmup) activeByDate[date] = next
  render()
  window.scrollTo({ top: 0, behavior: 'smooth' })

  if (ex.kind === 'weight' && !set.warmup && rec.sessions && set.weight > rec.weight && set.weight > bestToday) {
    show(`Yeni rekor! ${ex.name}: ${num(set.weight)} kg`)
  }
  if (!isToday) return
  if (inSuperset) {
    show(`Süperset: sıradaki ${exercise(items[next].exerciseId).name}`)
    return
  }
  startRest(state.data.settings.restSeconds, restInfo(date, i, set, next))
}

// Dinlenme ekranında gösterilecek "sıradaki" bilgisi.
function restInfo(date, i, set, next) {
  const w = workoutFor(date)
  const done = w.items[i]
  const ex = exercise(done.exerciseId)
  const doneNo = set.warmup ? 'ısınma' : `set ${workSets(done.sets).length}`
  const nx = w.items[next]
  const nxEx = exercise(nx.exerciseId)
  const nxWork = workSets(nx.sets)
  const goal = target(date, nx)
  // Isınmadan sonra da asıl set gösterilir: bugünkü son asıl set, yoksa öneri, yoksa geçen sefer.
  const tip = suggestion(nxEx, date)
  const last = nxWork[nxWork.length - 1] || (tip ? { weight: tip.weight, reps: tip.reps } : lastBefore(nxEx.id, date)?.sets[0])
  const value = !last ? nxEx.name : nxEx.kind === 'cardio' ? setsSummary([last], true) : `${num(last.weight)} kg × ${last.reps}`
  const after = w.items[next + 1] && next === i ? `sonra ${exercise(w.items[next + 1].exerciseId).name}` : ''
  return {
    title: `${ex.name} · ${doneNo} tamam`,
    nextLabel: next === i ? `Sıradaki · set ${nxWork.length + 1} / ${goal}` : `Sıradaki · ${nxEx.name}`,
    nextValue: value,
    after,
  }
}

// Kutudaki değer değişince kaydeder; ekran yeniden çizilmez (klavye kapanmasın diye).
function editSet(date, i, j, key, raw) {
  const w = workoutFor(date)
  const s = w.items[i]?.sets[j]
  if (!s) return
  if (key === 'rpe') {
    const v = parseNum(raw)
    if (v) s.rpe = Math.min(10, Math.max(1, Math.round(v * 2) / 2))
    else delete s.rpe
  } else {
    s[key] = key === 'reps' ? Math.round(parseNum(raw)) : parseNum(raw)
  }
  saveWorkout(w)
  const summary = document.getElementById('day-summary')
  if (summary) summary.textContent = summaryText(w) || longDate(date)
}

function toggleWarmup(date, i, j) {
  const w = workoutFor(date)
  const s = w.items[i]?.sets[j]
  if (!s) return
  if (s.warmup) delete s.warmup
  else s.warmup = true
  saveWorkout(w)
  render()
}

function removeSet(date, i, j) {
  const w = workoutFor(date)
  w.items[i].sets.splice(j, 1)
  saveWorkout(w)
  render()
}

function toggleLink(date, i) {
  const w = workoutFor(date)
  if (w.items[i].linkNext) delete w.items[i].linkNext
  else w.items[i].linkNext = true
  saveWorkout(w)
  render()
}

// Hareketin yerini değiştirir. Taşınan iki hareketin süperset bağları çözülür (bağlar
// sıraya göre tutulduğu için yer değişince anlamsızlaşır).
function moveItem(date, i, d) {
  const w = workoutFor(date)
  const j = i + d
  if (j < 0 || j >= w.items.length) return
  for (const k of [i - 1, i, j - 1, j]) if (w.items[k]) delete w.items[k].linkNext
  ;[w.items[i], w.items[j]] = [w.items[j], w.items[i]]
  activeByDate[date] = j
  saveWorkout(w)
  render()
}

function removeItem(date, i) {
  const w = workoutFor(date)
  const it = w.items[i]
  if (it.sets.length && !confirm(`"${exercise(it.exerciseId).name}" ve ${it.sets.length} seti bu antrenmandan çıkarılsın mı?`)) return
  // Önceki hareket bu harekete bağlıysa, bu hareketin kendi bağı yoksa bağ çözülür.
  const prevItem = w.items[i - 1]
  if (prevItem?.linkNext && !it.linkNext) delete prevItem.linkNext
  w.items.splice(i, 1)
  activeByDate[date] = Math.max(0, i - 1)
  saveWorkout(w)
  render()
}
