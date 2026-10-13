/**
 * Цветовые токены для canvas (паутина, «аэрозольные» пятна).
 * Единственный источник — переменные :root в styles.css; здесь только чтение.
 */
const FALLBACK: Record<string, string> = {
  '--gold': '#c9a227', '--gold-core': '#7a5e0c', '--gold-dust': '#d8b23c', '--gold-glow': '#e6be45',
  '--ash': '#8a8f98', '--ash-core': '#4c5059', '--ash-dust': '#9a9ea7',
}

let style: CSSStyleDeclaration | null = null
export function token(name: keyof typeof FALLBACK | string): string {
  if (typeof document !== 'undefined') {
    style ??= getComputedStyle(document.documentElement)
    const v = style.getPropertyValue(name).trim()
    if (v) return v
  }
  return FALLBACK[name] ?? '#000000'
}

/** '#c9a227' → [201, 162, 39] */
export function rgb(name: string): [number, number, number] {
  const hex = token(name).replace('#', '')
  const full = hex.length === 3 ? hex.split('').map((c) => c + c).join('') : hex
  const n = parseInt(full, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
