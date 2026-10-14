// Antrenman ekranı: seçilen günün hareketleri ve setleri.
import { h, today, addDays, longDate, shortDate, relativeDay, isValidDate, num, parseNum } from '../util.js'
import { state, exercise, workoutFor, saveWorkout, lastBefore, records, volume, workSets } from '../state.js'
import { go, render, show, card, button, groupChip, empty } from '../ui.js'
import { pickExercise, editTemplate } from '../sheets.js'
import { startRest } from '../timer.js'

// Kutuda gösterilecek sayı: 0 ise boş, ondalık ayırıcı virgül.
const field = (n) => (n ? String(n).replace('.', ',') : '')

export function setsSummary(sets, cardio) {
  if (cardio) return sets.map((s) => [s.minutes ? `${num(s.minutes)} dk` : '', s.km ? `${num(s.km)} km` : ''].filter(Boolean).join(' ')).join(' · ')
  // Aynı setler art arda ise "3×10 @ 60 kg" gibi kısalt.
  const parts = []
  for (const s of sets) {
    const last = parts[parts.length - 1]
    if (last && last.reps === s.reps && last.weight === s.weight) last.n++
    else parts.push({ ...s, n: 1 })
  }
  return parts.map((p) => `${p.n > 1 ? `${p.n}×` : ''}${p.weight ? `${num(p.weight)} kg × ` : ''}${p.reps || 0}`).join(' · ')
}

export function workoutView(arg) {
  const date = isValidDate(arg) ? arg : today()
  const w = workoutFor(date)
  const rel = relativeDay(date)

  const header = h(
    'div',
    { class: 'flex items-center justify-between gap-2' },
    navBtn('‹', () => go(`#/antrenman/${addDays(date, -1)}`, true)),
    h(
      'button',
      { type: 'button', class: 'flex-1 text-center', onclick: () => go(`#/takvim/${date.slice(0, 7)}`) },
      h('p', { class: 'text-xl font-bold' }, rel || longDate(date)),
      h('p', { class: 'text-xs text-zinc-400' }, rel ? longDate(date) : 'Takvimi aç'),
    ),
    navBtn('›', () => go(`#/antrenman/${addDays(date, 1)}`, true)),
  )

  const summary = h('p', { id: 'day-summary', class: 'text-center text-sm text-zinc-400' }, summaryText(w))

  const backToToday =
    date !== today()
      ? h('div', { class: 'text-center' }, button('Bugüne dön', () => go(`#/antrenman/${today()}`, true), 'ghost', 'text-sm'))
      : null

  const items = w.items.map((_, i) => itemCard(date, i))

  const addBtn = h(
    'button',
    {
      type: 'button',
      class: 'w-full rounded-2xl border-2 border-dashed border-zinc-700 py-4 font-semibold text-emerald-400 active:bg-zinc-900',
      onclick: () => pickExercise((e) => addExercise(date, e.id), new Set(w.items.map((it) => it.exerciseId))),
    },
    '+ Hareket ekle',
  )

  const templates = state.data.templates
  const start =
    !w.items.length && templates.length
      ? card(
          {},
          h('p', { class: 'mb-3 text-sm text-zinc-400' }, 'Programdan başla'),
          h(
            'div',
            { class: 'flex flex-wrap gap-2' },
            templates.map((t) => button(`${t.name} (${t.exerciseIds.length})`, () => applyTemplate(date, t), 'secondary')),
          ),
        )
      : null

  const note = h('textarea', {
    rows: 2,
    placeholder: 'Antrenman notu (isteğe bağlı)',
    class: 'w-full rounded-xl bg-zinc-900 px-3 py-2.5 text-sm text-zinc-100 outline-none placeholder:text-zinc-500 focus:ring-2 focus:ring-emerald-500',
    onchange: (ev) => {
      const cur = workoutFor(date)
      cur.note = ev.target.value.trim()
      saveWorkout(cur)
    },
  })
  note.value = w.note || ''

  const saveAsTemplate = w.items.length
    ? h(
        'div',
        { class: 'text-center' },
        button('Bu antrenmanı program olarak kaydet', () => editTemplate(null, w.items.map((it) => it.exerciseId)), 'ghost', 'text-sm'),
      )
    : null

  return h(
    'div',
    { class: 'space-y-4' },
    header,
    summary,
    backToToday,
    !w.items.length && !templates.length ? empty('Bu gün için kayıt yok. Hareket ekleyerek başla.') : null,
    start,
    items,
    addBtn,
    w.items.length || w.note ? note : null,
    saveAsTemplate,
  )
}

function summaryText(w) {
  const sets = w.items.reduce((n, it) => n + workSets(it.sets).length, 0)
  const vol = w.items.reduce((n, it) => n + volume(it.sets), 0)
  return sets ? `${w.items.length} hareket · ${sets} set${vol ? ` · ${num(Math.round(vol))} kg toplam` : ''}` : ''
}

const navBtn = (text, onclick) =>
  h('button', { type: 'button', class: 'h-11 w-11 rounded-full bg-zinc-900 text-2xl leading-none text-zinc-300 active:bg-zinc-800', onclick }, text)

function addExercise(date, exId) {
  const w = workoutFor(date)
  let i = w.items.findIndex((it) => it.exerciseId === exId)
  if (i < 0) {
    w.items.push({ exerciseId: exId, sets: [] })
    i = w.items.length - 1
    saveWorkout(w)
  }
  render()
  document.getElementById(`item-${i}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
}

function applyTemplate(date, t) {
  const w = workoutFor(date)
  for (const id of t.exerciseIds) {
    const ex = exercise(id)
    if (ex && !ex.archived && !w.items.some((it) => it.exerciseId === id)) w.items.push({ exerciseId: id, sets: [] })
  }
  saveWorkout(w)
  render()
}

function itemCard(date, i) {
  const it = workoutFor(date).items[i]
  const ex = exercise(it.exerciseId)
  const cardio = ex.kind === 'cardio'
  const last = lastBefore(ex.id, date)
  const rec = records(ex.id, date)

  // Önceki günlerin rekorunu geçen ilk set (ilk kez yapılan harekette rekor gösterilmez).
  let prIndex = -1
  if (!cardio && rec.sessions) {
    let best = rec.weight
    it.sets.forEach((s, j) => {
      if (!s.warmup && (s.weight || 0) > best) [best, prIndex] = [s.weight, j]
    })
  }

  const [colA, colB] = cardio ? ['dk', 'km'] : ['kg', 'tekrar']
  const keyA = cardio ? 'minutes' : 'weight'
  const keyB = cardio ? 'km' : 'reps'

  const grid = 'grid grid-cols-[2rem_1fr_1fr_2.75rem] items-center gap-2'
  const boxClass = 'w-full rounded-lg bg-zinc-800 px-2 py-2 text-center text-base outline-none focus:ring-2 focus:ring-emerald-500'

  // Girilmiş setler: kutular doğrudan düzenlenebilir. Set numarasına dokununca set
  // ısınma seti (I) olur ya da geri döner.
  let workNo = 0
  const rows = it.sets.map((s, j) =>
    h(
      'div',
      { class: grid },
      setNumber(s.warmup ? 'I' : j === prIndex ? '🏆' : ++workNo, s.warmup, () => toggleWarmup(date, i, j)),
      setInput(boxClass, s[keyA], 'decimal', (v) => editSet(date, i, j, keyA, v)),
      setInput(boxClass, s[keyB], cardio ? 'decimal' : 'numeric', (v) => editSet(date, i, j, keyB, v)),
      h(
        'button',
        { type: 'button', class: 'h-10 rounded-lg text-zinc-500 active:bg-zinc-800', onclick: () => removeSet(date, i, j), 'aria-label': 'Seti sil' },
        '✕',
      ),
    ),
  )

  // Yeni set satırı: bu antrenmandaki son setle, yoksa geçen seferin ilk setiyle dolu gelir.
  const prev = it.sets[it.sets.length - 1] || last?.sets[0] || {}
  let newWarmup = false
  const newNo = setNumber(workNo + 1, false, () => {
    newWarmup = !newWarmup
    styleSetNumber(newNo, newWarmup ? 'I' : workNo + 1, newWarmup)
  })
  const newA = h('input', { inputmode: 'decimal', value: field(prev[keyA]), placeholder: colA, class: `${boxClass} bg-zinc-950 ring-1 ring-zinc-700` })
  const newB = h('input', {
    inputmode: cardio ? 'decimal' : 'numeric',
    value: field(prev[keyB]),
    placeholder: colB,
    class: `${boxClass} bg-zinc-950 ring-1 ring-zinc-700`,
  })
  const addRow = h(
    'div',
    { class: grid },
    newNo,
    newA,
    newB,
    h(
      'button',
      {
        type: 'button',
        class: 'h-10 rounded-lg bg-emerald-600 text-xl font-bold text-white active:bg-emerald-700',
        onclick: () =>
          addSet(date, i, {
            [keyA]: parseNum(newA.value),
            [keyB]: keyB === 'reps' ? Math.round(parseNum(newB.value)) : parseNum(newB.value),
            ...(newWarmup ? { warmup: true } : {}),
          }),
        'aria-label': 'Set ekle',
      },
      '+',
    ),
  )

  const info = []
  if (last) info.push(h('p', {}, h('span', { class: 'text-zinc-500' }, `Geçen sefer (${shortDate(last.date)}): `), setsSummary(last.sets, cardio)))
  else info.push(h('p', { class: 'text-zinc-500' }, 'İlk kez yapılıyor'))
  if (!cardio && rec.weight) info.push(h('p', { class: 'text-zinc-500' }, `Rekor: ${num(rec.weight)} kg (${shortDate(rec.weightDate)})`))
  if (cardio && rec.km) info.push(h('p', { class: 'text-zinc-500' }, `En uzun: ${num(rec.km)} km`))

  return card(
    { id: `item-${i}` },
    h(
      'div',
      { class: 'flex items-start justify-between gap-2' },
      h(
        'button',
        { type: 'button', class: 'text-left', onclick: () => go(`#/ilerleme/${ex.id}`) },
        h('h3', { class: 'text-lg font-semibold leading-tight' }, ex.name),
        h('div', { class: 'mt-1' }, groupChip(ex.group)),
      ),
      h('button', { type: 'button', class: 'rounded-lg px-2 py-1 text-zinc-500 active:bg-zinc-800', onclick: () => removeItem(date, i) }, 'Çıkar'),
    ),
    h('div', { class: 'mt-2 space-y-0.5 text-sm text-zinc-300' }, info),
    it.note ? h('p', { class: 'mt-2 text-sm italic text-zinc-400' }, it.note) : null,
    h(
      'div',
      { class: 'mt-3 space-y-2' },
      h('div', { class: `${grid} text-center text-xs text-zinc-500` }, h('span', {}, 'Set'), h('span', {}, colA), h('span', {}, colB), h('span')),
      rows,
      addRow,
      !it.sets.length && !cardio ? h('p', { class: 'pt-1 text-xs text-zinc-500' }, 'İpucu: set numarasına dokunursan ısınma seti (I) olur; rekora ve grafiğe sayılmaz.') : null,
    ),
  )
}

function setNumber(label, warmup, onclick) {
  const btn = h('button', { type: 'button', onclick, 'aria-label': 'Isınma seti yap/geri al' })
  styleSetNumber(btn, label, warmup)
  return btn
}

function styleSetNumber(btn, label, warmup) {
  btn.textContent = label
  btn.className = `h-10 rounded-lg text-center text-sm ${warmup ? 'bg-amber-500/15 font-bold text-amber-300' : 'text-zinc-400 active:bg-zinc-800'}`
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

function setInput(cls, value, mode, onchange) {
  return h('input', {
    inputmode: mode,
    value: field(value),
    class: cls,
    onchange: (ev) => onchange(ev.target.value),
  })
}

// Kutudaki değer değişince kaydeder; ekran yeniden çizilmez (klavye kapanmasın diye).
function editSet(date, i, j, key, raw) {
  const w = workoutFor(date)
  const s = w.items[i]?.sets[j]
  if (!s) return
  s[key] = key === 'reps' ? Math.round(parseNum(raw)) : parseNum(raw)
  saveWorkout(w)
  const summary = document.getElementById('day-summary')
  if (summary) summary.textContent = summaryText(w)
}

function addSet(date, i, set) {
  const w = workoutFor(date)
  const it = w.items[i]
  const ex = exercise(it.exerciseId)
  if (ex.kind === 'cardio' ? !set.minutes && !set.km : !set.reps) {
    return show(ex.kind === 'cardio' ? 'Süre ya da mesafe girin.' : 'Tekrar sayısını girin.', false)
  }
  const rec = records(ex.id, date)
  const bestToday = Math.max(0, ...it.sets.filter((s) => !s.warmup).map((s) => s.weight || 0))
  it.sets.push(set)
  saveWorkout(w)
  render()
  if (ex.kind === 'weight' && !set.warmup && rec.sessions && set.weight > rec.weight && set.weight > bestToday) {
    show(`🏆 Yeni rekor! ${ex.name}: ${num(set.weight)} kg`)
  }
  if (date === today()) startRest(state.data.settings.restSeconds)
}

function removeSet(date, i, j) {
  const w = workoutFor(date)
  w.items[i].sets.splice(j, 1)
  saveWorkout(w)
  render()
}

function removeItem(date, i) {
  const w = workoutFor(date)
  const it = w.items[i]
  if (it.sets.length && !confirm(`"${exercise(it.exerciseId).name}" ve ${it.sets.length} seti bu antrenmandan çıkarılsın mı?`)) return
  w.items.splice(i, 1)
  saveWorkout(w)
  render()
}
