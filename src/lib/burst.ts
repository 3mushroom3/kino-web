/**
 * Частицы, которые вылетают от контура (узла паутины или постера), тормозят
 * и растворяются на небольшом расстоянии — волокнистый «взрыв» как на референсе.
 *
 * Производительность: частицы живут в пуле фиксированного размера, а рисуются
 * пачками — по одному path на «возрастную корзину» и палитру (~12 stroke() на кадр
 * вместо сотен), без shadowBlur и без создания градиентов в кадре.
 */
export type Rgb = [number, number, number] | number[]
export interface Outline { cx: number; cy: number; w: number; h: number; shape: 'ellipse' | 'rect' }
/** alpha — яркость палитры: светлые «волокна» и тусклая «пыль» в одном выбросе */
export interface Palette { from: Rgb; to: Rgb; alpha?: number; /** задан — рисуются точки этого радиуса, а не штрихи */ size?: number }

interface P { x: number; y: number; vx: number; vy: number; age: number; life: number; pal: number }

const FRAME = 1000 / 60
const BUCKETS = 6
const MAX = 1600

export class Burst {
  private ps: P[] = []
  palettes: Palette[] = []
  /** длина «хвоста» в кадрах движения: быстрые частицы — длинные волокна */
  tail = 2.6
  width = 1.1
  /** второй, широкий и прозрачный проход — мягкое свечение волокон (0 — выключено) */
  glow = 0.22

  constructor(palettes: Palette[]) { this.palettes = palettes }

  get size() { return this.ps.length }

  /** Точки без хвостов: плавно расходятся и гаснут (по одному path на возрастную корзину) */
  private drawDots(ctx: CanvasRenderingContext2D, pal: number, from: Rgb, to: Rgb, alpha: number, size: number) {
    for (let b = 0; b < BUCKETS; b++) {
      const f = (b + 0.5) / BUCKETS
      ctx.beginPath()
      let any = false
      for (const p of this.ps) {
        if (p.pal !== pal || Math.min(BUCKETS - 1, Math.floor((p.age / p.life) * BUCKETS)) !== b) continue
        const r = size * (1 - f * 0.4) // к концу жизни точка чуть меньше
        ctx.moveTo(p.x + r, p.y)
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2)
        any = true
      }
      if (!any) continue
      // плавное появление и долгое затухание
      const a = Math.min(1, f * 5) * Math.pow(1 - f, 1.3) * alpha
      ctx.fillStyle = `rgba(${from.map((v, j) => Math.round(v + (to[j] - v) * f))},${a.toFixed(3)})`
      ctx.fill()
    }
  }
  clear() { this.ps.length = 0 }

  /**
   * n частиц с контура o, наружу по нормали с небольшим разбросом.
   * speed — начальная скорость в px за кадр 60 Гц; при торможении 0.93 частица
   * проходит ≈ speed / 0.07, т.е. 2.4…6.5 px/кадр → 35…90 px — за ореол узла, но недалеко.
   */
  /** где на нормали рождается частица: 1 — ровно на контуре */
  inset: [number, number] = [0.96, 1.1]

  emit(o: Outline, n: number, pal = 0, speed: [number, number] = [2.4, 6.5], life: [number, number] = [45, 85]) {
    for (let i = 0; i < n && this.ps.length < MAX; i++) {
      let x: number, y: number, nx: number, ny: number
      const inset = this.inset[0] + Math.random() * (this.inset[1] - this.inset[0])
      if (o.shape === 'ellipse') {
        const a = Math.random() * Math.PI * 2
        const rx = (o.w / 2) * inset, ry = (o.h / 2) * inset
        x = o.cx + Math.cos(a) * rx; y = o.cy + Math.sin(a) * ry
        nx = Math.cos(a) / rx; ny = Math.sin(a) / ry // нормаль эллипса
      } else {
        const per = (o.w + o.h) * 2, s = Math.random() * per
        const hw = (o.w / 2) * inset, hh = (o.h / 2) * inset
        if (s < o.w) { x = o.cx - hw + (s / o.w) * hw * 2; y = o.cy - hh; nx = 0; ny = -1 }
        else if (s < o.w * 2) { x = o.cx - hw + ((s - o.w) / o.w) * hw * 2; y = o.cy + hh; nx = 0; ny = 1 }
        else if (s < o.w * 2 + o.h) { x = o.cx - hw; y = o.cy - hh + ((s - o.w * 2) / o.h) * hh * 2; nx = -1; ny = 0 }
        else { x = o.cx + hw; y = o.cy - hh + ((s - o.w * 2 - o.h) / o.h) * hh * 2; nx = 1; ny = 0 }
        // у углов направление веером, а не строго по оси
        nx += (x - o.cx) / (o.w * 1.4); ny += (y - o.cy) / (o.h * 1.4)
      }
      const len = Math.hypot(nx, ny) || 1
      const jitter = (Math.random() - 0.5) * 0.9
      const c = Math.cos(jitter), sn = Math.sin(jitter)
      const dx = (nx / len) * c - (ny / len) * sn, dy = (nx / len) * sn + (ny / len) * c
      // большинство коротких, редкие — длинные «волокна»
      const r = Math.random()
      const v = (speed[0] + (speed[1] - speed[0]) * r * r * r) * (0.55 + Math.random() * 0.45)
      this.ps.push({ x, y, vx: dx * v, vy: dy * v, age: 0, life: life[0] + Math.random() * (life[1] - life[0]), pal })
    }
  }

  /** dt — в кадрах 60 Гц (как в движке паутины) */
  step(dt: number) {
    const drag = Math.pow(0.93, dt)
    let w = 0
    for (const p of this.ps) {
      p.age += dt
      if (p.age >= p.life) continue
      p.vx *= drag; p.vy *= drag
      p.x += p.vx * dt; p.y += p.vy * dt
      this.ps[w++] = p
    }
    this.ps.length = w
  }

  draw(ctx: CanvasRenderingContext2D, alpha = 1) {
    if (!this.ps.length) return
    ctx.lineCap = 'round'
    ctx.lineWidth = this.width
    for (let pal = 0; pal < this.palettes.length; pal++) {
      const { from, to, alpha: pa = 1, size } = this.palettes[pal]
      if (size) { this.drawDots(ctx, pal, from, to, pa * alpha, size); continue }
      for (let b = 0; b < BUCKETS; b++) {
        const f = (b + 0.5) / BUCKETS // доля прожитой жизни
        ctx.beginPath()
        let any = false
        for (const p of this.ps) {
          if (p.pal !== pal || Math.min(BUCKETS - 1, Math.floor((p.age / p.life) * BUCKETS)) !== b) continue
          ctx.moveTo(p.x - p.vx * this.tail, p.y - p.vy * this.tail)
          ctx.lineTo(p.x + 0.01, p.y)
          any = true
        }
        if (!any) continue
        // появляется быстро, гаснет плавно; цвет — от светлого у контура к акценту на излёте
        const a = Math.pow(1 - f, 1.5) * alpha * pa
        const col = from.map((v, j) => Math.round(v + (to[j] - v) * f))
        if (this.glow) {
          ctx.lineWidth = this.width * 3.2
          ctx.strokeStyle = `rgba(${col},${(a * this.glow).toFixed(3)})`
          ctx.stroke()
          ctx.lineWidth = this.width
        }
        ctx.strokeStyle = `rgba(${col},${a.toFixed(3)})`
        ctx.stroke()
      }
    }
  }
}

export const frameDt = (now: number, last: number) => (last ? Math.min((now - last) / FRAME, 3) : 1)

/** Смешение двух цветов: t=0 → a, t=1 → b */
export const mix = (a: Rgb, b: Rgb, t: number) => a.map((v, i) => Math.round(v + (b[i] - v) * t))
