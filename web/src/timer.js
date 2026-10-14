// Setler arası dinlenme sayacı. Ekranın altında, menünün üstünde görünür.
import { h, duration } from './util.js'
import { android } from './ui.js'

let end = 0
let total = 0
let tick = null
let doneTimeout = null
let audio = null

const bar = () => document.getElementById('timer')

export function startRest(seconds) {
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
  clearTimeout(doneTimeout)
  clearInterval(tick)
  tick = setInterval(update, 250)
  android()?.keepScreenOn?.(true)
  update()
}

export function stopRest() {
  clearInterval(tick)
  clearTimeout(doneTimeout)
  tick = null
  android()?.keepScreenOn?.(false)
  bar().replaceChildren()
}

function adjust(sec) {
  end += sec * 1000
  total = Math.max(total + sec, 1)
  update()
}

function update() {
  const left = Math.ceil((end - Date.now()) / 1000)
  if (left <= 0) return finish()
  const pct = Math.min(100, Math.max(0, (left / total) * 100))
  bar().replaceChildren(
    h(
      'div',
      { class: 'mx-auto max-w-md px-3 pb-2' },
      h(
        'div',
        { class: 'relative overflow-hidden rounded-2xl bg-zinc-800 shadow-lg' },
        h('div', { class: 'absolute inset-y-0 left-0 bg-emerald-700/40', style: `width:${pct}%` }),
        h(
          'div',
          { class: 'relative flex items-center gap-2 px-3 py-2' },
          h('span', { class: 'text-sm text-zinc-300' }, 'Dinlenme'),
          h('span', { class: 'flex-1 text-xl font-bold tabular-nums' }, duration(left)),
          small('−15', () => adjust(-15)),
          small('+15', () => adjust(15)),
          small('Bitir', stopRest),
        ),
      ),
    ),
  )
}

const small = (text, onclick) =>
  h('button', { type: 'button', class: 'rounded-lg bg-zinc-700 px-3 py-1.5 text-sm active:bg-zinc-600', onclick }, text)

function finish() {
  clearInterval(tick)
  tick = null
  android()?.keepScreenOn?.(false)
  if (android()?.vibrate) android().vibrate(600)
  else navigator.vibrate?.([300, 100, 300])
  beep()
  bar().replaceChildren(
    h(
      'div',
      { class: 'mx-auto max-w-md px-3 pb-2' },
      h(
        'button',
        { type: 'button', class: 'w-full rounded-2xl bg-emerald-600 px-4 py-3 text-center font-semibold shadow-lg', onclick: stopRest },
        'Dinlenme bitti, sıradaki sete!',
      ),
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
// (süre, bitiş zamanından hesaplanır).
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && tick) update()
})
