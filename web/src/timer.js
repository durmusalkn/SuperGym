// Setler arası dinlenme. Tam ekran "nefes" görünümü: büyüyüp küçülen halkalar nefes
// ritmini (4 sn al, 6 sn ver) gösterir. Küçültülünce menünün üstünde küçük bir baloncuk olur.
// Android'de süre ayrıca telefonun alarmına kurulur: uygulama arka plandayken ya da ekran
// kilitliyken kalan süre bildirimde görünür, bitince telefon titrer ve ses çıkarır.
import { h, svg, duration } from './util.js'
import { android } from './ui.js'

let end = 0
let total = 0
let tick = null
let doneTimeout = null
let audio = null
let askedPermission = false
let expanded = true
let info = {}
let view = null // tam ekran görünümün güncellenen parçaları
let breathStart = 0

const overlay = () => document.getElementById('rest')
const mini = () => document.getElementById('timer')
const native = () => (android()?.startRest ? android() : null)
const RING = 300
const R = (RING - 6) / 2
const C = 2 * Math.PI * R

// info: { title, nextLabel, nextValue, after } — tam ekranda gösterilir.
export function startRest(seconds, restInfo = {}) {
  if (!seconds) return
  // Ses, kullanıcı bir düğmeye bastığı anda hazırlanmalı (tarayıcı kuralı).
  try {
    audio ||= new (window.AudioContext || window.webkitAudioContext)()
    audio.resume?.()
  } catch {
    audio = null
  }
  total = seconds
  end = Date.now() + seconds * 1000
  info = restInfo
  expanded = true
  if (native()) {
    if (!askedPermission) {
      askedPermission = true
      native().requestNotifications()
    }
    native().startRest(end)
  }
  clearTimeout(doneTimeout)
  clearInterval(tick)
  tick = setInterval(update, 250)
  android()?.keepScreenOn?.(true)
  build()
  update()
}

export function stopRest() {
  native()?.cancelRest()
  clearInterval(tick)
  clearTimeout(doneTimeout)
  tick = null
  android()?.keepScreenOn?.(false)
  hideOverlay()
  mini().replaceChildren()
}

function hideOverlay() {
  overlay().classList.add('hidden')
  overlay().replaceChildren()
  view = null
  // Tam ekran açılırken eklenen geçmiş adımı geri alınır.
  if (history.state?.rest) history.back()
}

function adjust(sec) {
  end += sec * 1000
  total = Math.max(total + sec, 1)
  if (end > Date.now()) native()?.startRest(end)
  update()
}

function setExpanded(on) {
  expanded = on
  if (on) build()
  else hideOverlay()
  if (tick) update()
}

const pillBtn = (text, onclick, extra = '') =>
  h('button', { type: 'button', class: `h-16 w-16 rounded-full font-sans text-base ${extra}`, onclick }, text)

// Tam ekran görünüm bir kez kurulur; her saniye yalnızca metin ve halka güncellenir
// (yeniden kurulursa nefes animasyonu baştan başlar).
function build() {
  if (!expanded) return
  breathStart = Date.now()
  const time = h('span', { class: 'text-7xl font-medium tracking-tight tabular-nums' })
  const breath = h('p', { class: 'text-3xl font-light tracking-wide' }, 'Nefes al')
  const arc = svg('circle', { cx: RING / 2, cy: RING / 2, r: R, fill: 'none', stroke: '#74e3c8', 'stroke-width': 4, 'stroke-linecap': 'round' })
  const circle = (size, opacity) =>
    h('div', { class: 'nefes absolute rounded-full bg-mint', style: `width:${size}px;height:${size}px;opacity:${opacity}` })

  view = { time, breath, arc }
  overlay().replaceChildren(
    h(
      'div',
      { class: 'mx-auto flex h-full max-w-md flex-col items-center bg-[#121a1f] px-5 pb-6 pt-4' },
      h(
        'div',
        { class: 'flex w-full items-center justify-between' },
        h('p', { class: 'text-sm text-[#9db5b8]' }, info.title || 'Dinlenme'),
        h(
          'button',
          { type: 'button', class: 'h-9 rounded-full border border-[#2b3b40] px-4 text-sm', onclick: () => setExpanded(false) },
          'Küçült',
        ),
      ),
      h('div', { class: 'mt-8 text-center' }, breath, h('p', { class: 'mt-1 text-sm text-[#9db5b8]' }, '4 saniye al · 6 saniye ver')),
      h(
        'div',
        { class: 'relative mt-6 flex items-center justify-center', style: `width:${RING}px;height:${RING}px` },
        circle(300, 0.08),
        circle(232, 0.12),
        circle(172, 0.18),
        svg(
          'svg',
          { width: RING, height: RING, viewBox: `0 0 ${RING} ${RING}`, class: 'absolute inset-0', style: 'transform: rotate(-90deg)', 'aria-hidden': 'true' },
          svg('circle', { cx: RING / 2, cy: RING / 2, r: R, fill: 'none', stroke: '#22323a', 'stroke-width': 4 }),
          arc,
        ),
        h('div', { class: 'relative flex flex-col items-center', role: 'timer', 'aria-live': 'off' }, time, h('span', { class: 'mt-1 text-sm text-[#9db5b8]' }, 'dinlenme')),
      ),
      h(
        'div',
        { class: 'mt-8 flex gap-3.5' },
        pillBtn('−15', () => adjust(-15), 'border border-[#2b3b40]'),
        pillBtn('+15', () => adjust(15), 'border border-[#2b3b40]'),
        pillBtn('Atla', stopRest, 'bg-mint font-semibold text-[#121a1f]'),
      ),
      h('div', { class: 'flex-1' }),
      info.nextValue
        ? h(
            'div',
            { class: 'flex w-full items-center gap-3.5 rounded-[26px] bg-[#1a262c] px-5 py-4' },
            h('div', { class: 'flex-1' }, h('p', { class: 'text-sm text-[#9db5b8]' }, info.nextLabel), h('p', { class: 'mt-0.5 text-xl font-semibold' }, info.nextValue)),
            info.after ? h('span', { class: 'text-sm text-[#9db5b8]' }, info.after) : null,
          )
        : null,
    ),
  )
  overlay().classList.remove('hidden')
  // Telefonun geri tuşu tam ekranı küçültsün diye geçmişe bir adım eklenir.
  if (!history.state?.rest) history.pushState({ rest: true }, '')
}

function update() {
  const left = Math.ceil((end - Date.now()) / 1000)
  if (left <= 0) return finish()
  const ratio = Math.min(1, Math.max(0, left / total))
  if (view) {
    view.time.textContent = duration(left)
    view.arc.setAttribute('stroke-dasharray', `${ratio * C} ${C}`)
    const t = ((Date.now() - breathStart) / 1000) % 10
    view.breath.textContent = t < 4 ? 'Nefes al' : 'Nefes ver'
    mini().replaceChildren()
  } else {
    // Küçük baloncuk: dokununca tam ekran açılır.
    const r = 13
    const c = 2 * Math.PI * r
    mini().replaceChildren(
      h(
        'button',
        { type: 'button', class: 'flex items-center gap-2.5 rounded-full bg-[#1a262c] py-2 pl-2 pr-4 shadow-lg shadow-black/40', onclick: () => setExpanded(true), 'aria-label': 'Dinlenmeyi aç' },
        svg(
          'svg',
          { width: 32, height: 32, viewBox: '0 0 32 32', style: 'transform: rotate(-90deg)', 'aria-hidden': 'true' },
          svg('circle', { cx: 16, cy: 16, r, fill: 'none', stroke: '#2b3b40', 'stroke-width': 4 }),
          svg('circle', { cx: 16, cy: 16, r, fill: 'none', stroke: '#74e3c8', 'stroke-width': 4, 'stroke-linecap': 'round', 'stroke-dasharray': `${ratio * c} ${c}` }),
        ),
        h('span', { class: 'text-lg font-medium tabular-nums' }, duration(left)),
        h('span', { class: 'text-sm text-[#9db5b8]' }, 'dinlenme'),
      ),
    )
  }
}

function finish() {
  clearInterval(tick)
  tick = null
  android()?.keepScreenOn?.(false)
  // Android'de titreşimi alarm yapar (iki kez titremesin diye burada yapılmaz).
  if (!native()) {
    navigator.vibrate?.([300, 100, 300])
    beep()
  }
  hideOverlay()
  mini().replaceChildren(
    h(
      'button',
      { type: 'button', class: 'rounded-full bg-mint px-6 py-3.5 font-semibold text-[#121a1f] shadow-lg shadow-black/40', onclick: stopRest },
      'Dinlenme bitti · sıradaki sete',
    ),
  )
  doneTimeout = setTimeout(stopRest, 6000)
}

function beep() {
  if (!audio) return
  try {
    for (const at of [0, 0.25, 0.5]) {
      const osc = audio.createOscillator()
      const gain = audio.createGain()
      osc.frequency.value = 880
      gain.gain.setValueAtTime(0.2, audio.currentTime + at)
      gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + at + 0.2)
      osc.connect(gain).connect(audio.destination)
      osc.start(audio.currentTime + at)
      osc.stop(audio.currentTime + at + 0.2)
    }
  } catch {
    // Ses çalınamazsa titreşim yeter.
  }
}

// Uygulama arka plandan dönünce sayaç kaldığı yerden doğru süreyle devam eder
// (süre, bitiş zamanından hesaplanır). Bildirimden "Bitir"e basıldıysa sayaç kapanır.
function resume() {
  if (!tick) return
  if (native() && end > Date.now() && !native().restEndsAt()) {
    stopRest()
    return
  }
  update()
}
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) resume()
})
window.onAppResume = resume

// Geri tuşu: tam ekran dinlenme açıksa küçültülür.
window.addEventListener('popstate', () => {
  if (!view) return
  expanded = false
  overlay().classList.add('hidden')
  overlay().replaceChildren()
  view = null
  if (tick) update()
})
