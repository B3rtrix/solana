import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { fmtUsd } from '../lib/format'
import type { PnlPoint } from '../store/types'

/** Light EMA so the line reads as a trend, not daily noise. */
const smooth = (pts: PnlPoint[], alpha = 0.35) => {
  let prev = pts[0]?.v ?? 0
  return pts.map((p, i) => {
    prev = i === 0 ? p.v : prev + alpha * (p.v - prev)
    return { t: p.t, v: i === pts.length - 1 ? p.v : prev }
  })
}

function Tip({ active, payload }: { active?: boolean; payload?: { payload: PnlPoint }[] }) {
  if (!active || !payload?.length) return null
  const p = payload[0].payload
  return (
    <div className="rounded-md border border-ink-700 bg-ink-900 px-3 py-2 shadow-xl">
      <div className="text-[11px] text-ink-400 font-mono">
        {new Date(p.t).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
      </div>
      <div className={`num text-sm font-semibold ${p.v >= 0 ? 'text-up' : 'text-down'}`}>{fmtUsd(p.v, false)}</div>
    </div>
  )
}

export function PnlChart({ data, height = 280 }: { data: PnlPoint[]; height?: number }) {
  const pts = smooth(data)
  const color = '#ededed'
  const spanDays = pts.length ? (pts[pts.length - 1].t - pts[0].t) / 86400_000 : 0
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={pts} margin={{ top: 10, right: 4, left: 4, bottom: 0 }}>
        <defs>
          <linearGradient id="pnlFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.14} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis
          dataKey="t"
          type="number"
          domain={['dataMin', 'dataMax']}
          tickFormatter={(t) =>
            new Date(t).toLocaleDateString('en-US', spanDays > 60 ? { month: 'short' } : { month: 'short', day: 'numeric' })
          }
          tick={{ fill: '#666', fontSize: 11, fontFamily: 'Geist Mono' }}
          axisLine={false}
          tickLine={false}
          minTickGap={40}
        />
        <YAxis
          orientation="right"
          tickFormatter={(v) => fmtUsd(v)}
          tick={{ fill: '#666', fontSize: 11, fontFamily: 'Geist Mono' }}
          axisLine={false}
          tickLine={false}
          width={64}
          domain={['auto', 'auto']}
        />
        <Tooltip content={<Tip />} cursor={{ stroke: '#444', strokeDasharray: '3 3' }} />
        <Area
          type="monotone"
          dataKey="v"
          stroke={color}
          strokeWidth={1.75}
          fill="url(#pnlFill)"
          dot={false}
          activeDot={{ r: 4, fill: color, stroke: '#0a0a0a', strokeWidth: 2 }}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
