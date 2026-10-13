/**
 * Акцентный цвет сервиса. По умолчанию — золото из styles.css; после выбора
 * жанра (и уточнений: эпоха, длительность) акцент перекрашивает всё, что было
 * золотым: шапку, кнопки, узлы паутины, частицы, страницу фильма.
 *
 * Переменные на :root меняются ОДИН раз за смену акцента (без покадровой
 * анимации — она пересчитывала бы стили всего дерева). Плавность дают
 * transition color/background-color на самих элементах (класс .accent-shift).
 */
import { useLayoutEffect, useSyncExternalStore } from 'react'
import { GENRE_OPTIONS, type Choice } from '../data/criteria'
import type { Movie } from '../data/movies'

export interface Hsl { h: number; s: number; l: number }

/** Характерный цвет каждого жанра каталога */
export const GENRE_HSL: Record<string, Hsl> = {
  drama: { h: 350, s: 70, l: 55 }, // винно-красный
  comedy: { h: 32, s: 95, l: 56 }, // тёплый оранжевый
  fantasy: { h: 222, s: 88, l: 62 }, // электрический синий
  history: { h: 18, s: 40, l: 56 }, // сепия, терракота
  crime: { h: 176, s: 62, l: 46 }, // холодный бирюзовый «нуар»
  doc: { h: 95, s: 48, l: 52 }, // документальный зелёный
}

/**
 * Сдвиг оттенка к цели по кратчайшей дуге цветового круга (350° → 35° идёт через 0°, а не через синий),
 * не больше чем на 25° — цвет жанра остаётся узнаваемым.
 */
const towardHue = (h: number, target: number, t: number) => {
  const d = ((((target - h) % 360) + 540) % 360 - 180) * t
  return h + Math.max(-25, Math.min(25, d))
}

/** Уточнения сдвигают цвет жанра, оставляя его узнаваемым */
const MODIFIERS: Record<string, (c: Hsl) => Hsl> = {
  'period:classic': (c) => ({ h: towardHue(c.h, 35, 0.4), s: c.s * 0.55, l: c.l }), // выцветшая плёнка
  'period:2000s': (c) => ({ ...c, s: c.s * 0.85 }),
  'period:new': (c) => ({ h: c.h + 12, s: Math.min(100, c.s * 1.2), l: c.l + 3 }), // неон
  'runtime:short': (c) => ({ h: c.h - 10, s: c.s, l: c.l + 6 }), // светлее, легче
  'runtime:mid': (c) => c,
  'runtime:long': (c) => ({ h: c.h + 20, s: Math.min(100, c.s * 1.1), l: c.l - 4 }), // сумеречный
}

// ——— цветовая математика

function hslToRgb({ h, s, l }: Hsl): [number, number, number] {
  h = ((h % 360) + 360) % 360; s = Math.max(0, Math.min(100, s)) / 100; l = Math.max(0, Math.min(100, l)) / 100
  const k = (n: number) => (n + h / 30) % 12
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)]
}
const hex = (c: number[]) => '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('')
function luminance([r, g, b]: number[]) {
  const ch = (v: number) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }
  return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b)
}

export interface AccentTokens {
  gold: string; hi: string; deep: string; core: string; dust: string; glow: string
  rgb: [number, number, number]; glowRgb: [number, number, number]; hiRgb: [number, number, number]
}

/**
 * Из базового цвета выводится вся шкала. Контраст держится автоматически:
 *  - акцент на фоне #0e0e12 и тёмный текст на акценте — ≥ 4.5:1 (яркость акцента ≥ 0.2);
 *  - светлый текст на ядре узла — ≥ 4.5:1 (яркость ядра ≤ 0.15).
 */
export function deriveTokens(base: Hsl): AccentTokens {
  const c = { ...base }
  while (luminance(hslToRgb(c)) < 0.2 && c.l < 82) c.l += 1
  const core = { ...c, l: Math.min(c.l, 40) }
  while (luminance(hslToRgb(core)) > 0.15 && core.l > 8) core.l -= 1
  const rgb = hslToRgb(c)
  const hi = hslToRgb({ h: c.h, s: Math.min(100, c.s + 8), l: Math.min(84, c.l + 18) })
  const glow = hslToRgb({ ...c, l: Math.min(80, c.l + 10) })
  return {
    gold: hex(rgb), hi: hex(hi), deep: hex(hslToRgb({ ...c, l: c.l - 14 })), core: hex(hslToRgb(core)),
    dust: hex(hslToRgb({ ...c, l: Math.min(80, c.l + 7) })), glow: hex(glow), rgb, glowRgb: glow, hiRgb: hi,
  }
}

// ——— какой акцент у какого контекста

export function accentForPath(path: Choice[]): Hsl | null {
  const genre = path.find((c) => c.step === 'genre')
  const base = genre && GENRE_HSL[genre.option]
  if (!base) return null
  return path.reduce((c, ch) => MODIFIERS[`${ch.step}:${ch.option}`]?.(c) ?? c, base)
}

export const accentForGenre = (id: string | null): Hsl | null => (id ? GENRE_HSL[id] ?? null : null)

/** Фильм окрашивается по своему первому жанру («анимация» → сказка, «детектив» → нуар…) */
export function accentForMovie(m: Movie): Hsl | null {
  for (const g of m.genres) {
    const opt = GENRE_OPTIONS.find((o) => o.test({ ...m, genres: [g] }))
    if (opt) return GENRE_HSL[opt.id] ?? null
  }
  return null
}

// ——— применение

const VARS: [string, keyof AccentTokens][] = [
  ['--gold', 'gold'], ['--gold-hi', 'hi'], ['--gold-deep', 'deep'], ['--gold-core', 'core'],
  ['--gold-dust', 'dust'], ['--gold-glow', 'glow'],
]
let current = 'default'
let first = true
let shiftTimer = 0

/** null — вернуть золото из таблицы стилей */
export function applyAccent(spec: Hsl | null) {
  const key = spec ? `${spec.h.toFixed(1)}:${spec.s.toFixed(1)}:${spec.l.toFixed(1)}` : 'default'
  const initial = first // первая установка (открыли сразу страницу фильма) — без перехода
  first = false
  if (key === current) return
  const root = document.documentElement
  // переходы цвета включаются только на время смены акцента, чтобы не мешать hover-переходам
  if (!initial) {
    root.classList.add('accent-shift')
    clearTimeout(shiftTimer)
    shiftTimer = window.setTimeout(() => root.classList.remove('accent-shift'), 700)
  }
  current = key
  if (!spec) {
    for (const [v] of VARS) root.style.removeProperty(v)
    root.style.removeProperty('--gold-rgb')
  } else {
    const t = deriveTokens(spec)
    for (const [v, k] of VARS) root.style.setProperty(v, t[k] as string)
    root.style.setProperty('--gold-rgb', t.rgb.join(', '))
  }
  listeners.forEach((fn) => fn(spec))
}

const listeners = new Set<(spec: Hsl | null) => void>()
export function onAccent(fn: (spec: Hsl | null) => void) { listeners.add(fn); return () => { listeners.delete(fn) } }

/** Страница объявляет свой акцент; последняя смонтированная побеждает. */
export function useAccent(spec: Hsl | null) {
  const key = spec ? `${spec.h}:${spec.s}:${spec.l}` : ''
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useLayoutEffect(() => applyAccent(spec), [key])
}

/**
 * Страница фильма не задаёт свой цвет, а наследует цвет ветки, по которой к ней пришли
 * (паутина, каталог с фильтром, «Похожие»…). Только если фильм открыт первым экраном
 * (прямая ссылка) и наследовать нечего — берётся цвет его жанра.
 */
export function useInheritedAccent(fallback: () => Hsl | null, dep: unknown) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useLayoutEffect(() => { if (first) applyAccent(fallback()) }, [dep])
}

/** Ключ текущего акцента — чтобы canvas-компоненты перечитывали цвета из CSS при смене */
export const useAccentKey = () => useSyncExternalStore(onAccent, () => current)
