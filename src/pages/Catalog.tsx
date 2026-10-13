import { useEffect, useMemo, useRef, useState } from 'react'
import { GENRE_OPTIONS, choiceLabel, stepById, type Choice } from '../data/criteria'
import { MOVIES, filmsWord, type Movie } from '../data/movies'
import { MovieCard } from '../components/MovieCard'
import { accentForGenre, accentForPath, useAccent } from '../lib/accent'
import { withTransition } from '../lib/nav'

type Sort = 'rating' | 'new' | 'old' | 'title'

const norm = (s: string) => s.toLowerCase().replace(/ё/g, 'е')

function haystack(m: Movie) {
  const r = m.raw
  return norm([
    m.title, m.original, ...(r.identification.alternative_titles ?? []), String(m.year), ...m.genres, ...m.countries,
    ...(r.creators.directors ?? []), ...(r.cast ?? []).flatMap((c) => [c.name_ru, c.name_original ?? '']),
  ].join(' '))
}

export function Catalog({ picked, pickOn, autoFocus, path }: { picked: Movie[] | null; pickOn: boolean; autoFocus: boolean; path: Choice[] }) {
  const [q, setQ] = useState('')
  const [genre, setGenre] = useState<string | null>(null)
  const [sort, setSort] = useState<Sort>('rating')
  const [usePick, setUsePick] = useState(pickOn && !!picked)
  const input = useRef<HTMLInputElement>(null)
  // акцент: выбранный жанр-фильтр, иначе подборка из паутины, иначе золото
  useAccent(genre ? accentForGenre(genre) : usePick && picked ? accentForPath(path) : null)
  useEffect(() => { if (autoFocus) input.current?.focus() }, [autoFocus])

  const list = useMemo(() => {
    let l = usePick && picked ? picked : MOVIES
    if (genre) l = l.filter(GENRE_OPTIONS.find((g) => g.id === genre)!.test)
    const words = norm(q).split(/\s+/).filter(Boolean)
    if (words.length) l = l.filter((m) => { const h = haystack(m); return words.every((w) => h.includes(w)) })
    const s = [...l]
    if (sort === 'rating') s.sort((a, b) => (b.kp?.value ?? 0) - (a.kp?.value ?? 0))
    if (sort === 'new') s.sort((a, b) => b.year - a.year)
    if (sort === 'old') s.sort((a, b) => a.year - b.year)
    if (sort === 'title') s.sort((a, b) => a.title.localeCompare(b.title, 'ru'))
    return s
  }, [q, genre, sort, usePick, picked])

  return (
    <div className="catalog wrap">
      <div className="page-head">
        <div>
          <p className="eyebrow">Каталог</p>
          <h1 className="display">Все фильмы</h1>
        </div>
        <a className="btn btn-ghost" href="#/">← Вернуться к паутине</a>
      </div>

      {usePick && picked && (
        <div className="pick-banner" role="status">
          <span className="pick-dot" aria-hidden="true" />
          <span>
            Подборка из паутины: {path.map((c) => `${stepById(c.step).short.toLowerCase()} — ${choiceLabel(c).toLowerCase()}`).join(', ')}
          </span>
          <button type="button" className="link" onClick={() => setUsePick(false)}>Показать все</button>
        </div>
      )}

      <div className="filters">
        <label className="search">
          <span className="sr-only">Поиск по фильмам</span>
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><circle cx="10" cy="10" r="7" fill="none" stroke="currentColor" strokeWidth="2.4" /><path d="M15.5 15.5L21 21" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" /></svg>
          <input ref={input} type="search" value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Название, режиссёр, актёр, страна…" />
        </label>
        <div className="chips" role="group" aria-label="Жанр">
          <button type="button" className={`chip ${genre === null ? 'is-on' : ''}`} aria-pressed={genre === null} onClick={() => withTransition(() => setGenre(null))}>Все жанры</button>
          {GENRE_OPTIONS.map((g) => (
            <button key={g.id} type="button" className={`chip ${genre === g.id ? 'is-on' : ''}`} aria-pressed={genre === g.id}
              onClick={() => withTransition(() => setGenre(genre === g.id ? null : g.id))}>{g.label}</button>
          ))}
        </div>
        <label className="sort">
          <span>Сортировка</span>
          {/* карточки плавно переезжают на новые места (View Transitions) */}
          <select value={sort} onChange={(e) => { const v = e.target.value as Sort; withTransition(() => setSort(v)) }}>
            <option value="rating">по рейтингу</option>
            <option value="new">сначала новые</option>
            <option value="old">сначала старые</option>
            <option value="title">по названию</option>
          </select>
        </label>
      </div>

      <p className="count" aria-live="polite">{filmsWord(list.length)}</p>

      {list.length ? (
        <div className="grid">
          {list.map((m, i) => <MovieCard key={m.id} m={m} index={i} />)}
        </div>
      ) : (
        <div className="empty">
          <p className="display-sm">Ничего не нашлось</p>
          <p>Попробуй другой запрос или сними фильтры.</p>
          <button type="button" className="btn btn-gold" onClick={() => { setQ(''); setGenre(null); setUsePick(false) }}>Сбросить фильтры</button>
        </div>
      )}
    </div>
  )
}
