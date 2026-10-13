import { cap, rating, runtimeText, type Movie } from '../data/movies'
import { linkClick } from '../lib/nav'

/** vt=false — когда тот же фильм уже есть на странице (имена view-transition должны быть уникальны) */
export function MovieCard({ m, index = 0, vt = true }: { m: Movie; index?: number; vt?: boolean }) {
  const path = `/film/${m.id}`
  return (
    <a className="card" href={`#${path}`} onClick={linkClick(path)}
      style={{ animationDelay: `${Math.min(index, 12) * 45}ms`, viewTransitionName: vt ? `card-${m.id}` : undefined }}>
      <span className="card-poster" style={{ viewTransitionName: vt ? `poster-${m.id}` : undefined }}>
        <img src={m.poster} alt={`Постер фильма «${m.title}»`} loading="lazy" width={m.raw.poster.width} height={m.raw.poster.height} />
        {m.kp && <span className="card-rating" title="Рейтинг Кинопоиска">КП {rating(m.kp.value)}</span>}
      </span>
      <span className="card-body">
        <span className="card-title">{m.title}</span>
        <span className="card-meta">{m.year} · {runtimeText(m.runtime)}{m.age ? ` · ${m.age}` : ''}</span>
        <span className="card-genres">{m.genres.map(cap).join(', ')}</span>
      </span>
    </a>
  )
}
