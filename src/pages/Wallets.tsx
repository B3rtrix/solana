import { ArrowDownToLine, FolderInput, FolderPlus, MoreHorizontal, Pencil, Plus, Send, Trash2, Wallet as WalletIcon } from 'lucide-react'
import { useMemo, useState } from 'react'
import { CopyAddr, cx, Empty, Field, GROUP_COLORS, Modal, PageHeader, Sol } from '../components/ui'
import { fmtUsd } from '../lib/format'
import { useStore } from '../store/useStore'

type Filter = 'all' | 'none' | string

function CreateWalletsModal({ open, onClose, defaultGroup }: { open: boolean; onClose: () => void; defaultGroup: string | null }) {
  const { groups, createWallets, toast } = useStore()
  const [count, setCount] = useState('5')
  const [group, setGroup] = useState<string | null>(defaultGroup)
  const [prefix, setPrefix] = useState('Wallet')
  const n = Math.max(0, Math.min(100, Math.floor(+count || 0)))
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Create wallets"
      subtitle="Fresh keypairs are generated locally."
      footer={
        <>
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={!n} onClick={() => { createWallets(n, group, prefix || 'Wallet'); toast(`Created ${n} wallets`); onClose() }}>
            <Plus size={16} /> Create {n || ''}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="How many" hint="(1-100)">
          <input className="input" type="number" value={count} onChange={(e) => setCount(e.target.value)} />
        </Field>
        <Field label="Name prefix">
          <input className="input" value={prefix} onChange={(e) => setPrefix(e.target.value)} />
        </Field>
        <Field label="Put in group">
          <select className="input" value={group ?? ''} onChange={(e) => setGroup(e.target.value || null)}>
            <option value="">No group</option>
            {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </Field>
      </div>
    </Modal>
  )
}

function FundModal({ open, onClose, ids }: { open: boolean; onClose: () => void; ids: string[] }) {
  const { funder, fundWallets, toast } = useStore()
  const [amt, setAmt] = useState('0.1')
  const total = (+amt || 0) * ids.length
  const ok = +amt > 0 && total <= funder.balance
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Fund ${ids.length} wallet${ids.length === 1 ? '' : 's'}`}
      subtitle="SOL is sent from your Funder."
      footer={
        <>
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={!ok} onClick={() => { fundWallets(ids, +amt); toast(`Sent ${total.toFixed(3)} SOL to ${ids.length} wallets`); onClose() }}>
            <Send size={16} /> Send
          </button>
        </>
      }
    >
      <Field label="Amount per wallet">
        <input className="input" type="number" value={amt} onChange={(e) => setAmt(e.target.value)} />
      </Field>
      <div className="flex gap-2 mt-2">
        {[0.05, 0.1, 0.25, 0.5, 1].map((v) => (
          <button key={v} className="chip bg-ink-800 text-ink-300 hover:bg-ink-700 px-2 py-1" onClick={() => setAmt(String(v))}>{v}</button>
        ))}
      </div>
      <div className="mt-5 rounded-lg bg-ink-850 border border-ink-750 p-3 text-sm space-y-1.5">
        <div className="flex justify-between"><span className="text-ink-400">Total</span><Sol v={total.toFixed(3)} /></div>
        <div className="flex justify-between"><span className="text-ink-400">Funder after</span><Sol v={(funder.balance - total).toFixed(3)} className={cx(funder.balance - total < 0 && 'text-down')} /></div>
      </div>
    </Modal>
  )
}

function GroupModal({ open, onClose, edit }: { open: boolean; onClose: () => void; edit?: { id: string; name: string } }) {
  const { createGroup, renameGroup } = useStore()
  const [name, setName] = useState(edit?.name ?? '')
  const [color, setColor] = useState(GROUP_COLORS[0])
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={edit ? 'Rename group' : 'New group'}
      footer={
        <>
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={!name.trim()} onClick={() => { if (edit) renameGroup(edit.id, name.trim()); else createGroup(name.trim(), color); setName(''); onClose() }}>
            Save
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Name"><input autoFocus className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Launch squad" /></Field>
        {!edit && (
          <div className="flex gap-2">
            {GROUP_COLORS.map((c) => (
              <button key={c} onClick={() => setColor(c)} style={{ background: c }} className={cx('w-7 h-7 rounded-full ring-offset-2 ring-offset-ink-900', color === c && 'ring-2 ring-ink-100')} />
            ))}
          </div>
        )}
      </div>
    </Modal>
  )
}

export default function Wallets() {
  const { wallets, groups, solPrice, reclaimWallets, moveWallets, deleteWallets, renameWallet, deleteGroup, toast } = useStore()
  const [filter, setFilter] = useState<Filter>('all')
  const [sel, setSel] = useState<string[]>([])
  const [modal, setModal] = useState<null | 'create' | 'fund' | 'group' | 'rename-group'>(null)
  const [fundIds, setFundIds] = useState<string[]>([])
  const [menu, setMenu] = useState<string | null>(null)
  const [renaming, setRenaming] = useState<{ id: string; label: string } | null>(null)

  const list = useMemo(
    () => wallets.filter((w) => (filter === 'all' ? true : filter === 'none' ? !w.groupId : w.groupId === filter)),
    [wallets, filter],
  )
  const total = wallets.reduce((a, w) => a + w.balance, 0)
  const allSel = list.length > 0 && list.every((w) => sel.includes(w.id))
  const toggle = (id: string) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))
  const groupOf = (id: string | null) => groups.find((g) => g.id === id)
  const currentGroup = groupOf(filter)

  return (
    <div className="p-8 max-w-[1280px] mx-auto animate-in" onClick={() => setMenu(null)}>
      <PageHeader
        title="My Wallets"
        subtitle="Create, fund and organize the wallets you launch and trade with."
        right={
          <>
            <button className="btn-ghost" onClick={() => setModal('group')}><FolderPlus size={16} /> New group</button>
            <button className="btn-primary" onClick={() => setModal('create')}><Plus size={16} /> Create wallets</button>
          </>
        }
      />

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="panel p-4">
          <div className="label">Total in wallets</div>
          <div className="mt-2 text-xl font-semibold"><Sol v={total.toFixed(3)} /></div>
          <div className="text-xs text-ink-400 mt-1 num">{fmtUsd(total * solPrice, false)}</div>
        </div>
        <div className="panel p-4">
          <div className="label">Wallets</div>
          <div className="mt-2 text-xl font-semibold num">{wallets.length}</div>
          <div className="text-xs text-ink-400 mt-1">{wallets.filter((w) => w.balance > 0).length} funded</div>
        </div>
        <div className="panel p-4">
          <div className="label">Groups</div>
          <div className="mt-2 text-xl font-semibold num">{groups.length}</div>
          <div className="text-xs text-ink-400 mt-1">{wallets.filter((w) => !w.groupId).length} ungrouped</div>
        </div>
      </div>

      <div className="grid lg:grid-cols-[220px_1fr] gap-4">
        <div className="space-y-1">
          {[
            { id: 'all', name: 'All wallets', color: '#8a8a8a', n: wallets.length },
            ...groups.map((g) => ({ ...g, n: wallets.filter((w) => w.groupId === g.id).length })),
            { id: 'none', name: 'Ungrouped', color: '#444', n: wallets.filter((w) => !w.groupId).length },
          ].map((g) => (
            <button
              key={g.id}
              onClick={() => { setFilter(g.id); setSel([]) }}
              className={cx('w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition', filter === g.id ? 'bg-ink-800 text-ink-100' : 'text-ink-400 hover:bg-ink-850 hover:text-ink-200')}
            >
              <span className="w-2 h-2 rounded-full" style={{ background: g.color }} />
              <span className="flex-1 text-left truncate">{g.name}</span>
              <span className="text-[11px] num text-ink-500">{g.n}</span>
            </button>
          ))}
        </div>

        <div className="panel overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-ink-750 min-h-[56px]">
            {sel.length ? (
              <>
                <span className="text-sm text-ink-300 mr-2"><span className="num text-ink-100">{sel.length}</span> selected</span>
                <button className="btn-ghost py-1.5 text-xs" onClick={() => { setFundIds(sel); setModal('fund') }}><Send size={14} /> Fund</button>
                <button className="btn-ghost py-1.5 text-xs" onClick={() => { const t = reclaimWallets(sel); toast(`Reclaimed ${t.toFixed(3)} SOL to Funder`) }}><ArrowDownToLine size={14} /> Reclaim to Funder</button>
                <div className="relative">
                  <select
                    className="btn-ghost py-1.5 text-xs appearance-none pr-6"
                    value=""
                    onChange={(e) => { moveWallets(sel, e.target.value === 'none' ? null : e.target.value); toast('Moved'); setSel([]) }}
                  >
                    <option value="" disabled>Move to…</option>
                    {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                    <option value="none">No group</option>
                  </select>
                  <FolderInput size={12} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-ink-400" />
                </div>
                <button className="btn-danger py-1.5 text-xs ml-auto" onClick={() => { deleteWallets(sel); toast(`Deleted ${sel.length} wallets`, 'info'); setSel([]) }}><Trash2 size={14} /> Delete</button>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{filter === 'all' ? 'All wallets' : filter === 'none' ? 'Ungrouped' : currentGroup?.name}</span>
                  {currentGroup && (
                    <>
                      <button className="btn-quiet p-1" title="Rename group" onClick={() => setModal('rename-group')}><Pencil size={13} /></button>
                      <button className="btn-quiet p-1 hover:text-down" title="Delete group" onClick={() => { deleteGroup(currentGroup.id); setFilter('all') }}><Trash2 size={13} /></button>
                    </>
                  )}
                </div>
                <button className="btn-ghost py-1.5 text-xs ml-auto" disabled={!list.length} onClick={() => { setFundIds(list.map((w) => w.id)); setModal('fund') }}>
                  <Send size={14} /> Fund all in view
                </button>
              </>
            )}
          </div>

          {list.length ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-ink-500">
                  <th className="w-10 pl-4 py-2.5">
                    <input type="checkbox" className="accent-accent" checked={allSel} onChange={() => setSel(allSel ? [] : list.map((w) => w.id))} />
                  </th>
                  <th className="font-normal py-2.5">Wallet</th>
                  <th className="font-normal py-2.5">Address</th>
                  <th className="font-normal py-2.5">Group</th>
                  <th className="font-normal py-2.5 text-right">Balance</th>
                  <th className="w-24 pr-4" />
                </tr>
              </thead>
              <tbody>
                {list.map((w) => {
                  const g = groupOf(w.groupId)
                  return (
                    <tr key={w.id} className={cx('border-t border-ink-800 hover:bg-ink-850', sel.includes(w.id) && 'bg-accent/[0.04]')}>
                      <td className="pl-4"><input type="checkbox" className="accent-accent" checked={sel.includes(w.id)} onChange={() => toggle(w.id)} /></td>
                      <td className="py-3">
                        {renaming?.id === w.id ? (
                          <input
                            autoFocus
                            className="input py-1 text-sm w-40"
                            value={renaming.label}
                            onChange={(e) => setRenaming({ id: w.id, label: e.target.value })}
                            onBlur={() => { renameWallet(w.id, renaming.label || w.label); setRenaming(null) }}
                            onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                          />
                        ) : (
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-md bg-ink-800 border border-ink-700 grid place-items-center"><WalletIcon size={13} className="text-ink-400" /></div>
                            <span className="font-medium">{w.label}</span>
                          </div>
                        )}
                      </td>
                      <td><CopyAddr address={w.address} head={6} tail={6} /></td>
                      <td>
                        {g ? (
                          <span className="chip border" style={{ color: g.color, borderColor: `${g.color}40`, background: `${g.color}12` }}>{g.name}</span>
                        ) : (
                          <span className="text-xs text-ink-500">—</span>
                        )}
                      </td>
                      <td className="text-right"><Sol v={w.balance.toFixed(3)} className={cx('justify-end', !w.balance && 'text-ink-500')} /></td>
                      <td className="pr-4 text-right relative">
                        <div className="inline-flex gap-0.5">
                          <button className="btn-quiet p-1.5" title="Fund" onClick={() => { setFundIds([w.id]); setModal('fund') }}><Send size={14} /></button>
                          <button className="btn-quiet p-1.5" onClick={(e) => { e.stopPropagation(); setMenu(menu === w.id ? null : w.id) }}><MoreHorizontal size={14} /></button>
                        </div>
                        {menu === w.id && (
                          <div className="absolute right-4 top-10 z-20 w-44 panel bg-ink-850 p-1 shadow-xl text-left animate-pop" onClick={(e) => e.stopPropagation()}>
                            <button className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs hover:bg-ink-750" onClick={() => { setRenaming({ id: w.id, label: w.label }); setMenu(null) }}><Pencil size={13} /> Rename</button>
                            <button className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs hover:bg-ink-750" onClick={() => { const t = reclaimWallets([w.id]); toast(`Reclaimed ${t.toFixed(3)} SOL`); setMenu(null) }}><ArrowDownToLine size={13} /> Reclaim to Funder</button>
                            <button className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs text-down hover:bg-down/10" onClick={() => { deleteWallets([w.id]); setMenu(null) }}><Trash2 size={13} /> Delete</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          ) : (
            <Empty icon={<WalletIcon size={20} />} title="No wallets here" text="Create wallets and drop them into a group to keep launches organized." action={<button className="btn-primary" onClick={() => setModal('create')}><Plus size={16} /> Create wallets</button>} />
          )}
        </div>
      </div>

      <CreateWalletsModal key={`${filter}-${modal}`} open={modal === 'create'} onClose={() => setModal(null)} defaultGroup={filter !== 'all' && filter !== 'none' ? filter : null} />
      <FundModal open={modal === 'fund'} onClose={() => { setModal(null); setSel([]) }} ids={fundIds} />
      <GroupModal open={modal === 'group'} onClose={() => setModal(null)} />
      {currentGroup && <GroupModal key={currentGroup.id} open={modal === 'rename-group'} onClose={() => setModal(null)} edit={currentGroup} />}
    </div>
  )
}
