import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { choiceLabel, stepById, type Choice } from '../data/criteria'
import { cap, filmsWord } from '../data/movies'
import { accentForPath, useAccent } from '../lib/accent'
import { useReducedMotion } from '../lib/motion'
import { rgb } from '../lib/tokens'
import { Engine } from './engine'
import { layout, stageOf, type Action, type NodeView, type WebState } from './layout'
import type React from 'react'

interface Props {
  state: WebState
  onAction: (a: Action) => void
  onTruncate: (len: number) => void
  onReset: () => void
}

type Rendered = NodeView & { gone?: boolean }

export function Web({ state, onAction, onTruncate, onReset }: Props) {
  const box = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const engine = useMemo(() => new Engine(), [])
  const [size, setSize] = useState({ w: 0, h: 0 })
  const reduced = useReducedMotion()

  useLayoutEffect(() => {
    const el = box.current!
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }))
    ro.observe(el)
    setSize({ w: el.clientWidth, h: el.clientHeight })
    engine.attach(canvas.current!)
    const move = (e: PointerEvent) => {
      const r = el.getBoundingClientRect()
      engine.pointer(e.clientX - r.left, e.clientY - r.top)
    }
    window.addEventListener('pointermove', move)
    return () => { ro.disconnect(); engine.detach(); window.removeEventListener('pointermove', move) }
  }, [engine])

  useEffect(() => engine.setReduced(reduced), [engine, reduced])

  // акцент по выбранному жанру и уточнениям: CSS-переменные (layout effect) → затем цвета движка
  const accent = accentForPath(state.path)
  useAccent(accent)
  const accentKey = accent ? `${accent.h}:${accent.s}:${accent.l}` : ''
  useEffect(() => engine.setAccent(rgb('--gold-glow'), rgb('--gold-hi')), [engine, accentKey])

  // Esc — шаг назад по сети (как узел «← Назад»), если не печатаем в поле ввода
  const started = state.started
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || !started || e.defaultPrevented) return
      if ((e.target as HTMLElement)?.closest('input, textarea, select')) return
      onAction({ type: 'back' })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [started, onAction])
  useEffect(() => engine.resize(size.w, size.h), [engine, size])

  const lay = useMemo(() => (size.w ? layout(state, size.w, size.h) : null), [state, size])

  const [rendered, setRendered] = useState<Rendered[]>([])
  useEffect(() => {
    if (!lay) return
    setRendered((prev) => {
      const next = new Map<string, Rendered>(lay.views.map((v) => [v.id, v]))
      for (const p of prev) if (!next.has(p.id)) next.set(p.id, { ...p, gone: true })
      return [...next.values()]
    })
    engine.setScene(lay.scene)
  }, [lay, engine])
  useEffect(() => {
    engine.onGone = (ids) => setRendered((prev) => prev.filter((p) => !(p.gone && ids.includes(p.id))))
  }, [engine])

  const stage = lay?.stage ?? stageOf(state)
  const intro = stage.kind === 'intro'

  const announce =
    stage.kind === 'intro' ? 'Начальный экран. Нажми на центральный узел, чтобы выбрать жанр.'
      : stage.kind === 'ask' ? `${stage.step.title} Доступно вариантов: ${lay?.views.filter((v) => v.role === 'option').length ?? 0}.`
        : stage.kind === 'results' ? `Подходит ${filmsWord(stage.candidates.length)}.`
          : `Выбран фильм «${stage.movie.title}».`

  return (
    <section className={`web ${intro ? 'is-intro' : ''} ${lay?.compact ? 'is-compact' : ''}`} aria-label="Интерактивный выбор фильма">
      <h1 className="sr-only">Что сегодня посмотреть?</h1>
      <div className="web-stage" ref={box}>
        <canvas ref={canvas} className="web-canvas" aria-hidden="true" />
        {rendered.map((v) => (
          <WebNode key={v.id} v={v} engine={engine} onAction={onAction} />
        ))}
      </div>
      <p className="sr-only" aria-live="polite">{announce}</p>
      <ControlBar state={state} stageKind={stage.kind} count={'candidates' in stage ? stage.candidates.length : 0}
        onAction={onAction} onTruncate={onTruncate} onReset={onReset} />
    </section>
  )
}

const WebNode = memo(function WebNode({ v, engine, onAction }: { v: Rendered; engine: Engine; onAction: (a: Action) => void }) {
  const interactive = v.action.type !== 'none' && !v.gone
  const Tag = interactive ? 'button' : 'div'
  // «Не знаешь, что включить?» + «Начни с жанра!» → без лишней точки после знака вопроса
  const sentence = (s: string) => (/[.!?…]$/.test(s) ? s : s + '.')
  const label = v.role === 'history' ? `Назад: ${v.label}` : v.role === 'movie' || v.role === 'film' ? `${v.label}, ${v.sub ?? v.movie?.year}`
    : v.sub ? `${sentence(v.label)} ${v.sub}` : v.label
  return (
    <Tag
      ref={(el: HTMLElement | null) => engine.register(v.id, el)}
      className={`node role-${v.role} tone-${v.tone} shape-${v.shape} ${interactive ? 'is-live' : ''}`}
      style={geoStyle(v)}
      onClick={interactive ? () => onAction(v.action) : undefined}
      onPointerEnter={interactive ? () => engine.hover(v.id) : undefined}
      onPointerLeave={interactive ? () => engine.hover(null) : undefined}
      onFocus={interactive ? () => engine.hover(v.id) : undefined}
      onBlur={interactive ? () => engine.hover(null) : undefined}
      aria-label={interactive ? label : undefined}
      aria-hidden={v.gone || undefined}
      tabIndex={v.gone ? -1 : undefined}
      type={interactive ? 'button' : undefined}
    >
      <Projector />
      <span className="node-body">
        {v.movie && (
          <span className="node-poster" style={{ viewTransitionName: v.gone ? undefined : `poster-${v.movie.id}` }}>
            <img src={v.movie.poster} alt="" draggable={false} />
          </span>
        )}
        {v.kicker && <span className="node-kicker">{v.kicker}</span>}
        <span className="node-label">{v.label}</span>
        {v.sub && <span className="node-sub">{v.sub}</span>}
        {v.role === 'film' && v.movie && (
          <span className="node-meta">{v.movie.genres.slice(0, 3).map(cap).join(' · ')}</span>
        )}
      </span>
    </Tag>
  )
})

/**
 * Геометрия узла из layout.fit → CSS-переменные: высота камеры, границы овала света
 * и вписанного в него текстового блока (ширина 72% → высота 69% овала).
 */
function geoStyle(v: NodeView): React.CSSProperties {
  const g = v.geo
  const pct = (x: number) => `${(x * 100).toFixed(2)}%`
  return {
    width: v.w, height: v.h, opacity: 0,
    ...(g && {
      '--cam': pct(g.cam),
      '--oval-top': pct(g.cy - g.ry), '--oval-bottom': pct(1 - g.cy - g.ry),
      '--text-top': pct(g.cy - g.ry * 0.69), '--text-bottom': pct(1 - g.cy - g.ry * 0.69),
    }),
  } as React.CSSProperties
}

/** дырки в диске бобины: 5 штук по кругу */
const HOLES = [0, 1, 2, 3, 4].map((i) => [Math.cos((i * 2 * Math.PI) / 5 - Math.PI / 2) * 10, Math.sin((i * 2 * Math.PI) / 5 - Math.PI / 2) * 10])

function Reel({ cx, className }: { cx: number; className: string }) {
  return (
    <g className={`reel ${className}`}>
      <circle cx={cx} cy={24} r={20} className="reel-rim" />
      <circle cx={cx} cy={24} r={16.5} className="reel-disc" />
      {HOLES.map(([x, y], i) => <circle key={i} cx={cx + x} cy={24 + y} r={4} className="reel-hole" />)}
      <circle cx={cx} cy={24} r={3.2} className="reel-hub" />
    </g>
  )
}

/**
 * Кинопроектор узла: две бобины сверху (вращаются), корпус, объектив вниз —
 * из него выходит луч (.proj-beam). Цвета — из токенов: оправа бобин и стекло
 * объектива в цвет тона узла, поэтому смена жанра перекрашивает и проекторы.
 * Геометрия согласована с engine.ts (CAM_Y — точка подключения провода).
 */
export const Projector = memo(function Projector() {
  return (
    <svg className="proj-cam" viewBox="0 0 120 100" aria-hidden="true">
      <path d="M36 24 L56 46 M84 24 L64 46" className="proj-film" />
      <Reel cx={36} className="reel-a" />
      <Reel cx={84} className="reel-b" />
      <rect x={16} y={44} width={88} height={36} rx={8} className="proj-body" />
      <rect x={16} y={44} width={88} height={8} rx={4} className="proj-shine" />
      <rect x={24} y={60} width={34} height={4} rx={2} className="proj-vent" />
      <rect x={24} y={68} width={26} height={4} rx={2} className="proj-vent" />
      <circle cx={90} cy={63} r={6} className="proj-knob" />
      <path d="M48 80 h24 l-3 14 h-18 z" className="proj-lens" />
      <path d="M49 85 h22 M50 89 h20" className="proj-rib" />
      <ellipse cx={60} cy={94.5} rx={8} ry={2.4} className="proj-glass" />
    </svg>
  )
})

function ControlBar({ state, stageKind, count, onAction, onTruncate, onReset }: {
  state: WebState; stageKind: string; count: number
  onAction: (a: Action) => void; onTruncate: (n: number) => void; onReset: () => void
}) {
  if (stageKind === 'intro')
    return (
      <div className="web-bar is-hint">
        <span className="hint-dot" aria-hidden="true" />
        <span>Нажми на светящийся узел — сеть подскажет дальше</span>
      </div>
    )
  return (
    <div className="web-bar">
      <nav className="crumbs" aria-label="Выбранные параметры">
        <button type="button" className="crumb" onClick={() => onTruncate(0)}>Старт</button>
        {state.path.map((c: Choice, i) => (
          <button key={i} type="button" className="crumb" onClick={() => onTruncate(i + 1)}
            aria-current={i === state.path.length - 1 && state.filmId == null ? 'step' : undefined}>
            <span className="crumb-k">{stepById(c.step).short}</span> {choiceLabel(c)}
          </button>
        ))}
      </nav>
      <div className="bar-actions">
        {(stageKind === 'results' || stageKind === 'film') && count > 0 && (
          <button type="button" className="btn btn-ghost" onClick={() => onAction({ type: 'catalog' })}>
            Открыть карточками ({count})
          </button>
        )}
        <button type="button" className="btn btn-ghost" onClick={() => onAction({ type: 'back' })}>← Назад</button>
        <button type="button" className="btn btn-gold" onClick={onReset}>Начать заново</button>
      </div>
    </div>
  )
}
