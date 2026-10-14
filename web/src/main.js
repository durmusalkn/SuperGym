import './style.css'

const $ = (sel) => document.querySelector(sel)
const form = $('#form')
const list = $('#list')
const pad = (n) => String(n).padStart(2, '0')
// Telefonun saatine göre bugünün tarihi (toISOString UTC verdiği için gece yarısından
// sonra bir gün geride kalıyordu).
const today = () => {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

// Go sunucusunun her açılışta ürettiği anahtar, sayfa adresinde (?t=...) gelir.
const token = new URLSearchParams(location.search).get('t') || ''

async function api(path, options = {}) {
  const res = await fetch(path, {
    ...options,
    headers: { ...options.headers, 'X-SuperGym-Token': token },
  })
  if (res.status === 204) return null
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body.error || 'Bir hata oluştu')
  return body
}

let messageTimer
function show(text, ok = true, sticky = false) {
  const el = $('#message')
  el.textContent = text
  el.className = `mt-3 rounded-lg px-3 py-2 text-sm ${ok ? 'bg-emerald-900 text-emerald-100' : 'bg-red-900 text-red-100'}`
  clearTimeout(messageTimer)
  if (!sticky) messageTimer = setTimeout(() => el.classList.add('hidden'), 3000)
}

function render(entries) {
  list.replaceChildren()
  if (!entries.length) {
    const li = document.createElement('li')
    li.className = 'text-center text-zinc-500'
    li.textContent = 'Henüz kayıt yok.'
    list.append(li)
    return
  }
  entries
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date))
    .forEach((e) => {
      const li = document.createElement('li')
      li.className = 'flex items-center justify-between rounded-xl bg-zinc-900 px-4 py-3'
      const info = document.createElement('div')
      const title = document.createElement('p')
      title.className = 'font-medium'
      title.textContent = e.exercise
      const detail = document.createElement('p')
      detail.className = 'text-sm text-zinc-400'
      detail.textContent = `${e.date} · ${e.sets} x ${e.reps} · ${e.weight} kg`
      info.append(title, detail)
      const del = document.createElement('button')
      del.className = 'text-sm text-red-400'
      del.textContent = 'Sil'
      del.onclick = async () => {
        if (!confirm(`"${e.exercise}" silinsin mi?`)) return
        try {
          await api(`/api/entries/${e.id}`, { method: 'DELETE' })
          await load()
        } catch (err) {
          show(err.message, false)
        }
      }
      li.append(info, del)
      list.append(li)
    })
}

async function load() {
  render(await api('/api/entries'))
}

form.date.value = today()
form.onsubmit = async (ev) => {
  ev.preventDefault()
  const f = new FormData(form)
  try {
    await api('/api/entries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        exercise: f.get('exercise').trim(),
        sets: Number(f.get('sets')) || 0,
        reps: Number(f.get('reps')) || 0,
        weight: Number(f.get('weight')) || 0,
        date: f.get('date') || today(),
      }),
    })
    form.reset()
    form.date.value = today()
    await load()
  } catch (err) {
    show(err.message, false)
  }
}

// Dışa aktar: Android'de dosya kaydetme ekranını açar, tarayıcıda dosyayı indirir.
$('#export').onclick = async () => {
  const name = `supergym-yedek-${today()}.json`
  try {
    const data = await api('/api/export')
    const text = JSON.stringify(data, null, 2)
    if (window.SuperGymAndroid) {
      window.SuperGymAndroid.exportFile(name, text)
    } else {
      const a = document.createElement('a')
      a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
      a.download = name
      a.click()
      setTimeout(() => URL.revokeObjectURL(a.href), 1000)
    }
  } catch (err) {
    show(err.message, false)
  }
}

// Android uygulaması kaydetme bitince bunu çağırır.
window.onExportDone = (ok) => show(ok ? 'Yedek kaydedildi.' : 'Yedek kaydedilemedi.', ok)

$('#import').onclick = () => $('#import-file').click()
$('#import-file').onchange = async (ev) => {
  const file = ev.target.files[0]
  ev.target.value = ''
  if (!file) return
  if (!confirm('İçe aktarılan yedek mevcut kayıtların yerine geçecek. Devam edilsin mi?')) return
  try {
    const res = await api('/api/import', { method: 'POST', body: await file.text() })
    show(`${res.imported} kayıt içe aktarıldı.`)
    await load()
  } catch (err) {
    show(err.message, false)
  }
}

async function start() {
  const { warning } = await api('/api/status')
  if (warning) show(warning, false, true)
  await load()
}

start().catch((err) => show(err.message, false, true))
