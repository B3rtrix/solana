import {
  AlertTriangle, ArrowDownToLine, Bomb, CheckCircle2, ChefHat, Circle, Eye, EyeOff, Globe, Loader2, Plus, Rocket, Send, Share2, Trash2, User, Users,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { PadGlyph } from '../components/brand'
import { CandleChart } from '../components/CandleChart'
import { DepositModal } from '../components/Funder'
import { CopyAddr, cx, Modal, Segmented, Sol, TokenAvatar } from '../components/ui'
import { WalletPicker } from '../components/WalletPicker'
import { GRADUATION_SOL, INIT_V_TOK, mcapSol, realSol, TOTAL_SUPPLY } from '../lib/curve'
import { fmtSigned, fmtTinyUsd, fmtTokens, fmtUsd, shortAddr, timeAgo } from '../lib/format'
import { mulberry32 } from '../lib/random'
import type { Launch, Position, Wallet } from '../store/types'
import { launchStats, positionValueSol, tokenPriceUsd, TX_BUFFER, useStore } from '../store/useStore'

export default function LaunchPage() {
  const { id } = useParams()
  const launch = useStore((s) => s.launches.find((l) => l.id === id))
  if (!launch)
    return (
      <div className="p-16 text-center text-ink-400">
        Launch not found. <Link to="/" className="text-accent hover:underline">Back to dashboard</Link>
      </div>
    )
  return launch.status === 'draft' ? <DraftView l={launch} key={launch.id} /> : <LiveView l={launch} key={launch.id} />
}

/* ------------------------------------------------------------------ */
/* Shared                                                              */
/* ------------------------------------------------------------------ */

function TokenHeader({ l }: { l: Launch }) {
  return (
    <div className="flex items-center gap-3 min-w-0">
      <div className="relative">
        <TokenAvatar image={l.image} symbol={l.symbol} size={44} />
        <div className="absolute -bottom-1 -right-1"><PadGlyph id={l.launchpad} size={16} /></div>
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-lg">${l.symbol}</span>
          <span className="text-ink-400 text-sm truncate">{l.name}</span>
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <CopyAddr address={l.mint} className="text-[11px]" />
          {l.twitter && <a href={`https://${l.twitter.replace(/^https?:\/\//, '')}`} target="_blank" rel="noreferrer" className="text-ink-400 hover:text-ink-100 text-[12px] font-bold">𝕏</a>}
          {l.telegram && <a href={`https://${l.telegram.replace(/^https?:\/\//, '')}`} target="_blank" rel="noreferrer" className="text-ink-400 hover:text-ink-100"><Send size={12} /></a>}
          {l.website && <a href={`https://${l.website.replace(/^https?:\/\//, '')}`} target="_blank" rel="noreferrer" className="text-ink-400 hover:text-ink-100"><Globe size={12} /></a>}
          {l.launchedAt && <span className="chip bg-ink-800 text-ink-400">{timeAgo(l.launchedAt)}</span>}
        </div>
      </div>
    </div>
  )
}

function HeadStat({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cx('px-5 border-l border-ink-750', className)}>
      <div className="text-[11px] text-ink-500">{label}</div>
      <div className="text-sm font-semibold num mt-0.5">{children}</div>
    </div>
  )
}

const RoleIcon = ({ role }: { role: Position['role'] }) =>
  role === 'dev' ? <ChefHat size={14} className="text-ink-200" /> : <User size={14} className="text-ink-500" />

/* ------------------------------------------------------------------ */
/* Draft: fund wallets, then launch                                     */
/* ------------------------------------------------------------------ */

function DraftView({ l }: { l: Launch }) {
  const nav = useNavigate()
  const { wallets, funder, solPrice, setPositions, deleteLaunch, fundPosition, goLive, toast } = useStore()
  const [picker, setPicker] = useState(false)
  const [deposit, setDeposit] = useState(false)
  const [distributing, setDistributing] = useState<string | null>(null)
  const [confirm, setConfirm] = useState(false)
  const wById = Object.fromEntries(wallets.map((w) => [w.id, w])) as Record<string, Wallet | undefined>

  const rows = l.positions.map((p) => {
    const w = wById[p.walletId]
    const need = p.required + TX_BUFFER
    const have = w?.balance ?? 0
    return { p, w, need, have, ready: !!w && have + 1e-9 >= p.required, short: Math.max(0, need - have) }
  })
  const totalNeed = rows.reduce((a, r) => a + r.short, 0)
  const totalPct = l.positions.reduce((a, p) => a + (p.buyPct || 0), 0)
  const required = l.positions.reduce((a, p) => a + p.required, 0)
  const afterMcap = mcapSol({ vSol: 30 + required / 1.01, vTok: (30 * INIT_V_TOK) / (30 + required / 1.01) }) * solPrice
  const allReady = rows.length > 0 && rows.every((r) => r.ready)
  const missing = rows.some((r) => !r.w)

  const editPct = (walletId: string, v: string) =>
    setPositions(l.id, l.positions.map((p) => ({ ...p, buyPct: p.walletId === walletId ? Math.max(0, +v || 0) : p.buyPct })))
  const remove = (walletId: string) => setPositions(l.id, l.positions.filter((p) => p.walletId !== walletId))

  const distribute = async () => {
    if (totalNeed > funder.balance + 1e-9) {
      toast(`Funder needs ${(totalNeed - funder.balance).toFixed(3)} more SOL`, 'err')
      setDeposit(true)
      return
    }
    for (const r of rows) {
      if (r.short <= 0 || !r.w) continue
      setDistributing(r.p.walletId)
      await new Promise((res) => setTimeout(res, 220))
      fundPosition(l.id, r.p.walletId)
    }
    setDistributing(null)
    toast('All wallets funded — ready to launch')
  }

  const launch = () => {
    if (goLive(l.id)) toast(`$${l.symbol} is live`)
    else toast('Some wallets are not funded yet', 'err')
    setConfirm(false)
  }

  return (
    <div className="min-h-full flex flex-col animate-in">
      <div className="h-[72px] shrink-0 border-b border-ink-750 px-6 flex items-center">
        <TokenHeader l={l} />
        <div className="flex items-center ml-6">
          <HeadStat label="Est. market cap">{fmtUsd(mcapSol({ vSol: 30, vTok: INIT_V_TOK }) * solPrice)} → {fmtUsd(afterMcap)}</HeadStat>
          <HeadStat label="Block-0 supply">{Number(totalPct.toFixed(2))}%</HeadStat>
          <HeadStat label="Required funding"><Sol v={(required + rows.length * TX_BUFFER).toFixed(3)} /></HeadStat>
        </div>
        <span className="ml-auto chip bg-ink-800 text-ink-300 border border-ink-700 px-2 py-1">Draft</span>
      </div>

      <div className="grid md:grid-cols-3 border-b border-ink-750">
        <div className="p-5 border-r border-ink-750">
          <div className="label">Funder</div>
          <div className="mt-3 flex items-center justify-between rounded-lg bg-accent/[0.06] border border-accent/25 px-3 py-2.5">
            <CopyAddr address={funder.address} />
            <span className="text-sm"><Sol v={funder.balance.toFixed(2)} /> <span className="text-ink-500">/ {totalNeed.toFixed(2)} needed</span></span>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-3">
            <button className="btn-ghost text-xs" onClick={() => setDeposit(true)}><ArrowDownToLine size={14} /> Deposit</button>
            <button className="btn-ghost text-xs" onClick={() => nav('/wallets')}>Manage wallets</button>
          </div>
        </div>
        <div className="p-5 border-r border-ink-750">
          <div className="label">Plan</div>
          <div className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-ink-400">Wallets</span><span className="num">{rows.length}</span></div>
            <div className="flex justify-between"><span className="text-ink-400">Funded</span><span className="num">{rows.filter((r) => r.ready).length}/{rows.length}</span></div>
            <div className="flex justify-between"><span className="text-ink-400">Launchpad</span><span>Pump.fun</span></div>
          </div>
        </div>
        <div className="p-5">
          <div className="label">Checklist</div>
          <div className="mt-3 space-y-2 text-sm">
            {[
              { ok: rows.length > 0 && !missing, t: 'Wallets selected' },
              { ok: totalNeed <= funder.balance || allReady, t: 'Funder covers distribution' },
              { ok: allReady, t: 'All wallets funded' },
            ].map((c) => (
              <div key={c.t} className={cx('flex items-center gap-2', c.ok ? 'text-ink-200' : 'text-ink-500')}>
                {c.ok ? <CheckCircle2 size={15} className="text-up" /> : <Circle size={15} />} {c.t}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 p-6">
        <div className="panel overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-ink-750">
            <span className="font-medium text-sm">Launch wallets</span>
            <span className="text-xs text-ink-500">Buys execute top to bottom in the first block</span>
            <div className="ml-auto flex gap-2">
              <button className="btn-ghost text-xs py-1.5" onClick={() => setPicker(true)}><Plus size={14} /> Add / remove wallets</button>
              <button className="btn-danger text-xs py-1.5" onClick={() => { deleteLaunch(l.id); nav('/') }}><Trash2 size={14} /> Delete draft</button>
            </div>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-ink-500">
                <th className="font-normal pl-4 py-2.5 w-10">#</th>
                <th className="font-normal">Wallet</th>
                <th className="font-normal w-36">Supply %</th>
                <th className="font-normal text-right">Buy cost</th>
                <th className="font-normal w-[260px] pl-8">Funding</th>
                <th className="w-12" />
              </tr>
            </thead>
            <tbody>
              {rows.map(({ p, w, need, have, ready }, i) => (
                <tr key={p.walletId} className="border-t border-ink-800">
                  <td className="pl-4 text-ink-500 num">{i + 1}</td>
                  <td className="py-3">
                    <div className="flex items-center gap-2.5">
                      <RoleIcon role={p.role} />
                      <div>
                        <div className="font-medium">{w?.label ?? 'Missing wallet'} {p.role === 'dev' && <span className="chip border border-ink-600 text-ink-300 font-mono ml-1">DEV</span>}</div>
                        {w && <CopyAddr address={w.address} className="text-[11px]" />}
                      </div>
                    </div>
                  </td>
                  <td>
                    <div className="relative w-28">
                      <input
                        type="number"
                        className="input py-1.5 pr-7 text-sm"
                        defaultValue={p.buyPct || ''}
                        placeholder="0"
                        onBlur={(e) => editPct(p.walletId, e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                      />
                      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-500 text-xs">%</span>
                    </div>
                  </td>
                  <td className="text-right"><Sol v={p.required.toFixed(3)} className="justify-end" /></td>
                  <td className="pl-8">
                    <div className="flex items-center gap-3">
                      <div className="flex-1">
                        <div className="flex justify-between text-[11px] mb-1">
                          <span className="num text-ink-300">{have.toFixed(3)} / {need.toFixed(3)}</span>
                          {distributing === p.walletId ? (
                            <span className="text-accent flex items-center gap-1"><Loader2 size={11} className="animate-spin" /> sending</span>
                          ) : ready ? (
                            <span className="text-up">funded</span>
                          ) : (
                            <span className="text-warn">needs {(need - have).toFixed(3)}</span>
                          )}
                        </div>
                        <div className="h-1.5 rounded-full bg-ink-750 overflow-hidden">
                          <div className={cx('h-full rounded-full transition-all duration-300', ready ? 'bg-ink-100' : 'bg-ink-500')} style={{ width: `${Math.min(100, (have / need) * 100)}%` }} />
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="pr-4 text-right">
                    {p.role !== 'dev' && (
                      <button className="btn-quiet p-1.5 hover:text-down" onClick={() => remove(p.walletId)}><Trash2 size={14} /></button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!rows.length && <div className="text-center text-sm text-ink-500 py-10">No wallets yet — add some to buy in the launch block.</div>}
        </div>
      </div>

      <div className="sticky bottom-0 border-t border-ink-750 bg-ink-950/90 backdrop-blur px-6 py-4 flex items-center gap-3">
        <div className="text-sm text-ink-400">
          {allReady ? <span className="text-up">Everything is funded.</span> : <>Distribution needs <Sol v={totalNeed.toFixed(3)} className="text-ink-100" /> from your Funder.</>}
        </div>
        <div className="ml-auto flex gap-2">
          <button className="btn-ghost px-5" disabled={allReady || !!distributing || !rows.length || missing} onClick={distribute}>
            {distributing ? <Loader2 size={16} className="animate-spin" /> : <Share2 size={16} />} 1. Distribute
          </button>
          <button className="btn-primary px-6" disabled={!allReady || missing} onClick={() => setConfirm(true)}>
            <Rocket size={16} /> 2. Launch
          </button>
        </div>
      </div>

      <WalletPicker
        open={picker}
        onClose={() => setPicker(false)}
        value={l.positions.filter((p) => p.role === 'holder').map((p) => p.walletId)}
        exclude={l.positions.filter((p) => p.role === 'dev').map((p) => p.walletId)}
        onConfirm={(ids) => {
          const dev = l.positions.filter((p) => p.role === 'dev')
          const holders = ids.map((id) => l.positions.find((p) => p.walletId === id) ?? { walletId: id, role: 'holder' as const, buyPct: 0 })
          setPositions(l.id, [...dev, ...holders])
        }}
      />
      <DepositModal open={deposit} onClose={() => setDeposit(false)} />
      <Modal
        open={confirm}
        onClose={() => setConfirm(false)}
        title={`Launch $${l.symbol}?`}
        subtitle="The token is created and every wallet buys in the same block. This can't be undone."
        footer={
          <>
            <button className="btn-ghost" onClick={() => setConfirm(false)}>Not yet</button>
            <button className="btn-primary" onClick={launch}><Rocket size={16} /> Launch now</button>
          </>
        }
      >
        <div className="flex items-center gap-4">
          <TokenAvatar image={l.image} symbol={l.symbol} size={56} />
          <div className="text-sm space-y-1">
            <div><span className="text-ink-400">Wallets buying:</span> <span className="num">{rows.length}</span></div>
            <div><span className="text-ink-400">Supply in block 0:</span> <span className="num">{Number(totalPct.toFixed(2))}%</span></div>
            <div><span className="text-ink-400">Total spend:</span> <Sol v={required.toFixed(3)} /></div>
          </div>
        </div>
      </Modal>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Live: chart + trading                                               */
/* ------------------------------------------------------------------ */

type Scope = 'all' | 'dev' | 'holders' | 'custom'

function LiveView({ l }: { l: Launch }) {
  const { wallets, solPrice, trade, sweepLaunch, toast } = useStore()
  const [tf, setTf] = useState(5)
  const [bubbles, setBubbles] = useState(true)
  const [tab, setTab] = useState<'wallets' | 'trades' | 'holders'>('wallets')
  const [side, setSide] = useState<'buy' | 'sell'>('buy')
  const [scope, setScope] = useState<Scope>('all')
  const [custom, setCustom] = useState<string[]>([])
  const [buyAmt, setBuyAmt] = useState('0.1')
  const [sellPct, setSellPct] = useState('25')
  const [nuke, setNuke] = useState(false)
  const [withdraw, setWithdraw] = useState(false)

  const wById = Object.fromEntries(wallets.map((w) => [w.id, w])) as Record<string, Wallet | undefined>
  const mine = new Set(l.positions.map((p) => p.walletId))
  const myTrades = l.trades.filter((t) => t.walletId && mine.has(t.walletId))
  const st = launchStats(l)
  const mcap = mcapSol(l.curve) * solPrice
  const price = tokenPriceUsd(l, solPrice)
  const open = l.candles[0]?.open ?? mcap
  const change = ((mcap - open) / open) * 100
  const grad = Math.min(100, (realSol(l.curve) / GRADUATION_SOL) * 100)
  const walletSol = l.positions.reduce((a, p) => a + (wById[p.walletId]?.balance ?? 0), 0)
  const hourAgo = Date.now() - 3600_000
  const recent = l.trades.filter((t) => t.ts > hourAgo)
  const buys = recent.filter((t) => t.side === 'buy')
  const sells = recent.filter((t) => t.side === 'sell')
  const buyVol = buys.reduce((a, t) => a + t.sol, 0)
  const sellVol = sells.reduce((a, t) => a + t.sol, 0)

  const avg = (side: 'buy' | 'sell') => {
    const t = myTrades.filter((x) => x.side === side)
    const s = t.reduce((a, x) => a + x.sol, 0)
    return s ? t.reduce((a, x) => a + x.mcapUsd * x.sol, 0) / s : undefined
  }

  const scopeIds = (s: Scope) =>
    s === 'all' ? l.positions.map((p) => p.walletId)
      : s === 'dev' ? l.positions.filter((p) => p.role === 'dev').map((p) => p.walletId)
      : s === 'holders' ? l.positions.filter((p) => p.role === 'holder').map((p) => p.walletId)
      : custom

  const execute = () => {
    const ids = scopeIds(scope)
    if (!ids.length) return toast('Select at least one wallet', 'err')
    trade(l.id, ids, side, side === 'buy' ? +buyAmt : +sellPct)
  }

  const holders = useMemo(() => {
    const rnd = mulberry32(l.mint.charCodeAt(3) * 97)
    const n = Math.min(12, l.extHolders)
    const w = Array.from({ length: n }, () => rnd() ** 2 + 0.05)
    const sum = w.reduce((a, b) => a + b, 0)
    const ext = w.map((x, i) => ({ key: `ext${i}`, label: shortAddr(l.mint.slice(i, i + 12) + 'xx', 4, 4), tokens: (l.extTokens * x) / sum, mine: false, role: undefined as Position['role'] | undefined }))
    const my = l.positions.filter((p) => p.tokens > 1).map((p) => ({ key: p.walletId, label: wById[p.walletId]?.label ?? '—', tokens: p.tokens, mine: true, role: p.role }))
    const curveLeft = l.curve.vTok - (INIT_V_TOK - TOTAL_SUPPLY * 0.793)
    return [{ key: 'curve', label: 'Bonding curve', tokens: Math.max(0, curveLeft), mine: false, role: undefined }, ...[...my, ...ext].sort((a, b) => b.tokens - a.tokens)]
  }, [l.extTokens, l.extHolders, l.positions, l.curve, l.mint]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="h-full flex flex-col">
      {/* header */}
      <div className="h-[72px] shrink-0 border-b border-ink-750 px-5 flex items-center">
        <TokenHeader l={l} />
        <div className="flex items-center ml-5">
          <HeadStat label="Market cap"><span className="text-base">{fmtUsd(mcap)}</span></HeadStat>
          <HeadStat label="Price">
            {fmtTinyUsd(price)} <span className={cx('text-xs', change >= 0 ? 'text-up' : 'text-down')}>{fmtSigned(change, (v) => v.toFixed(1))}%</span>
          </HeadStat>
          <HeadStat label="1h volume">{fmtUsd((buyVol + sellVol) * solPrice)}</HeadStat>
          <div className="px-5 border-l border-ink-750 w-52">
            <div className="flex justify-between text-[11px]">
              <span className="text-up num">{buys.length} / {fmtUsd(buyVol * solPrice)}</span>
              <span className="text-down num">{sells.length} / {fmtUsd(sellVol * solPrice)}</span>
            </div>
            <div className="flex h-1.5 mt-1.5 rounded-full overflow-hidden bg-ink-750">
              <div className="bg-up" style={{ width: `${(buyVol / (buyVol + sellVol || 1)) * 100}%` }} />
              <div className="bg-down flex-1" />
            </div>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button className="btn-ghost" onClick={() => setWithdraw(true)}>
            <ArrowDownToLine size={15} /> Withdraw <span className="text-ink-400 num">· {walletSol.toFixed(2)}</span>
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 grid grid-cols-[1fr_340px]">
        {/* left: chart + tables */}
        <div className="min-w-0 flex flex-col border-r border-ink-750">
          <div className="h-11 shrink-0 border-b border-ink-750 px-3 flex items-center gap-3">
            <Segmented size="sm" value={String(tf)} onChange={(v) => setTf(+v)} options={[{ value: '5', label: '5s' }, { value: '15', label: '15s' }, { value: '60', label: '1m' }, { value: '300', label: '5m' }]} />
            <button className="btn-quiet text-xs py-1" onClick={() => setBubbles(!bubbles)}>
              {bubbles ? <EyeOff size={14} /> : <Eye size={14} />} {bubbles ? 'Hide' : 'Show'} my trades
            </button>
            <div className="ml-auto flex items-center gap-2 text-[11px] text-ink-400">
              Bonding curve
              <div className="w-28 h-1.5 rounded-full bg-ink-750 overflow-hidden"><div className="h-full bg-accent" style={{ width: `${grad}%` }} /></div>
              <span className="num text-ink-200">{grad.toFixed(1)}%</span>
            </div>
          </div>
          <div className="h-[46%] min-h-[300px] shrink-0">
            <CandleChart candles={l.candles} tf={tf} myTrades={myTrades} showMarkers={bubbles} avgBuy={bubbles ? avg('buy') : undefined} avgSell={bubbles ? avg('sell') : undefined} />
          </div>

          <div className="flex-1 min-h-0 flex flex-col border-t border-ink-750">
            <div className="h-11 shrink-0 px-3 flex items-center gap-1 border-b border-ink-750">
              {([['wallets', `My Wallets (${l.positions.length})`], ['trades', 'Trades'], ['holders', 'Holders']] as const).map(([k, label]) => (
                <button key={k} onClick={() => setTab(k)} className={cx('px-3 py-1.5 text-sm rounded-md', tab === k ? 'bg-ink-800 text-ink-100' : 'text-ink-400 hover:text-ink-200')}>{label}</button>
              ))}
            </div>
            <div className="flex-1 overflow-y-auto">
              {tab === 'wallets' && (
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-ink-950">
                    <tr className="text-left text-xs text-ink-500">
                      <th className="font-normal pl-4 py-2">Wallet</th>
                      <th className="font-normal">Supply</th>
                      <th className="font-normal text-right">Value</th>
                      <th className="font-normal text-right">SOL</th>
                      <th className="font-normal text-right">PnL</th>
                      <th className="font-normal text-right pr-4">Quick trade</th>
                    </tr>
                  </thead>
                  <tbody>
                    {l.positions.map((p) => {
                      const w = wById[p.walletId]
                      const val = positionValueSol(l, p)
                      const pnl = p.solOut + val - p.solIn
                      return (
                        <tr key={p.walletId} className="border-t border-ink-800 hover:bg-ink-900">
                          <td className="pl-4 py-2.5">
                            <div className="flex items-center gap-2">
                              <RoleIcon role={p.role} />
                              <div>
                                <div className="text-sm">{w?.label ?? '—'}</div>
                                {w && <CopyAddr address={w.address} className="text-[10px]" />}
                              </div>
                            </div>
                          </td>
                          <td className="num">{((p.tokens / TOTAL_SUPPLY) * 100).toFixed(2)}%</td>
                          <td className="text-right"><Sol v={val.toFixed(3)} className="justify-end" /></td>
                          <td className="text-right"><Sol v={(w?.balance ?? 0).toFixed(3)} className="justify-end text-ink-300" /></td>
                          <td className={cx('text-right num', pnl >= 0 ? 'text-up' : 'text-down')}>{fmtSigned(pnl, (v) => v.toFixed(3))}</td>
                          <td className="pr-4">
                            <div className="flex justify-end gap-1">
                              {[0.1, 0.5].map((v) => (
                                <button key={v} onClick={() => trade(l.id, [p.walletId], 'buy', v)} className="chip border border-ink-700 text-ink-200 hover:bg-ink-800 px-2 py-1">{v}</button>
                              ))}
                              <span className="w-2" />
                              {[25, 50, 100].map((v) => (
                                <button key={v} onClick={() => trade(l.id, [p.walletId], 'sell', v)} disabled={p.tokens < 1} className="chip border border-down/30 text-down hover:bg-down/10 px-2 py-1 disabled:opacity-30">{v}%</button>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-ink-750 text-xs text-ink-400">
                      <td className="pl-4 py-2.5">{l.positions.length} wallets</td>
                      <td className="num">{((st.tokens / TOTAL_SUPPLY) * 100).toFixed(2)}%</td>
                      <td className="text-right"><Sol v={st.holding.toFixed(3)} className="justify-end" /></td>
                      <td className="text-right"><Sol v={walletSol.toFixed(3)} className="justify-end" /></td>
                      <td className={cx('text-right num', st.pnl >= 0 ? 'text-up' : 'text-down')}>{fmtSigned(st.pnl, (v) => v.toFixed(3))}</td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              )}

              {tab === 'trades' && (
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-ink-950">
                    <tr className="text-left text-xs text-ink-500">
                      <th className="font-normal pl-4 py-2">Age</th>
                      <th className="font-normal">Type</th>
                      <th className="font-normal text-right">SOL</th>
                      <th className="font-normal text-right">Tokens</th>
                      <th className="font-normal text-right">Mcap</th>
                      <th className="font-normal text-right pr-4">Trader</th>
                    </tr>
                  </thead>
                  <tbody>
                    {l.trades.slice(0, 80).map((t) => (
                      <tr key={t.id} className={cx('border-t border-ink-800', t.walletId && 'bg-accent/[0.03]')}>
                        <td className="pl-4 py-2 text-xs text-ink-400">{timeAgo(t.ts)}</td>
                        <td className={t.side === 'buy' ? 'text-up' : 'text-down'}>{t.side === 'buy' ? 'Buy' : 'Sell'}</td>
                        <td className="text-right"><Sol v={t.sol.toFixed(3)} className="justify-end" /></td>
                        <td className="text-right num text-ink-300">{fmtTokens(t.tokens)}</td>
                        <td className="text-right num text-ink-300">{fmtUsd(t.mcapUsd)}</td>
                        <td className="text-right pr-4 font-mono text-xs">
                          {t.walletId ? <span className="text-accent">{wById[t.walletId]?.label ?? 'You'}</span> : <span className="text-ink-400">{shortAddr(t.trader)}</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {tab === 'holders' && (
                <div className="divide-y divide-ink-800">
                  {holders.map((h, i) => {
                    const pct = (h.tokens / TOTAL_SUPPLY) * 100
                    return (
                      <div key={h.key} className="flex items-center gap-3 px-4 py-2 text-sm">
                        <span className="w-6 text-ink-500 num text-xs">{i + 1}</span>
                        <span className={cx('flex-1 flex items-center gap-2', h.mine && 'text-accent')}>
                          {h.role && <RoleIcon role={h.role} />}
                          {h.label}
                          {h.key === 'curve' && <span className="chip bg-ink-800 text-ink-400">pool</span>}
                        </span>
                        <div className="w-40 h-1.5 rounded-full bg-ink-800 overflow-hidden"><div className={cx('h-full', h.mine ? 'bg-accent' : 'bg-ink-500')} style={{ width: `${Math.min(100, pct)}%` }} /></div>
                        <span className="w-16 text-right num">{pct.toFixed(2)}%</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* right: trade panel */}
        <div className="overflow-y-auto">
          <div className="p-4 space-y-4">
            <div className="grid grid-cols-2 rounded-full bg-ink-900 border border-ink-750 p-0.5">
              {(['buy', 'sell'] as const).map((s) => (
                <button key={s} onClick={() => setSide(s)} className={cx('py-2 rounded-full text-sm font-medium capitalize transition', side === s ? (s === 'buy' ? 'bg-ink-100 text-ink-950' : 'bg-down text-white') : 'text-ink-400')}>{s}</button>
              ))}
            </div>

            <div>
              <div className="label mb-2">Wallets</div>
              <div className="grid grid-cols-4 gap-1">
                {([['all', 'All'], ['dev', 'Dev'], ['holders', 'Holders'], ['custom', 'Pick']] as const).map(([k, label]) => (
                  <button key={k} onClick={() => setScope(k)} className={cx('py-1.5 text-xs rounded-md border', scope === k ? 'border-accent/60 text-accent bg-accent/[0.06]' : 'border-ink-750 text-ink-400 hover:text-ink-200')}>{label}</button>
                ))}
              </div>
              {scope === 'custom' && (
                <div className="mt-2 max-h-40 overflow-y-auto rounded-lg border border-ink-750 divide-y divide-ink-800">
                  {l.positions.map((p) => (
                    <label key={p.walletId} className="flex items-center gap-2 px-2.5 py-1.5 text-xs cursor-pointer hover:bg-ink-850">
                      <input type="checkbox" className="accent-accent" checked={custom.includes(p.walletId)} onChange={() => setCustom((c) => (c.includes(p.walletId) ? c.filter((x) => x !== p.walletId) : [...c, p.walletId]))} />
                      <RoleIcon role={p.role} /> <span className="flex-1">{wById[p.walletId]?.label}</span>
                      <span className="num text-ink-500">{((p.tokens / TOTAL_SUPPLY) * 100).toFixed(2)}%</span>
                    </label>
                  ))}
                </div>
              )}
              <div className="text-[11px] text-ink-500 mt-1.5">{scopeIds(scope).length} wallet{scopeIds(scope).length === 1 ? '' : 's'} selected</div>
            </div>

            {side === 'buy' ? (
              <div>
                <div className="label mb-2">SOL per wallet</div>
                <div className="relative">
                  <input className="input pr-12" type="number" value={buyAmt} onChange={(e) => setBuyAmt(e.target.value)} />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-ink-500">SOL</span>
                </div>
                <div className="grid grid-cols-5 gap-1 mt-2">
                  {[0.05, 0.1, 0.25, 0.5, 1].map((v) => (
                    <button key={v} onClick={() => setBuyAmt(String(v))} className={cx('chip justify-center py-1.5', +buyAmt === v ? 'bg-ink-100 text-ink-950' : 'bg-ink-800 text-ink-300 hover:bg-ink-750')}>{v}</button>
                  ))}
                </div>
              </div>
            ) : (
              <div>
                <div className="label mb-2">% of holdings</div>
                <div className="relative">
                  <input className="input pr-8" type="number" value={sellPct} onChange={(e) => setSellPct(e.target.value)} />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-ink-500">%</span>
                </div>
                <div className="grid grid-cols-5 gap-1 mt-2">
                  {[10, 25, 50, 75, 100].map((v) => (
                    <button key={v} onClick={() => setSellPct(String(v))} className={cx('chip justify-center py-1.5', +sellPct === v ? 'bg-down text-white' : 'bg-ink-800 text-ink-300 hover:bg-ink-750')}>{v === 100 ? 'MAX' : `${v}%`}</button>
                  ))}
                </div>
              </div>
            )}

            <button onClick={execute} className={cx('btn w-full py-2.5 font-semibold', side === 'buy' ? 'bg-ink-100 text-ink-950 hover:bg-white' : 'bg-down text-white hover:brightness-110')}>
              {side === 'buy' ? `Buy with ${scopeIds(scope).length} wallets` : `Sell ${sellPct}% from ${scopeIds(scope).length} wallets`}
            </button>

            <div className="grid grid-cols-2 gap-px rounded-lg overflow-hidden bg-ink-750 border border-ink-750">
              {[
                { k: 'Bought', v: fmtUsd(st.bought * solPrice), c: 'text-up' },
                { k: 'Sold', v: fmtUsd(st.sold * solPrice), c: 'text-down' },
                { k: 'Holding', v: fmtUsd(st.holding * solPrice), c: 'text-ink-100' },
                { k: 'PnL', v: fmtSigned(st.pnl * solPrice, (x) => fmtUsd(x)), c: st.pnl >= 0 ? 'text-up' : 'text-down' },
              ].map((s) => (
                <div key={s.k} className="bg-ink-900 px-3 py-2.5">
                  <div className="text-[11px] text-ink-500">{s.k}</div>
                  <div className={cx('num text-sm font-medium mt-0.5', s.c)}>{s.v}</div>
                </div>
              ))}
            </div>

            <button onClick={() => setNuke(true)} disabled={st.tokens < 1} className="btn w-full py-3 bg-down/10 border border-down/40 text-down hover:bg-down/20 font-semibold">
              <Bomb size={16} /> Nuke · sell everything <span className="num opacity-70">≈ {st.holding.toFixed(2)} SOL</span>
            </button>

            <div className="rounded-lg border border-ink-750 p-3 text-xs space-y-2">
              <div className="flex justify-between"><span className="text-ink-500">Holders</span><span className="num">{holders.length - 1}</span></div>
              <div className="flex justify-between"><span className="text-ink-500">Total trades</span><span className="num">{l.buys + l.sells}</span></div>
              <div className="flex justify-between"><span className="text-ink-500">Total volume</span><span className="num">{fmtUsd(l.volumeSol * solPrice)}</span></div>
              <div className="flex justify-between"><span className="text-ink-500">Curve liquidity</span><Sol v={realSol(l.curve).toFixed(2)} /></div>
              {l.description && <p className="text-ink-400 pt-2 border-t border-ink-800">{l.description}</p>}
            </div>
          </div>
        </div>
      </div>

      <Modal
        open={nuke}
        onClose={() => setNuke(false)}
        title="Sell everything?"
        subtitle={`Every wallet sells 100% of its $${l.symbol}.`}
        footer={
          <>
            <button className="btn-ghost" onClick={() => setNuke(false)}>Cancel</button>
            <button className="btn bg-down text-white font-semibold" onClick={() => { trade(l.id, l.positions.map((p) => p.walletId), 'sell', 100); setNuke(false) }}>
              <Bomb size={16} /> Sell all
            </button>
          </>
        }
      >
        <div className="flex items-start gap-3 rounded-lg bg-down/10 border border-down/30 p-3 text-sm">
          <AlertTriangle size={16} className="text-down shrink-0 mt-0.5" />
          <div>
            Sells from {l.positions.filter((p) => p.tokens > 1).length} wallets in sequence. Expected return ≈ <Sol v={st.holding.toFixed(3)} /> before slippage.
          </div>
        </div>
      </Modal>

      <Modal
        open={withdraw}
        onClose={() => setWithdraw(false)}
        title="Withdraw to Funder"
        subtitle="Sweeps SOL from this launch's wallets back to your Funder. Tokens stay where they are."
        footer={
          <>
            <button className="btn-ghost" onClick={() => setWithdraw(false)}>Cancel</button>
            <button className="btn-primary" disabled={walletSol <= 0} onClick={() => { const t = sweepLaunch(l.id); toast(`Withdrew ${t.toFixed(3)} SOL to Funder`); setWithdraw(false) }}>
              <ArrowDownToLine size={16} /> Withdraw {walletSol.toFixed(3)} SOL
            </button>
          </>
        }
      >
        <div className="divide-y divide-ink-800 rounded-lg border border-ink-750">
          {l.positions.map((p) => (
            <div key={p.walletId} className="flex items-center justify-between px-3 py-2 text-sm">
              <span className="flex items-center gap-2"><RoleIcon role={p.role} /> {wById[p.walletId]?.label}</span>
              <Sol v={(wById[p.walletId]?.balance ?? 0).toFixed(3)} />
            </div>
          ))}
        </div>
        {st.tokens > 1 && <p className="text-xs text-ink-500 mt-3 flex items-center gap-1.5"><Users size={12} /> Tip: sell first if you want to withdraw everything.</p>}
      </Modal>
    </div>
  )
}
