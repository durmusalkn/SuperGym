// Hareketler sekmesi: hareket listesi, arşiv, programlar, ayarlar ve yedek.
import { h, today, num, GROUPS } from '../util.js'
import { state, api, mutate, exercise, records } from '../state.js'
import { render, show, card, button, select, sectionTitle, groupDot, android } from '../ui.js'
import { editExercise, editTemplate } from '../sheets.js'

export function exercisesView() {
  const active = state.data.exercises.filter((e) => !e.archived)
  const archived = state.data.exercises.filter((e) => e.archived)

  return h(
    'div',
    { class: 'space-y-2' },
    h(
      'div',
      { class: 'flex items-center justify-between' },
      h('h1', { class: 'text-xl font-bold' }, 'Hareketler'),
      button('+ Yeni', () => editExercise(null), 'primary', 'py-2 text-sm'),
    ),
    GROUPS.map((g) => {
      const list = active.filter((e) => e.group === g).sort((a, b) => a.name.localeCompare(b.name, 'tr'))
      if (!list.length) return null
      return [
        h('h2', { class: 'flex items-center gap-2 px-1 pt-4 text-xs font-semibold uppercase tracking-wide text-zinc-400' }, groupDot(g), g),
        h('div', { class: 'divide-y divide-zinc-800 overflow-hidden rounded-2xl bg-zinc-900' }, list.map(row)),
      ]
    }),
    archived.length
      ? h(
          'details',
          { class: 'pt-4' },
          h('summary', { class: 'px-1 text-sm text-zinc-400' }, `Arşiv (${archived.length})`),
          h(
            'div',
            { class: 'mt-2 divide-y divide-zinc-800 overflow-hidden rounded-2xl bg-zinc-900' },
            archived.map((e) =>
              h(
                'div',
                { class: 'flex items-center justify-between px-4 py-3' },
                h('span', { class: 'text-zinc-400' }, e.name),
                button('Geri al', () => restore(e), 'secondary', 'py-1.5 text-sm'),
              ),
            ),
          ),
        )
      : null,
    templatesSection(),
    settingsSection(),
    backupSection(),
  )
}

function row(e) {
  const rec = records(e.id)
  const right = e.kind === 'cardio' ? (rec.km ? `${num(rec.km)} km` : 'kardiyo') : rec.weight ? `${num(rec.weight)} kg` : ''
  return h(
    'button',
    { type: 'button', class: 'flex w-full items-center justify-between px-4 py-3 text-left active:bg-zinc-800', onclick: () => editExercise(e) },
    h('span', {}, e.name),
    h('span', { class: 'text-sm text-zinc-500' }, right),
  )
}

async function restore(e) {
  try {
    await mutate('PUT', `/api/exercises/${e.id}`, { ...e, archived: false })
    show(`"${e.name}" geri alındı.`)
    render()
  } catch {
    // mutate hatayı gösterdi
  }
}

function templatesSection() {
  const list = state.data.templates
  return [
    sectionTitle('Programlar', button('+ Yeni', () => editTemplate(null), 'ghost', 'py-0 text-sm text-emerald-400')),
    list.length
      ? h(
          'div',
          { class: 'divide-y divide-zinc-800 overflow-hidden rounded-2xl bg-zinc-900' },
          list.map((t) =>
            h(
              'button',
              { type: 'button', class: 'block w-full px-4 py-3 text-left active:bg-zinc-800', onclick: () => editTemplate(t) },
              h('p', {}, t.name),
              h(
                'p',
                { class: 'truncate text-xs text-zinc-500' },
                t.exerciseIds
                  .map((id) => exercise(id)?.name)
                  .filter(Boolean)
                  .join(', ') || 'Hareket yok',
              ),
            ),
          ),
        )
      : card({}, h('p', { class: 'text-sm text-zinc-400' }, 'Sık yaptığın antrenmanları (örn. Push / Pull / Bacak) program olarak kaydet; antrenman ekranında tek dokunuşla tüm hareketler eklensin.')),
  ]
}

export async function saveSettings(change) {
  try {
    await mutate('PUT', '/api/settings', { ...state.data.settings, ...change })
    show('Kaydedildi.')
  } catch {
    // mutate hatayı gösterdi
  }
}

function settingsSection() {
  const options = [
    [0, 'Kapalı'],
    ...[30, 45, 60, 90, 120, 150, 180, 240, 300].map((s) => [s, s < 60 ? `${s} sn` : `${Math.floor(s / 60)} dk${s % 60 ? ` ${s % 60} sn` : ''}`]),
  ]
  return [
    sectionTitle('Ayarlar'),
    card(
      {},
      h(
        'div',
        { class: 'space-y-1' },
        h('span', { class: 'text-sm' }, 'Setler arası dinlenme sayacı'),
        select(
          {
            value: state.data.settings.restSeconds,
            onchange: (ev) => saveSettings({ restSeconds: Number(ev.target.value) }),
          },
          options,
        ),
        h('p', { class: 'text-xs text-zinc-500' }, 'Bugünün antrenmanına set eklediğinde başlar, bitince titreşir.'),
      ),
      h(
        'label',
        { class: 'mt-4 flex items-start gap-3' },
        h('input', {
          type: 'checkbox',
          class: 'mt-0.5 h-5 w-5 accent-emerald-500',
          checked: !!state.data.settings.showRpe,
          onchange: (ev) => saveSettings({ showRpe: ev.target.checked }),
        }),
        h(
          'span',
          {},
          h('span', { class: 'block text-sm' }, 'Setlerde zorluk (RPE) kutusu'),
          h('span', { class: 'block text-xs text-zinc-500' }, '1 = çok kolay, 10 = bir tekrar daha yapamazdın. İsteğe bağlı; boş bırakılabilir.'),
        ),
      ),
    ),
  ]
}

function backupSection() {
  return [
    sectionTitle('Yedek'),
    card(
      {},
      h('p', { class: 'mb-3 text-sm text-zinc-400' }, 'Veriler yalnızca bu telefonda durur. Uygulamayı silmeden ya da telefon değiştirmeden önce dışa aktararak yedek al.'),
      h('div', { class: 'grid grid-cols-2 gap-2' }, button('Dışa aktar', exportData, 'secondary'), button('İçe aktar', () => document.getElementById('import-file').click(), 'secondary')),
    ),
  ]
}

// Dışa aktar: Android'de dosya kaydetme ekranını açar, tarayıcıda dosyayı indirir.
async function exportData() {
  const name = `supergym-yedek-${today()}.json`
  try {
    const data = await api('/api/export')
    const text = JSON.stringify(data, null, 2)
    if (android()) {
      android().exportFile(name, text)
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

export async function importData(file) {
  if (!confirm('İçe aktarılan yedek mevcut verilerin yerine geçecek. Devam edilsin mi?')) return
  try {
    const data = await mutate('POST', '/api/import', await file.text())
    show(`Yedek yüklendi: ${data.workouts.length} antrenman, ${data.exercises.length} hareket.`)
    render()
  } catch {
    // mutate hatayı gösterdi
  }
}
