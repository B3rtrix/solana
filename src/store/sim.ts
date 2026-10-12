import { buyTokens, mcapSol, sellTokens } from '../lib/curve'
import { fakeAddress, uid } from '../lib/random'
import type { Candle, Launch, Trade } from './types'

export const CANDLE_SEC = 5
const MAX_CANDLES = 720
const MAX_TRADES = 120

/** Pushes a new mcap observation into the 5s candle series. */
export const pushCandle = (candles: Candle[], ts: number, mcapUsd: number, volSol: number): Candle[] => {
  const bucket = Math.floor(ts / 1000 / CANDLE_SEC) * CANDLE_SEC
  const last = candles[candles.length - 1]
  if (last && last.time === bucket) {
    const next = {
      ...last,
      high: Math.max(last.high, mcapUsd),
      low: Math.min(last.low, mcapUsd),
      close: mcapUsd,
      volume: last.volume + volSol,
    }
    return [...candles.slice(0, -1), next]
  }
  const open = last ? last.close : mcapUsd
  const c: Candle = {
    time: bucket,
    open,
    high: Math.max(open, mcapUsd),
    low: Math.min(open, mcapUsd),
    close: mcapUsd,
    volume: volSol,
  }
  const out = [...candles, c]
  return out.length > MAX_CANDLES ? out.slice(-MAX_CANDLES) : out
}

export const pushTrade = (trades: Trade[], t: Trade) => {
  const out = [t, ...trades]
  return out.length > MAX_TRADES ? out.slice(0, MAX_TRADES) : out
}

/** One second of simulated outside market activity on a live launch. */
export const simulateStep = (l: Launch, ts: number, solPrice: number, rnd: () => number = Math.random): Launch => {
  const momentum = Math.max(-1, Math.min(1, l.momentum * 0.97 + (rnd() - 0.5) * 0.25))
  let stepVol = 0
  let { curve, extTokens, extHolders, volumeSol, buys, sells, trades, candles } = l

  if (rnd() < 0.55) {
    const buyBias = 0.5 + momentum * 0.3
    const isBuy = rnd() < buyBias || extTokens < 1e6
    if (isBuy) {
      const sol = 0.03 + rnd() ** 2 * 1.6
      const r = buyTokens(curve, sol)
      curve = r.curve
      extTokens += r.tokens
      if (rnd() < 0.5) extHolders += 1
      volumeSol += sol
      stepVol = sol
      buys += 1
      trades = pushTrade(trades, {
        id: uid(), ts, side: 'buy', sol, tokens: r.tokens,
        mcapUsd: mcapSol(curve) * solPrice, trader: fakeAddress(),
      })
    } else {
      const tokens = extTokens * (0.05 + rnd() * 0.25)
      const r = sellTokens(curve, tokens)
      curve = r.curve
      extTokens -= tokens
      if (rnd() < 0.25) extHolders = Math.max(0, extHolders - 1)
      volumeSol += r.sol
      stepVol = r.sol
      sells += 1
      trades = pushTrade(trades, {
        id: uid(), ts, side: 'sell', sol: r.sol, tokens,
        mcapUsd: mcapSol(curve) * solPrice, trader: fakeAddress(),
      })
    }
  }
  candles = pushCandle(candles, ts, mcapSol(curve) * solPrice, stepVol)
  return { ...l, curve, extTokens, extHolders, volumeSol, buys, sells, trades, candles, momentum }
}
