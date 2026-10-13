import { useEffect, useState } from 'react'
import { flushSync } from 'react-dom'
import { prefersReducedMotion } from './motion'

type VTDocument = Document & { startViewTransition?: (update: () => void) => unknown }

/**
 * Обновление DOM внутри View Transition (постер «перелетает» между экранами).
 * Без поддержки браузером или при уменьшенной анимации — обычное обновление.
 */
export function withTransition(update: () => void) {
  const doc = document as VTDocument
  if (!doc.startViewTransition || prefersReducedMotion()) { update(); return }
  doc.startViewTransition(() => flushSync(update))
}

const readHash = () => window.location.hash.replace(/^#/, '') || '/'
let syncHash: (() => void) | null = null

export function useHash() {
  const [h, setH] = useState(readHash)
  useEffect(() => {
    const on = () => setH(readHash())
    syncHash = on
    window.addEventListener('hashchange', on)
    return () => { window.removeEventListener('hashchange', on); syncHash = null }
  }, [])
  return h
}

export function go(path: string) {
  if (readHash() === path) return
  withTransition(() => {
    window.location.hash = path
    syncHash?.() // hashchange придёт асинхронно — синхронизируем состояние сразу, внутри перехода
  })
}

/** Клик по ссылке-карточке: открываем через go(), но Ctrl/⌘/средняя кнопка работают как обычно. */
export function linkClick(path: string) {
  return (e: React.MouseEvent) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
    e.preventDefault()
    go(path)
  }
}
