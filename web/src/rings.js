// Ritim tasarımının halkaları (SVG).
import { svg } from './util.js'

// Dilimli halka: her dilim { color, opacity, cls }. Dilimler saat 12'den başlar.
export function segmentRing(size, stroke, segments, label) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const n = Math.max(segments.length, 1)
  const step = c / n
  const len = n === 1 ? c : Math.max(step - (stroke + 8), 1)
  return svg(
    'svg',
    {
      width: size,
      height: size,
      viewBox: `0 0 ${size} ${size}`,
      style: 'transform: rotate(-90deg)',
      ...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': 'true' }),
    },
    segments.map((s, i) =>
      svg('circle', {
        cx: size / 2,
        cy: size / 2,
        r,
        fill: 'none',
        stroke: s.color,
        'stroke-opacity': s.opacity ?? 1,
        'stroke-width': stroke,
        'stroke-linecap': n === 1 ? 'butt' : 'round',
        'stroke-dasharray': `${len} ${c - len}`,
        'stroke-dashoffset': -i * step,
        class: s.cls,
      }),
    ),
  )
}

// İlerleme halkası: oran 0–1.
export function progressRing(size, stroke, ratio, color, track = '#2e2942', label) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const len = Math.max(0, Math.min(1, ratio)) * c
  return svg(
    'svg',
    {
      width: size,
      height: size,
      viewBox: `0 0 ${size} ${size}`,
      style: 'transform: rotate(-90deg); flex-shrink: 0',
      ...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': 'true' }),
    },
    svg('circle', { cx: size / 2, cy: size / 2, r, fill: 'none', stroke: track, 'stroke-width': stroke }),
    len > 0
      ? svg('circle', {
          cx: size / 2,
          cy: size / 2,
          r,
          fill: 'none',
          stroke: color,
          'stroke-width': stroke,
          'stroke-linecap': 'round',
          'stroke-dasharray': `${len} ${c}`,
        })
      : null,
  )
}
