import { Bell, BellOff, ImagePlus, Pencil, Plus, Radar, Search, Smile, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { CopyAddr, cx, Empty, Field, GROUP_COLORS, Modal, PageHeader, Segmented, Sol } from '../components/ui'
import { fmtSigned, fmtUsd, timeAgo } from '../lib/format'
import { fileToAvatar } from '../lib/image'
import { mulberry32 } from '../lib/random'
import type { Tracked } from '../store/types'
import { useStore } from '../store/useStore'

const EMOJIS = ['🐋', '🦅', '🎲', '🦊', '🐸', '🚀', '💎', '🔥', '👑', '🧠', '🐂', '🐻', '🤖', '👻', '🦈', '🍀', '⚡', '🎯', '🐍', '🦄', '🥷', '🧙', '🐶', '🍌']

export function TrackedAvatar({ t, size = 40 }: { t: Pick<Tracked, 'emoji' | 'image' | 'color' | 'label'>; size?: number }) {
  if (t.image) return <img src={t.image} alt="" style={{ width: size, height: size }} className="rounded-full object-cover shrink-0" />
  return (
    <div
      style={{ width: size, height: size, background: `${t.color}1f`, borderColor: `${t.color}55`, fontSize: size * 0.5 }}
      className="rounded-full border grid place-items-center shrink-0"
    >
      {t.emoji || <span style={{ color: t.color, fontSize: size * 0.4 }} className="font-semibold">{t.label.slice(0, 1)}</span>}
    </div>
  )
}

function TrackedEditor({ open, onClose, initial }: { open: boolean; onClose: () => void; initial?: Tracked }) {
  const { addTracked, updateTracked, toast } = useStore()
  const [address, setAddress] = useState(initial?.address ?? '')
  const [label, setLabel] = useState(initial?.label ?? '')
  const [mode, setMode] = useState<'emoji' | 'image'>(initial?.image ? 'image' : 'emoji')
  const [emoji, setEmoji] = useState(initial?.emoji ?? '🐋')
  const [image, setImage] = useState<string | undefined>(initial?.image)
  const [color, setColor] = useState(initial?.color ?? GROUP_COLORS[1])
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    setAddress(initial?.address ?? '')
    setLabel(initial?.label ?? '')
    setMode(initial?.image ? 'image' : 'emoji')
    setEmoji(initial?.emoji ?? '🐋')
    setImage(initial?.image)
    setColor(initial?.color ?? GROUP_COLORS[1])
  }, [open, initial])

  const valid = address.length >= 32 && label.trim().length > 0
  const preview = { label: label || '?', color, emoji: mode === 'emoji' ? emoji : undefined, image: mode === 'image' ? image : undefined }

  const save = () => {
    const data = { address, label: label.trim(), color, emoji: preview.emoji, image: preview.image }
    if (initial) updateTracked(initial.id, data)
    else addTracked(data)
    toast(initial ? 'Wallet updated' : `Now tracking ${label}`)
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial ? 'Edit tracked wallet' : 'Track a wallet'}
      subtitle="Give it a name and a face so you can spot it instantly."
      footer={
        <>
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={!valid} onClick={save}>{initial ? 'Save' : 'Start tracking'}</button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex items-center gap-4 rounded-xl bg-ink-850 border border-ink-750 p-4">
          <TrackedAvatar t={preview} size={56} />
          <div className="min-w-0">
            <div className="font-medium truncate">{label || 'Nickname'}</div>
            <div className="text-xs font-mono text-ink-500 truncate">{address || 'Wallet address'}</div>
          </div>
        </div>
        <Field label="Wallet address">
          <input className="input font-mono text-xs" disabled={!!initial} value={address} onChange={(e) => setAddress(e.target.value.trim())} placeholder="Paste a Solana address" />
        </Field>
        <Field label="Nickname" counter={`${label.length}/24`}>
          <input className="input" maxLength={24} value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Smart money #1" />
        </Field>
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-ink-200">Avatar</span>
            <Segmented
              size="sm"
              value={mode}
              onChange={setMode}
              options={[
                { value: 'emoji', label: <span className="flex items-center gap-1"><Smile size={12} /> Emoji</span> },
                { value: 'image', label: <span className="flex items-center gap-1"><ImagePlus size={12} /> Picture</span> },
              ]}
            />
          </div>
          {mode === 'emoji' ? (
            <div className="grid grid-cols-8 gap-1.5">
              {EMOJIS.map((e) => (
                <button
                  key={e}
                  onClick={() => setEmoji(e)}
                  className={cx('aspect-square rounded-lg text-lg grid place-items-center border transition', emoji === e ? 'border-lime bg-lime-soft' : 'border-ink-750 bg-ink-850 hover:border-ink-600')}
                >
                  {e}
                </button>
              ))}
            </div>
          ) : (
            <button
              onClick={() => fileRef.current?.click()}
              className="w-full rounded-xl border border-dashed border-ink-600 bg-ink-850 hover:border-lime/50 py-6 flex flex-col items-center gap-2 text-sm text-ink-300"
            >
              {image ? <img src={image} className="w-16 h-16 rounded-full object-cover" alt="" /> : <ImagePlus size={22} />}
              {image ? 'Replace picture' : 'Upload a picture'}
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                hidden
                onChange={async (e) => {
                  const f = e.target.files?.[0]
                  if (f) setImage(await fileToAvatar(f))
                }}
              />
            </button>
          )}
        </div>
        <div>
          <div className="text-sm font-medium text-ink-200 mb-2">Accent</div>
          <div className="flex gap-2">
            {GROUP_COLORS.map((c) => (
              <button key={c} onClick={() => setColor(c)} style={{ background: c }} className={cx('w-7 h-7 rounded-full ring-offset-2 ring-offset-ink-900', color === c && 'ring-2 ring-ink-100')} />
            ))}
          </div>
        </div>
      </div>
    </Modal>
  )
}

const TOKENS = ['WIF', 'BONK', 'POPCAT', 'MEW', 'GIGA', 'MOODENG', 'FWOG', 'PNUT', 'CHILLGUY', 'GOAT']

export default function Tracker() {
  const { tracked, updateTracked, removeTracked } = useStore()
  const [editing, setEditing] = useState<Tracked | undefined>()
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [sort, setSort] = useState<'pnl' | 'recent'>('pnl')

  const list = useMemo(() => {
    const f = tracked.filter((t) => `${t.label} ${t.address}`.toLowerCase().includes(q.toLowerCase()))
    return f.sort((a, b) => (sort === 'pnl' ? b.pnl - a.pnl : b.lastActive - a.lastActive))
  }, [tracked, q, sort])

  // Simulated activity feed for the tracked wallets.
  const feed = useMemo(() => {
    const rnd = mulberry32(tracked.length * 13 + 1)
    return Array.from({ length: Math.min(14, tracked.length * 4) }, (_, i) => {
      const t = tracked[Math.floor(rnd() * tracked.length)]
      return {
        id: i, t, side: rnd() > 0.45 ? 'buy' : 'sell', token: TOKENS[Math.floor(rnd() * TOKENS.length)],
        sol: Math.round((0.2 + rnd() * 12) * 100) / 100, ts: Date.now() - i * 1000 * 60 * (2 + rnd() * 9),
      }
    }).sort((a, b) => b.ts - a.ts)
  }, [tracked])

  return (
    <div className="p-8 max-w-[1280px] mx-auto animate-in">
      <PageHeader
        title="Tracker"
        subtitle="Follow any wallet. Tag it with an emoji or your own picture."
        right={
          <button className="btn-primary" onClick={() => { setEditing(undefined); setOpen(true) }}>
            <Plus size={16} /> Track wallet
          </button>
        }
      />

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative w-72">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-500" />
          <input className="input pl-9 py-2" placeholder="Search by name or address" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Segmented value={sort} onChange={setSort} options={[{ value: 'pnl', label: 'Top PnL' }, { value: 'recent', label: 'Recently active' }]} />
      </div>

      <div className="grid xl:grid-cols-[1fr_340px] gap-4">
        <div>
          {list.length ? (
            <div className="grid md:grid-cols-2 gap-3">
              {list.map((t) => (
                <div key={t.id} className="panel p-4 group hover:border-ink-600 transition">
                  <div className="flex items-start gap-3">
                    <TrackedAvatar t={t} size={44} />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{t.label}</div>
                      <CopyAddr address={t.address} className="text-[11px]" />
                    </div>
                    <div className="flex gap-0.5 opacity-60 group-hover:opacity-100">
                      <button title={t.notify ? 'Mute alerts' : 'Enable alerts'} className="btn-quiet p-1.5" onClick={() => updateTracked(t.id, { notify: !t.notify })}>
                        {t.notify ? <Bell size={14} className="text-lime" /> : <BellOff size={14} />}
                      </button>
                      <button title="Edit" className="btn-quiet p-1.5" onClick={() => { setEditing(t); setOpen(true) }}><Pencil size={14} /></button>
                      <button title="Remove" className="btn-quiet p-1.5 hover:text-down" onClick={() => removeTracked(t.id)}><Trash2 size={14} /></button>
                    </div>
                  </div>
                  <div className="grid grid-cols-4 gap-2 mt-4 pt-4 border-t border-ink-800">
                    <div>
                      <div className="text-[11px] text-ink-500">PnL</div>
                      <div className={cx('text-sm num mt-0.5', t.pnl >= 0 ? 'text-up' : 'text-down')}>{fmtSigned(t.pnl, (v) => fmtUsd(v))}</div>
                    </div>
                    <div>
                      <div className="text-[11px] text-ink-500">Balance</div>
                      <Sol v={t.balance.toFixed(1)} className="text-sm mt-0.5" />
                    </div>
                    <div>
                      <div className="text-[11px] text-ink-500">Win rate</div>
                      <div className="text-sm num mt-0.5">{t.winRate}%</div>
                    </div>
                    <div>
                      <div className="text-[11px] text-ink-500">Active</div>
                      <div className="text-sm mt-0.5 text-ink-300">{timeAgo(t.lastActive)}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="panel">
              <Empty icon={<Radar size={20} />} title="No wallets tracked" text="Paste any address to follow its trades and PnL." action={<button className="btn-primary" onClick={() => setOpen(true)}><Plus size={16} /> Track wallet</button>} />
            </div>
          )}
        </div>

        <div className="panel h-fit">
          <div className="px-4 py-3.5 border-b border-ink-750 flex items-center justify-between">
            <h2 className="font-medium text-sm">Live activity</h2>
            <span className="flex items-center gap-1.5 text-[11px] text-up"><span className="w-1.5 h-1.5 rounded-full bg-up animate-pulse" />streaming</span>
          </div>
          <div className="divide-y divide-ink-800">
            {feed.map((f) => (
              <div key={f.id} className="flex items-center gap-3 px-4 py-2.5">
                <TrackedAvatar t={f.t} size={26} />
                <div className="flex-1 min-w-0 text-xs">
                  <span className="font-medium text-ink-200">{f.t.label}</span>{' '}
                  <span className={f.side === 'buy' ? 'text-up' : 'text-down'}>{f.side === 'buy' ? 'bought' : 'sold'}</span>{' '}
                  <span className="text-ink-200">${f.token}</span>
                  <div className="text-ink-500 mt-0.5">{timeAgo(f.ts)}</div>
                </div>
                <Sol v={f.sol.toFixed(2)} className="text-xs" />
              </div>
            ))}
            {!feed.length && <div className="text-xs text-ink-500 p-6 text-center">Activity from tracked wallets shows up here.</div>}
          </div>
        </div>
      </div>

      <TrackedEditor open={open} onClose={() => setOpen(false)} initial={editing} />
    </div>
  )
}
