/**
 * Движок «живой паутины»: пружинная интерполяция позиций узлов,
 * покачивание, параллакс от курсора, связи и частицы на canvas.
 * DOM-узлы рендерит React, движок только пишет им transform/opacity.
 */
import { Burst, mix } from '../lib/burst'
import { prefersReducedMotion } from '../lib/motion'
import { rgb } from '../lib/tokens'

export type Tone = 'gold' | 'ash'
export interface SceneNode {
  id: string; x: number; y: number; w: number; h: number
  shape: 'ellipse' | 'rect'; depth: number; dim?: boolean; parent?: string
  /** вокруг овала света плавно расходятся частицы */
  pulse?: boolean; tone?: Tone
  /** геометрия проектора по содержимому (см. layout.fit) */
  geo?: Geo
}
/** Доли высоты узла: камера, кончик объектива, центр и полувысота овала, точка разъёма провода */
export interface Geo { cam: number; lens: number; cy: number; ry: number; plugY: number; plugX: number }
const DEFAULT_GEO: Geo = { cam: 0.34, lens: 0.324, cy: 0.69, ry: 0.3, plugY: 0.21, plugX: 0.16 }
export interface SceneDeco { id: string; x: number; y: number; r: number; parent?: string }
export interface SceneLink { from: string; to: string; kind: 'main' | 'trail' | 'deco' }
export interface Scene { nodes: SceneNode[]; decos: SceneDeco[]; links: SceneLink[] }

interface Body {
  id: string; x: number; y: number; vx: number; vy: number; tx: number; ty: number
  o: number; to: number; s: number; ts: number; w: number; h: number; tw: number; th: number; pw?: number; ph?: number
  shape: 'ellipse' | 'rect'; depth: number; phase: number; freq: number
  r?: number; deco: boolean; exiting: boolean; el?: HTMLElement | null
  dx: number; dy: number
  pulse: boolean; tone: Tone
  /** время следующего пульса, начало текущего овала, сколько частиц ещё выпустить в этом пульсе */
  /** накопитель дробной части потока частиц вокруг овала */
  acc: number
  geo: Geo
  motes?: Mote[]
}
interface LinkState extends SceneLink { a: number; ta: number; seed: number }

/** Все коэффициенты ниже подобраны для 60 кадров/с; dt — время кадра в этих единицах. */
const FRAME = 1000 / 60
/** Плавное приближение a → b, не зависящее от частоты кадров (rate — доля за 1/60 с). */
const approach = (a: number, b: number, rate: number, dt: number) => b + (a - b) * Math.pow(1 - rate, dt)

/** Геометрия узла-проектора: вертикальные доли приходят из layout (Geo), горизонтальные — здесь */
const OVAL_RX = 0.5 // полуширина овала, в долях ширины узла
const LENS_HALF = 0.09 // полуширина объектива, в долях высоты камеры (18 из 120 по ширине SVG)
/** Частицы вокруг овала: сколько рождается за кадр на 1px периметра (непрерывно, без волн) */
const RIM_RATE = { gold: 1 / 260, ash: 1 / 420 }
const CREAM = [245, 240, 232]

/**
 * Пылинка в луче — как настоящая пыль в свете проектора: круглая, разного размера,
 * летит по расходящейся траектории конуса, слегка покачиваясь и мерцая,
 * у овала замедляется и тает. u — путь от объектива (0) до центра овала (1),
 * v — положение поперёк луча (−1…1), r — радиус, ph — фаза покачивания/мерцания.
 */
interface Mote { u: number; v: number; sp: number; r: number; br: number; ph: number; wob: number }
const newMote = (u: number): Mote => ({
  u, v: (Math.random() * 2 - 1) * Math.sqrt(Math.random()),
  sp: 0.0035 + Math.random() * 0.006,
  r: Math.random() < 0.15 ? 1.4 + Math.random() * 0.8 : 0.5 + Math.random() * 0.8,
  br: 0.35 + Math.random() * 0.65, ph: Math.random() * 6.28, wob: 0.4 + Math.random() * 0.8,
})

/** Мягкое пятно-свечение, отрисованное один раз; рисуется через drawImage вместо shadowBlur. */
function glowSprite(color: number[], size = 64, core = 0) {
  const c = document.createElement('canvas')
  c.width = c.height = size
  const g = c.getContext('2d')!
  const r = size / 2
  const grad = g.createRadialGradient(r, r, 0, r, r, r)
  grad.addColorStop(0, `rgba(${color},1)`)
  grad.addColorStop(core || 0.25, `rgba(${color},${core ? 0.47 : 0.55})`)
  grad.addColorStop(1, `rgba(${color},0)`)
  g.fillStyle = grad
  g.fillRect(0, 0, size, size)
  return c
}

export class Engine {
  /** акцент (по жанру) плавно перетекает к цели — без резкой смены цвета линий и частиц */
  private GOLD: number[] = rgb('--gold-glow')
  private HI: number[] = rgb('--gold-hi')
  private goldTo: number[] = this.GOLD
  private hiTo: number[] = this.HI
  private ASH = rgb('--ash')
  /** свечение искр на проводах; перерисовывается, пока цвет акцента перетекает */
  private glowGold = glowSprite(this.GOLD)
  private burst = new Burst([])
  private decoSprite = glowSprite(this.ASH, 64, 0.7)
  private last = 0
  /** Сколько ещё кадров рисовать при уменьшенной анимации, прежде чем уснуть. */
  private wake = 0
  private bodies = new Map<string, Body>()
  private links = new Map<string, LinkState>()
  private els = new Map<string, HTMLElement>()
  private canvas: HTMLCanvasElement | null = null
  private ctx: CanvasRenderingContext2D | null = null
  private raf = 0
  private w = 0
  private h = 0
  private px = 0
  private py = 0
  private hovered: string | null = null
  private reduced = prefersReducedMotion()
  onGone: (ids: string[]) => void = () => {}

  attach(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')
    this.raf = requestAnimationFrame(this.frame)
  }
  detach() {
    cancelAnimationFrame(this.raf)
    this.canvas = null
  }
  resize(w: number, h: number) {
    this.w = w; this.h = h
    if (!this.canvas) return
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    this.canvas.width = Math.round(w * dpr)
    this.canvas.height = Math.round(h * dpr)
    this.canvas.style.width = w + 'px'
    this.canvas.style.height = h + 'px'
    this.ctx?.setTransform(dpr, 0, 0, dpr, 0, 0)
    this.wake = 90
  }
  setReduced(v: boolean) { this.reduced = v; this.wake = 90; if (v) this.burst.clear() }
  setAccent(glow: number[], hi: number[]) { this.goldTo = glow; this.hiTo = hi; this.wake = 90 }
  pointer(x: number, y: number) { this.px = x; this.py = y }
  hover(id: string | null) {
    this.hovered = id
    this.wake = 90
    this.bodies.forEach((b) => { if (!b.deco && !b.exiting) b.ts = b.id === id ? 1.07 : 1 })
  }
  register(id: string, el: HTMLElement | null) {
    if (el) this.els.set(id, el)
    else this.els.delete(id)
    const b = this.bodies.get(id)
    if (b) { b.el = el; b.pw = undefined; if (el) this.paint(b) }
    this.wake = 90
  }

  setScene(scene: Scene) {
    this.wake = 90
    const seen = new Set<string>()
    const spawn = (id: string, parent: string | undefined, x: number, y: number) => {
      const p = parent ? this.bodies.get(parent) : undefined
      return p && !this.reduced ? { x: p.x, y: p.y } : { x, y }
    }
    for (const n of scene.nodes) {
      seen.add(n.id)
      let b = this.bodies.get(n.id)
      if (!b || b.exiting && b.o < 0.05) {
        const s = spawn(n.id, n.parent, n.x, n.y)
        b = {
          id: n.id, x: s.x, y: s.y, vx: 0, vy: 0, tx: n.x, ty: n.y, o: 0, to: 1, s: 0.55, ts: 1,
          w: n.w, h: n.h, tw: n.w, th: n.h, shape: n.shape, depth: n.depth, phase: Math.random() * 6.28, freq: 0.6 + Math.random() * 0.5,
          deco: false, exiting: false, el: this.els.get(n.id), dx: s.x, dy: s.y,
          pulse: false, tone: 'ash', acc: 0, geo: n.geo ?? DEFAULT_GEO,
        }
        this.bodies.set(n.id, b)
      }
      Object.assign(b, {
        tx: n.x, ty: n.y, tw: n.w, th: n.h, shape: n.shape, depth: n.depth, exiting: false, to: n.dim ? 0.85 : 1, ts: 1,
        pulse: !!n.pulse, tone: n.tone ?? 'ash', geo: n.geo ?? DEFAULT_GEO,
      })
      if (this.reduced) { b.x = n.x; b.y = n.y; b.w = n.w; b.h = n.h }
    }
    for (const d of scene.decos) {
      seen.add(d.id)
      let b = this.bodies.get(d.id)
      if (!b) {
        const s = spawn(d.id, d.parent, d.x, d.y)
        b = {
          id: d.id, x: s.x, y: s.y, vx: 0, vy: 0, tx: d.x, ty: d.y, o: 0, to: 1, s: 1, ts: 1, w: d.r * 2, h: d.r * 2, tw: d.r * 2, th: d.r * 2,
          shape: 'ellipse', depth: 1.2, phase: Math.random() * 6.28, freq: 0.3 + Math.random() * 0.4, r: d.r,
          deco: true, exiting: false, dx: s.x, dy: s.y,
          pulse: false, tone: 'ash', acc: 0, geo: DEFAULT_GEO,
        }
        this.bodies.set(d.id, b)
      }
      Object.assign(b, { tx: d.x, ty: d.y, r: d.r, w: d.r * 2, h: d.r * 2, exiting: false, to: 1 })
      if (this.reduced) { b.x = d.x; b.y = d.y }
    }
    const gone: string[] = []
    this.bodies.forEach((b) => {
      if (!seen.has(b.id) && !b.exiting) { b.exiting = true; b.to = 0; b.ts = 0.7 }
      if (b.exiting && this.reduced) gone.push(b.id)
    })
    const keys = new Set<string>()
    for (const l of scene.links) {
      const k = l.from + '>' + l.to
      keys.add(k)
      const cur = this.links.get(k)
      if (cur) Object.assign(cur, l, { ta: 1 })
      else this.links.set(k, { ...l, a: 0, ta: 1, seed: Math.random() })
    }
    this.links.forEach((l, k) => { if (!keys.has(k)) l.ta = 0 })
    if (gone.length) { gone.forEach((id) => this.bodies.delete(id)); this.onGone(gone) }
  }

  private paint(b: Body) {
    const el = b.el
    if (!el) return
    if (b.pw !== Math.round(b.w) || b.ph !== Math.round(b.h)) {
      b.pw = Math.round(b.w); b.ph = Math.round(b.h)
      el.style.width = b.pw + 'px'; el.style.height = b.ph + 'px'
    }
    el.style.transform = `translate3d(${(b.dx - b.w / 2).toFixed(1)}px, ${(b.dy - b.h / 2).toFixed(1)}px, 0) scale(${b.s.toFixed(3)})`
    el.style.opacity = b.o.toFixed(3)
    el.style.pointerEvents = b.exiting || b.o < 0.3 ? 'none' : ''
  }

  private frame = (now: number) => {
    this.raf = requestAnimationFrame(this.frame)
    // dt в «кадрах по 60 Гц»: на 120/144 Гц шаг меньше, и сцена движется с той же скоростью.
    // Ограничение 3 — после неактивной вкладки пружины не «выстреливают».
    const dt = this.last ? Math.min((now - this.last) / FRAME, 3) : 1
    this.last = now
    const reduced = this.reduced
    // при уменьшенной анимации частиц нет: дорисовываем переход и засыпаем до следующего изменения
    if (reduced && this.wake <= 0) return
    this.wake -= dt
    const t = now / 1000
    const k = reduced ? 0.3 : 0.055, damp = Math.pow(reduced ? 0.5 : 0.8, dt)
    const pcx = this.w / 2, pcy = this.h / 2
    const gone: string[] = []
    this.bodies.forEach((b) => {
      b.vx = (b.vx + (b.tx - b.x) * k * dt) * damp
      b.vy = (b.vy + (b.ty - b.y) * k * dt) * damp
      b.x += b.vx * dt; b.y += b.vy * dt
      b.o = approach(b.o, b.to, reduced ? 0.3 : 0.09, dt)
      b.s = approach(b.s, b.ts, 0.14, dt)
      b.w = approach(b.w, b.tw, 0.12, dt); b.h = approach(b.h, b.th, 0.12, dt)
      let ox = 0, oy = 0
      if (!reduced) {
        const amp = b.deco ? 5 : 2.6
        ox = Math.sin(t * b.freq + b.phase) * amp + (this.px - pcx) * 0.012 * b.depth
        oy = Math.cos(t * b.freq * 0.8 + b.phase) * amp + (this.py - pcy) * 0.012 * b.depth
      }
      b.dx = b.x + ox; b.dy = b.y + oy
      if (!b.deco) this.paint(b)
      if (b.exiting && b.o < 0.02) gone.push(b.id)
    })
    if (gone.length) {
      gone.forEach((id) => this.bodies.delete(id))
      this.onGone(gone.filter((id) => !id.startsWith('d:')))
    }
    this.tickAccent(dt)
    if (!reduced) this.tickRim(dt)
    this.draw(t, dt)
  }

  /** Цвет акцента (лучи, рябь, частицы) догоняет цель за ~0.6 с. */
  private tickAccent(dt: number) {
    const moving = this.GOLD.some((v, i) => Math.abs(v - this.goldTo[i]) > 0.5) || this.HI.some((v, i) => Math.abs(v - this.hiTo[i]) > 0.5)
    if (!moving) return
    this.GOLD = this.GOLD.map((v, i) => approach(v, this.goldTo[i], 0.12, dt))
    this.HI = this.HI.map((v, i) => approach(v, this.hiTo[i], 0.12, dt))
    this.glowGold = glowSprite(this.GOLD.map(Math.round))
  }

  /**
   * Частицы вокруг овала: рождаются непрерывно в случайных точках кромки и плавно
   * расходятся наружу — медленно, с затуханием, без волн и колец. Дробная часть
   * темпа копится в b.acc, чтобы поток был ровным на любой частоте кадров.
   */
  private tickRim(dt: number) {
    this.bodies.forEach((b) => {
      if (b.deco || !b.pulse || b.exiting || b.o < 0.5) return
      const o = this.pool(b)
      const perim = Math.PI * (o.w + o.h) / 2
      const hot = this.hovered === b.id
      b.acc += perim * RIM_RATE[b.tone] * (hot ? 1.8 : 1) * dt
      const n = Math.floor(b.acc)
      if (!n) return
      b.acc -= n
      const base = b.tone === 'gold' ? 0 : 2
      for (let i = 0; i < n; i++) {
        // треть — яркие точки, остальное — тусклая пыль
        this.burst.emit(o, 1, Math.random() < 0.35 ? base : base + 1, hot ? [0.5, 1.6] : [0.3, 1.1], [70, 130])
      }
    })
    this.burst.step(dt)
  }

  /**
   * Разъём провода — бок корпуса проектора, обращённый к соседу (side = ±1).
   * Корпус в SVG занимает x 16…104 из 120 при высоте камеры 34% узла → край ≈ 0.15h от оси.
   */
  private plug(b: Body, side: number) {
    if (b.deco) return { x: b.dx, y: b.dy }
    const h = b.h * b.s
    return { x: b.dx + side * h * b.geo.plugX, y: b.dy - h / 2 + h * b.geo.plugY }
  }

  /** Овал света, в который ложится луч, — от его кромки идёт рябь и вылетают частицы. */
  private pool(b: Body) {
    const w = b.w * b.s, h = b.h * b.s
    return { cx: b.dx, cy: b.dy - h / 2 + h * b.geo.cy, w: w * OVAL_RX * 2, h: h * b.geo.ry * 2, shape: 'ellipse' as const }
  }

  /** Цвет света узла: у «золотых» (центр, фильмы) — акцент, у вариантов — тёплый белый с оттенком акцента. */
  private lightOf(b: Body, GOLD: number[]) {
    return b.tone === 'gold' ? mix(GOLD, CREAM, 0.3) : mix(CREAM, GOLD, 0.22)
  }

  /**
   * Свет проекторов: конус от объектива расширяется до полной ширины овала,
   * овал — мягкое пятно с чёткой кромкой. Под текстом свет полупрозрачный (≈30%),
   * поэтому светлые подписи читаются. По лучу от объектива к овалу течёт поток
   * частиц и растворяется в овале.
   */
  private drawLights(ctx: CanvasRenderingContext2D, t: number, dt: number, GOLD: number[]) {
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    this.bodies.forEach((b) => {
      if (b.deco || b.o < 0.02) return
      const h = b.h * b.s
      const top = b.dy - h / 2
      const lx = b.dx, ly = top + h * b.geo.lens, lh = h * b.geo.cam * LENS_HALF
      const ov = this.pool(b), rx = ov.w / 2, ry = ov.h / 2
      const hot = this.hovered === b.id
      const k = b.o * (hot ? 1.35 : 1)
      const light = this.lightOf(b, GOLD)

      // луч — одна фигура: от объектива по касательным к овалу и дальше по его нижней дуге,
      // поэтому свет заливает овал целиком, без шва посередине.
      // Касательные из точки (0, −d) к единичной окружности: y' = −1/d, x' = ±√(1 − 1/d²).
      const d = Math.max(1.05, (ov.cy - ly) / ry)
      const s = Math.sqrt(1 - 1 / (d * d))
      const aL = Math.atan2(-1 / d, -s), aR = Math.atan2(-1 / d, s)
      const g = ctx.createLinearGradient(lx, ly, lx, ov.cy + ry)
      g.addColorStop(0, `rgba(${light},${(0.42 * k).toFixed(3)})`)
      g.addColorStop(0.55, `rgba(${light},${(0.17 * k).toFixed(3)})`)
      g.addColorStop(1, `rgba(${light},${(0.1 * k).toFixed(3)})`)
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.moveTo(lx + lh, ly)
      ctx.lineTo(ov.cx + rx * s, ov.cy - ry / d)
      ctx.ellipse(ov.cx, ov.cy, rx, ry, 0, aR, aL, false) // по нижней дуге справа налево
      ctx.lineTo(lx - lh, ly)
      ctx.closePath(); ctx.fill()

      // овал света: радиальный градиент, сжатый по вертикали
      ctx.save()
      ctx.translate(ov.cx, ov.cy)
      ctx.scale(1, ry / rx)
      const rg = ctx.createRadialGradient(0, 0, 0, 0, 0, rx)
      rg.addColorStop(0, `rgba(${light},${(0.12 * k).toFixed(3)})`)
      rg.addColorStop(0.7, `rgba(${light},${(0.1 * k).toFixed(3)})`)
      rg.addColorStop(0.94, `rgba(${light},${(0.09 * k).toFixed(3)})`)
      rg.addColorStop(1, `rgba(${light},0)`)
      ctx.fillStyle = rg
      ctx.beginPath(); ctx.arc(0, 0, rx, 0, Math.PI * 2); ctx.fill()
      ctx.restore()
      ctx.strokeStyle = `rgba(${light},${(0.32 * k).toFixed(3)})`
      ctx.lineWidth = 1.2
      ctx.beginPath(); ctx.ellipse(ov.cx, ov.cy, rx * 0.985, ry * 0.985, 0, 0, Math.PI * 2); ctx.stroke()

      // пыль в луче: круглые пылинки летят по расходящимся траекториям конуса,
      // покачиваются и мерцают, у овала замедляются и тают
      if (!b.motes) b.motes = Array.from({ length: b.tone === 'gold' ? 40 : 26 }, () => newMote(Math.random()))
      const [r, gg, bl] = mix(light, CREAM, 0.5)
      for (const m of b.motes) {
        if (!this.reduced) {
          m.u += m.sp * (1 - 0.55 * m.u) * (hot ? 1.8 : 1) * dt // торможение к овалу
          if (m.u >= 1) Object.assign(m, newMote(0))
        }
        const half = lh + (rx * 0.85 - lh) * m.u // ширина конуса на этой глубине
        const sway = this.reduced ? 0 : Math.sin(t * 1.1 + m.ph) * m.wob * (1.5 + 6 * m.u)
        const x = lx + m.v * half + sway
        const y = ly + (ov.cy - ly + ry * 0.4 * Math.cos(m.ph)) * m.u // оседает в разных местах овала
        const twinkle = this.reduced ? 1 : 0.6 + 0.4 * Math.sin(t * 2.3 + m.ph * 3)
        const a = k * m.br * twinkle * Math.min(1, m.u * 8) * (m.u > 0.72 ? (1 - m.u) / 0.28 : 1)
        if (a < 0.02) continue
        ctx.fillStyle = `rgba(${r},${gg},${bl},${(a * 0.16).toFixed(3)})` // мягкий ореол
        ctx.beginPath(); ctx.arc(x, y, m.r * 2.6, 0, Math.PI * 2); ctx.fill()
        ctx.fillStyle = `rgba(${r},${gg},${bl},${a.toFixed(3)})`
        ctx.beginPath(); ctx.arc(x, y, m.r, 0, Math.PI * 2); ctx.fill()
      }
    })
    ctx.restore()
  }

  /**
   * Провод между проекторами: кубическая кривая, обе ручки подняты вверх —
   * провод уходит аркой над корпусами и не пересекает лучи, которые светят вниз.
   * Лёгкое покачивание (кроме уменьшенной анимации) — провода «живые».
   */
  private cable(A: Body, B: Body, l: LinkState, t: number, lift = 1) {
    const side = B.dx >= A.dx ? 1 : -1
    const p0 = this.plug(A, side), p3 = this.plug(B, -side)
    const dx = p3.x - p0.x, dist = Math.hypot(dx, p3.y - p0.y)
    const sway = this.reduced ? 0 : Math.sin(t * 0.7 + l.seed * 6.28) * 5
    if (p3.y < p0.y - 30) {
      // сосед выше — провод уходит аркой вверх, над корпусами
      const k = (34 + dist * 0.26 + sway) * lift
      return [p0.x, p0.y, p0.x + dx * 0.12, p0.y - k, p3.x - dx * 0.12, p3.y - k, p3.x, p3.y] as const
    }
    // сосед сбоку или ниже — провод неглубоко провисает, как настоящий кабель, и не взлетает над чужими лучами
    const k = (16 + dist * 0.1 + sway) * lift
    return [p0.x, p0.y, p0.x + dx * 0.3, p0.y + k, p3.x - dx * 0.3, p3.y + k, p3.x, p3.y] as const
  }

  private draw(t: number, dt: number) {
    const ctx = this.ctx
    if (!ctx) return
    const GOLD = this.GOLD.map(Math.round), ASH = this.ASH
    ctx.clearRect(0, 0, this.w, this.h)
    // декоративные узлы — глубина сети
    this.bodies.forEach((b) => {
      if (!b.deco || b.o < 0.01) return
      ctx.globalAlpha = 0.34 * b.o
      ctx.drawImage(this.decoSprite, b.dx - b.r!, b.dy - b.r!, b.r! * 2, b.r! * 2)
    })
    ctx.globalAlpha = 1
    const dead: string[] = []
    this.links.forEach((l, key) => {
      l.a = approach(l.a, l.ta, 0.08, dt)
      if (l.ta === 0 && l.a < 0.01) { dead.push(key); return }
      const A = this.bodies.get(l.from), B = this.bodies.get(l.to)
      if (!A || !B) return
      const alpha = l.a * Math.min(A.o, B.o)
      if (alpha < 0.01) return
      ctx.lineCap = 'round'
      if (l.kind === 'deco') {
        const c = this.cable(A, B, l, t, 0.5)
        ctx.strokeStyle = `rgba(${ASH},${0.18 * alpha})`
        ctx.lineWidth = 1
        ctx.beginPath(); ctx.moveTo(c[0], c[1]); ctx.bezierCurveTo(c[2], c[3], c[4], c[5], c[6], c[7]); ctx.stroke()
        return
      }
      const c = this.cable(A, B, l, t)
      const path = () => { ctx.beginPath(); ctx.moveTo(c[0], c[1]); ctx.bezierCurveTo(c[2], c[3], c[4], c[5], c[6], c[7]) }
      if (l.kind === 'trail') {
        // след «Назад» — тонкий пунктирный провод: пройденный шаг, по нему ничего не бежит
        ctx.strokeStyle = `rgba(${ASH},${0.45 * alpha})`
        ctx.lineWidth = 1.4
        ctx.setLineDash([4, 7])
        path(); ctx.stroke()
        ctx.setLineDash([])
        return
      }
      const hot = this.hovered === l.to || this.hovered === l.from
      // провод: тёмная оплётка + блик сверху (при наведении блик — цвета акцента)
      ctx.strokeStyle = `rgba(14,15,19,${alpha})`; ctx.lineWidth = 4.4; path(); ctx.stroke()
      ctx.strokeStyle = `rgba(66,70,80,${alpha})`; ctx.lineWidth = 2.6; path(); ctx.stroke()
      ctx.strokeStyle = hot ? `rgba(${GOLD},${0.75 * alpha})` : `rgba(${ASH},${0.5 * alpha})`; ctx.lineWidth = 0.9; path(); ctx.stroke()
      // разъёмы на концах
      for (const [x, y] of [[c[0], c[1]], [c[6], c[7]]]) {
        ctx.fillStyle = `rgba(14,15,19,${alpha})`
        ctx.beginPath(); ctx.arc(x, y, 4.2, 0, Math.PI * 2); ctx.fill()
        ctx.fillStyle = `rgba(${GOLD},${0.9 * alpha})`
        ctx.beginPath(); ctx.arc(x, y, 2.4, 0, Math.PI * 2); ctx.fill()
      }
      // золотые искры бегут по проводу от центра к дочернему проектору
      const len = (Math.hypot(c[2] - c[0], c[3] - c[1]) + Math.hypot(c[4] - c[2], c[5] - c[3]) + Math.hypot(c[6] - c[4], c[7] - c[5]) + Math.hypot(c[6] - c[0], c[7] - c[1])) / 2
      const speed = this.reduced ? 0 : (hot ? 160 : 90) / Math.max(len, 60)
      const n = hot ? 5 : 3
      for (let i = 0; i < n; i++) {
        const p = (((t * speed + l.seed + i / n) % 1) + 1) % 1
        const q = 1 - p
        const x = q * q * q * c[0] + 3 * q * q * p * c[2] + 3 * q * p * p * c[4] + p * p * p * c[6]
        const y = q * q * q * c[1] + 3 * q * q * p * c[3] + 3 * q * p * p * c[5] + p * p * p * c[7]
        const a = alpha * Math.sin(Math.PI * p)
        const g = hot ? 13 : 9
        ctx.globalAlpha = a * 0.9
        ctx.drawImage(this.glowGold, x - g, y - g, g * 2, g * 2)
        ctx.globalAlpha = 1
        ctx.fillStyle = `rgba(${mix(GOLD, CREAM, 0.45)},${a.toFixed(3)})`
        ctx.beginPath(); ctx.arc(x, y, 1.8, 0, Math.PI * 2); ctx.fill()
      }
    })
    dead.forEach((k) => this.links.delete(k))
    this.drawLights(ctx, t, dt, GOLD)
    if (!this.reduced) this.drawRim()
  }

  private drawRim() {
    const ctx = this.ctx!
    const GOLD = this.GOLD.map(Math.round), HI = this.HI.map(Math.round), ASH = this.ASH
    // точки вокруг овала: у кромки светлые, отходя — гаснут в цвет акцента (яркие крупнее, пыль мельче)
    this.burst.palettes = [
      { from: mix(HI, CREAM, 0.35), to: GOLD, alpha: 0.85, size: 1.3 },
      { from: GOLD, to: mix(GOLD, [14, 14, 18], 0.4), alpha: 0.5, size: 0.8 },
      { from: mix(ASH, CREAM, 0.45), to: mix(ASH, GOLD, 0.35), alpha: 0.7, size: 1.1 },
      { from: mix(ASH, GOLD, 0.25), to: ASH, alpha: 0.4, size: 0.7 },
    ]
    this.burst.draw(ctx)
  }
}
