import { useEffect, useRef } from 'react'
import { mix } from '../lib/burst'
import { useReducedMotion } from '../lib/motion'
import { rgb } from '../lib/tokens'
import { Projector } from '../web/Web'

const CREAM = [245, 240, 232]

interface Mote { u: number; tx: number; ty: number; sp: number; r: number; br: number; ph: number }
const newMote = (u: number): Mote => ({
  u, tx: Math.random(), ty: Math.random(), sp: 0.003 + Math.random() * 0.005,
  r: Math.random() < 0.15 ? 1.3 + Math.random() * 0.8 : 0.5 + Math.random() * 0.7,
  br: 0.35 + Math.random() * 0.65, ph: Math.random() * 6.28,
})

/**
 * Проектор из паутины на странице фильма: стоит в углу блока, сам разворачивается
 * к постеру и «проецирует» его — луч света ложится на плакат, по лучу летит пыль.
 * Луч и пыль — canvas поверх постера, но под текстом; цвет — текущий акцент (accentKey).
 */
export function HeroProjector({ hero, poster, accentKey }: {
  hero: React.RefObject<HTMLElement>; poster: React.RefObject<HTMLElement>; accentKey: string
}) {
  const cam = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const reduced = useReducedMotion()

  useEffect(() => {
    const box = hero.current, img = poster.current, cv = canvas.current, pr = cam.current
    if (!box || !img || !cv || !pr) return
    const ctx = cv.getContext('2d')!
    const light = mix(rgb('--gold-hi'), CREAM, 0.25)
    const dust = mix(light, CREAM, 0.5)
    const motes = Array.from({ length: 46 }, () => newMote(Math.random()))
    let w = 0, h = 0

    // направить объектив (в SVG смотрит вниз) на центр постера
    const aim = () => {
      pr.style.transform = 'none'
      const a = box.getBoundingClientRect(), p = img.getBoundingClientRect(), c = pr.getBoundingClientRect()
      const ang = Math.atan2(p.top + p.height / 2 - (c.top + c.height / 2), p.left + p.width / 2 - (c.left + c.width / 2))
      pr.style.transform = `rotate(${ang - Math.PI / 2}rad)`
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      w = a.width; h = a.height
      cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    const draw = (dt: number, t: number) => {
      const a = box.getBoundingClientRect()
      const g = pr.querySelector('.proj-glass')!.getBoundingClientRect()
      const p = img.getBoundingClientRect()
      const lx = g.left + g.width / 2 - a.left, ly = g.top + g.height / 2 - a.top
      const R = { x: p.left - a.left, y: p.top - a.top, w: p.width, h: p.height }
      // крайние по углу углы постера — края луча
      const corners = [[R.x, R.y], [R.x + R.w, R.y], [R.x + R.w, R.y + R.h], [R.x, R.y + R.h]]
      const angs = corners.map(([x, y]) => Math.atan2(y - ly, x - lx))
      const ref = angs[0]
      const rel = angs.map((v) => { let d = v - ref; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d })
      const i0 = rel.indexOf(Math.min(...rel)), i1 = rel.indexOf(Math.max(...rel))

      ctx.clearRect(0, 0, w, h)
      ctx.save()
      ctx.globalCompositeOperation = 'lighter'
      const cx = R.x + R.w / 2, cy = R.y + R.h / 2
      const grad = ctx.createLinearGradient(lx, ly, cx, cy)
      grad.addColorStop(0, `rgba(${light},0.34)`)
      grad.addColorStop(0.5, `rgba(${light},0.13)`)
      grad.addColorStop(1, `rgba(${light},0.07)`)
      ctx.fillStyle = grad
      ctx.beginPath()
      ctx.moveTo(lx, ly)
      ctx.lineTo(corners[i0][0], corners[i0][1])
      // дальняя сторона луча идёт по контуру постера
      for (let k = 1; k <= 3; k++) {
        const idx = (i0 + k) % 4
        ctx.lineTo(corners[idx][0], corners[idx][1])
        if (idx === i1) break
      }
      ctx.closePath()
      ctx.fill()
      // пыль: от объектива к случайной точке на постере, тает при подлёте
      for (const m of motes) {
        if (!reduced) { m.u += m.sp * dt; if (m.u >= 1) Object.assign(m, newMote(0)) }
        const tx = R.x + R.w * (0.1 + m.tx * 0.8), ty = R.y + R.h * (0.1 + m.ty * 0.8)
        const sway = reduced ? 0 : Math.sin(t * 1.1 + m.ph) * 3 * m.u
        const x = lx + (tx - lx) * m.u + sway, y = ly + (ty - ly) * m.u
        const al = m.br * Math.min(1, m.u * 8) * (m.u > 0.75 ? (1 - m.u) / 0.25 : 1) * (reduced ? 1 : 0.6 + 0.4 * Math.sin(t * 2.3 + m.ph * 3))
        if (al < 0.02) continue
        ctx.fillStyle = `rgba(${dust},${(al * 0.16).toFixed(3)})`
        ctx.beginPath(); ctx.arc(x, y, m.r * 2.6, 0, Math.PI * 2); ctx.fill()
        ctx.fillStyle = `rgba(${dust},${al.toFixed(3)})`
        ctx.beginPath(); ctx.arc(x, y, m.r, 0, Math.PI * 2); ctx.fill()
      }
      ctx.restore()
    }

    aim()
    const ro = new ResizeObserver(aim)
    ro.observe(box); ro.observe(img)
    if (reduced) { draw(0, 0); return () => ro.disconnect() }

    let raf = 0, last = 0, visible = true
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame)
      const dt = last ? Math.min((now - last) / (1000 / 60), 3) : 1
      last = now
      draw(dt, now / 1000)
    }
    const start = () => { if (!raf && visible) { last = 0; raf = requestAnimationFrame(frame) } }
    const stop = () => { cancelAnimationFrame(raf); raf = 0 }
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) start(); else stop() })
    io.observe(box)
    start()
    return () => { stop(); io.disconnect(); ro.disconnect() }
  }, [hero, poster, reduced, accentKey])

  return (
    <>
      <canvas ref={canvas} className="hero-beam" aria-hidden="true" />
      <div ref={cam} className="hero-projector tone-gold" aria-hidden="true"><Projector /></div>
    </>
  )
}
