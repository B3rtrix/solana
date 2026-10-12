// Constant-product bonding curve modelled on pump.fun's launch parameters.
export const TOTAL_SUPPLY = 1_000_000_000
export const INIT_V_SOL = 30
export const INIT_V_TOK = 1_073_000_000
export const GRADUATION_SOL = 85
export const FEE = 0.01

export interface Curve {
  vSol: number
  vTok: number
}

export const initialCurve = (): Curve => ({ vSol: INIT_V_SOL, vTok: INIT_V_TOK })

export const priceSol = (c: Curve) => c.vSol / c.vTok
export const mcapSol = (c: Curve) => priceSol(c) * TOTAL_SUPPLY
export const realSol = (c: Curve) => c.vSol - INIT_V_SOL

/** SOL needed (incl. fee) to buy `tokens` from the curve. */
export const costToBuy = (c: Curve, tokens: number) => {
  const k = c.vSol * c.vTok
  const sol = k / (c.vTok - tokens) - c.vSol
  return sol * (1 + FEE)
}

export const buyTokens = (c: Curve, solIn: number): { curve: Curve; tokens: number } => {
  const net = solIn / (1 + FEE)
  const k = c.vSol * c.vTok
  const vSol = c.vSol + net
  const vTok = k / vSol
  return { curve: { vSol, vTok }, tokens: c.vTok - vTok }
}

export const sellTokens = (c: Curve, tokens: number): { curve: Curve; sol: number } => {
  const k = c.vSol * c.vTok
  const vTok = c.vTok + tokens
  const vSol = k / vTok
  return { curve: { vSol, vTok }, sol: (c.vSol - vSol) * (1 - FEE) }
}

/**
 * Plans block-0 buys: each entry is a % of total supply, executed in order.
 * Returns the SOL each wallet needs and the curve afterwards.
 */
export const planBuys = (pcts: number[]) => {
  let c = initialCurve()
  const costs = pcts.map((p) => {
    const tokens = (TOTAL_SUPPLY * p) / 100
    if (tokens <= 0) return 0
    const cost = costToBuy(c, tokens)
    c = buyTokens(c, cost).curve
    return cost
  })
  return { costs, curve: c }
}
