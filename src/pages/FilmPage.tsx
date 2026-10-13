import { useMemo, useRef } from 'react'
import { IconHeart } from '../components/Icons'
import { MovieCard } from '../components/MovieCard'
import { PosterAura } from '../components/PosterAura'
import { HeroProjector } from '../components/HeroProjector'
import { MOVIES, byId, cap, ddmmyyyy, money, rating, runtimeText, type Rating } from '../data/movies'
import { accentForMovie, useAccentKey, useInheritedAccent } from '../lib/accent'
import { go } from '../lib/nav'
import { maskStyle, spray } from '../lib/spray'

function Blob({ masks }: { masks: { edge: string; core: string } }) {
  return <>
    <span className="spray spray-edge" style={maskStyle(masks.edge)} aria-hidden="true" />
    <span className="spray spray-core" style={maskStyle(masks.core)} aria-hidden="true" />
  </>
}

function Votes({ r }: { r: Rating }) {
  return <>{r.votes_approximate ? '≈ ' : ''}{r.votes.toLocaleString('ru-RU')} голосов</>
}

function Row({ k, v }: { k: string; v?: string | null | (string | null | undefined)[] }) {
  const val = Array.isArray(v) ? v.filter(Boolean).join(', ') : v
  if (!val) return null
  return <div className="row"><dt>{k}</dt><dd>{val}</dd></div>
}

export function FilmPage({ id, fav, onFav, onRestart, backTo }: { backTo: string; id: number; fav: boolean; onFav: (id: number) => void; onRestart: () => void }) {
  const m = byId(id)
  const blob = useMemo(() => spray(120, 120, 'ellipse', 11), [])
  const poster = useRef<HTMLImageElement>(null)
  const hero = useRef<HTMLElement>(null)
  // цвет страницы — цвет ветки, по которой сюда пришли; жанр фильма — только для прямой ссылки
  useInheritedAccent(() => (m ? accentForMovie(m) : null), id)
  const accentKey = useAccentKey()
  const similar = useMemo(() => {
    if (!m) return []
    return MOVIES.filter((x) => x.id !== m.id)
      .map((x) => ({ x, s: x.genres.filter((g) => m.genres.includes(g)).length }))
      .filter((o) => o.s > 0).sort((a, b) => b.s - a.s || (b.x.kp?.value ?? 0) - (a.x.kp?.value ?? 0))
      .slice(0, 4).map((o) => o.x)
  }, [m])

  if (!m) {
    return (
      <div className="wrap empty">
        <p className="display-sm">Фильм не найден</p>
        <p>Похоже, ссылка устарела.</p>
        <a className="btn btn-gold" href="#/catalog">Открыть каталог</a>
      </div>
    )
  }
  const r = m.raw
  const awards = r.recognition?.awards ?? []
  const wins = awards.filter((a) => a.result === 'win')
  const back = () => go(backTo || '/')
  const crew: [string, string[] | null | undefined][] = [
    ['Режиссёр', r.creators.directors], ['Сценарий', r.creators.screenwriters], ['Оператор', r.creators.cinematographers],
    ['Композитор', r.creators.composers], ['Монтаж', r.creators.editors], ['Продюсеры', r.creators.producers],
    ['Производство', r.creators.production_companies],
  ]
  const releases = [r.release.world_premiere, r.release.russian_premiere, ...(r.release.additional_releases ?? [])]
    .filter((x): x is NonNullable<typeof x> => !!x && !!(x.date || x.year))

  return (
    <article className="film">
      <div className="film-backdrop" aria-hidden="true"><img src={m.poster} alt="" /></div>
      <div className="wrap">
        <div className="film-top">
          <button type="button" className="btn btn-ghost" onClick={back}>← Назад</button>
          <div className="film-top-r">
            <a className="btn btn-ghost" href="#/catalog">Каталог</a>
            <button type="button" className="btn btn-gold" onClick={onRestart}>Выбрать другой фильм</button>
          </div>
        </div>

        <section className="film-hero" ref={hero}>
          <HeroProjector hero={hero} poster={poster} accentKey={accentKey} />
          <div className="film-poster">
            <PosterAura target={poster} accentKey={accentKey} />
            <img ref={poster} src={m.poster} alt={`Постер фильма «${m.title}»`} width={r.poster.width} height={r.poster.height}
              style={{ viewTransitionName: `poster-${m.id}` }} />
          </div>

          <div className="film-info">
            <p className="eyebrow">{cap(m.type)}</p>
            <h1 className="display film-title">{m.title}</h1>
            <p className="film-orig">{m.original}{r.identification.alternative_titles?.length ? ` · ${r.identification.alternative_titles.join(', ')}` : ''}</p>
            <p className="film-meta">
              <span>{m.year}</span><span>{m.countries.join(', ')}</span><span>{runtimeText(m.runtime)}</span>
              {m.age && <span className="age">{m.age}</span>}
            </p>
            <ul className="chips" aria-label="Жанры">{m.genres.map((g) => <li key={g} className="chip is-static">{cap(g)}</li>)}</ul>

            <p className="logline">{r.content.logline}</p>

            <div className="ratings">
              {m.kp && (
                <div className="rating-node tone-ash">
                  <Blob masks={blob} />
                  <b>{rating(m.kp.value)}</b><span>Кинопоиск</span><small><Votes r={m.kp} /></small>
                </div>
              )}
              {m.imdb && (
                <div className="rating-node tone-ash">
                  <Blob masks={blob} />
                  <b>{rating(m.imdb.value)}</b><span>IMDb</span><small><Votes r={m.imdb} /></small>
                </div>
              )}
              {wins.length > 0 && (
                <div className="rating-node tone-gold">
                  <Blob masks={blob} />
                  <b>{wins.length}</b><span>{wins.length === 1 ? 'награда' : wins.length < 5 ? 'награды' : 'наград'}</span><small>из {awards.length} в списке</small>
                </div>
              )}
            </div>

            <div className="film-actions">
              <button type="button" className={`btn ${fav ? 'btn-gold' : 'btn-ghost'}`} aria-pressed={fav} onClick={() => onFav(m.id)}>
                <IconHeart filled={fav} /> {fav ? 'В избранном' : 'В избранное'}
              </button>
              {r.links?.official_trailer && (
                <a className="btn btn-ghost" href={r.links.official_trailer.url} target="_blank" rel="noreferrer">Страница с трейлером ↗</a>
              )}
              <a className="btn btn-ghost" href={r.identification.kinopoisk_url} target="_blank" rel="noreferrer">Кинопоиск ↗</a>
            </div>
          </div>
        </section>

        <div className="film-cols">
          <div className="film-main">
            <section className="block">
              <h2 className="h2">Сюжет</h2>
              <p className="lead">{r.content.synopsis}</p>
            </section>
            <section className="block two">
              <div><h3 className="h3">Настроение</h3><p>{r.content.mood}</p></div>
              <div><h3 className="h3">Визуальный стиль</h3><p>{r.content.visual_style}</p></div>
            </section>
            {r.content.themes?.length > 0 && (
              <section className="block">
                <h3 className="h3">Темы</h3>
                <ul className="chips">{r.content.themes.map((t) => <li key={t} className="chip is-static">{t}</li>)}</ul>
              </section>
            )}
            {r.context?.text && (
              <section className="block">
                <h2 className="h2">Контекст</h2>
                <p>{r.context.text}</p>
                {r.context.facts?.length > 0 && (
                  <ul className="facts">{r.context.facts.map((f, i) => <li key={i}>{f.text}</li>)}</ul>
                )}
              </section>
            )}
            {(r.cast?.length ?? 0) > 0 && (
              <section className="block">
                <h2 className="h2">{r.cast!.every((c) => c.participation_type?.startsWith('документ')) ? 'В фильме' : 'В ролях'}</h2>
                <ul className="cast">
                  {r.cast!.map((c) => (
                    <li key={c.name_ru}>
                      <span className="cast-name">{c.name_ru}</span>
                      {c.name_original && <span className="cast-orig">{c.name_original}</span>}
                      {c.role && <span className="cast-role">{c.role}</span>}
                      {c.participation_type && c.participation_type !== 'актёр' && <span className="cast-type">{c.participation_type}</span>}
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>

          <aside className="film-aside">
            <section className="block">
              <h2 className="h2">Создатели</h2>
              <dl className="dl">
                {crew.map(([k, v]) => <Row key={k} k={k} v={v ?? undefined} />)}
                {r.creators.source_material && (
                  <Row k="Первоисточник" v={`${r.creators.source_material.form} «${r.creators.source_material.title}», ${r.creators.source_material.author}, ${r.creators.source_material.year}`} />
                )}
              </dl>
              {r.creators.credit_notes && <p className="note">{r.creators.credit_notes}</p>}
            </section>
            <section className="block">
              <h2 className="h2">Детали</h2>
              <dl className="dl">
                <Row k="Языки" v={r.details.languages} />
                <Row k="Изображение" v={`${r.details.color}, ${r.details.aspect_ratio}`} />
                {releases.map((x, i) => <Row key={i} k={x.event} v={ddmmyyyy(x.date) ?? String(x.year)} />)}
                {r.finances?.budget && <Row k="Бюджет" v={money(r.finances.budget)} />}
                {r.finances?.worldwide_gross && <Row k="Сборы в мире" v={money(r.finances.worldwide_gross)} />}
              </dl>
            </section>
            {awards.length > 0 && (
              <section className="block">
                <h2 className="h2">Награды</h2>
                <ul className="awards">
                  {awards.map((a, i) => (
                    <li key={i} className={a.result === 'win' ? 'is-win' : ''}>
                      <span className="aw-top"><b>{a.event}</b> · {a.year}</span>
                      <span>{a.category}</span>
                      <span className="aw-res">{a.result === 'win' ? 'Победа' : 'Номинация'} — {a.recipient}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </aside>
        </div>

        {similar.length > 0 && (
          <section className="block similar">
            <h2 className="h2">Похожие по жанру</h2>
            <div className="grid">{similar.map((x, i) => <MovieCard key={x.id} m={x} index={i} />)}</div>
          </section>
        )}
      </div>
    </article>
  )
}
