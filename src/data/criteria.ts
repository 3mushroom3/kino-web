import { MOVIES, type Movie } from './movies'

/** Шаги сужения выбора. Все варианты строятся из реальных полей movies.json. */
export type StepId = 'genre' | 'period' | 'runtime'

export interface Option {
  id: string
  label: string
  hint?: string
  test: (m: Movie) => boolean
}

export interface Step {
  id: StepId
  title: string // вопрос в центральном узле
  short: string // подпись в хлебных крошках
  options: Option[]
}

const has = (...g: string[]) => (m: Movie) => m.genres.some((x) => g.includes(x))

/**
 * Жанры каталога объединены в группы, чтобы в сети не было 13 узлов по 1 фильму.
 * Группа «Фантастика и сказка» — из исходного макета Desktop-2.
 */
export const GENRE_OPTIONS: Option[] = [
  { id: 'drama', label: 'Драма', test: has('драма') },
  { id: 'comedy', label: 'Комедия', test: has('комедия') },
  { id: 'fantasy', label: 'Фантастика и сказка', hint: 'фэнтези, анимация, приключения', test: has('фэнтези', 'анимация', 'приключения', 'семейный') },
  { id: 'history', label: 'История и биография', hint: 'исторический, биографический', test: has('исторический', 'биографический') },
  { id: 'crime', label: 'Детектив и война', hint: 'детектив, военный', test: has('детектив', 'военный') },
  { id: 'doc', label: 'Документальное', hint: 'об искусстве и культуре', test: has('документальный', 'искусство', 'культура') },
]

export const STEPS: Step[] = [
  { id: 'genre', title: 'Какой жанр?', short: 'Жанр', options: GENRE_OPTIONS },
  {
    id: 'period', title: 'Из какой эпохи?', short: 'Эпоха',
    options: [
      { id: 'classic', label: 'Классика', hint: 'до 2000 года', test: (m) => m.year < 2000 },
      { id: '2000s', label: '2000–2014', hint: 'нулевые и начало десятых', test: (m) => m.year >= 2000 && m.year <= 2014 },
      { id: 'new', label: 'Новое кино', hint: '2015 и позже', test: (m) => m.year >= 2015 },
    ],
  },
  {
    id: 'runtime', title: 'Сколько есть времени?', short: 'Длительность',
    options: [
      { id: 'short', label: 'До полутора часов', hint: '≤ 100 мин', test: (m) => m.runtime <= 100 },
      { id: 'mid', label: 'Около двух часов', hint: '101–130 мин', test: (m) => m.runtime > 100 && m.runtime <= 130 },
      { id: 'long', label: 'Длинный вечер', hint: 'больше 130 мин', test: (m) => m.runtime > 130 },
    ],
  },
]

export const ANY = 'any'

export interface Choice { step: StepId; option: string }

export const stepById = (id: StepId) => STEPS.find((s) => s.id === id)!
export const optionOf = (c: Choice) => stepById(c.step).options.find((o) => o.id === c.option)
export const choiceLabel = (c: Choice) => (c.option === ANY ? 'Не важно' : optionOf(c)?.label ?? '')

export function filterBy(path: Choice[], list = MOVIES) {
  return list.filter((m) => path.every((c) => c.option === ANY || optionOf(c)!.test(m)))
}

/** Варианты шага, у которых есть хотя бы один фильм среди кандидатов. */
export function availableOptions(step: Step, candidates: Movie[]) {
  return step.options
    .map((o) => ({ option: o, count: candidates.filter(o.test).length }))
    .filter((x) => x.count > 0)
}

/**
 * Следующий вопрос: жанр задаётся всегда, остальные шаги — только если
 * кандидатов больше двух и шаг реально разделяет их хотя бы на две группы.
 */
export function nextStep(path: Choice[]): Step | null {
  const candidates = filterBy(path)
  const done = new Set(path.map((c) => c.step))
  for (const s of STEPS) {
    if (done.has(s.id)) continue
    if (s.id === 'genre') return s
    if (candidates.length <= 2) return null
    if (availableOptions(s, candidates).length >= 2) return s
  }
  return null
}

export const sortByRating = (a: Movie, b: Movie) => (b.kp?.value ?? 0) - (a.kp?.value ?? 0)
