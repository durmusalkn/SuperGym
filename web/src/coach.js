// Yapay zekâ antrenörü denemesi: aynı soruyu üç yolla sorar.
// 1) Gemini API (internet, ücretsiz katman; Go sunucusu sorar, bkz. core/ai.go)
// 2) Gemini Nano (telefonun içinde, internetsiz; Android köprüsü, bkz. Nano.java)
// 3) Gemini uygulaması (soru paylaşılır; cevap Gemini uygulamasında kalır)
import { h, today, addDays, num } from './util.js'
import { state, api, exercise, hasSets, workSets } from './state.js'
import { openSheet, card, button, input, sectionTitle, android, show } from './ui.js'
import { setsSummary } from './views/workout.js'

export const COACH_SYSTEM =
  'Sen SuperGym uygulamasındaki kişisel antrenörsün. Kısa, net ve Türkçe cevap ver. Emoji kullanma. ' +
  'Önerilerini kullanıcının kayıtlarına dayandır. Ağrı ya da sağlık riski görürsen doktora yönlendir.'

// Son 4 haftanın özeti ve soru. Yalnızca antrenman bilgisi gönderilir (ad, not yok).
export function coachPrompt() {
  const from = addDays(today(), -28)
  const lines = state.data.workouts
    .filter((w) => w.date >= from && hasSets(w))
    .map((w) => {
      const items = w.items
        .map((it) => {
          const ex = exercise(it.exerciseId)
          const sets = workSets(it.sets)
          return ex && sets.length ? `${ex.name} ${setsSummary(sets, ex.kind === 'cardio')}` : ''
        })
        .filter(Boolean)
      return `- ${w.date}: ${items.join('; ')}`
    })
  const bw = state.data.bodyWeights.at(-1)
  return [
    `Bugün ${today()}.`,
    lines.length ? `Son 4 haftadaki antrenmanlarım:\n${lines.join('\n')}` : 'Son 4 haftada antrenman kaydım yok.',
    bw ? `Vücut ağırlığım: ${num(bw.kg)} kg (${bw.date}).` : '',
    'Gidişatım nasıl, bu hafta neye dikkat etmeliyim? Kısa maddelerle cevap ver.',
  ]
    .filter(Boolean)
    .join('\n')
}

const resultBox = () => h('div', { class: 'mt-3 hidden whitespace-pre-wrap rounded-2xl bg-line/60 p-4 text-sm' })

function showResult(box, text, meta = '', ok = true) {
  box.classList.remove('hidden')
  box.replaceChildren(h('div', {}, h('p', { class: ok ? '' : 'text-[#ffb3be]' }, ok ? text : capitalize(text)), meta ? h('p', { class: 'mt-2 text-xs text-muted' }, meta) : null))
}

const capitalize = (s) => s.charAt(0).toLocaleUpperCase('tr') + s.slice(1)

const seconds = (ms) => `${num(Math.round(ms / 100) / 10)} sn`

// --- 1) Gemini API ---

function apiCard(question) {
  const status = h('p', { class: 'text-xs text-muted' }, 'Anahtar kontrol ediliyor…')
  const keyInput = input({ type: 'password', placeholder: 'AI Studio API anahtarı', autocomplete: 'off' })
  const box = resultBox()
  const refresh = (hasKey) => (status.textContent = hasKey ? 'Anahtar kayıtlı (yalnızca bu telefonda, yedeğe girmez).' : 'Anahtar yok. aistudio.google.com/apikey adresinden ücretsiz alınır.')
  api('/api/ai').then((r) => refresh(r.hasKey), () => (status.textContent = 'Durum alınamadı.'))

  const saveKey = async () => {
    try {
      const r = await api('/api/ai/key', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: keyInput.value }) })
      keyInput.value = ''
      refresh(r.hasKey)
      show(r.hasKey ? 'Anahtar kaydedildi.' : 'Anahtar silindi.')
    } catch (err) {
      show(err.message, false)
    }
  }
  const ask = async (ev) => {
    const btn = ev.currentTarget
    btn.disabled = true
    showResult(box, 'Soruluyor…')
    try {
      const r = await api('/api/ai/ask', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ system: COACH_SYSTEM, prompt: question.value }) })
      showResult(box, r.text, `${r.model} · ${seconds(r.ms)}`)
    } catch (err) {
      showResult(box, err.message, '', false)
    } finally {
      btn.disabled = false
    }
  }
  return card(
    {},
    h('h3', { class: 'font-semibold' }, '1. Gemini API'),
    h('p', { class: 'mb-3 mt-1 text-sm text-zinc-400' }, 'İnternet gerekir. Ücretsiz katman; Flash yoğunsa Flash-Lite cevap verir.'),
    status,
    h('div', { class: 'mt-3 flex gap-2' }, keyInput, button('Kaydet', saveKey, 'secondary', 'shrink-0')),
    button('Sor', ask, 'primary', 'mt-3 w-full disabled:opacity-50'),
    box,
  )
}

// --- 2) Gemini Nano ---

const NANO_STATUS = {
  available: 'Hazır.',
  downloadable: 'Model telefona indirilebilir.',
  downloading: 'Model iniyor…',
  unavailable: 'Bu telefonda kullanılamıyor.',
}

function nanoCard(question) {
  const nano = android()
  const status = h('p', { class: 'text-xs text-muted' }, nano?.nanoStatus ? 'Kontrol edilmedi.' : 'Yalnızca Android uygulamasında çalışır.')
  const box = resultBox()
  const download = button('Modeli indir', () => nano.nanoDownload(), 'secondary', 'mt-3 hidden w-full')
  let started = 0

  // Android sonuçları buraya gönderir (bkz. Nano.java).
  window.onNano = (m) => {
    if (m.type === 'status') {
      status.textContent = m.error ? `Hata: ${m.error}` : `${NANO_STATUS[m.status] || m.status}${m.model ? ` Model: ${m.model}` : ''}`
      download.classList.toggle('hidden', m.status !== 'downloadable')
    } else if (m.type === 'progress') {
      status.textContent = `Model iniyor… ${num(Math.round(m.bytes / 1e6))} MB`
    } else if (m.type === 'downloaded') {
      status.textContent = 'Model indi.'
      download.classList.add('hidden')
      nano.nanoStatus()
    } else if (m.type === 'answer') {
      showResult(box, m.text, `Gemini Nano · ${seconds(Date.now() - started)}`)
    } else if (m.type === 'error') {
      showResult(box, m.error, '', false)
    }
  }

  const ask = () => {
    started = Date.now()
    showResult(box, 'Soruluyor… (ilk soruda model hazırlanırken biraz sürebilir)')
    nano.nanoAsk(`${COACH_SYSTEM}\n\n${question.value}`)
  }
  return card(
    {},
    h('h3', { class: 'font-semibold' }, '2. Gemini Nano'),
    h('p', { class: 'mb-3 mt-1 text-sm text-zinc-400' }, 'Telefonun içinde çalışır; internet ve anahtar gerekmez. Yalnızca destekleyen telefonlarda.'),
    status,
    nano?.nanoStatus
      ? [
          h('div', { class: 'mt-3 grid grid-cols-2 gap-2' }, button('Durumu kontrol et', () => ((status.textContent = 'Kontrol ediliyor…'), nano.nanoStatus()), 'secondary'), button('Sor', ask)),
          download,
        ]
      : null,
    box,
  )
}

// --- 3) Gemini uygulaması ---

function shareCard(question) {
  const nano = android()
  return card(
    {},
    h('h3', { class: 'font-semibold' }, '3. Gemini uygulaması'),
    h('p', { class: 'mb-3 mt-1 text-sm text-zinc-400' }, 'Soru Gemini uygulamasına gönderilir; Gemini aboneliğinle cevaplanır. Cevap orada kalır.'),
    nano?.askGeminiApp
      ? button('Gemini\u2019ye gönder', () => nano.askGeminiApp(`${COACH_SYSTEM}\n\n${question.value}`), 'primary', 'w-full')
      : h('p', { class: 'text-xs text-muted' }, 'Yalnızca Android uygulamasında çalışır.'),
  )
}

export function openCoachTest() {
  const question = h('textarea', {
    rows: 8,
    class: 'w-full rounded-2xl bg-line/60 px-4 py-3 text-sm text-text outline-none focus:ring-2 focus:ring-coral',
  })
  question.value = coachPrompt()
  openSheet(
    'Antrenör denemesi',
    h(
      'div',
      { class: 'space-y-3' },
      h('p', { class: 'text-sm text-zinc-400' }, 'Aynı soru üç yolla sorulur. Gönderilen yalnızca aşağıdaki metindir; değiştirebilirsin.'),
      question,
      apiCard(question),
      nanoCard(question),
      shareCard(question),
    ),
    () => (window.onNano = null),
  )
}

export function coachSection() {
  return [
    sectionTitle('Yapay zekâ antrenörü'),
    card(
      {},
      h('p', { class: 'mb-3 text-sm text-zinc-400' }, 'Deneme: son 4 haftanın antrenmanlarını üç farklı yapay zekâya sorup cevapları karşılaştır.'),
      button('Denemeyi aç', openCoachTest, 'secondary', 'w-full'),
    ),
  ]
}
