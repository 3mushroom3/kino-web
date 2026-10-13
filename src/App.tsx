import { useCallback, useEffect, useRef, useState } from 'react'
import { NavBar, type NavKey } from './components/NavBar'
import { filterBy } from './data/criteria'
import { MOVIES } from './data/movies'
import { load, save } from './lib/motion'
import { go, useHash } from './lib/nav'
import { Catalog } from './pages/Catalog'
import { FilmPage } from './pages/FilmPage'
import { Profile } from './pages/Profile'
import { INITIAL, type Action, type WebState } from './web/layout'
import { Web } from './web/Web'


export default function App() {
  const hash = useHash()
  const [route, query = ''] = hash.split('?')
  const params = new URLSearchParams(query)
  const [web, setWeb] = useState<WebState>(INITIAL)
  const [favs, setFavs] = useState<number[]>(() => load('kino:favs', []))
  const [recent, setRecent] = useState<number[]>(() => load('kino:recent', []))

  useEffect(() => save('kino:favs', favs), [favs])
  useEffect(() => save('kino:recent', recent), [recent])

  // куда вести кнопку «Назад» со страницы фильма (без history.back — страница может жить во фрейме)
  const lastPage = useRef('/')
  const prevHash = useRef(hash)
  useEffect(() => {
    if (!prevHash.current.startsWith('/film/')) lastPage.current = prevHash.current
    prevHash.current = hash
  }, [hash])

  const filmMatch = route.match(/^\/film\/(\d+)/)
  const filmId = filmMatch ? +filmMatch[1] : null
  useEffect(() => {
    window.scrollTo({ top: 0 })
    if (filmId) setRecent((r) => [filmId, ...r.filter((x) => x !== filmId)].slice(0, 8))
  }, [route, filmId])

  const toggleFav = useCallback((id: number) => setFavs((f) => (f.includes(id) ? f.filter((x) => x !== id) : [id, ...f])), [])

  const onAction = useCallback((a: Action) => {
    setWeb((s) => {
      switch (a.type) {
        case 'start': return { ...s, started: true }
        case 'choose': return { ...s, path: [...s.path, a.choice], filmId: null }
        case 'film': return { ...s, filmId: a.id }
        case 'restart': return { ...INITIAL, started: true }
        case 'back':
          if (s.filmId != null) return { ...s, filmId: null }
          if (s.path.length) return { ...s, path: s.path.slice(0, -1) }
          return INITIAL
        default: return s
      }
    })
    if (a.type === 'details') go(`/film/${a.id}`)
    if (a.type === 'catalog') go('/catalog?pick=1')
  }, [])

  const resetWeb = useCallback(() => setWeb(INITIAL), [])

  const onNav = (k: NavKey) => {
    if (k === 'search') go('/catalog?focus=1')
    if (k === 'catalog') go('/catalog')
    if (k === 'profile') go('/profile')
    if (k === 'genres') { setWeb({ ...INITIAL, started: true }); go('/') }
    if (k === 'random') {
      const pool = MOVIES.filter((m) => m.id !== filmId)
      go(`/film/${pool[Math.floor(Math.random() * pool.length)].id}`)
    }
  }

  const active: NavKey | null =
    route === '/catalog' ? (params.get('focus') ? 'search' : 'catalog')
      : route === '/profile' ? 'profile'
        : route === '/' && web.started ? 'genres' : null

  const picked = filterBy(web.path)
  const hasPick = web.started && web.path.length > 0

  let page: JSX.Element
  if (filmId != null) {
    page = <FilmPage key={filmId} id={filmId} backTo={hash.startsWith('/film/') && prevHash.current !== hash ? (prevHash.current.startsWith('/film/') ? lastPage.current : prevHash.current) : lastPage.current} fav={favs.includes(filmId)} onFav={toggleFav}
      onRestart={() => { resetWeb(); go('/') }} />
  } else if (route === '/catalog') {
    page = <Catalog key="catalog" picked={hasPick ? picked : null} pickOn={params.get('pick') === '1'}
      autoFocus={params.get('focus') === '1'} path={web.path} />
  } else if (route === '/profile') {
    page = <Profile favs={favs} recent={recent} onFav={toggleFav} />
  } else {
    page = <Web state={web} onAction={onAction} onReset={resetWeb}
      onTruncate={(n) => setWeb((s) => (n === 0 ? { ...INITIAL, started: true } : { ...s, path: s.path.slice(0, n), filmId: null }))} />
  }

  return (
    <div className={`app ${route === '/' && filmId == null ? 'is-web' : ''}`}>
      <button type="button" className="skip" onClick={() => document.getElementById('main')?.focus()}>К содержимому</button>
      <NavBar active={active} onNav={onNav} />
      <main id="main" tabIndex={-1} className="page" key={route}>{page}</main>
    </div>
  )
}
