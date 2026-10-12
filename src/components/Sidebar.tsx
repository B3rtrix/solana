import { LayoutDashboard, Radar, Rocket, Search, Wallet } from 'lucide-react'
import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { mcapSol } from '../lib/curve'
import { fmtUsd } from '../lib/format'
import { useStore } from '../store/useStore'
import { Logo, PadGlyph } from './brand'
import { FunderCard } from './Funder'
import { cx, TokenAvatar } from './ui'

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/tracker', label: 'Tracker', icon: Radar },
  { to: '/wallets', label: 'My Wallets', icon: Wallet },
]

export function Sidebar() {
  const launches = useStore((s) => s.launches)
  const solPrice = useStore((s) => s.solPrice)
  const tracked = useStore((s) => s.tracked.length)
  const wallets = useStore((s) => s.wallets.length)
  const nav = useNavigate()
  const [q, setQ] = useState('')
  const list = launches.filter((l) => `${l.name} ${l.symbol}`.toLowerCase().includes(q.toLowerCase()))

  return (
    <aside className="w-[264px] shrink-0 h-full flex flex-col border-r border-ink-750 bg-ink-900/60">
      <div className="px-4 h-16 flex items-center border-b border-ink-750">
        <Logo />
      </div>

      <div className="p-3">
        <button className="btn-primary w-full py-2.5 shadow-glow" onClick={() => nav('/launch/new')}>
          <Rocket size={16} /> New Launch
        </button>
      </div>

      <nav className="px-3 space-y-0.5">
        {NAV.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              cx(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition',
                isActive ? 'bg-ink-800 text-ink-100' : 'text-ink-400 hover:text-ink-100 hover:bg-ink-850',
              )
            }
          >
            <Icon size={16} />
            <span className="flex-1">{label}</span>
            {to === '/tracker' && <span className="text-[11px] num text-ink-500">{tracked}</span>}
            {to === '/wallets' && <span className="text-[11px] num text-ink-500">{wallets}</span>}
          </NavLink>
        ))}
      </nav>

      <div className="mt-5 px-3 flex items-center justify-between">
        <span className="label">Launches</span>
        <span className="text-[11px] num text-ink-500">{launches.length}</span>
      </div>
      <div className="px-3 mt-2">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-500" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search launches" className="input py-1.5 pl-8 text-xs" />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-2 mt-2 space-y-0.5">
        {list.map((l) => (
          <NavLink
            key={l.id}
            to={`/launch/${l.id}`}
            className={({ isActive }) =>
              cx('flex items-center gap-2.5 rounded-lg px-2 py-2 transition', isActive ? 'bg-ink-800' : 'hover:bg-ink-850')
            }
          >
            <TokenAvatar image={l.image} symbol={l.symbol} size={30} />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium truncate">${l.symbol}</div>
              <div className="text-[11px] text-ink-500 truncate">
                {l.status === 'live' ? fmtUsd(mcapSol(l.curve) * solPrice) + ' mc' : l.name}
              </div>
            </div>
            <span className={cx('chip', l.status === 'live' ? 'bg-up/10 text-up' : 'bg-ink-750 text-ink-300')}>
              {l.status === 'live' && <span className="w-1.5 h-1.5 rounded-full bg-up animate-pulse" />}
              {l.status === 'live' ? 'Live' : 'Draft'}
            </span>
            <PadGlyph id={l.launchpad} size={16} />
          </NavLink>
        ))}
        {!list.length && <div className="text-xs text-ink-500 px-2 py-4 text-center">No launches yet</div>}
      </div>

      <div className="p-3 border-t border-ink-750">
        <FunderCard />
      </div>
    </aside>
  )
}
