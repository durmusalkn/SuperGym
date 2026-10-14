// Hareketler sekmesi: hareket listesi, arşiv, programlar, ayarlar ve yedek.
import { h, today, num, shortDate, parseDate, GROUPS, WEEKDAYS_SHORT, groupColor } from '../util.js'
import { state, api, mutate, exercise, records, history } from '../state.js'
import { render, show, card, button, input, select, sectionTitle, icon, android } from '../ui.js'
import { progressRing } from '../rings.js'
import { editExercise, editTemplate } from '../sheets.js'

// Liste filtresi: seçili kas grubu ve arama metni.
let filterGroup = null
let query = ''

export function exercisesView() {
  const active = state.data.exercises.filter((e) => !e.archived)
  const archived = state.data.exercises.filter((e) => e.archived)

  const list = h('section', { class: 'mt-4 space-y-2', 'aria-label': 'Hareket listesi' })
  const fill = () => {
    const q = query.trim().toLocaleLowerCase('tr')
    const rows = active
      .filter((e) => (!filterGroup || e.group === filterGroup) && e.name.toLocaleLowerCase('tr').includes(q))
      .sort((a, b) => a.name.localeCompare(b.name, 'tr'))
    list.replaceChildren(...(rows.length ? rows.map(row) : [h('p', { class: 'py-4 text-center text-sm text-muted' }, 'Bu aramayla hareket yok.')]))
  }
  fill()

  // Kas grupları baloncuk: boyutu gruptaki hareket sayısı; dokununca liste o gruba süzülür.
  const counts = GROUPS.map((g) => [g, active.filter((e) => e.group === g).length]).filter(([, n]) => n)
  const maxN = Math.max(1, ...counts.map(([, n]) => n))
  const bubbles = h(
    'section',
    { class: 'mt-4 flex flex-wrap items-center justify-center gap-2.5', 'aria-label': 'Kas grupları' },
    counts.map(([g, n]) => {
      const size = Math.round(62 + (n / maxN) * 30)
      const on = filterGroup === g
      const c = groupColor(g).hex
      return h(
        'button',
        {
          type: 'button',
          'aria-pressed': on ? 'true' : 'false',
          class: 'flex flex-col items-center justify-center rounded-full',
          style: `width:${size}px;height:${size}px;background:${on ? `${c}26` : '#1f1b2d'};border:${on ? `2px solid ${c}` : '1px solid #2e2942'}`,
          onclick: () => {
            filterGroup = on ? null : g
            render()
          },
        },
        h('span', { class: 'text-[13px] font-semibold' }, g),
        h('span', { class: 'text-[11px] text-muted' }, `${n} hareket`),
      )
    }),
  )

  return h(
    'div',
    {},
    h(
      'header',
      { class: 'flex items-center justify-between' },
      h('h1', { class: 'text-[22px] font-semibold' }, 'Hareketler'),
      h(
        'button',
        { type: 'button', 'aria-label': 'Yeni hareket', class: 'flex h-11 w-11 items-center justify-center rounded-full bg-coral', onclick: () => editExercise(null) },
        icon('plus', 20, '#15121f', 2.6),
      ),
    ),
    h(
      'div',
      { class: 'mt-4' },
      h('input', {
        type: 'search',
        value: query,
        placeholder: 'Hareket ara',
        'aria-label': 'Hareket ara',
        class: 'h-[46px] w-full rounded-full bg-surface px-5 text-[15px] text-text outline-none placeholder:text-zinc-500 focus:ring-2 focus:ring-coral',
        oninput: (ev) => {
          query = ev.target.value
          fill()
        },
      }),
    ),
    bubbles,
    list,
    archived.length
      ? h(
          'details',
          { class: 'mt-3 rounded-[22px] bg-surface' },
          h('summary', { class: 'cursor-pointer px-5 py-4 text-sm text-muted' }, `Arşiv (${archived.length})`),
          h(
            'div',
            { class: 'space-y-1 px-2 pb-2' },
            archived.map((e) =>
              h(
                'div',
                { class: 'flex items-center justify-between rounded-2xl px-3 py-2' },
                h('span', { class: 'text-muted' }, e.name),
                button('Geri al', () => restore(e), 'outline', 'py-2 text-sm'),
              ),
            ),
          ),
        )
      : null,
    templatesSection(),
    settingsSection(),
    remindersSection(),
    backupSection(),
  )
}

// Satırdaki küçük halka: son yapılışın en iyisinin rekora oranı.
function row(e) {
  const rec = records(e.id)
  const hist = history(e.id)
  const last = hist[hist.length - 1]
  const cardio = e.kind === 'cardio'
  const best = (sets) => Math.max(0, ...sets.map((s) => (cardio ? s.km || 0 : s.weight || 0)))
  const top = cardio ? rec.km : rec.weight
  const ratio = last && top ? best(last.sets) / top : 0
  const right = cardio ? (rec.km ? `${num(rec.km)} km` : '') : rec.weight ? `${num(rec.weight)} kg` : ''
  const meta = [cardio ? 'kardiyo' : `${e.repMin || 8}–${e.repMax || 12} tekrar`, last ? since(last.date) : 'henüz yapılmadı'].join(' · ')
  return h(
    'button',
    { type: 'button', class: 'flex w-full items-center gap-3 rounded-[22px] bg-surface px-3.5 py-2.5 text-left active:bg-line', onclick: () => editExercise(e) },
    progressRing(36, 4, ratio, groupColor(e.group).hex),
    h('span', { class: 'min-w-0 flex-1' }, h('span', { class: 'block truncate font-medium' }, e.name), h('span', { class: 'block text-xs text-muted' }, meta)),
    h('span', { class: 'shrink-0 text-[15px] font-semibold' }, right),
  )
}

function since(date) {
  const days = Math.round((parseDate(today()) - parseDate(date)) / 86400000)
  return days <= 0 ? 'bugün' : days === 1 ? 'dün' : `${days} gün önce`
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
  const tints = ['#2a1f2a', '#221f35', '#2a2620', '#1f2a29']
  return [
    sectionTitle('Programlar'),
    h(
      'div',
      { class: 'grid grid-cols-3 gap-2' },
      list.map((t, k) =>
        h(
          'button',
          {
            type: 'button',
            class: 'flex h-[74px] flex-col items-center justify-center gap-0.5 rounded-[22px] px-2 active:opacity-80',
            style: `background:${tints[k % tints.length]}`,
            onclick: () => editTemplate(t),
          },
          h('span', { class: 'max-w-full truncate font-semibold' }, t.name),
          h('span', { class: 'text-xs text-muted' }, `${t.exerciseIds.filter((id) => exercise(id)).length} hareket`),
        ),
      ),
      h(
        'button',
        { type: 'button', 'aria-label': 'Yeni program', class: 'flex h-[74px] items-center justify-center rounded-[22px] border border-dashed border-zinc-600 text-muted', onclick: () => editTemplate(null) },
        icon('plus', 22),
      ),
    ),
    list.length ? null : h('p', { class: 'mt-2 px-1 text-xs text-muted' }, 'Sık yaptığın antrenmanları (Push, Pull, Bacak) program olarak kaydet; antrenmanda tek dokunuşla eklensin.'),
  ]
}

export async function saveSettings(change) {
  try {
    await mutate('PUT', '/api/settings', { ...state.data.settings, ...change })
    show('Kaydedildi.')
    render()
  } catch {
    // mutate hatayı gösterdi
  }
}

// Hatırlatma ayarı değişince bildirim izni istenir (Android 13+).
function saveReminder(change) {
  android()?.requestNotifications?.()
  return saveSettings(change)
}

function remindersSection() {
  const st = state.data.settings
  const nativeOn = !!android()?.syncState
  // Pazartesiden başlayarak; değerler JavaScript'teki gibi (Pazar = 0).
  const days = [1, 2, 3, 4, 5, 6, 0]
  const allowed = android()?.notificationsAllowed ? android().notificationsAllowed() : true
  const anyOn = st.reminderDays.length || st.inactiveDays
  return [
    sectionTitle('Hatırlatmalar'),
    card(
      {},
      !nativeOn ? h('p', { class: 'mb-3 text-xs text-zinc-500' }, 'Yalnızca Android uygulamasında çalışır.') : null,
      h('span', { class: 'text-sm' }, 'Antrenman günlerim'),
      h(
        'div',
        { class: 'mt-2 grid grid-cols-7 gap-1' },
        days.map((d) => {
          const on = st.reminderDays.includes(d)
          return h(
            'button',
            {
              type: 'button',
              disabled: !nativeOn,
              class: `h-10 rounded-full text-xs ${on ? 'bg-coral font-semibold text-ink' : 'bg-line text-zinc-300'}`,
              onclick: () => saveReminder({ reminderDays: on ? st.reminderDays.filter((x) => x !== d) : [...st.reminderDays, d] }),
            },
            WEEKDAYS_SHORT[d],
          )
        }),
      ),
      h(
        'div',
        { class: 'mt-4 grid grid-cols-2 gap-3' },
        h(
          'div',
          { class: 'space-y-1' },
          h('span', { class: 'text-xs text-zinc-400' }, 'Saat'),
          input({
            type: 'time',
            value: st.reminderTime,
            disabled: !nativeOn,
            onchange: (ev) => ev.target.value && saveReminder({ reminderTime: ev.target.value }),
          }),
        ),
        h(
          'div',
          { class: 'space-y-1' },
          h('span', { class: 'text-xs text-zinc-400' }, 'Uzun ara uyarısı'),
          select(
            { value: st.inactiveDays, disabled: !nativeOn, onchange: (ev) => saveReminder({ inactiveDays: Number(ev.target.value) }) },
            [[0, 'Kapalı'], ...[2, 3, 4, 5, 7, 10].map((n) => [n, `${n} gün gidilmezse`])],
          ),
        ),
      ),
      h(
        'p',
        { class: 'mt-3 text-xs text-zinc-500' },
        'Seçtiğin günlerde, o gün antrenman girmediysen bu saatte bildirim gelir. Uzun ara uyarısı da aynı saatte kontrol edilir.',
      ),
      nativeOn && anyOn && !allowed
        ? h(
            'button',
            { type: 'button', class: 'mt-3 w-full rounded-[20px] bg-sun/10 px-4 py-3 text-left text-sm text-sun', onclick: () => android().requestNotifications() },
            'Bildirim izni kapalı: hatırlatmalar gelmez. İzin vermek için dokun (ya da telefonun Ayarlar > Uygulamalar > SuperGym > Bildirimler).',
          )
        : null,
    ),
  ]
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
          class: 'mt-0.5 h-5 w-5 accent-[#ff8a6b]',
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
  const st = state.data.settings
  const nativeBackup = !!android()?.autoBackup
  return [
    sectionTitle('Yedek'),
    card(
      {},
      h('p', { class: 'mb-3 text-sm text-zinc-400' }, 'Veriler yalnızca bu telefonda durur. Uygulamayı silmeden ya da telefon değiştirmeden önce dışa aktararak yedek al.'),
      h('div', { class: 'grid grid-cols-2 gap-2' }, button('Dışa aktar', exportData, 'secondary'), button('İçe aktar', () => document.getElementById('import-file').click(), 'secondary')),
      h(
        'div',
        { class: 'mt-5 space-y-1 border-t border-line pt-4' },
        h('span', { class: 'text-sm' }, 'Otomatik yedek'),
        select(
          { value: st.backupDays, disabled: !nativeBackup, onchange: (ev) => saveSettings({ backupDays: Number(ev.target.value) }) },
          [
            [0, 'Kapalı'],
            [1, 'Her gün'],
            [3, '3 günde bir'],
            [7, 'Haftada bir'],
            [14, '2 haftada bir'],
          ],
        ),
        h(
          'p',
          { class: 'text-xs text-zinc-500' },
          nativeBackup
            ? `Uygulamayı açtığında süresi dolduysa telefonun İndirilenler/SuperGym klasörüne kaydedilir; uygulama silinse de kalır. Son 8 yedek tutulur.${st.lastBackup ? ` Son otomatik yedek: ${shortDate(st.lastBackup)}.` : ''}`
            : 'Yalnızca Android uygulamasında çalışır.',
        ),
      ),
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
