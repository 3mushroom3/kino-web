import { useEffect, useState } from 'react'

const Q = '(prefers-reduced-motion: reduce)'
export const prefersReducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.(Q).matches

export function useReducedMotion() {
  const [v, setV] = useState(prefersReducedMotion())
  useEffect(() => {
    const m = window.matchMedia(Q)
    const on = () => setV(m.matches)
    m.addEventListener('change', on)
    return () => m.removeEventListener('change', on)
  }, [])
  return v
}

export function load<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key)
    return v ? (JSON.parse(v) as T) : fallback
  } catch {
    return fallback
  }
}
export function save(key: string, v: unknown) {
  try { localStorage.setItem(key, JSON.stringify(v)) } catch { /* хранилище недоступно */ }
}
