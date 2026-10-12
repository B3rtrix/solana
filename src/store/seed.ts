import { buyTokens, initialCurve, mcapSol } from '../lib/curve'
import { fakeAddress, mulberry32, uid } from '../lib/random'
import { pushCandle, simulateStep } from './sim'
import type { Group, Launch, PnlPoint, Tracked, Wallet } from './types'

const SOL_PRICE = 168.4

/** Smooth-ish cumulative PnL history so the dashboard has something to show. */
const seedPnl = (): PnlPoint[] => {
  const rnd = mulberry32(42)
  const days = 180
  const out: PnlPoint[] = []
  let v = 0
  let trend = 0
  const start = Date.now() - days * 86400_000
  for (let i = 0; i <= days; i++) {
    trend = trend * 0.85 + (rnd() - 0.42) * 90
    v += trend + (rnd() - 0.5) * 60
    out.push({ t: start + i * 86400_000, v: Math.round(v * 100) / 100 })
  }
  return out
}

export const buildSeed = () => {
  const groups: Group[] = [
    { id: 'g-launch', name: 'Launch Squad', color: '#ededed' },
    { id: 'g-snipe', name: 'Volume', color: '#9fb3c8' },
    { id: 'g-cold', name: 'Cold', color: '#c8b79f' },
  ]
  const mk = (label: string, groupId: string | null, balance: number): Wallet => ({
    id: uid(), address: fakeAddress(), label, groupId, balance, createdAt: Date.now() - 86400_000 * 4,
  })
  const wallets: Wallet[] = [
    mk('Dev Main', 'g-launch', 2.4),
    ...Array.from({ length: 6 }, (_, i) => mk(`Holder ${i + 1}`, 'g-launch', 0.35 + i * 0.05)),
    ...Array.from({ length: 4 }, (_, i) => mk(`Vol ${i + 1}`, 'g-snipe', 0.8)),
    mk('Vault', 'g-cold', 12.5),
    mk('Spare', null, 0),
  ]

  const tracked: Tracked[] = [
    { label: 'Whale Alpha', emoji: '🐋', color: '#9fb3c8', pnl: 48210, winRate: 71, trades: 312, balance: 1840.2 },
    { label: 'Early Bird', emoji: '🦅', color: '#ededed', pnl: 12904, winRate: 64, trades: 891, balance: 211.4 },
    { label: 'Degen Dave', emoji: '🎲', color: '#c49f9f', pnl: -3420, winRate: 38, trades: 1544, balance: 18.9 },
  ].map((t, i) => ({
    ...t,
    id: uid(),
    address: fakeAddress(),
    addedAt: Date.now() - 86400_000 * (i + 2),
    lastActive: Date.now() - 60_000 * (i * 23 + 4),
    notify: i !== 2,
  }))

  // A launch that is already live with ~40 minutes of history.
  const holders = wallets.slice(0, 5)
  const launchedAt = Date.now() - 40 * 60_000
  let curve = initialCurve()
  let candles = pushCandle([], launchedAt - 5000, mcapSol(curve) * SOL_PRICE, 0)
  const pcts = [3, 2.5, 2, 2, 1.5]
  const positions = holders.map((w, i) => {
    const sol = [1.0, 0.85, 0.7, 0.72, 0.55][i]
    const r = buyTokens(curve, sol)
    curve = r.curve
    candles = pushCandle(candles, launchedAt, mcapSol(curve) * SOL_PRICE, sol)
    return {
      walletId: w.id, role: i === 0 ? ('dev' as const) : ('holder' as const), buyPct: pcts[i],
      required: sol, funded: sol, tokens: r.tokens, solIn: sol, solOut: 0,
    }
  })
  let live: Launch = {
    id: 'demo-ember', chain: 'solana', launchpad: 'pumpfun', name: 'Ember', symbol: 'EMBER',
    description: 'A small flame that refuses to go out.', twitter: 'x.com/ember', telegram: '', website: '',
    status: 'live', mint: fakeAddress('pump'), createdAt: launchedAt - 600_000, launchedAt, positions, curve,
    candles, trades: [], volumeSol: 3.82, buys: 5, sells: 0, extTokens: 0, extHolders: 0, momentum: 0.6,
  }
  const rnd = mulberry32(7)
  for (let t = launchedAt + 1000; t < Date.now(); t += 1000) live = simulateStep(live, t, SOL_PRICE, rnd)

  // Partial profit already taken by the dev wallet.
  live = { ...live, positions: live.positions.map((p, i) => (i === 0 ? { ...p, tokens: p.tokens * 0.6, solOut: 0.9 } : p)) }

  const history = seedPnl()
  return {
    solPrice: SOL_PRICE,
    funder: { address: fakeAddress(), balance: 24.73 },
    wallets,
    groups,
    tracked,
    launches: [live],
    pnlHistory: history,
    pnlBaseline: history[history.length - 1].v,
  }
}
