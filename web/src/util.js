// DOM oluşturma yardımcısı: h('div', { class: '...', onclick }, ...çocuklar)
export function h(tag, props, ...children) {
  const el = document.createElement(tag)
  setProps(el, props)
  append(el, children)
  return el
}

// SVG öğeleri için aynısı.
export function svg(tag, props, ...children) {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag)
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v)
    else el.setAttribute(k, v)
  }
  append(el, children)
  return el
}

function setProps(el, props) {
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v)
    else if (k === 'class') el.className = v
    else if (k === 'value' || k === 'checked' || k === 'selected' || k === 'disabled') el[k] = v
    else el.setAttribute(k, v === true ? '' : v)
  }
}

function append(el, children) {
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue
    el.append(c instanceof Node ? c : String(c))
  }
}

// --- Tarihler (hepsi telefonun saatine göre, YYYY-AA-GG) ---

const pad = (n) => String(n).padStart(2, '0')
export const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
export const parseDate = (s) => {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}
export const today = () => ymd(new Date())
export const addDays = (s, n) => {
  const d = parseDate(s)
  d.setDate(d.getDate() + n)
  return ymd(d)
}
// Haftanın pazartesisi.
export const weekStart = (s) => {
  const d = parseDate(s)
  return addDays(s, -((d.getDay() + 6) % 7))
}
export const isValidDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s || '') && ymd(parseDate(s)) === s

export const MONTHS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık']
export const WEEKDAYS = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi']
export const WEEKDAYS_SHORT = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt']

// "14 Ekim Salı"
export const longDate = (s) => {
  const d = parseDate(s)
  const year = d.getFullYear() !== new Date().getFullYear() ? ` ${d.getFullYear()}` : ''
  return `${d.getDate()} ${MONTHS[d.getMonth()]}${year} ${WEEKDAYS[d.getDay()]}`
}
// "14 Eki"
export const shortDate = (s) => {
  const d = parseDate(s)
  const year = d.getFullYear() !== new Date().getFullYear() ? ` ${String(d.getFullYear()).slice(2)}` : ''
  return `${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)}${year}`
}
export const relativeDay = (s) => {
  const t = today()
  if (s === t) return 'Bugün'
  if (s === addDays(t, -1)) return 'Dün'
  if (s === addDays(t, 1)) return 'Yarın'
  return null
}

// --- Sayılar ---

export const num = (n) => (Number(n) || 0).toLocaleString('tr-TR', { maximumFractionDigits: 2 })

// Kullanıcının yazdığı sayı ("62,5" de olabilir). Boşsa 0.
export function parseNum(v) {
  const n = Number(String(v ?? '').trim().replace(',', '.'))
  return Number.isFinite(n) && n > 0 ? n : 0
}

// "1 sa 12 dk"
export const hoursMinutes = (min) => (min >= 60 ? `${Math.floor(min / 60)} sa${min % 60 ? ` ${min % 60} dk` : ''}` : `${min} dk`)
// Zaman damgasından telefonun saatine göre "18:05"
export const clock = (iso) => {
  const d = new Date(iso)
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export const duration = (sec) => `${Math.floor(sec / 60)}:${pad(Math.max(0, sec % 60))}`

// --- Kas grupları ---

export const GROUPS = ['Göğüs', 'Sırt', 'Bacak', 'Omuz', 'Kol', 'Karın', 'Kardiyo', 'Diğer']

// Tailwind sınıfları tam yazılmalı (derleyici kaynak koddaki sınıf adlarını arar).
export const GROUP_COLORS = {
  Göğüs: { dot: 'bg-rose-500', chip: 'bg-rose-500/15 text-rose-300', hex: '#f43f5e' },
  Sırt: { dot: 'bg-sky-500', chip: 'bg-sky-500/15 text-sky-300', hex: '#0ea5e9' },
  Bacak: { dot: 'bg-amber-500', chip: 'bg-amber-500/15 text-amber-300', hex: '#f59e0b' },
  Omuz: { dot: 'bg-violet-500', chip: 'bg-violet-500/15 text-violet-300', hex: '#8b5cf6' },
  Kol: { dot: 'bg-pink-400', chip: 'bg-pink-400/15 text-pink-300', hex: '#f472b6' },
  Karın: { dot: 'bg-teal-400', chip: 'bg-teal-400/15 text-teal-300', hex: '#2dd4bf' },
  Kardiyo: { dot: 'bg-lime-400', chip: 'bg-lime-400/15 text-lime-300', hex: '#a3e635' },
  Diğer: { dot: 'bg-zinc-400', chip: 'bg-zinc-400/15 text-zinc-300', hex: '#a1a1aa' },
}
export const groupColor = (g) => GROUP_COLORS[g] || GROUP_COLORS.Diğer
