import type { ChainId } from '../store/types'
import { SolMark } from './ui'

/** Simple, original glyphs — deliberately not the official logos. */
export function ChainGlyph({ id, size = 22 }: { id: ChainId; size?: number }) {
  const s = { width: size, height: size }
  switch (id) {
    case 'solana':
      return <SolMark size={size} />
    case 'ethereum':
      return (
        <svg {...s} viewBox="0 0 24 24"><path d="M12 2 5 12l7 4 7-4z" fill="#8f9bd8" /><path d="m5 13.5 7 8.5 7-8.5-7 4z" fill="#6c78b8" /></svg>
      )
    case 'base':
      return (
        <svg {...s} viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#3d6cff" /><rect x="3" y="10.5" width="11" height="3" fill="#0d0f10" /></svg>
      )
    case 'bnb':
      return (
        <svg {...s} viewBox="0 0 24 24"><path d="m12 3 3 3-3 3-3-3zM6 9l3 3-3 3-3-3zm12 0 3 3-3 3-3-3zm-6 6 3 3-3 3-3-3zm0-6 3 3-3 3-3-3z" fill="#f3ba2f" /></svg>
      )
    case 'arbitrum':
      return (
        <svg {...s} viewBox="0 0 24 24"><path d="M12 2 21 7v10l-9 5-9-5V7z" fill="#213147" stroke="#58a8ff" strokeWidth="1.5" /><path d="m9 16 3-8 3 8" stroke="#9dccff" strokeWidth="1.8" fill="none" /></svg>
      )
    case 'tron':
      return (
        <svg {...s} viewBox="0 0 24 24"><path d="M3 4 20 7l-8 14z" fill="none" stroke="#ff4b4b" strokeWidth="1.8" strokeLinejoin="round" /></svg>
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

export const LAUNCHPADS: { id: string; name: string; available: boolean; tint: string; letter: string }[] = [
  { id: 'pumpfun', name: 'Pump.fun', available: true, tint: '#3ddc97', letter: 'P' },
  { id: 'letsbonk', name: 'LetsBonk', available: false, tint: '#ff9a3d', letter: 'B' },
  { id: 'meteora', name: 'Meteora DBC', available: false, tint: '#ff5c9a', letter: 'M' },
  { id: 'bags', name: 'Bags', available: false, tint: '#5fd35f', letter: 'B' },
  { id: 'moonshot', name: 'Moonshot', available: false, tint: '#b892ff', letter: 'M' },
  { id: 'raydium', name: 'Raydium LaunchLab', available: false, tint: '#7cc4ff', letter: 'R' },
]

export function PadGlyph({ id, size = 22 }: { id: string; size?: number }) {
  const p = LAUNCHPADS.find((x) => x.id === id) ?? LAUNCHPADS[0]
  return (
    <div
      style={{ width: size, height: size, background: `${p.tint}22`, color: p.tint, borderColor: `${p.tint}55`, fontSize: size * 0.5 }}
      className="rounded-md border grid place-items-center font-bold"
    >
      {p.letter}
    </div>
  )
}

export function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="w-8 h-8 rounded-lg bg-lime grid place-items-center">
        <svg width="18" height="18" viewBox="0 0 32 32"><path d="M16 3c3.5 4.5 8 8 8 14.5a8 8 0 0 1-16 0c0-3.5 1.7-5.7 3.4-7.4 0 2.3 1.1 4 2.8 4.6C14 10.5 14 6.5 16 3z" fill="#0d0f10" /></svg>
      </div>
      <div className="leading-tight">
        <div className="font-semibold tracking-tight">Kiln</div>
        <div className="text-[10px] text-ink-400 font-mono">launch desk</div>
      </div>
    </div>
  )
}
