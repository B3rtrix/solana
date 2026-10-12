import type { Curve } from '../lib/curve'

export type ChainId = 'solana' | 'ethereum' | 'base' | 'bnb' | 'arbitrum' | 'tron'

export interface Wallet {
  id: string
  address: string
  label: string
  groupId: string | null
  balance: number
  createdAt: number
}

export interface Group {
  id: string
  name: string
  color: string
}

export interface Tracked {
  id: string
  address: string
  label: string
  emoji?: string
  image?: string
  color: string
  addedAt: number
  balance: number
  pnl: number
  winRate: number
  trades: number
  lastActive: number
  notify: boolean
}

export type Role = 'dev' | 'holder'

export interface Position {
  walletId: string
  role: Role
  buyPct: number
  required: number
  funded: number
  tokens: number
  solIn: number
  solOut: number
}

export interface Trade {
  id: string
  ts: number
  side: 'buy' | 'sell'
  sol: number
  tokens: number
  mcapUsd: number
  trader: string
  walletId?: string
}

export interface Candle {
  time: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export interface Launch {
  id: string
  chain: ChainId
  launchpad: string
  name: string
  symbol: string
  description: string
  image?: string
  twitter: string
  telegram: string
  website: string
  status: 'draft' | 'live'
  mint: string
  createdAt: number
  launchedAt?: number
  positions: Position[]
  curve: Curve
  candles: Candle[]
  trades: Trade[]
  volumeSol: number
  buys: number
  sells: number
  extTokens: number
  extHolders: number
  momentum: number
}

export interface PnlPoint {
  t: number
  v: number
}

export interface Toast {
  id: string
  kind: 'ok' | 'err' | 'info'
  text: string
}
