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

// Her grubun hedef kasları (core.Muscles ile aynı).
export const MUSCLES = {
  Göğüs: ['Göğüs', 'Üst göğüs', 'Alt göğüs'],
  Sırt: ['Kanat', 'Orta sırt', 'Trapez', 'Bel'],
  Bacak: ['Ön bacak', 'Arka bacak', 'Kalça', 'Baldır', 'İç bacak'],
  Omuz: ['Ön omuz', 'Yan omuz', 'Arka omuz'],
  Kol: ['Biceps', 'Triceps', 'Ön kol'],
  Karın: ['Karın', 'Alt karın', 'Yan karın', 'Core'],
  Kardiyo: [],
  Diğer: [],
}

// Kas grubu renkleri (Ritim paleti).
export const GROUP_COLORS = {
  Göğüs: { hex: '#ff8a6b' },
  Sırt: { hex: '#b79cff' },
  Bacak: { hex: '#ffc15e' },
  Omuz: { hex: '#74e3c8' },
  Kol: { hex: '#f59bc2' },
  Karın: { hex: '#8fb8ff' },
  Kardiyo: { hex: '#c9e87a' },
  Diğer: { hex: '#a39db8' },
}
export const groupColor = (g) => GROUP_COLORS[g] || GROUP_COLORS.Diğer
