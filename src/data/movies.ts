import raw from './movies.json'

export interface Person { name_ru: string; name_original?: string; role?: string; participation_type?: string }
export interface Award { year: number; event: string; category: string; recipient: string; result: 'win' | 'nomination' | string }
export interface Money { amount: number; currency: string; estimated?: boolean; coverage_note?: string }
export interface Release { date: string | null; year: number | null; event: string; release_type: string }
export interface Rating { value: number; scale: number; votes: number; votes_approximate?: boolean }
export interface SourceMaterial { title: string; author: string; form: string; year: number }

export interface RawMovie {
  identification: {
    kinopoisk_id: number; kinopoisk_url: string; imdb_id?: string; imdb_url?: string
    title_ru: string; title_original: string; alternative_titles: string[]; year: number; film_type: string
  }
  details: {
    countries: string[]; languages: string[]; genres: string[]; runtime_minutes: number
    age_ratings: { country: string; rating: string }[]; color: string; aspect_ratio: string
  }
  creators: {
    directors: string[] | null; screenwriters: string[] | null; producers: string[] | null
    cinematographers: string[] | null; composers: string[] | null; editors: string[] | null
    production_companies: string[] | null; source_material: SourceMaterial | null; credit_notes?: string
  }
  cast: Person[] | null
  content: { logline: string; synopsis: string; themes: string[]; mood: string; visual_style: string }
  context: { text: string; facts: { text: string }[] }
  release: { world_premiere: Release | null; russian_premiere: Release | null; additional_releases: Release[] | null }
  recognition: { awards: Award[] | null } | null
  finances: { budget: Money | null; worldwide_gross: Money | null } | null
  ratings: { kinopoisk?: Rating | null; imdb?: Rating | null }
  links: { official_trailer?: { url: string; link_type: string } | null } | null
  poster: { path: string; width: number; height: number }
}

export interface Movie {
  id: number
  title: string
  original: string
  year: number
  type: string
  genres: string[]
  runtime: number
  color: string
  age?: string
  countries: string[]
  kp?: Rating
  imdb?: Rating
  poster: string
  raw: RawMovie
}

const data = raw as unknown as { movies: RawMovie[] }

export const MOVIES: Movie[] = data.movies.map((m) => ({
  id: m.identification.kinopoisk_id,
  title: m.identification.title_ru,
  original: m.identification.title_original,
  year: m.identification.year,
  type: m.identification.film_type,
  genres: m.details.genres,
  runtime: m.details.runtime_minutes,
  color: m.details.color,
  age: m.details.age_ratings?.find((a) => a.country === 'Россия')?.rating,
  countries: m.details.countries ?? [],
  kp: m.ratings.kinopoisk ?? undefined,
  imdb: m.ratings.imdb ?? undefined,
  // путь в JSON уже вида posters/<kinopoisk_id>.jpg — файлы лежат в public/posters
  poster: './' + m.poster.path,
  raw: m,
}))

export const byId = (id: number) => MOVIES.find((m) => m.id === id)

/** 8 → «8,0»: десятичная запятая по-русски */
export const rating = (v: number) => v.toLocaleString('ru-RU', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

export const cap =(s: string) => s.charAt(0).toUpperCase() + s.slice(1)

export function plural(n: number, one: string, few: string, many: string) {
  const a = n % 10, b = n % 100
  if (a === 1 && b !== 11) return one
  if (a >= 2 && a <= 4 && (b < 10 || b >= 20)) return few
  return many
}
export const filmsWord = (n: number) => `${n} ${plural(n, 'фильм', 'фильма', 'фильмов')}`

export function runtimeText(min: number) {
  const h = Math.floor(min / 60), m = min % 60
  return h ? `${h} ч ${m.toString().padStart(2, '0')} мин` : `${m} мин`
}

export function ddmmyyyy(s: string | null) {
  if (!s || s.length !== 8) return null
  const months = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря']
  return `${+s.slice(0, 2)} ${months[+s.slice(2, 4) - 1]} ${s.slice(4)}`
}

export function money(m: Money) {
  const sym: Record<string, string> = { USD: '$', EUR: '€', RUB: '₽' }
  const v = m.amount >= 1e6 ? `${(m.amount / 1e6).toLocaleString('ru-RU', { maximumFractionDigits: 1 })} млн` : m.amount.toLocaleString('ru-RU')
  return `${m.estimated ? '≈ ' : ''}${v} ${sym[m.currency] ?? m.currency}`
}
