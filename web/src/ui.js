// Ortak arayüz parçaları: mesaj kutusu, alttan açılan paneller, sayfa geçişleri.
import { h, groupColor } from './util.js'

// --- Mesaj ---

let messageTimer
export function show(text, ok = true, sticky = false) {
  const el = document.getElementById('message')
  el.replaceChildren(
    h(
      'div',
      {
        class: `pointer-events-auto mx-auto max-w-md rounded-xl px-4 py-3 text-sm shadow-lg ${ok ? 'bg-emerald-700 text-white' : 'bg-red-800 text-red-50'}`,
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
export function openSheet(title, body) {
  const el = document.getElementById('sheet')
  el.replaceChildren(
    h(
      'div',
      { class: 'mx-auto flex h-full max-w-md flex-col' },
      h(
        'div',
        { class: 'flex items-center justify-between border-b border-zinc-800 px-4 py-3' },
        h('h2', { class: 'text-lg font-semibold' }, title),
        h('button', { class: 'rounded-lg px-3 py-1 text-2xl leading-none text-zinc-400', onclick: () => closeSheet() }, '×'),
      ),
      h('div', { class: 'flex-1 overflow-y-auto p-4' }, body),
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
  const fn = afterClose
  afterClose = null
  if (fn) fn()
}

window.addEventListener('popstate', () => {
  if (!document.getElementById('sheet').classList.contains('hidden')) hideSheet()
})

// --- Küçük parçalar ---

export const groupChip = (group) =>
  h('span', { class: `inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${groupColor(group).chip}` }, group)

export const groupDot = (group, size = 'h-2 w-2') => h('span', { class: `inline-block rounded-full ${size} ${groupColor(group).dot}` })

export const card = (props, ...children) =>
  h('section', { ...props, class: `rounded-2xl bg-zinc-900 p-4 ${props?.class || ''}` }, ...children)

export const button = (text, onclick, kind = 'primary', extra = '') => {
  const styles = {
    primary: 'bg-emerald-600 text-white active:bg-emerald-700 font-semibold',
    secondary: 'bg-zinc-800 text-zinc-100 active:bg-zinc-700',
    danger: 'bg-red-900/60 text-red-200 active:bg-red-900',
    ghost: 'text-zinc-400 active:text-zinc-200',
  }
  return h('button', { type: 'button', class: `rounded-xl px-4 py-2.5 ${styles[kind]} ${extra}`, onclick }, text)
}

export const input = (props) =>
  h('input', {
    ...props,
    class: `w-full rounded-xl bg-zinc-800 px-3 py-2.5 text-zinc-100 outline-none placeholder:text-zinc-500 focus:ring-2 focus:ring-emerald-500 ${props.class || ''}`,
  })

export const select = (props, options) =>
  h(
    'select',
    {
      ...props,
      class: `w-full rounded-xl bg-zinc-800 px-3 py-2.5 text-zinc-100 outline-none focus:ring-2 focus:ring-emerald-500 ${props.class || ''}`,
    },
    options.map(([value, label]) => h('option', { value, selected: String(value) === String(props.value) }, label)),
  )

export const sectionTitle = (text, extra) =>
  h('div', { class: 'mb-2 mt-6 flex items-center justify-between px-1' }, h('h2', { class: 'text-sm font-semibold uppercase tracking-wide text-zinc-400' }, text), extra)

export const empty = (text) => h('p', { class: 'py-6 text-center text-sm text-zinc-500' }, text)

export const android = () => window.SuperGymAndroid
