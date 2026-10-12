import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { buyTokens, initialCurve, mcapSol, planBuys, priceSol, sellTokens, FEE } from '../lib/curve'
import { fakeAddress, uid } from '../lib/random'
import { buildSeed } from './seed'
import { pushCandle, pushTrade, simulateStep } from './sim'
import type { Group, Launch, PnlPoint, Position, Toast, Tracked, Wallet } from './types'

/** Rent + priority fee buffer each wallet keeps on top of its buy. */
export const TX_BUFFER = 0.012

export interface LaunchDraft {
  chain: Launch['chain']
  launchpad: string
  name: string
  symbol: string
  description: string
  image?: string
  twitter: string
  telegram: string
  website: string
  positions: Pick<Position, 'walletId' | 'role' | 'buyPct'>[]
}

interface State {
  solPrice: number
  funder: { address: string; balance: number }
  wallets: Wallet[]
  groups: Group[]
  tracked: Tracked[]
  launches: Launch[]
  pnlHistory: PnlPoint[]
  pnlBaseline: number
  toasts: Toast[]

  toast: (text: string, kind?: Toast['kind']) => void
  dismissToast: (id: string) => void

  deposit: (amount: number) => void
  withdrawFunder: (amount: number) => boolean

  createWallets: (count: number, groupId: string | null, prefix?: string) => void
  fundWallets: (ids: string[], amountEach: number) => boolean
  reclaimWallets: (ids: string[]) => number
  moveWallets: (ids: string[], groupId: string | null) => void
  renameWallet: (id: string, label: string) => void
  deleteWallets: (ids: string[]) => void
  createGroup: (name: string, color: string) => string
  renameGroup: (id: string, name: string) => void
  deleteGroup: (id: string) => void

  addTracked: (t: Pick<Tracked, 'address' | 'label' | 'emoji' | 'image' | 'color'>) => void
  updateTracked: (id: string, patch: Partial<Tracked>) => void
  removeTracked: (id: string) => void

  createLaunch: (d: LaunchDraft) => string
  setPositions: (id: string, positions: Pick<Position, 'walletId' | 'role' | 'buyPct'>[]) => void
  deleteLaunch: (id: string) => void
  fundPosition: (id: string, walletId: string) => boolean
  goLive: (id: string) => boolean
  trade: (id: string, walletIds: string[], side: 'buy' | 'sell', amount: number) => void
  sweepLaunch: (id: string) => number
  tick: () => void
}

const updLaunch = (launches: Launch[], id: string, fn: (l: Launch) => Launch) =>
  launches.map((l) => (l.id === id ? fn(l) : l))

/** Recomputes the SOL each position needs, executing buys dev-first. */
const withRequirements = (positions: Pick<Position, 'walletId' | 'role' | 'buyPct'>[], prev: Position[] = []) => {
  const ordered = [...positions].sort((a, b) => (a.role === 'dev' ? -1 : b.role === 'dev' ? 1 : 0))
  const { costs } = planBuys(ordered.map((p) => p.buyPct || 0))
  return ordered.map((p, i): Position => {
    const old = prev.find((o) => o.walletId === p.walletId)
    return {
      walletId: p.walletId,
      role: p.role,
      buyPct: p.buyPct,
      required: costs[i],
      funded: old?.funded ?? 0,
      tokens: 0,
      solIn: 0,
      solOut: 0,
    }
  })
}

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      ...buildSeed(),
      toasts: [],

      toast: (text, kind = 'ok') => {
        const id = uid()
        set((s) => ({ toasts: [...s.toasts, { id, kind, text }] }))
        setTimeout(() => get().dismissToast(id), 3200)
      },
      dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

      deposit: (amount) => set((s) => ({ funder: { ...s.funder, balance: s.funder.balance + amount } })),
      withdrawFunder: (amount) => {
        if (amount > get().funder.balance) return false
        set((s) => ({ funder: { ...s.funder, balance: s.funder.balance - amount } }))
        return true
      },

      createWallets: (count, groupId, prefix = 'Wallet') => {
        const base = get().wallets.length
        const fresh: Wallet[] = Array.from({ length: count }, (_, i) => ({
          id: uid(),
          address: fakeAddress(),
          label: `${prefix} ${base + i + 1}`,
          groupId,
          balance: 0,
          createdAt: Date.now(),
        }))
        set((s) => ({ wallets: [...s.wallets, ...fresh] }))
      },
      fundWallets: (ids, amountEach) => {
        const total = ids.length * amountEach
        if (total > get().funder.balance + 1e-9) return false
        set((s) => ({
          funder: { ...s.funder, balance: s.funder.balance - total },
          wallets: s.wallets.map((w) => (ids.includes(w.id) ? { ...w, balance: w.balance + amountEach } : w)),
        }))
        return true
      },
      reclaimWallets: (ids) => {
        const total = get().wallets.filter((w) => ids.includes(w.id)).reduce((a, w) => a + w.balance, 0)
        set((s) => ({
          funder: { ...s.funder, balance: s.funder.balance + total },
          wallets: s.wallets.map((w) => (ids.includes(w.id) ? { ...w, balance: 0 } : w)),
        }))
        return total
      },
      moveWallets: (ids, groupId) =>
        set((s) => ({ wallets: s.wallets.map((w) => (ids.includes(w.id) ? { ...w, groupId } : w)) })),
      renameWallet: (id, label) => set((s) => ({ wallets: s.wallets.map((w) => (w.id === id ? { ...w, label } : w)) })),
      deleteWallets: (ids) => set((s) => ({ wallets: s.wallets.filter((w) => !ids.includes(w.id)) })),
      createGroup: (name, color) => {
        const id = uid()
        set((s) => ({ groups: [...s.groups, { id, name, color }] }))
        return id
      },
      renameGroup: (id, name) => set((s) => ({ groups: s.groups.map((g) => (g.id === id ? { ...g, name } : g)) })),
      deleteGroup: (id) =>
        set((s) => ({
          groups: s.groups.filter((g) => g.id !== id),
          wallets: s.wallets.map((w) => (w.groupId === id ? { ...w, groupId: null } : w)),
        })),

      addTracked: (t) =>
        set((s) => ({
          tracked: [
            {
              ...t,
              id: uid(),
              addedAt: Date.now(),
              balance: Math.round(Math.random() * 400 * 100) / 100,
              pnl: Math.round((Math.random() - 0.35) * 30000),
              winRate: Math.round(35 + Math.random() * 45),
              trades: Math.floor(Math.random() * 900),
              lastActive: Date.now() - Math.random() * 3.6e6 * 6,
              notify: true,
            },
            ...s.tracked,
          ],
        })),
      updateTracked: (id, patch) =>
        set((s) => ({ tracked: s.tracked.map((t) => (t.id === id ? { ...t, ...patch } : t)) })),
      removeTracked: (id) => set((s) => ({ tracked: s.tracked.filter((t) => t.id !== id) })),

      createLaunch: (d) => {
        const id = uid()
        const launch: Launch = {
          id,
          chain: d.chain,
          launchpad: d.launchpad,
          name: d.name,
          symbol: d.symbol,
          description: d.description,
          image: d.image,
          twitter: d.twitter,
          telegram: d.telegram,
          website: d.website,
          status: 'draft',
          mint: fakeAddress('pump'),
          createdAt: Date.now(),
          positions: withRequirements(d.positions),
          curve: initialCurve(),
          candles: [],
          trades: [],
          volumeSol: 0,
          buys: 0,
          sells: 0,
          extTokens: 0,
          extHolders: 0,
          momentum: 0.4,
        }
        set((s) => ({ launches: [launch, ...s.launches] }))
        return id
      },
      setPositions: (id, positions) =>
        set((s) => ({
          launches: updLaunch(s.launches, id, (l) => ({ ...l, positions: withRequirements(positions, l.positions) })),
        })),
      deleteLaunch: (id) => set((s) => ({ launches: s.launches.filter((l) => l.id !== id) })),

      fundPosition: (id, walletId) => {
        const l = get().launches.find((x) => x.id === id)
        const p = l?.positions.find((x) => x.walletId === walletId)
        if (!l || !p) return false
        const wallet = get().wallets.find((w) => w.id === walletId)
        const need = Math.max(0, p.required + TX_BUFFER - (wallet?.balance ?? 0))
        if (need > get().funder.balance + 1e-9) return false
        set((s) => ({
          funder: { ...s.funder, balance: s.funder.balance - need },
          wallets: s.wallets.map((w) => (w.id === walletId ? { ...w, balance: w.balance + need } : w)),
          launches: updLaunch(s.launches, id, (x) => ({
            ...x,
            positions: x.positions.map((q) => (q.walletId === walletId ? { ...q, funded: q.required + TX_BUFFER } : q)),
          })),
        }))
        return true
      },

      goLive: (id) => {
        const { launches, wallets, solPrice } = get()
        const l = launches.find((x) => x.id === id)
        if (!l) return false
        const short = l.positions.find((p) => {
          const w = wallets.find((x) => x.id === p.walletId)
          return !w || w.balance + 1e-9 < p.required
        })
        if (short) return false
        const now = Date.now()
        let curve = initialCurve()
        let candles = pushCandle([], now - 5000, mcapSol(curve) * solPrice, 0)
        let trades = l.trades
        const spent: Record<string, number> = {}
        const positions = l.positions.map((p) => {
          if (p.required <= 0) return p
          const r = buyTokens(curve, p.required)
          curve = r.curve
          spent[p.walletId] = p.required
          const w = wallets.find((x) => x.id === p.walletId)!
          trades = pushTrade(trades, {
            id: uid(), ts: now, side: 'buy', sol: p.required, tokens: r.tokens,
            mcapUsd: mcapSol(curve) * solPrice, trader: w.address, walletId: w.id,
          })
          candles = pushCandle(candles, now, mcapSol(curve) * solPrice, p.required)
          return { ...p, tokens: r.tokens, solIn: p.required }
        })
        const vol = Object.values(spent).reduce((a, b) => a + b, 0)
        set((s) => ({
          wallets: s.wallets.map((w) => (spent[w.id] ? { ...w, balance: w.balance - spent[w.id] - 0.002 } : w)),
          launches: updLaunch(s.launches, id, (x) => ({
            ...x,
            status: 'live',
            launchedAt: now,
            positions,
            curve,
            candles,
            trades,
            volumeSol: vol,
            buys: Object.keys(spent).length,
          })),
        }))
        return true
      },

      trade: (id, walletIds, side, amount) => {
        const { launches, wallets, solPrice } = get()
        const l = launches.find((x) => x.id === id)
        if (!l) return
        const now = Date.now()
        let { curve, trades, candles, volumeSol, buys, sells } = l
        const balDelta: Record<string, number> = {}
        let executed = 0
        const positions = l.positions.map((p) => {
          if (!walletIds.includes(p.walletId)) return p
          const w = wallets.find((x) => x.id === p.walletId)
          if (!w) return p
          if (side === 'buy') {
            const sol = Math.min(amount, Math.max(0, w.balance - 0.003))
            if (sol <= 0.0001) return p
            const r = buyTokens(curve, sol)
            curve = r.curve
            balDelta[w.id] = -sol
            volumeSol += sol
            buys += 1
            executed++
            trades = pushTrade(trades, { id: uid(), ts: now, side, sol, tokens: r.tokens, mcapUsd: mcapSol(curve) * solPrice, trader: w.address, walletId: w.id })
            candles = pushCandle(candles, now, mcapSol(curve) * solPrice, sol)
            return { ...p, tokens: p.tokens + r.tokens, solIn: p.solIn + sol }
          }
          const tokens = p.tokens * Math.min(1, amount / 100)
          if (tokens <= 1) return p
          const r = sellTokens(curve, tokens)
          curve = r.curve
          balDelta[w.id] = r.sol
          volumeSol += r.sol
          sells += 1
          executed++
          trades = pushTrade(trades, { id: uid(), ts: now, side, sol: r.sol, tokens, mcapUsd: mcapSol(curve) * solPrice, trader: w.address, walletId: w.id })
          candles = pushCandle(candles, now, mcapSol(curve) * solPrice, r.sol)
          return { ...p, tokens: p.tokens - tokens, solOut: p.solOut + r.sol }
        })
        if (!executed) {
          get().toast(side === 'buy' ? 'No SOL available in selected wallets' : 'No tokens to sell in selected wallets', 'err')
          return
        }
        set((s) => ({
          wallets: s.wallets.map((w) => (balDelta[w.id] ? { ...w, balance: w.balance + balDelta[w.id] } : w)),
          launches: updLaunch(s.launches, id, (x) => ({ ...x, positions, curve, trades, candles, volumeSol, buys, sells })),
        }))
        get().toast(`${side === 'buy' ? 'Bought' : 'Sold'} with ${executed} wallet${executed > 1 ? 's' : ''}`)
      },

      sweepLaunch: (id) => {
        const l = get().launches.find((x) => x.id === id)
        if (!l) return 0
        return get().reclaimWallets(l.positions.map((p) => p.walletId))
      },

      tick: () => {
        const { launches, solPrice } = get()
        if (!launches.some((l) => l.status === 'live')) return
        const now = Date.now()
        const drift = solPrice * (1 + (Math.random() - 0.5) * 0.0008)
        set({
          solPrice: drift,
          launches: launches.map((l) => (l.status === 'live' ? simulateStep(l, now, drift) : l)),
        })
      },
    }),
    {
      name: 'kiln-v2',
      partialize: (s) => {
        const { toasts: _t, ...rest } = s
        return rest
      },
    },
  ),
)

/* ---------- derived helpers ---------- */

export const positionValueSol = (l: Launch, p: Position) => (p.tokens > 0 ? sellTokens(l.curve, p.tokens).sol : 0)

export const launchPnlSol = (l: Launch) =>
  l.positions.reduce((a, p) => a + p.solOut + positionValueSol(l, p) - p.solIn, 0)

export const launchStats = (l: Launch) => {
  const bought = l.positions.reduce((a, p) => a + p.solIn, 0)
  const sold = l.positions.reduce((a, p) => a + p.solOut, 0)
  const holding = l.positions.reduce((a, p) => a + positionValueSol(l, p), 0)
  const tokens = l.positions.reduce((a, p) => a + p.tokens, 0)
  return { bought, sold, holding, tokens, pnl: sold + holding - bought }
}

export const tokenPriceUsd = (l: Launch, solPrice: number) => priceSol(l.curve) * solPrice

export { FEE }
