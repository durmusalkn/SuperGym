// Alttan açılan paneller: hareket seçme, hareket düzenleme, program düzenleme.
import { h, GROUPS, MUSCLES, num, parseNum } from './util.js'
import { state, mutate, activeExercises, history, records, exercise } from './state.js'
import { openSheet, closeSheet, show, groupDot, button, input, select, go, render, stars, icon } from './ui.js'

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
          h('h3', { class: 'mb-1 flex items-center gap-2 px-1 text-xs font-medium text-muted' }, groupDot(g), g),
          h(
            'div',
            { class: 'divide-y divide-zinc-800 overflow-hidden rounded-[22px] bg-zinc-900' },
            exs.map((e) =>
              h(
                'button',
                {
                  type: 'button',
                  class: 'flex w-full items-center justify-between px-4 py-3 text-left active:bg-zinc-800',
                  onclick: () => closeSheet(() => onPick(e)),
                },
                h('span', {}, e.name),
                added.has(e.id) ? h('span', { class: 'text-xs text-coral' }, 'ekli') : null,
              ),
            ),
          ),
        ),
      ),
      h(
        'div',
        { class: 'rounded-[22px] border border-dashed border-zinc-700 p-3 text-center' },
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
  // Hedef kas: seçili grubun kasları. Hazır programlar hareketleri buna göre seçer.
  const muscleBox = h('div', {})
  let muscleSelect
  const fillMuscles = (value) => {
    const list = MUSCLES[groupSelect.value] || []
    muscleSelect = select({ value }, [['', '—'], ...list.map((m) => [m, m])])
    muscleBox.replaceChildren(list.length ? field('Hedef kas', muscleSelect, 'Hazır programlar (Push, Pull, Legs…) hareketleri hedef kasa ve puanına göre seçer.') : '')
  }
  fillMuscles(ex?.muscle ?? '')
  let rating = ex?.rating || 0
  const kindSelect = select({ value: ex?.kind ?? 'weight', disabled: usedBefore }, KINDS)
  // Artırma önerisi için hedef tekrar aralığı ve ağırlık artışı (yalnızca ağırlık hareketleri).
  const numBox = (value, placeholder) =>
    input({ inputmode: 'decimal', value: value ? String(value).replace('.', ',') : '', placeholder, class: 'text-center' })
  const noteInput = h('textarea', {
    rows: 3,
    maxlength: 500,
    placeholder: 'Örn. dirsekler içeride, koltuk ayarı 4',
    class: 'w-full rounded-[22px] bg-zinc-800 px-3 py-2.5 text-zinc-100 outline-none placeholder:text-zinc-500 focus:ring-2 focus:ring-coral',
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
    fillMuscles('')
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
      muscle: muscleSelect.value,
      rating,
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
      muscleBox,
      field('Puanın', h('div', {}, stars(rating, (v) => (rating = v), 30)), 'Sevdiğin hareketlere yüksek puan ver; 1 puan verdiğin hareket programlara seçilmez.'),
      field('Tür', kindSelect, usedBefore ? 'Antrenmanlarda kullanıldığı için tür değiştirilemez.' : null),
      progression,
      field('Not (antrenmanda hareketin altında görünür)', noteInput),
      button(isNew ? 'Ekle' : 'Kaydet', save, 'primary', 'w-full'),
      !isNew && rec.sessions
        ? h(
            'div',
            { class: 'rounded-[22px] bg-zinc-900 p-3 text-sm text-zinc-300' },
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

// Programın kopyasını (fork) oluşturur ve kopyayı düzenlemek için açar.
async function forkTemplate(t) {
  try {
    const data = await mutate('POST', `/api/templates/${t.id}/fork`)
    const fork = data.templates[data.templates.length - 1]
    closeSheet(() => {
      show(`"${fork.name}" oluşturuldu. Değişikliklerin "${t.name}" programını etkilemez.`)
      render()
      editTemplate(fork)
    })
  } catch {
    // mutate hatayı gösterdi
  }
}

// Hazır program: hareketleri puanlara göre otomatik seçilir, değiştirilemez.
function viewBuiltin(t) {
  const list = t.exerciseIds.map(exercise).filter(Boolean)
  openSheet(
    t.name,
    h(
      'div',
      { class: 'space-y-4' },
      h('p', { class: 'text-sm text-muted' }, 'Hazır program: hareketler puanlarına ve hedef kaslara göre otomatik seçilir, puan verdikçe güncellenir. Değiştirmek istersen kopyasını oluştur; kopya bundan bağımsızdır.'),
      list.length
        ? h(
            'ol',
            { class: 'space-y-1' },
            list.map((e, i) =>
              h(
                'li',
                { class: 'flex items-center gap-3 rounded-[20px] bg-zinc-900 px-4 py-2.5' },
                h('span', { class: 'w-5 text-sm text-zinc-500' }, `${i + 1}.`),
                h('span', { class: 'min-w-0 flex-1' }, h('span', { class: 'block truncate' }, e.name), h('span', { class: 'block text-xs text-muted' }, e.muscle || e.group)),
                stars(e.rating, null, 14),
              ),
            ),
          )
        : h('p', { class: 'text-sm text-zinc-500' }, 'Bu program için uygun hareket yok.'),
      button([icon('copy', 18), ' Kopyasını oluştur'], () => forkTemplate(t), 'primary', 'flex w-full items-center justify-center gap-1'),
      button('Hareketleri puanla', () => closeSheet(() => rateExercises()), 'secondary', 'w-full'),
    ),
  )
}

// Program (şablon) ekler/düzenler. t null ise yeni program. exerciseIds: başlangıç seçimi.
export function editTemplate(t, exerciseIds = []) {
  if (t?.builtin) return viewBuiltin(t)
  const isNew = !t
  const source = t?.forkOf ? state.data.templates.find((x) => x.id === t.forkOf) : null
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
                { class: 'flex items-center gap-2 rounded-full bg-zinc-900 px-4 py-2 text-sm' },
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
          h('h3', { class: 'mb-1 flex items-center gap-2 px-1 text-xs font-medium text-muted' }, groupDot(g), g),
          h(
            'div',
            { class: 'divide-y divide-zinc-800 overflow-hidden rounded-[22px] bg-zinc-900' },
            exs.map((e) =>
              h(
                'label',
                { class: 'flex items-center gap-3 px-4 py-3 active:bg-zinc-800' },
                h('input', { type: 'checkbox', class: 'h-5 w-5 accent-[#ff8a6b]', checked: chosen.includes(e.id), onchange: () => toggle(e.id) }),
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
      t?.forkOf ? h('p', { class: 'text-xs text-muted' }, `${source ? `"${source.name}"` : 'Başka bir'} programdan kopyalandı; değişikliklerin asıl programı etkilemez.`) : null,
      field('Ad', nameInput),
      field('Hareketler (sırasıyla)', order),
      button('Kaydet', save, 'primary', 'w-full'),
      isNew ? null : button([icon('copy', 18), ' Kopyasını oluştur'], () => forkTemplate(t), 'secondary', 'flex w-full items-center justify-center gap-1'),
      isNew ? null : button('Programı sil', remove, 'danger', 'w-full'),
      h('h3', { class: 'pt-2 text-sm font-semibold text-zinc-300' }, 'Hareket seç'),
      list,
    ),
  )
}

// Hızlı puanlama: tüm hareketler kas gruplarına göre; yıldıza dokununca hemen kaydedilir.
let rateFilter = 'all'
export function rateExercises() {
  const list = h('div', { class: 'space-y-4' })
  const counter = h('p', { class: 'text-sm text-muted' })
  const tabs = h('div', { class: 'grid grid-cols-2 gap-2' })
  const weightOnly = () => activeExercises().filter((e) => e.kind === 'weight')

  function count() {
    const all = weightOnly()
    counter.textContent = `${all.filter((e) => e.rating).length} / ${all.length} hareket puanlandı. Hazır programlar puanlarına göre güncellenir.`
  }
  async function setRating(id, rating) {
    const e = exercise(id)
    if (!e) return
    e.rating = rating
    count()
    try {
      await mutate('PUT', `/api/exercises/${id}`, { ...e, rating })
    } catch {
      // mutate hatayı gösterdi
    }
  }
  function fill() {
    tabs.replaceChildren(
      ...[
        ['all', 'Tümü'],
        ['unrated', 'Puanlanmamış'],
      ].map(([key, label]) =>
        button(label, () => {
          rateFilter = key
          fill()
        }, rateFilter === key ? 'primary' : 'outline', 'py-2 text-sm'),
      ),
    )
    const shown = weightOnly().filter((e) => rateFilter === 'all' || !e.rating)
    const groups = grouped(shown)
    list.replaceChildren(
      ...(groups.length
        ? groups.map(([g, exs]) =>
            h(
              'div',
              {},
              h('h3', { class: 'mb-1 flex items-center gap-2 px-1 text-xs font-medium text-muted' }, groupDot(g), g),
              h(
                'div',
                { class: 'divide-y divide-zinc-800 overflow-hidden rounded-[22px] bg-zinc-900' },
                exs.map((e) =>
                  h(
                    'div',
                    { class: 'flex items-center gap-2 py-1.5 pl-4 pr-2' },
                    h('span', { class: 'min-w-0 flex-1' }, h('span', { class: 'block truncate text-[15px]' }, e.name), h('span', { class: 'block text-xs text-muted' }, e.muscle || '—')),
                    stars(e.rating, (v) => setRating(e.id, v), 20),
                  ),
                ),
              ),
            ),
          )
        : [h('p', { class: 'py-6 text-center text-sm text-muted' }, 'Puanlanmamış hareket kalmadı 🎉')]),
    )
  }
  count()
  fill()
  openSheet('Hareketleri puanla', h('div', { class: 'space-y-4' }, counter, tabs, list, button('Bitti', () => closeSheet(), 'secondary', 'w-full')), render)
}

const miniBtn = (text, onclick) =>
  h('button', { type: 'button', class: 'rounded-full bg-zinc-800 px-2.5 py-1 text-zinc-300 active:bg-zinc-700', onclick }, text)

const field = (label, control, hint) =>
  h('div', { class: 'space-y-1' }, h('span', { class: 'text-xs text-zinc-400' }, label), control, hint ? h('p', { class: 'text-xs text-zinc-500' }, hint) : null)
