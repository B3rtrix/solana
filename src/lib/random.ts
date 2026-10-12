const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'

export const uid = () => Math.random().toString(36).slice(2, 10)

/** Generates a Solana-looking base58 address (demo only — not a real keypair). */
export const fakeAddress = (suffix = '') => {
  let s = ''
  const len = 44 - suffix.length
  for (let i = 0; i < len; i++) s += B58[Math.floor(Math.random() * B58.length)]
  return s + suffix
}

/** Deterministic PRNG so seeded charts look the same on every load. */
export const mulberry32 = (seed: number) => () => {
  let t = (seed += 0x6d2b79f5)
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

export const randBetween = (a: number, b: number) => a + Math.random() * (b - a)
