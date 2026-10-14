// Alttan açılan paneller: hareket seçme, hareket düzenleme, program düzenleme.
import { h, GROUPS, num, parseNum } from './util.js'
import { state, mutate, activeExercises, history, records } from './state.js'
import { openSheet, closeSheet, show, groupDot, button, input, select, go, render } from './ui.js'

const KINDS = [
  ['weight', 'Ağırlık (kg × tekrar)'],
  ['cardio', 'Kardiyo (süre, mesafe)'],
]

// Hareket listesini kas gruplarına göre gruplar.
function grouped(list) {
  return GROUPS.map((g) => [g, list.filter((e) => e.group === g).sort((a, b) => a.name.localeCompare(b.name, 'tr'))]).filter(
    ([, l]) => l.length,
  )
}

// Antrenmana eklenecek hareketi seçtirir. added: antrenmanda zaten olanların ID'leri.
export function pickExercise(onPick, added = new Set()) {
  const list = h('div', { class: 'space-y-4' })
  const search = input({ placeholder: 'Ara…', type: 'search', oninput: () => fill() })

  function fill() {
    const q = search.value.trim().toLocaleLowerCase('tr')
    const matches = activeExercises().filter((e) => e.name.toLocaleLowerCase('tr').includes(q))
    list.replaceChildren(
      ...grouped(matches).map(([g, exs]) =>
        h(
          'div',
          {},
          h('h3', { class: 'mb-1 flex items-center gap-2 px-1 text-xs font-semibold uppercase text-zinc-400' }, groupDot(g), g),
          h(
            'div',
            { class: 'divide-y divide-zinc-800 overflow-hidden rounded-xl bg-zinc-900' },
            exs.map((e) =>
              h(
                'button',
                {
                  type: 'button',
                  class: 'flex w-full items-center justify-between px-4 py-3 text-left active:bg-zinc-800',
                  onclick: () => closeSheet(() => onPick(e)),
                },
                h('span', {}, e.name),
                added.has(e.id) ? h('span', { class: 'text-xs text-emerald-400' }, '✓ ekli') : null,
              ),
            ),
          ),
        ),
      ),
      h(
        'div',
        { class: 'rounded-xl border border-dashed border-zinc-700 p-3 text-center' },
        h('p', { class: 'mb-2 text-sm text-zinc-400' }, matches.length ? 'Aradığın yok mu?' : 'Bu adla bir hareket yok.'),
        button('+ Yeni hareket oluştur', () => editExercise(null, { name: search.value.trim(), onCreated: onPick }), 'secondary'),
      ),
    )
  }

  fill()
  openSheet('Hareket ekle', h('div', { class: 'space-y-4' }, search, list))
}

// Hareket ekler/düzenler. ex null ise yeni hareket.
export function editExercise(ex, { name = '', onCreated } = {}) {
  const isNew = !ex
  const usedBefore = !isNew && history(ex.id).length > 0
  const nameInput = input({ value: ex?.name ?? name, placeholder: 'Hareket adı (örn. Hip Thrust)', maxlength: 60 })
  const groupSelect = select({ value: ex?.group ?? 'Diğer' }, GROUPS.map((g) => [g, g]))
  const kindSelect = select({ value: ex?.kind ?? 'weight', disabled: usedBefore }, KINDS)
  // Artırma önerisi için hedef tekrar aralığı ve ağırlık artışı (yalnızca ağırlık hareketleri).
  const numBox = (value, placeholder) =>
    input({ inputmode: 'decimal', value: value ? String(value).replace('.', ',') : '', placeholder, class: 'text-center' })
  const noteInput = h('textarea', {
    rows: 3,
    maxlength: 500,
    placeholder: 'Örn. dirsekler içeride, koltuk ayarı 4',
    class: 'w-full rounded-xl bg-zinc-800 px-3 py-2.5 text-zinc-100 outline-none placeholder:text-zinc-500 focus:ring-2 focus:ring-emerald-500',
  })
  noteInput.value = ex?.note ?? ''
  const repMin = numBox(ex?.repMin || 8, '8')
  const repMax = numBox(ex?.repMax || 12, '12')
  const increment = numBox(ex?.increment || 2.5, '2,5')
  const progression = h(
    'div',
    { class: 'space-y-1' },
    h('span', { class: 'text-xs text-zinc-400' }, 'Hedef tekrar aralığı ve ağırlık artışı'),
    h(
      'div',
      { class: 'grid grid-cols-[1fr_auto_1fr_auto_1.2fr_auto] items-center gap-2 text-sm text-zinc-400' },
      repMin,
      '–',
      repMax,
      'tekrar',
      increment,
      'kg',
    ),
    h('p', { class: 'text-xs text-zinc-500' }, 'Tüm setlerde üst sınıra ulaşınca bir sonraki antrenmanda bu kadar artırman önerilir.'),
  )
  const showProgression = () => progression.classList.toggle('hidden', kindSelect.value !== 'weight')
  kindSelect.onchange = showProgression
  showProgression()
  groupSelect.onchange = () => {
    if (isNew && groupSelect.value === 'Kardiyo') {
      kindSelect.value = 'cardio'
      showProgression()
    }
  }

  async function save() {
    const weight = kindSelect.value === 'weight'
    const body = {
      ...(ex || {}),
      name: nameInput.value.trim(),
      group: groupSelect.value,
      kind: kindSelect.value,
      note: noteInput.value.trim(),
      repMin: weight ? Math.round(parseNum(repMin.value)) : 0,
      repMax: weight ? Math.round(parseNum(repMax.value)) : 0,
      increment: weight ? parseNum(increment.value) : 0,
    }
    if (!body.name) return show('Hareket adını yazın.', false)
    if (weight && (!body.repMin || !body.repMax || body.repMin > body.repMax)) return show('Hedef tekrar aralığı geçersiz (örn. 8 – 12).', false)
    try {
      if (isNew) {
        const data = await mutate('POST', '/api/exercises', body)
        const created = data.exercises[data.exercises.length - 1]
        closeSheet(() => {
          show(`"${created.name}" eklendi.`)
          if (onCreated) onCreated(created)
          else render()
        })
      } else {
        await mutate('PUT', `/api/exercises/${ex.id}`, body)
        closeSheet(render)
      }
    } catch {
      // mutate hatayı gösterdi
    }
  }

  async function remove() {
    const msg = usedBefore
      ? `"${ex.name}" arşivlensin mi? Geçmiş antrenmanlarda görünmeye devam eder, yeni antrenmanlarda listede çıkmaz. Arşivden geri alabilirsin.`
      : `"${ex.name}" silinsin mi?`
    if (!confirm(msg)) return
    try {
      await mutate('DELETE', `/api/exercises/${ex.id}`)
      closeSheet(() => {
        show(usedBefore ? 'Hareket arşivlendi.' : 'Hareket silindi.')
        render()
      })
    } catch {
      // mutate hatayı gösterdi
    }
  }

  const rec = isNew ? null : records(ex.id)
  openSheet(
    isNew ? 'Yeni hareket' : 'Hareketi düzenle',
    h(
      'div',
      { class: 'space-y-4' },
      field('Ad', nameInput),
      field('Kas grubu', groupSelect),
      field('Tür', kindSelect, usedBefore ? 'Antrenmanlarda kullanıldığı için tür değiştirilemez.' : null),
      progression,
      field('Not (antrenmanda hareketin altında görünür)', noteInput),
      button(isNew ? 'Ekle' : 'Kaydet', save, 'primary', 'w-full'),
      !isNew && rec.sessions
        ? h(
            'div',
            { class: 'rounded-xl bg-zinc-900 p-3 text-sm text-zinc-300' },
            `${rec.sessions} antrenmanda yapıldı`,
            ex.kind === 'weight' && rec.weight ? ` · rekor ${num(rec.weight)} kg` : '',
            ex.kind === 'cardio' && rec.km ? ` · en uzun ${num(rec.km)} km` : '',
            h('div', { class: 'mt-2' }, button('İlerlemeyi gör', () => closeSheet(() => go(`#/ilerleme/${ex.id}`)), 'secondary', 'w-full')),
          )
        : null,
      isNew ? null : button(usedBefore ? 'Arşivle' : 'Sil', remove, 'danger', 'w-full'),
    ),
  )
  if (isNew && !name) setTimeout(() => nameInput.focus(), 50)
}

// Program (şablon) ekler/düzenler. t null ise yeni program. exerciseIds: başlangıç seçimi.
export function editTemplate(t, exerciseIds = []) {
  const isNew = !t
  const chosen = [...(t?.exerciseIds ?? exerciseIds)]
  const nameInput = input({ value: t?.name ?? '', placeholder: 'Program adı (örn. Push, Bacak günü)', maxlength: 40 })
  const order = h('div', {})
  const list = h('div', { class: 'space-y-4' })

  function fill() {
    order.replaceChildren(
      chosen.length
        ? h(
            'ol',
            { class: 'space-y-1' },
            chosen.map((id, i) => {
              const e = state.data.exercises.find((x) => x.id === id)
              return h(
                'li',
                { class: 'flex items-center gap-2 rounded-lg bg-zinc-900 px-3 py-2 text-sm' },
                h('span', { class: 'w-5 text-zinc-500' }, `${i + 1}.`),
                h('span', { class: 'flex-1' }, e?.name ?? '?'),
                i > 0 ? miniBtn('↑', () => move(i, -1)) : null,
                miniBtn('✕', () => toggle(id)),
              )
            }),
          )
        : h('p', { class: 'text-sm text-zinc-500' }, 'Aşağıdan hareket seç.'),
    )
    list.replaceChildren(
      ...grouped(activeExercises()).map(([g, exs]) =>
        h(
          'div',
          {},
          h('h3', { class: 'mb-1 flex items-center gap-2 px-1 text-xs font-semibold uppercase text-zinc-400' }, groupDot(g), g),
          h(
            'div',
            { class: 'divide-y divide-zinc-800 overflow-hidden rounded-xl bg-zinc-900' },
            exs.map((e) =>
              h(
                'label',
                { class: 'flex items-center gap-3 px-4 py-3 active:bg-zinc-800' },
                h('input', { type: 'checkbox', class: 'h-5 w-5 accent-emerald-500', checked: chosen.includes(e.id), onchange: () => toggle(e.id) }),
                e.name,
              ),
            ),
          ),
        ),
      ),
    )
  }
  function toggle(id) {
    const i = chosen.indexOf(id)
    if (i >= 0) chosen.splice(i, 1)
    else chosen.push(id)
    fill()
  }
  function move(i, d) {
    ;[chosen[i], chosen[i + d]] = [chosen[i + d], chosen[i]]
    fill()
  }

  async function save() {
    const body = { name: nameInput.value.trim(), exerciseIds: chosen }
    if (!body.name) return show('Program adını yazın.', false)
    if (!chosen.length) return show('En az bir hareket seçin.', false)
    try {
      if (isNew) await mutate('POST', '/api/templates', body)
      else await mutate('PUT', `/api/templates/${t.id}`, body)
      closeSheet(() => {
        show(isNew ? `"${body.name}" programı kaydedildi.` : 'Program kaydedildi.')
        render()
      })
    } catch {
      // mutate hatayı gösterdi
    }
  }
  async function remove() {
    if (!confirm(`"${t.name}" programı silinsin mi? Antrenman geçmişin etkilenmez.`)) return
    try {
      await mutate('DELETE', `/api/templates/${t.id}`)
      closeSheet(render)
    } catch {
      // mutate hatayı gösterdi
    }
  }

  fill()
  openSheet(
    isNew ? 'Yeni program' : 'Programı düzenle',
    h(
      'div',
      { class: 'space-y-4' },
      field('Ad', nameInput),
      field('Hareketler (sırasıyla)', order),
      button('Kaydet', save, 'primary', 'w-full'),
      isNew ? null : button('Programı sil', remove, 'danger', 'w-full'),
      h('h3', { class: 'pt-2 text-sm font-semibold text-zinc-300' }, 'Hareket seç'),
      list,
    ),
  )
}

const miniBtn = (text, onclick) =>
  h('button', { type: 'button', class: 'rounded-md bg-zinc-800 px-2 py-0.5 text-zinc-300 active:bg-zinc-700', onclick }, text)

const field = (label, control, hint) =>
  h('div', { class: 'space-y-1' }, h('span', { class: 'text-xs text-zinc-400' }, label), control, hint ? h('p', { class: 'text-xs text-zinc-500' }, hint) : null)
