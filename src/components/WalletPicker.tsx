import { Check, ChevronDown, Plus, Search } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore'
import { cx, Modal, Sol } from './ui'

export function WalletPicker({
  open, onClose, value, onConfirm, exclude = [], title = 'Choose wallets',
}: {
  open: boolean
  onClose: () => void
  value: string[]
  onConfirm: (ids: string[]) => void
  exclude?: string[]
  title?: string
}) {
  const { wallets, groups, createWallets } = useStore()
  const nav = useNavigate()
  const [sel, setSel] = useState<string[]>(value)
  const [q, setQ] = useState('')
  const [collapsed, setCollapsed] = useState<string[]>([])

  useEffect(() => {
    if (open) setSel(value.filter((v) => !exclude.includes(v)))
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  const sections = useMemo(() => {
    const avail = wallets.filter((w) => !exclude.includes(w.id) && `${w.label} ${w.address}`.toLowerCase().includes(q.toLowerCase()))
    const out = groups.map((g) => ({ id: g.id, name: g.name, color: g.color, items: avail.filter((w) => w.groupId === g.id) }))
    out.push({ id: 'none', name: 'Ungrouped', color: '#444', items: avail.filter((w) => !w.groupId) })
    return out.filter((s) => s.items.length)
  }, [wallets, groups, q, exclude])

  const toggle = (id: string) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))

  return (
    <Modal
      open={open}
      onClose={onClose}
      width="max-w-xl"
      title={title}
      subtitle="Pick wallets from your groups. Each one buys in the launch block."
      footer={
        <>
          <span className="mr-auto self-center text-sm text-ink-400"><span className="num text-ink-100">{sel.length}</span> selected</span>
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={() => { onConfirm(sel); onClose() }}>Use {sel.length} wallet{sel.length === 1 ? '' : 's'}</button>
        </>
      }
    >
      <div className="flex gap-2 mb-4">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-500" />
          <input className="input pl-9 py-2" placeholder="Search wallets" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <button className="btn-ghost text-xs" onClick={() => createWallets(5, null, 'Fresh')}><Plus size={14} /> 5 fresh</button>
      </div>

      {!sections.length && (
        <div className="text-center py-10 text-sm text-ink-400">
          No wallets available.{' '}
          <button className="text-accent hover:underline" onClick={() => { onClose(); nav('/wallets') }}>Go to My Wallets</button>
        </div>
      )}

      <div className="space-y-3">
        {sections.map((s) => {
          const ids = s.items.map((w) => w.id)
          const all = ids.every((id) => sel.includes(id))
          const some = ids.some((id) => sel.includes(id))
          const isCollapsed = collapsed.includes(s.id)
          return (
            <div key={s.id} className="rounded-xl border border-ink-750 overflow-hidden">
              <div className="flex items-center gap-3 px-3 py-2.5 bg-ink-850">
                <button
                  onClick={() => setSel((cur) => (all ? cur.filter((x) => !ids.includes(x)) : [...new Set([...cur, ...ids])]))}
                  className={cx('w-4 h-4 rounded border grid place-items-center', all ? 'bg-accent border-accent' : some ? 'border-accent' : 'border-ink-500')}
                >
                  {all && <Check size={11} className="text-ink-950" strokeWidth={3} />}
                  {!all && some && <span className="w-2 h-0.5 bg-accent" />}
                </button>
                <span className="w-2 h-2 rounded-full" style={{ background: s.color }} />
                <span className="text-sm font-medium flex-1">{s.name}</span>
                <span className="text-xs text-ink-500 num">{ids.filter((i) => sel.includes(i)).length}/{ids.length}</span>
                <button onClick={() => setCollapsed((c) => (isCollapsed ? c.filter((x) => x !== s.id) : [...c, s.id]))} className="text-ink-400">
                  <ChevronDown size={16} className={cx('transition', isCollapsed && '-rotate-90')} />
                </button>
              </div>
              {!isCollapsed && (
                <div className="divide-y divide-ink-800">
                  {s.items.map((w) => (
                    <button key={w.id} onClick={() => toggle(w.id)} className={cx('w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-ink-850', sel.includes(w.id) && 'bg-accent/[0.04]')}>
                      <span className={cx('w-4 h-4 rounded border grid place-items-center', sel.includes(w.id) ? 'bg-accent border-accent' : 'border-ink-500')}>
                        {sel.includes(w.id) && <Check size={11} className="text-ink-950" strokeWidth={3} />}
                      </span>
                      <span className="text-sm flex-1">{w.label}</span>
                      <span className="font-mono text-[11px] text-ink-500">{w.address.slice(0, 4)}…{w.address.slice(-4)}</span>
                      <Sol v={w.balance.toFixed(3)} className={cx('text-xs w-16 justify-end', !w.balance && 'text-ink-500')} />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </Modal>
  )
}
