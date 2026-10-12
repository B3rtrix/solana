import type { ChainId } from '../store/types'
import { SolMark } from './ui'

/** Simple, original glyphs — deliberately not the official logos. */
export function ChainGlyph({ id, size = 22 }: { id: ChainId; size?: number }) {
  const s = { width: size, height: size, className: 'text-ink-200' }
  switch (id) {
    case 'solana':
      return <SolMark size={size} className="text-ink-200" />
    case 'ethereum':
      return (
        <svg {...s} viewBox="0 0 24 24"><path d="M12 2 5 12l7 4 7-4z" fill="currentColor" /><path d="m5 13.5 7 8.5 7-8.5-7 4z" fill="currentColor" opacity=".55" /></svg>
      )
    case 'base':
      return (
        <svg {...s} viewBox="0 0 24 24"><circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" strokeWidth="1.6" /><rect x="2.5" y="11" width="11" height="2" fill="currentColor" /></svg>
      )
    case 'bnb':
      return (
        <svg {...s} viewBox="0 0 24 24"><path d="m12 3 3 3-3 3-3-3zM6 9l3 3-3 3-3-3zm12 0 3 3-3 3-3-3zm-6 6 3 3-3 3-3-3zm0-6 3 3-3 3-3-3z" fill="currentColor" /></svg>
      )
    case 'arbitrum':
      return (
        <svg {...s} viewBox="0 0 24 24"><path d="M12 2.5 20.5 7.3v9.4L12 21.5l-8.5-4.8V7.3z" fill="none" stroke="currentColor" strokeWidth="1.5" /><path d="m9 16 3-8 3 8" stroke="currentColor" strokeWidth="1.6" fill="none" /></svg>
      )
    case 'tron':
      return (
        <svg {...s} viewBox="0 0 24 24"><path d="M3 4 20 7l-8 14z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /></svg>
      )
  }
}

export const CHAINS: { id: ChainId; name: string; available: boolean; note: string }[] = [
  { id: 'solana', name: 'Solana', available: true, note: 'Bonding-curve launches, ~400ms blocks' },
  { id: 'base', name: 'Base', available: false, note: 'Coming later' },
  { id: 'ethereum', name: 'Ethereum', available: false, note: 'Coming later' },
  { id: 'bnb', name: 'BNB Chain', available: false, note: 'Coming later' },
  { id: 'arbitrum', name: 'Arbitrum', available: false, note: 'Coming later' },
  { id: 'tron', name: 'Tron', available: false, note: 'Coming later' },
]

export const LAUNCHPADS: { id: string; name: string; available: boolean; letter: string }[] = [
  { id: 'pumpfun', name: 'Pump.fun', available: true, letter: 'P' },
  { id: 'letsbonk', name: 'LetsBonk', available: false, letter: 'B' },
  { id: 'meteora', name: 'Meteora DBC', available: false, letter: 'M' },
  { id: 'bags', name: 'Bags', available: false, letter: 'B' },
  { id: 'moonshot', name: 'Moonshot', available: false, letter: 'M' },
  { id: 'raydium', name: 'Raydium LaunchLab', available: false, letter: 'R' },
]

export function PadGlyph({ id, size = 22 }: { id: string; size?: number }) {
  const p = LAUNCHPADS.find((x) => x.id === id) ?? LAUNCHPADS[0]
  return (
    <div
      style={{ width: size, height: size, fontSize: size * 0.48 }}
      className="rounded border border-ink-600 bg-ink-850 text-ink-200 grid place-items-center font-mono font-medium"
    >
      {p.letter}
    </div>
  )
}

export function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="w-7 h-7 rounded-md bg-ink-100 grid place-items-center">
        <svg width="18" height="18" viewBox="0 0 32 32"><path d="M16 3c3.5 4.5 8 8 8 14.5a8 8 0 0 1-16 0c0-3.5 1.7-5.7 3.4-7.4 0 2.3 1.1 4 2.8 4.6C14 10.5 14 6.5 16 3z" fill="#0a0a0a" /></svg>
      </div>
      <div className="leading-tight">
        <div className="font-semibold tracking-tight">Kiln</div>
        <div className="text-[10px] text-ink-500 font-mono uppercase tracking-[0.14em]">launch desk</div>
      </div>
    </div>
  )
}
