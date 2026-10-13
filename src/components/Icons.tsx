type P = { className?: string }
const base = { width: 32, height: 32, viewBox: '0 0 32 32', 'aria-hidden': true, fill: 'currentColor' } as const

export const IconSearch = (p: P) => (
  <svg {...base} {...p}><circle cx="13.5" cy="13.5" r="10.5" /><path d="M21 21l7.5 7.5" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" /></svg>
)
export const IconList = (p: P) => (
  <svg {...base} {...p}>
    <rect x="2" y="6" width="4" height="4" rx="1" /><rect x="2" y="14" width="4" height="4" rx="1" /><rect x="2" y="22" width="4" height="4" rx="1" />
    <rect x="9" y="6" width="21" height="4" rx="1" /><rect x="9" y="14" width="21" height="4" rx="1" /><rect x="9" y="22" width="21" height="4" rx="1" />
  </svg>
)
export const IconMasks = (p: P) => (
  <svg {...base} viewBox="0 0 40 32" width={40} {...p}>
    <path d="M2 4c5-2.5 11-2.8 17-1v9.5c0 6-3.6 10.5-8.5 10.5S2 18.5 2 12.5z" />
    <path d="M6 9.5l3 .8M12 10.3l3-.8" style={{ stroke: 'var(--bg)' }} strokeWidth="2" strokeLinecap="round" />
    <path d="M6.5 17.2c2.4-2.2 5.6-2.2 8 0" style={{ stroke: 'var(--bg)' }} strokeWidth="2" fill="none" strokeLinecap="round" />
    <path d="M20 9.2c6-1.8 12-1.5 17 1v9c0 6-3.6 10.6-8.5 10.6S20 25.2 20 19.2z" style={{ fill: 'var(--bg)' }} stroke="currentColor" strokeWidth="2.2" />
    <path d="M24 15.5l3 .6M31 16.1l3-.6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <path d="M24.5 21.5c2.4 2.4 5.6 2.4 8 0" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
  </svg>
)
export const IconShuffle = (p: P) => (
  <svg {...base} viewBox="0 0 40 32" width={40} {...p} fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 8h7c4 0 6 2 9 8s5 8 9 8h8" /><path d="M2 24h7c4 0 6-2 9-8s5-8 9-8h8" />
    <path d="M30 3l5 5-5 5M30 19l5 5-5 5" />
  </svg>
)
export const IconUser = (p: P) => (
  <svg {...base} {...p}><circle cx="16" cy="8" r="6" /><path d="M3 30v-5c0-4 3-7 7-7h12c4 0 7 3 7 7v5z" /></svg>
)
export const IconHeart = ({ filled, ...p }: P & { filled?: boolean }) => (
  <svg {...base} width={20} height={20} {...p} fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2.6">
    <path d="M16 27S4 19.5 4 11.5A6.5 6.5 0 0 1 16 8a6.5 6.5 0 0 1 12 3.5C28 19.5 16 27 16 27z" strokeLinejoin="round" />
  </svg>
)
