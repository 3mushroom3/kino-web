/**
 * Генератор «аэрозольных» пятен узлов из макета Desktop-2/3.
 * Рисуется один раз на canvas и кешируется как dataURL.
 *
 * Пятно отдаётся как две белые МАСКИ (контур с брызгами и затемнённое ядро),
 * а цвет задаёт CSS (background-color через var(--tone)/var(--tone-core)).
 * Поэтому смена акцента по жанру — это обычный CSS-переход цвета, без
 * перегенерации текстур.
 */
import type { CSSProperties } from 'react'

export type SprayShape = 'ellipse' | 'rect'
export interface SprayMasks { edge: string; core: string }

const cache = new Map<string, SprayMasks>()

function rng(seed: number) {
  let s = seed >>> 0 || 1
  return () => {
    s ^= s << 13; s ^= s >>> 17; s ^= s << 5
    return ((s >>> 0) % 100000) / 100000
  }
}

function gauss(r: () => number) {
  return (r() + r() + r() + r() - 2) / 2
}

function canvasFor(w: number, h: number) {
  const pad = 0.22
  const W = Math.round(w * (1 + pad * 2)), H = Math.round(h * (1 + pad * 2))
  const k = 1.25 // разрешение текстуры
  const c = document.createElement('canvas')
  c.width = Math.round(W * k); c.height = Math.round(H * k)
  const ctx = c.getContext('2d')!
  ctx.scale(k, k)
  ctx.fillStyle = '#fff'
  return { c, ctx, cx: W / 2, cy: H / 2 }
}

export function spray(w: number, h: number, shape: SprayShape, seed = 7): SprayMasks {
  const key = `${w}x${h}:${shape}:${seed}`
  const hit = cache.get(key)
  if (hit) return hit
  const r = rng(seed * 9301 + w * 7 + h)
  const rx = w / 2, ry = h / 2

  // ——— контур: мягкое тело + брызги по краю
  const E = canvasFor(w, h)
  E.ctx.save()
  E.ctx.filter = 'blur(6px)'
  E.ctx.beginPath()
  if (shape === 'ellipse') E.ctx.ellipse(E.cx, E.cy, rx * 0.92, ry * 0.9, 0, 0, Math.PI * 2)
  else E.ctx.rect(E.cx - rx * 0.92, E.cy - ry * 0.94, rx * 1.84, ry * 1.88)
  E.ctx.fill()
  E.ctx.restore()

  const n = Math.round((w + h) * 9)
  for (let i = 0; i < n; i++) {
    let x: number, y: number
    const spread = Math.abs(gauss(r)) * 0.22 + 0.86
    if (shape === 'ellipse') {
      const a = r() * Math.PI * 2
      x = E.cx + Math.cos(a) * rx * spread
      y = E.cy + Math.sin(a) * ry * spread
    } else {
      const side = r() * (w + h) * 2
      const out = (Math.abs(gauss(r)) * 0.2 - 0.04)
      if (side < w) { x = E.cx - rx + side; y = E.cy - ry - out * h }
      else if (side < w * 2) { x = E.cx - rx + side - w; y = E.cy + ry + out * h }
      else if (side < w * 2 + h) { x = E.cx - rx - out * w * 0.6; y = E.cy - ry + side - w * 2 }
      else { x = E.cx + rx + out * w * 0.6; y = E.cy - ry + side - w * 2 - h }
    }
    const rad = r() < 0.08 ? 1.4 + r() * 2.4 : 0.5 + r() * 1.3
    E.ctx.globalAlpha = 0.35 + r() * 0.65
    E.ctx.beginPath()
    E.ctx.arc(x, y, rad, 0, Math.PI * 2)
    E.ctx.fill()
  }

  // ——— затемнённое ядро под текстом — для контраста; мягкое, без видимой границы
  const C = canvasFor(w, h)
  C.ctx.filter = `blur(${Math.round(Math.min(w, h) * 0.12)}px)`
  C.ctx.globalAlpha = 0.95
  C.ctx.beginPath()
  if (shape === 'ellipse') C.ctx.ellipse(C.cx, C.cy, rx * 0.74, ry * 0.68, 0, 0, Math.PI * 2)
  else C.ctx.rect(C.cx - rx * 0.74, C.cy - ry * 0.78, rx * 1.48, ry * 1.56)
  C.ctx.fill()

  const masks = { edge: E.c.toDataURL('image/png'), core: C.c.toDataURL('image/png') }
  cache.set(key, masks)
  return masks
}

export const maskStyle = (url: string): CSSProperties => ({ WebkitMaskImage: `url(${url})`, maskImage: `url(${url})` })
