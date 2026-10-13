import { ANY, availableOptions, stepById, choiceLabel, filterBy, nextStep, sortByRating, type Choice, type Step } from '../data/criteria'
import { byId, filmsWord, rating, type Movie } from '../data/movies'
import type { Geo, Scene, SceneDeco, SceneLink, SceneNode } from './engine'

export interface WebState { started: boolean; path: Choice[]; filmId: number | null }
export const INITIAL: WebState = { started: false, path: [], filmId: null }

export type Role = 'root' | 'center' | 'option' | 'history' | 'movie' | 'film' | 'action'
export interface NodeView extends SceneNode {
  role: Role
  tone: 'gold' | 'ash'
  label: string
  sub?: string
  kicker?: string
  movie?: Movie
  action: Action
}
export type Action =
  | { type: 'start' }
  | { type: 'choose'; choice: Choice }
  | { type: 'back' }
  | { type: 'film'; id: number }
  | { type: 'details'; id: number }
  | { type: 'catalog' }
  | { type: 'restart' }
  | { type: 'none' }

export type Stage =
  | { kind: 'intro' }
  | { kind: 'ask'; step: Step; candidates: Movie[] }
  | { kind: 'results'; candidates: Movie[] }
  | { kind: 'film'; movie: Movie; candidates: Movie[] }

export function stageOf(s: WebState): Stage {
  if (!s.started) return { kind: 'intro' }
  const candidates = filterBy(s.path).sort(sortByRating)
  if (s.filmId != null) {
    const movie = byId(s.filmId)
    if (movie) return { kind: 'film', movie, candidates }
  }
  const step = nextStep(s.path)
  if (step) return { kind: 'ask', step, candidates }
  return { kind: 'results', candidates }
}

export const choiceId = (c: Choice) => `c:${c.step}:${c.option}`
export const MAX_IN_WEB = 4

/** Псевдослучайность, стабильная между перерисовками */
function hash(s: string) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return ((h >>> 0) % 10000) / 10000
}

export interface Layout { views: NodeView[]; scene: Scene; compact: boolean; stage: Stage }

/**
 * Размеры шрифтов узлов — те же, что в styles.css: [доля ширины, минимум px] для названия и подписи.
 * Нужны, чтобы оценить высоту текста и подогнать под неё овал света.
 */
const FONTS: Record<Role, { label: [number, number]; sub: [number, number] }> = {
  root: { label: [0.08, 15], sub: [0.066, 13] },
  center: { label: [0.09, 16], sub: [0.056, 13] },
  option: { label: [0.086, 15], sub: [0.064, 12] },
  history: { label: [0.1, 0], sub: [0.085, 11] },
  action: { label: [0.105, 0], sub: [0.07, 12] },
  movie: { label: [0.096, 0], sub: [0.074, 12] },
  film: { label: [0.09, 0], sub: [0.056, 12] },
}
const TEXT_W = 0.72 // ширина текстового блока в овале (left/right 14%)
const INSCRIBED = 0.69 // высота прямоугольника, вписанного в эллипс при ширине 0.72: √(1 − 0.72²)

/**
 * Узел-проектор по содержимому: камера сверху, луч, затем овал ровно такой высоты,
 * чтобы текст заполнял вписанный в него прямоугольник, — без пустого света.
 * Возвращает высоту узла и геометрию в долях высоты (её читают CSS и engine).
 */
function fit(role: Role, w: number, label: string, sub?: string, kicker?: string, poster = false): { h: number; geo: Geo } {
  const fs = FONTS[role]
  const avail = w * TEXT_W
  const font = (k: [number, number]) => Math.max(k[1], k[0] * w)
  // грубая оценка строк: средняя ширина знака ≈ 0.53 кегля, +10% на переносы по словам
  const lines = (text: string, size: number) => Math.max(1, Math.ceil((text.length * size * 0.53 * 1.1) / avail))
  const gap = 0.02 * w
  const lf = font(fs.label), sf = font(fs.sub)
  let textH = lines(label, lf) * lf * 1.12
  if (sub) textH += gap + lines(sub, sf) * sf * 1.25
  if (kicker) textH += gap + sf * 1.2
  if (role === 'film') textH += gap + 13 * 1.25 // строка жанров
  if (poster) textH += gap + avail * (role === 'film' ? 0.58 : 0.52) * (4 / 3)
  const ry = Math.max(textH / 2 / INSCRIBED + 0.03 * w, 0.13 * w)
  const cam = w * 0.38
  const lens = cam * 0.954
  const beam = cam * 0.62
  const h = lens + beam + ry * 2 + 2
  return { h, geo: { cam: cam / h, lens: lens / h, cy: (lens + beam + ry) / h, ry: ry / h, plugY: (cam * 0.62) / h, plugX: (cam * 0.44) / h } }
}

export function layout(state: WebState, W: number, H: number): Layout {
  const stage = stageOf(state)
  const compact = W < 720
  const f = compact ? Math.max(0.66, Math.min(W / 520, 0.8)) : Math.max(0.68, Math.min(W / 1320, H / 780, 1.05))
  const views: NodeView[] = []
  const links: SceneLink[] = []
  const decos: SceneDeco[] = []

  // безопасная зона: сверху заголовка больше нет, снизу — панель с крошками и кнопками
  const topSafe = compact ? 8 : 16, botSafe = compact ? 118 : 78
  const midY = (topSafe + H - botSafe) / 2
  const cx = W / 2
  // центр сети — посередине доступной высоты; на мобильном блок ещё раз центрируется ниже, по факту раскладки
  const cy = midY
  const rx = Math.min(W * 0.36, 500)
  const ry = Math.min(H * 0.33, 270)
  const ryBig = Math.min((H - topSafe - botSafe) / 2 - 214 * f / 2, ry * 1.12)

  const path = state.path
  const centerId = path.length ? choiceId(path[path.length - 1]) : 'root'
  const historyId = path.length >= 2 ? choiceId(path[path.length - 2]) : path.length === 1 ? 'root' : null

  const add = (v: Omit<NodeView, 'depth' | 'shape'> & Partial<Pick<NodeView, 'depth' | 'shape'>>) => {
    const n: NodeView = { depth: 0.5, shape: 'ellipse', ...v }
    Object.assign(n, fit(n.role, n.w, n.label, n.sub, n.kicker, !!n.movie)) // высота — по содержимому
    views.push(n)
    return n
  }
  /** размер дочернего узла: ширина из макета, высота — по тексту в овале */
  const sized = (k: { role: Role; w0: number; label: string; sub?: string; kicker?: string; movie?: Movie }, scale: number) => {
    const w = k.w0 * scale
    return { w, ...fit(k.role, w, k.label, k.sub, k.kicker, !!k.movie) }
  }

  // ——— центр
  let center: NodeView
  if (stage.kind === 'intro' || centerId === 'root' && stage.kind !== 'film') {
    const intro = stage.kind === 'intro'
    // узлы — кинопроекторы: камера сверху, луч вниз, подпись в пятне света
    center = add({
      id: 'root', role: 'root', tone: 'gold', x: cx, y: cy,
      w: (intro ? 320 : compact ? 206 : 236) * f, h: (intro ? 390 : compact ? 250 : 288) * f, depth: 0.2,
      label: 'Не знаешь, что включить?', sub: intro ? 'Начни с жанра!' : 'Выбери жанр',
      action: intro ? { type: 'start' } : { type: 'none' },
    })
  } else if (stage.kind === 'film') {
    const fx = compact ? cx : cx - Math.min(W * 0.17, 230)
    const fy = compact ? H * 0.4 : cy + 10
    center = add({
      id: `m:${stage.movie.id}`, role: 'film', tone: 'gold', shape: 'rect', x: fx, y: fy,
      w: 280 * f, h: 420 * f, depth: 0.2, label: stage.movie.title, movie: stage.movie,
      action: { type: 'details', id: stage.movie.id },
    })
  } else {
    const last = path[path.length - 1]
    const sub = stage.kind === 'ask' ? stage.step.title : stage.candidates.length ? `Нашлось: ${filmsWord(stage.candidates.length)}` : 'Ничего не нашлось'
    center = add({
      id: centerId, role: 'center', tone: 'gold', x: cx, y: cy, w: (compact ? 206 : 236) * f, h: (compact ? 250 : 288) * f, depth: 0.2,
      label: last.option === ANY ? `${stepById(last.step).short}: не важно` : choiceLabel(last), sub, action: { type: 'none' },
    })
  }

  // ——— предыдущий шаг (след в сети)
  let history: NodeView | null = null
  const histParent = stage.kind === 'film' ? centerId : historyId
  if (stage.kind !== 'intro' && histParent) {
    const isRoot = histParent === 'root'
    const choice = isRoot ? null : stage.kind === 'film' ? path[path.length - 1] : path[path.length - 2]
    let hx: number, hy: number
    if (stage.kind === 'film') {
      hx = compact ? 16 + 70 * f : cx + Math.min(W * 0.2, 280)
      hy = compact ? 46 * f + 8 : cy - ry * 0.72
    } else if (compact) {
      hx = 16 + 70 * f; hy = Math.max(cy - 130 * f - 40, 56 * f)
    } else {
      hx = cx - rx * 1.02; hy = cy - ry * 0.78
    }
    history = add({
      id: histParent, role: 'history', tone: 'ash', x: hx, y: hy, w: 130 * f, h: 160 * f, depth: 0.7, dim: true,
      label: isRoot ? 'Жанры' : choiceLabel(choice!), kicker: '← Назад', action: { type: 'back' },
    })
    links.push({ from: history.id, to: center.id, kind: 'trail' })
  }

  // ——— дочерние узлы
  type Child = Omit<NodeView, 'x' | 'y' | 'w' | 'h' | 'shape' | 'depth'> & { w0: number; h0: number; shape?: 'ellipse' | 'rect' }
  const kids: Child[] = []
  if (stage.kind === 'ask') {
    for (const { option, count } of availableOptions(stage.step, stage.candidates)) {
      const c = { step: stage.step.id, option: option.id }
      kids.push({
        id: choiceId(c), role: 'option', tone: 'ash', w0: 196, h0: 238, label: option.label,
        sub: compact ? filmsWord(count) : [option.hint, filmsWord(count)].filter(Boolean).join(' · '),
        action: { type: 'choose', choice: c }, parent: center.id,
      })
    }
    if (stage.step.id !== 'genre') {
      const c = { step: stage.step.id, option: ANY }
      kids.push({
        id: choiceId(c), role: 'option', tone: 'ash', w0: 156, h0: 190, label: 'Не важно',
        sub: filmsWord(stage.candidates.length), action: { type: 'choose', choice: c }, parent: center.id,
      })
    }
  } else if (stage.kind === 'results') {
    for (const m of stage.candidates.slice(0, MAX_IN_WEB)) {
      kids.push({
        id: `m:${m.id}`, role: 'movie', tone: 'gold', shape: 'rect', w0: 190, h0: 304, label: m.title, movie: m,
        sub: `${m.year} · КП ${m.kp ? rating(m.kp.value) : '—'}`, action: { type: 'film', id: m.id }, parent: center.id,
      })
    }
    if (stage.candidates.length)
      kids.push({
        id: 'a:catalog', role: 'action', tone: 'ash', w0: 176, h0: 214,
        label: stage.candidates.length > MAX_IN_WEB ? `Все ${stage.candidates.length} карточками` : 'Открыть карточками',
        action: { type: 'catalog' }, parent: center.id,
      })
    else
      kids.push({ id: 'a:restart', role: 'action', tone: 'ash', w0: 190, h0: 230, label: 'Начать заново', sub: 'подходящих фильмов нет', action: { type: 'restart' }, parent: center.id })
  } else if (stage.kind === 'film') {
    kids.push({ id: 'a:more', role: 'action', tone: 'ash', w0: 176, h0: 214, label: 'Подробнее', sub: 'сюжет, актёры, награды', action: { type: 'details', id: stage.movie.id }, parent: center.id })
    const others = stage.candidates.filter((m) => m.id !== stage.movie.id).slice(0, 2)
    for (const m of others)
      kids.push({ id: `m:${m.id}`, role: 'movie', tone: 'gold', shape: 'rect', w0: 136, h0: 222, label: m.title, movie: m, sub: `${m.year}`, action: { type: 'film', id: m.id }, parent: center.id, dim: true })
  }

  const n = kids.length
  if (stage.kind === 'film') {
    // композиция по мотивам Desktop-3: карточка слева, ветки справа
    kids.forEach((k, i) => {
      const { w, h, geo } = sized(k, f)
      let x: number, y: number
      if (compact) {
        const cols = Math.min(n, 3)
        x = W * ((i % cols) + 0.5) / cols
        y = center.y + center.h / 2 + 50 + h / 2
      } else if (i === 0) {
        x = center.x + center.w / 2 + Math.min(W * 0.14, 190); y = center.y + center.h * 0.42
      } else {
        x = cx + Math.min(W * 0.3, 420); y = center.y + (i === 1 ? -center.h * 0.08 : center.h * 0.42)
      }
      views.push({ ...k, x, y, w, h, geo, depth: 0.5, shape: k.shape ?? 'ellipse' } as NodeView)
      links.push({ from: center.id, to: k.id, kind: 'main' })
    })
  } else if (compact) {
    const cols = 2
    const kf = f * 0.82 // проекторы высокие — на телефоне чуть мельче, чтобы колонка влезла
    const rowH = Math.max(...kids.map((k) => sized(k, kf).h), 0) + 8
    const top = center.y + center.h / 2 + 24
    kids.forEach((k, i) => {
      const { w, h, geo } = sized(k, kf)
      const row = Math.floor(i / cols)
      const inRow = Math.min(cols, n - row * cols)
      const x = W * ((i % cols) + 0.5) / inRow
      views.push({ ...k, x: inRow === 1 ? cx : x, y: top + row * rowH + rowH / 2, w, h, geo, depth: 0.5, shape: k.shape ?? 'ellipse' } as NodeView)
      // второй и следующие ряды подключаются к узлу над собой — линии не проходят сквозь узлы
      links.push({ from: row === 0 ? center.id : kids[i - cols].id, to: k.id, kind: 'main' })
    })
  } else {
    // по эллипсу; если есть «след» слева сверху — пропускаем этот сектор.
    // Когда вариантов мало, они собираются в дугу напротив «следа», а не разбегаются по углам.
    const fullSpan = history ? 290 : 360
    // фильмы с постером — высокие проекторы: им нужен больший шаг по дуге, иначе соседи налезают
    const span = Math.min(fullSpan, n * (stage.kind === 'results' ? 105 : 72))
    const mid = span === fullSpan ? (history ? -100 : -90) + fullSpan / 2 : history ? 38 : 90
    const start = mid - span / 2
    const big = stage.kind === 'results'
    kids.forEach((k, i) => {
      const deg = start + (i + 0.5) * (span / n)
      const a = (deg * Math.PI) / 180
      const { w, h, geo } = sized(k, f)
      const stretch = big ? 1.08 : 1
      views.push({
        ...k, w, h, geo, depth: 0.5, shape: k.shape ?? 'ellipse',
        x: cx + Math.cos(a) * rx * stretch, y: cy + Math.sin(a) * (big ? ryBig : ry),
      } as NodeView)
      links.push({ from: center.id, to: k.id, kind: 'main' })
    })
  }

  // ——— мобильный: колонка узлов центрируется по высоте целиком, а не прилипает к верху
  if (compact) {
    const top = Math.min(...views.map((v) => v.y - v.h / 2))
    const bottom = Math.max(...views.map((v) => v.y + v.h / 2))
    const room = H - botSafe - topSafe
    const shift = bottom - top < room ? midY - (top + bottom) / 2 : topSafe - top
    for (const v of views) v.y += shift
  }

  // ——— держим узлы внутри безопасной зоны (панель снизу)
  const clamp = () => {
    for (const v of views) {
      if (v.id === center.id) continue
      v.x = Math.min(Math.max(v.x, v.w / 2 + 12), W - v.w / 2 - 12)
      v.y = Math.min(Math.max(v.y, v.h / 2 + topSafe), H - v.h / 2 - botSafe)
    }
  }
  clamp()

  // ——— проекторы разной высоты не должны налезать друг на друга: пересекающиеся узлы
  // раздвигаются вдоль оси наименьшего перекрытия (центр неподвижен), затем снова в безопасную зону
  const GAP = 14
  for (let iter = 0; iter < 24; iter++) {
    let moved = false
    for (let i = 0; i < views.length; i++) for (let j = i + 1; j < views.length; j++) {
      const a = views[i], b = views[j]
      const ox = (a.w + b.w) / 2 + GAP - Math.abs(a.x - b.x)
      const oy = (a.h + b.h) / 2 + GAP - Math.abs(a.y - b.y)
      if (ox <= 0 || oy <= 0) continue
      moved = true
      const fixedA = a.id === center.id, fixedB = b.id === center.id
      const ka = fixedA ? 0 : fixedB ? 1 : 0.5, kb = 1 - ka
      // если по вертикали не разойтись (упираются в границы экрана) — со временем раздвигаем по горизонтали
      if (ox < oy || iter >= 8) {
        const s = Math.sign(b.x - a.x) || 1
        a.x -= s * ox * ka; b.x += s * ox * kb
      } else {
        const s = Math.sign(b.y - a.y) || 1
        a.y -= s * oy * ka; b.y += s * oy * kb
      }
    }
    clamp()
    if (!moved) break
  }

  // ——— декоративные узлы: структура «паутины» из Desktop-1
  const anchors = views.filter((v) => v.role !== 'history')
  anchors.forEach((v) => {
    const isCenter = v.id === center.id
    const count = isCenter ? (stage.kind === 'intro' ? 7 : 3) : hash(v.id) > 0.45 ? 2 : 1
    let px = v.id, prevX = v.x, prevY = v.y
    for (let j = 0; j < count; j++) {
      const seed = hash(`${v.id}:${j}:${stage.kind}`)
      let ang: number
      if (isCenter) ang = (j / count) * Math.PI * 2 + seed * 0.7 + 0.3
      else ang = Math.atan2(v.y - cy, v.x - cx) + (seed - 0.5) * 1.6
      const dist = isCenter ? (stage.kind === 'intro' ? Math.max(rx, 260) * (0.9 + seed * 0.5) : rx * (1.25 + seed * 0.3)) : (90 + seed * 90) * f + Math.max(v.w, v.h) / 2
      const ox = isCenter ? v.x : prevX, oy = isCenter ? v.y : prevY
      const x = ox + Math.cos(ang) * dist, y = oy + Math.sin(ang) * dist * (isCenter ? 0.75 : 0.8)
      const r = (8 + seed * 18) * f
      const id = `d:${v.id}:${j}`
      if (x < -40 || x > W + 40 || y < -40 || y > H + 40) continue
      decos.push({ id, x, y, r, parent: v.id })
      links.push({ from: isCenter ? v.id : px, to: id, kind: 'deco' })
      // в intro у части ветвей есть «внучка», как на референсе
      if (stage.kind === 'intro' && isCenter && seed > 0.4) {
        const a2 = ang + (seed - 0.5) * 1.4
        const d2 = 120 + seed * 120
        const id2 = `${id}:x`
        const x2 = x + Math.cos(a2) * d2, y2 = y + Math.sin(a2) * d2 * 0.8
        if (x2 > -20 && x2 < W + 20 && y2 > 0 && y2 < H + 20) {
          decos.push({ id: id2, x: x2, y: y2, r: r * 0.8, parent: id })
          links.push({ from: id, to: id2, kind: 'deco' })
        }
      }
      if (!isCenter) { px = id; prevX = x; prevY = y }
    }
  })

  // «дышат» все узлы, кроме приглушённого следа «Назад»: овал + выброс частиц (см. engine)
  for (const v of views) v.pulse = v.role !== 'history'

  return { views, compact, stage, scene: { nodes: views, decos, links } }
}
