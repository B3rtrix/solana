import { ArrowDownRight, ArrowUpRight, Radar, Rocket } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { PadGlyph } from '../components/brand'
import { PnlChart } from '../components/PnlChart'
import { TrackedAvatar } from './Tracker'
import { cx, Empty, PageHeader, Segmented, Sol, TokenAvatar } from '../components/ui'
import { mcapSol } from '../lib/curve'
import { fmtSigned, fmtUsd, timeAgo } from '../lib/format'
import { launchPnlSol, launchStats, useStore } from '../store/useStore'

type Range = '7d' | '30d' | '90d' | 'all'
const DAYS: Record<Range, number> = { '7d': 7, '30d': 30, '90d': 90, all: Infinity }

function Stat({ label, value, sub, tone }: { label: string; value: React.ReactNode; sub?: React.ReactNode; tone?: 'up' | 'down' }) {
  return (
    <div className="panel p-4">
      <div className="label">{label}</div>
      <div className={cx('mt-2 text-xl font-semibold num', tone === 'up' && 'text-up', tone === 'down' && 'text-down')}>{value}</div>
      {sub && <div className="text-xs text-ink-400 mt-1">{sub}</div>}
    </div>
  )
}

export default function Dashboard() {
  const { pnlHistory, pnlBaseline, launches, solPrice, wallets, funder, tracked } = useStore()
  const [range, setRange] = useState<Range>('all')
  const nav = useNavigate()

  const livePnlUsd = launches.reduce((a, l) => a + launchPnlSol(l), 0) * solPrice
  const total = pnlBaseline + livePnlUsd

  const series = useMemo(() => {
    const now = Date.now()
    const all = [...pnlHistory.slice(0, -1), { t: now, v: total }]
    const cutoff = now - DAYS[range] * 86400_000
    return all.filter((p) => p.t >= cutoff)
  }, [pnlHistory, total, range])

  const first = series[0]?.v ?? 0
  const change = total - first
  const dayAgo = pnlHistory[pnlHistory.length - 2]?.v ?? 0
  const today = total - dayAgo

  const walletSol = wallets.reduce((a, w) => a + w.balance, 0)
  const liveCount = launches.filter((l) => l.status === 'live').length
  const winners = launches.filter((l) => l.status === 'live' && launchPnlSol(l) > 0).length

  return (
    <div className="p-8 max-w-[1280px] mx-auto animate-in">
      <PageHeader
        title="Dashboard"
        subtitle="Performance across every launch and wallet."
        right={
          <button className="btn-primary" onClick={() => nav('/launch/new')}>
            <Rocket size={16} /> New Launch
          </button>
        }
      />

      <div className="panel p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="label">All-time PnL</div>
            <div className={cx('text-4xl font-semibold num mt-2 tracking-tight', total >= 0 ? 'text-ink-100' : 'text-down')}>
              {fmtSigned(total, (v) => fmtUsd(v, false))}
            </div>
            <div className="flex items-center gap-3 mt-2 text-sm">
              <span className={cx('inline-flex items-center gap-1 num', change >= 0 ? 'text-up' : 'text-down')}>
                {change >= 0 ? <ArrowUpRight size={15} /> : <ArrowDownRight size={15} />}
                {fmtSigned(change, (v) => fmtUsd(v, false))}
              </span>
              <span className="text-ink-500">{range === 'all' ? 'since you started' : `in the last ${range}`}</span>
            </div>
          </div>
          <Segmented
            value={range}
            onChange={setRange}
            options={[
              { value: '7d', label: '7D' },
              { value: '30d', label: '30D' },
              { value: '90d', label: '90D' },
              { value: 'all', label: 'All' },
            ]}
          />
        </div>
        <div className="mt-6 -mx-2">
          <PnlChart data={series} />
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
        <Stat label="Today" value={fmtSigned(today, (v) => fmtUsd(v, false))} tone={today >= 0 ? 'up' : 'down'} sub="Realized + unrealized" />
        <Stat label="Open positions" value={fmtSigned(livePnlUsd, (v) => fmtUsd(v, false))} tone={livePnlUsd >= 0 ? 'up' : 'down'} sub={`${liveCount} live launch${liveCount === 1 ? '' : 'es'}`} />
        <Stat label="Capital" value={<Sol v={(walletSol + funder.balance).toFixed(2)} />} sub={`${fmtUsd((walletSol + funder.balance) * solPrice)} · funder + ${wallets.length} wallets`} />
        <Stat label="Win rate" value={liveCount ? `${Math.round((winners / liveCount) * 100)}%` : '—'} sub={`${winners}/${liveCount} launches in profit`} />
      </div>

      <div className="grid lg:grid-cols-3 gap-4 mt-4">
        <div className="panel lg:col-span-2">
          <div className="flex items-center justify-between px-5 py-4 border-b border-ink-750">
            <h2 className="font-medium">Launches</h2>
            <span className="text-xs text-ink-500">{launches.length} total</span>
          </div>
          {launches.length ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-ink-500 text-xs">
                  <th className="font-normal px-5 py-2.5">Token</th>
                  <th className="font-normal py-2.5">Status</th>
                  <th className="font-normal py-2.5 text-right">Market cap</th>
                  <th className="font-normal py-2.5 text-right">Invested</th>
                  <th className="font-normal px-5 py-2.5 text-right">PnL</th>
                </tr>
              </thead>
              <tbody>
                {launches.map((l) => {
                  const st = launchStats(l)
                  const pnl = st.pnl
                  return (
                    <tr key={l.id} onClick={() => nav(`/launch/${l.id}`)} className="border-t border-ink-800 hover:bg-ink-850 cursor-pointer">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <TokenAvatar image={l.image} symbol={l.symbol} size={32} />
                          <div>
                            <div className="font-medium flex items-center gap-1.5">${l.symbol} <PadGlyph id={l.launchpad} size={14} /></div>
                            <div className="text-xs text-ink-500">{l.name}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className={cx('chip', l.status === 'live' ? 'bg-up/10 text-up' : 'bg-ink-750 text-ink-300')}>
                          {l.status === 'live' ? 'Live' : 'Draft'}
                        </span>
                      </td>
                      <td className="text-right num">{l.status === 'live' ? fmtUsd(mcapSol(l.curve) * solPrice) : '—'}</td>
                      <td className="text-right"><Sol v={st.bought.toFixed(2)} className="justify-end" /></td>
                      <td className={cx('px-5 text-right num', pnl > 0 ? 'text-up' : pnl < 0 ? 'text-down' : 'text-ink-400')}>
                        {l.status === 'live' ? fmtSigned(pnl * solPrice, (v) => fmtUsd(v, false)) : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          ) : (
            <Empty icon={<Rocket size={20} />} title="No launches yet" text="Create your first launch to start tracking PnL." />
          )}
        </div>

        <div className="panel">
          <div className="flex items-center justify-between px-5 py-4 border-b border-ink-750">
            <h2 className="font-medium">Tracked wallets</h2>
            <Link to="/tracker" className="text-xs text-lime hover:underline">View all</Link>
          </div>
          <div className="p-2">
            {tracked.slice(0, 6).map((t) => (
              <div key={t.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-ink-850">
                <TrackedAvatar t={t} size={32} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{t.label}</div>
                  <div className="text-[11px] text-ink-500">active {timeAgo(t.lastActive)}</div>
                </div>
                <div className={cx('text-sm num', t.pnl >= 0 ? 'text-up' : 'text-down')}>{fmtSigned(t.pnl, (v) => fmtUsd(v))}</div>
              </div>
            ))}
            {!tracked.length && <Empty icon={<Radar size={20} />} title="Nobody tracked" text="Add wallets in the Tracker." />}
          </div>
        </div>
      </div>
    </div>
  )
}
