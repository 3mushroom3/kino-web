import { IconList, IconMasks, IconSearch, IconShuffle, IconUser } from './Icons'

export type NavKey = 'search' | 'catalog' | 'genres' | 'random' | 'profile'

const ITEMS: { key: NavKey; label: [string, string?]; short: string; Icon: (p: { className?: string }) => JSX.Element }[] = [
  { key: 'search', label: ['Поиск', 'по фильмам'], short: 'Поиск', Icon: IconSearch },
  { key: 'catalog', label: ['Каталог'], short: 'Каталог', Icon: IconList },
  { key: 'genres', label: ['Паутина', 'кинематографа'], short: 'Паутина', Icon: IconMasks },
  { key: 'random', label: ['Случайный', 'фильм'], short: 'Случайный', Icon: IconShuffle },
  { key: 'profile', label: ['Мой', 'профиль'], short: 'Профиль', Icon: IconUser },
]

export function NavBar({ active, onNav }: { active: NavKey | null; onNav: (k: NavKey) => void }) {
  return (
    <header className="filmstrip">
      <div className="perf" aria-hidden="true"><i /></div>
      <nav className="nav" aria-label="Основная навигация">
        {ITEMS.map(({ key, label, short, Icon }) => (
          <button key={key} type="button" className={`nav-item ${active === key ? 'is-active' : ''}`}
            aria-label={label.filter(Boolean).join(' ')} aria-current={active === key ? 'page' : undefined} onClick={() => onNav(key)}>
            <Icon className="nav-icon" />
            <span className="nav-label">{label[0]}{label[1] && <><br />{label[1]}</>}</span>
            <span className="nav-short" aria-hidden="true">{short}</span>
          </button>
        ))}
      </nav>
      <div className="perf" aria-hidden="true"><i /></div>
    </header>
  )
}
