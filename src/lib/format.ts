export const shortAddr = (a: string, head = 4, tail = 4) =>
  a.length <= head + tail + 1 ? a : `${a.slice(0, head)}…${a.slice(-tail)}`

export const fmtSol = (n: number, digits = 3) => {
  if (!isFinite(n)) return '0'
  if (Math.abs(n) >= 1000) return n.toLocaleString('en-US', { maximumFractionDigits: 1 })
  if (Math.abs(n) >= 100) return n.toFixed(2)
  return Number(n.toFixed(digits)).toString()
}

export const fmtUsd = (n: number, compact = true) => {
  const sign = n < 0 ? '-' : ''
  const v = Math.abs(n)
  if (compact && v >= 1e9) return `${sign}$${(v / 1e9).toFixed(2)}B`
  if (compact && v >= 1e6) return `${sign}$${(v / 1e6).toFixed(2)}M`
  if (compact && v >= 1e4) return `${sign}$${(v / 1e3).toFixed(1)}K`
  if (compact && v >= 1e3) return `${sign}$${(v / 1e3).toFixed(2)}K`
  return `${sign}$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export const fmtSigned = (n: number, f: (n: number) => string) => (n > 0 ? '+' : n < 0 ? '-' : '') + f(Math.abs(n))

export const fmtPct = (n: number, digits = 2) => `${Number(n.toFixed(digits))}%`

export const fmtTokens = (n: number) => {
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`
  return n.toFixed(0)
}

/** Tiny price like 0.0₅31 (subscript zero-count), similar to DEX terminals. */
export const fmtTinyUsd = (n: number) => {
  if (n >= 0.01) return `$${n.toFixed(4)}`
  const s = n.toFixed(20).split('.')[1]
  const zeros = s.match(/^0*/)![0].length
  const sub = '₀₁₂₃₄₅₆₇₈₉'
  const digits = s.slice(zeros, zeros + 3)
  return `$0.0${String(zeros).split('').map((d) => sub[+d]).join('')}${digits}`
}

export const timeAgo = (ts: number) => {
  const s = Math.max(1, Math.floor((Date.now() - ts) / 1000))
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}
