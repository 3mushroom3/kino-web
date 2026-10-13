import { useEffect, useRef } from 'react'
import { Burst, frameDt, mix } from '../lib/burst'
import { useReducedMotion } from '../lib/motion'
import { rgb } from '../lib/tokens'

const CREAM = [245, 240, 232]

/**
 * Аура из частиц вокруг постера: из растворённого края равномерно, без пульсов,
 * разлетаются частицы цвета текущего акцента (цвета ветки, по которой пришли).
 * accentKey меняется вместе с акцентом, чтобы перечитать цвета из CSS-токенов.
 */
export function PosterAura({ target, accentKey }: { target: React.RefObject<HTMLElement>; accentKey: string }) {
  const box = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const reduced = useReducedMotion()

  useEffect(() => {
    const cv = canvas.current!, el = box.current!, img = target.current
    if (!img) return
    const ctx = cv.getContext('2d')!
    const burst = new Burst([])
    burst.tail = 4.5
    burst.width = 1.3
    // постер растворяется по краю (маска 7–9%) — частицы рождаются прямо в этой полосе
    burst.inset = [0.9, 1.02]
    const hi = rgb('--gold-hi'), gold = rgb('--gold-glow'), deep = rgb('--gold-deep')
    burst.palettes = [
      { from: mix(hi, CREAM, 0.15), to: gold, alpha: 0.9 },
      { from: gold, to: mix(deep, [14, 14, 18], 0.3), alpha: 0.6 },
    ]

    let w = 0, h = 0
    const outline = () => {
      const a = el.getBoundingClientRect(), b = img.getBoundingClientRect()
      return { cx: b.left - a.left + b.width / 2, cy: b.top - a.top + b.height / 2, w: b.width, h: b.height, shape: 'rect' as const }
    }
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      w = el.clientWidth; h = el.clientHeight
      cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()

    /**
     * Равномерный поток без пульсов: частиц в секунду столько же, сколько раньше давали
     * волны + «дым», но рождаются они непрерывно и в случайных точках всего контура.
     * Дробные остатки копятся, чтобы темп не «дрожал» от округления.
     */
    const STREAMS: { rate: number; pal: number; speed: [number, number]; life: [number, number] }[] = [
      { rate: 1 / 500, pal: 0, speed: [1.6, 4.2], life: [40, 75] }, // светлые волокна (на 1px периметра за кадр)
      { rate: 1 / 1100, pal: 1, speed: [0.7, 2.2], life: [45, 80] }, // тусклая пыль подальше
      { rate: 1 / 640, pal: 0, speed: [0.8, 3], life: [28, 60] }, // «дым» у самой кромки
      { rate: 1 / 430, pal: 1, speed: [0.5, 2], life: [30, 70] },
    ]
    const acc = STREAMS.map(() => 0)
    const flow = (dt: number) => {
      const o = outline()
      const per = (o.w + o.h) * 2
      STREAMS.forEach((s, i) => {
        acc[i] += s.rate * per * dt
        const n = Math.floor(acc[i])
        acc[i] -= n
        if (n) burst.emit(o, n, s.pal, s.speed, s.life)
      })
      burst.step(dt)
    }
    // аура уже «установилась» к первому кадру — без нарастания при открытии страницы
    for (let i = 0; i < 90; i++) flow(1)

    if (reduced) {
      // без движения: один застывший кадр ауры
      ctx.clearRect(0, 0, w, h)
      burst.draw(ctx, 0.9)
      return
    }

    let raf = 0, last = 0, visible = true
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame)
      const dt = frameDt(now, last)
      last = now
      flow(dt)
      ctx.clearRect(0, 0, w, h)
      burst.draw(ctx)
    }
    const start = () => { if (!raf && visible) { last = 0; raf = requestAnimationFrame(frame) } }
    const stop = () => { cancelAnimationFrame(raf); raf = 0 }
    // вне экрана — не рисуем
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) start(); else stop() })
    io.observe(el)
    const ro = new ResizeObserver(resize)
    ro.observe(el)
    start()
    return () => { stop(); io.disconnect(); ro.disconnect() }
  }, [target, reduced, accentKey])

  return (
    <div className="film-aura" ref={box} aria-hidden="true">
      <canvas ref={canvas} />
    </div>
  )
}
