// Ortak arayüz parçaları: mesaj kutusu, alttan açılan paneller, sayfa geçişleri.
import { h, groupColor, svg } from './util.js'

// --- Mesaj ---

let messageTimer
export function show(text, ok = true, sticky = false) {
  const el = document.getElementById('message')
  el.replaceChildren(
    h(
      'div',
      {
        class: `pointer-events-auto mx-auto max-w-md rounded-3xl px-5 py-3 text-sm font-medium shadow-lg shadow-black/40 ${ok ? 'bg-text text-ink' : 'bg-[#5c1f2a] text-[#ffd9de]'}`,
        onclick: () => el.replaceChildren(),
      },
      text,
    ),
  )
  clearTimeout(messageTimer)
  if (!sticky) messageTimer = setTimeout(() => el.replaceChildren(), ok ? 2500 : 5000)
}

// --- Sayfalar: #/sekme/değer ---

export function route() {
  const [tab, arg = ''] = location.hash.replace(/^#\/?/, '').split('/')
  return { tab: tab || 'antrenman', arg: decodeURIComponent(arg) }
}

let renderFn = () => {}
export const setRender = (fn) => (renderFn = fn)
export const render = () => renderFn()

// replace: geri tuşuyla dönülecek bir adım eklemeden (örn. gün değiştirirken).
export function go(hash, replace = false) {
  if (replace) {
    history.replaceState(history.state, '', hash)
    render()
  } else if (location.hash === hash) {
    render()
  } else {
    location.hash = hash
  }
}

// --- Alttan açılan panel ---
// Panel açılınca geçmişe bir adım eklenir; telefonun geri tuşu paneli kapatır.

let afterClose = null
let onSheetClose = null
// onClose: panel nasıl kapanırsa kapansın (X, geri tuşu) sonra çalışır.
export function openSheet(title, body, onClose = null) {
  onSheetClose = onClose
  const el = document.getElementById('sheet')
  el.replaceChildren(
    h(
      'div',
      { class: 'mx-auto flex h-full max-w-md flex-col' },
      h(
        'div',
        { class: 'flex items-center justify-between px-5 pb-2 pt-4' },
        h('h2', { class: 'text-xl font-semibold' }, title),
        h(
          'button',
          { type: 'button', class: 'flex h-11 w-11 items-center justify-center rounded-full border border-line', onclick: () => closeSheet(), 'aria-label': 'Kapat' },
          icon('x', 18),
        ),
      ),
      h('div', { class: 'flex-1 overflow-y-auto px-5 pb-8 pt-2' }, body),
    ),
  )
  el.classList.remove('hidden')
  document.body.classList.add('overflow-hidden')
  if (!history.state?.sheet) history.pushState({ sheet: true }, '')
}

// then: panel kapandıktan sonra yapılacak iş (örn. başka sayfaya geçmek).
export function closeSheet(then) {
  afterClose = then || null
  if (history.state?.sheet) history.back()
  else hideSheet()
}

function hideSheet() {
  document.getElementById('sheet').classList.add('hidden')
  document.getElementById('sheet').replaceChildren()
  document.body.classList.remove('overflow-hidden')
  const fn = afterClose || onSheetClose
  afterClose = null
  onSheetClose = null
  if (fn) fn()
}

window.addEventListener('popstate', () => {
  if (!document.getElementById('sheet').classList.contains('hidden')) hideSheet()
})

// --- Küçük parçalar ---

export const groupChip = (group) => {
  const c = groupColor(group).hex
  return h('span', { class: 'inline-block rounded-full px-2.5 py-0.5 text-[11px] font-medium', style: `background:${c}26;color:${c}` }, group)
}

export const groupDot = (group, size = 8) =>
  h('span', { class: 'inline-block shrink-0 rounded-full', style: `width:${size}px;height:${size}px;background:${groupColor(group).hex}` })

export const card = (props, ...children) =>
  h('section', { ...props, class: `rounded-[28px] bg-surface p-5 ${props?.class || ''}` }, ...children)

export const button = (text, onclick, kind = 'primary', extra = '') => {
  const styles = {
    primary: 'bg-coral text-ink font-semibold active:opacity-80',
    secondary: 'bg-line text-text active:opacity-80',
    outline: 'border border-line text-text active:bg-surface',
    danger: 'bg-[#3a1d27] text-[#ffb3be] active:opacity-80',
    ghost: 'text-muted active:text-text',
  }
  return h('button', { type: 'button', class: `rounded-full px-5 py-3 ${styles[kind]} ${extra}`, onclick }, text)
}

export const input = (props) =>
  h('input', {
    ...props,
    class: `w-full rounded-2xl bg-line/60 px-4 py-3 text-text outline-none placeholder:text-zinc-500 focus:ring-2 focus:ring-coral ${props.class || ''}`,
  })

export const select = (props, options) =>
  h(
    'select',
    {
      ...props,
      class: `w-full rounded-2xl bg-line/60 px-4 py-3 text-text outline-none focus:ring-2 focus:ring-coral disabled:opacity-50 ${props.class || ''}`,
    },
    options.map(([value, label]) => h('option', { value, selected: String(value) === String(props.value) }, label)),
  )

export const sectionTitle = (text, extra) =>
  h('div', { class: 'mb-3 mt-8 flex items-center justify-between px-1' }, h('h2', { class: 'text-sm font-medium text-muted' }, text), extra)

export const empty = (text) => h('p', { class: 'py-6 text-center text-sm text-muted' }, text)

export const android = () => window.SuperGymAndroid

// Çizgi simgeler (24×24).
const ICONS = {
  x: 'M6 6l12 12M18 6L6 18',
  plus: 'M12 5v14M5 12h14',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  left: 'M15 5l-7 7 7 7',
  right: 'M9 5l7 7-7 7',
  up: 'M6 15l6-6 6 6',
  down: 'M6 9l6 6 6-6',
  link: 'M9 15l6-6M10.5 6.5l1-1a4 4 0 015.7 5.7l-1 1M13.5 17.5l-1 1a4 4 0 01-5.7-5.7l1-1',
  trash: 'M5 7h14M10 11v6M14 11v6M7 7l1 12h8l1-12M9 7V4h6v3',
  note: 'M6 4h9l3 3v13H6zM9 10h6M9 14h6',
  copy: 'M9 9h10v10H9zM5 15V5h10',
  bell: 'M6 16V11a6 6 0 0112 0v5l1.5 2h-15zM10 20.5a2 2 0 004 0',
}
export const icon = (name, size = 20, color = 'currentColor', width = 2) =>
  svg(
    'svg',
    { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: color, 'stroke-width': width, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true' },
    svg('path', { d: ICONS[name] }),
  )

// Yuvarlak simge düğmesi.
export const roundBtn = (name, onclick, label, extra = '') =>
  h(
    'button',
    { type: 'button', class: `flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-line text-text active:bg-surface ${extra}`, onclick, 'aria-label': label },
    icon(name, 18),
  )

// 5 yıldızlı puan. onchange verilirse dokunulabilir (aynı yıldıza tekrar dokunmak puanı
// siler); verilmezse yalnızca gösterir.
const STAR = 'M12 3.6l2.5 5.2 5.7.8-4.1 4 1 5.7-5.1-2.7-5.1 2.7 1-5.7-4.1-4 5.7-.8z'
export function stars(value, onchange, size = 22) {
  const wrap = h('span', { class: 'inline-flex shrink-0 items-center', role: onchange ? 'radiogroup' : 'img', 'aria-label': `${value || 0} / 5 puan` })
  const paint = (v) =>
    wrap.replaceChildren(
      ...[1, 2, 3, 4, 5].map((n) => {
        const star = svg(
          'svg',
          { width: size, height: size, viewBox: '0 0 24 24', 'aria-hidden': 'true' },
          svg('path', { d: STAR, fill: n <= v ? '#ffc15e' : 'none', stroke: n <= v ? '#ffc15e' : '#5b5378', 'stroke-width': 1.6, 'stroke-linejoin': 'round' }),
        )
        if (!onchange) return star
        return h(
          'button',
          {
            type: 'button',
            role: 'radio',
            'aria-checked': n === v ? 'true' : 'false',
            'aria-label': `${n} puan`,
            class: 'flex items-center justify-center p-1 active:scale-90',
            onclick: (ev) => {
              ev.stopPropagation()
              v = n === v ? 0 : n
              paint(v)
              onchange(v)
            },
          },
          star,
        )
      }),
    )
  paint(value || 0)
  return wrap
}
