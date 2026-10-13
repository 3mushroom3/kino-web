import { MovieCard } from '../components/MovieCard'
import { byId, type Movie } from '../data/movies'
import { useAccent } from '../lib/accent'

export function Profile({ favs, recent, onFav }: { favs: number[]; recent: number[]; onFav: (id: number) => void }) {
  useAccent(null)
  const fav = favs.map(byId).filter(Boolean) as Movie[]
  const rec = recent.map(byId).filter(Boolean) as Movie[]
  return (
    <div className="wrap profile">
      <div className="page-head">
        <div>
          <p className="eyebrow">Мой профиль</p>
          <h1 className="display">Твоя коллекция</h1>
        </div>
        <a className="btn btn-ghost" href="#/">← К выбору фильма</a>
      </div>
      <p className="note">Избранное и история хранятся только в этом браузере.</p>

      <section className="block">
        <h2 className="h2">Избранное</h2>
        {fav.length ? (
          <div className="grid">
            {fav.map((m, i) => (
              <div key={m.id} className="fav-wrap">
                <MovieCard m={m} index={i} />
                <button type="button" className="link" onClick={() => onFav(m.id)}>Убрать из избранного</button>
              </div>
            ))}
          </div>
        ) : (
          <p className="empty-line">Пока пусто. Отметь фильм кнопкой «В избранное» на его странице.</p>
        )}
      </section>

      <section className="block">
        <h2 className="h2">Недавно открытые</h2>
        {rec.length ? (
          <div className="grid">{rec.map((m, i) => <MovieCard key={m.id} m={m} index={i} vt={!favs.includes(m.id)} />)}</div>
        ) : (
          <p className="empty-line">Здесь появятся недавно открытые фильмы.</p>
        )}
      </section>
    </div>
  )
}
