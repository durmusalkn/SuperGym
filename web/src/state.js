// Uygulamanın verisi ve Go sunucusuyla konuşma.

// Go sunucusunun her açılışta ürettiği anahtar, sayfa adresinde (?t=...) gelir.
const token = new URLSearchParams(location.search).get('t') || ''

export const state = {
  data: null, // sunucudaki verilerin tamamı (core.Data)
}

export async function api(path, options = {}) {
  const res = await fetch(path, {
    ...options,
    headers: { ...options.headers, 'X-SuperGym-Token': token },
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body.error || 'Bir hata oluştu')
  return body
}

// Değişiklikler sırayla gönderilir (art arda yapılan düzenlemeler karışmasın diye).
// Her değişiklik güncel verileri döner; yalnızca sıradaki son cevap ekrandaki veriyi
// değiştirir, böylece henüz gönderilmemiş yerel değişiklikler ezilmez.
let queue = Promise.resolve()
let pending = 0
let onError = () => {}

export function setErrorHandler(fn) {
  onError = fn
}

export function mutate(method, path, body) {
  pending++
  const run = queue.then(() =>
    api(path, {
      method,
      headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
    }),
  )
  queue = run.catch(() => {})
  return run.then(
    (data) => {
      if (--pending === 0) state.data = data
      return data
    },
    (err) => {
      pending--
      onError(err)
      throw err
    },
  )
}

export async function reload() {
  state.data = await api('/api/data')
}

// --- Veriden türetilen bilgiler ---

export const exercise = (id) => state.data.exercises.find((e) => e.id === id)
export const activeExercises = () => state.data.exercises.filter((e) => !e.archived)
export const findWorkout = (date) => state.data.workouts.find((w) => w.date === date)

// O günün antrenmanı; yoksa boş bir tane (henüz kaydedilmemiş).
export function workoutFor(date) {
  return findWorkout(date) || { date, items: [], note: '' }
}

// Antrenmanı yerelde günceller ve sunucuya gönderir. Hareketi kalmayan gün silinir.
export function saveWorkout(w) {
  const list = state.data.workouts.filter((x) => x.date !== w.date)
  if (w.items.length || w.note) {
    list.push(w)
    list.sort((a, b) => a.date.localeCompare(b.date))
  }
  state.data.workouts = list
  return mutate('PUT', `/api/workouts/${w.date}`, { items: w.items, note: w.note || '' })
}

export const hasSets = (w) => w.items.some((it) => it.sets.length > 0)

// Antrenmana gidilen günler (en az bir set girilmiş).
export const attendedDates = () => new Set(state.data.workouts.filter(hasSets).map((w) => w.date))

// Bir hareketin geçmişi: [{ date, sets }] (eskiden yeniye, seti olan günler).
export function history(exId) {
  const out = []
  for (const w of state.data.workouts) {
    for (const it of w.items) {
      if (it.exerciseId === exId && it.sets.length) out.push({ date: w.date, sets: it.sets, note: it.note })
    }
  }
  return out
}

// O tarihten önceki son yapılış.
export function lastBefore(exId, date) {
  const h = history(exId).filter((x) => x.date < date)
  return h[h.length - 1] || null
}

// Tahmini tek tekrar maksimumu (Epley).
export const oneRM = (s) => (s.reps > 1 ? s.weight * (1 + s.reps / 30) : s.weight)
export const volume = (sets) => sets.reduce((sum, s) => sum + (s.reps || 0) * (s.weight || 0), 0)

// Rekorlar; exceptDate verilirse o gün hesaba katılmaz.
export function records(exId, exceptDate) {
  const r = { weight: 0, weightDate: null, oneRM: 0, km: 0, kmDate: null, minutes: 0, sessions: 0 }
  for (const { date, sets } of history(exId)) {
    if (date === exceptDate) continue
    r.sessions++
    for (const s of sets) {
      if ((s.weight || 0) > r.weight) [r.weight, r.weightDate] = [s.weight, date]
      r.oneRM = Math.max(r.oneRM, oneRM(s))
      if ((s.km || 0) > r.km) [r.km, r.kmDate] = [s.km, date]
      r.minutes = Math.max(r.minutes, s.minutes || 0)
    }
  }
  return r
}
