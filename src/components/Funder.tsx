import { ArrowDownToLine, ArrowUpFromLine, QrCode, Wallet as WalletIcon } from 'lucide-react'
import { useState } from 'react'
import { fmtUsd } from '../lib/format'
import { mulberry32 } from '../lib/random'
import { useStore } from '../store/useStore'
import { CopyAddr, Field, Modal, Sol, SolMark } from './ui'

/** Decorative pseudo-QR generated from the address. */
function PseudoQr({ seed }: { seed: string }) {
  const rnd = mulberry32([...seed].reduce((a, c) => a + c.charCodeAt(0), 0))
  const n = 21
  const finder = (x: number, y: number) =>
    [[0, 0], [n - 7, 0], [0, n - 7]].some(([fx, fy]) => x >= fx && x < fx + 7 && y >= fy && y < fy + 7)
  const cells: [number, number][] = []
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (!finder(x, y) && rnd() > 0.5) cells.push([x, y])
  return (
    <svg viewBox={`-1 -1 ${n + 2} ${n + 2}`} className="w-40 h-40 rounded-lg bg-white">
      {cells.map(([x, y]) => <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill="#0d0f10" />)}
      {[[0, 0], [n - 7, 0], [0, n - 7]].map(([x, y]) => (
        <g key={`${x}${y}`}>
          <rect x={x + 0.5} y={y + 0.5} width="6" height="6" fill="none" stroke="#0d0f10" />
          <rect x={x + 2} y={y + 2} width="3" height="3" fill="#0d0f10" />
        </g>
      ))}
    </svg>
  )
}

export function DepositModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { funder, deposit, toast } = useStore()
  const [amt, setAmt] = useState('')
  return (
    <Modal open={open} onClose={onClose} title="Deposit to Funder" subtitle="Send SOL to this address. It becomes your launch bankroll.">
      <div className="flex flex-col items-center gap-4">
        <PseudoQr seed={funder.address} />
        <div className="w-full rounded-lg bg-ink-850 border border-ink-700 px-3 py-2.5 flex items-center justify-between">
          <span className="text-xs text-ink-400">Funder address</span>
          <CopyAddr address={funder.address} head={8} tail={8} />
        </div>
        <div className="w-full border-t border-dashed border-ink-700 pt-4">
          <div className="label mb-2">Demo: simulate an incoming deposit</div>
          <div className="flex gap-2">
            <input className="input" type="number" placeholder="Amount in SOL" value={amt} onChange={(e) => setAmt(e.target.value)} />
            <button
              className="btn-primary shrink-0"
              disabled={!(+amt > 0)}
              onClick={() => {
                deposit(+amt)
                toast(`Received ${amt} SOL`)
                setAmt('')
                onClose()
              }}
            >
              <ArrowDownToLine size={16} /> Receive
            </button>
          </div>
        </div>
      </div>
    </Modal>
  )
}

export function WithdrawModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { funder, withdrawFunder, toast } = useStore()
  const [amt, setAmt] = useState('')
  const [to, setTo] = useState('')
  const valid = +amt > 0 && +amt <= funder.balance && to.length >= 32
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Withdraw from Funder"
      footer={
        <>
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button
            className="btn-primary"
            disabled={!valid}
            onClick={() => {
              withdrawFunder(+amt)
              toast(`Sent ${amt} SOL`)
              setAmt('')
              setTo('')
              onClose()
            }}
          >
            <ArrowUpFromLine size={16} /> Withdraw
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Destination address">
          <input className="input font-mono" placeholder="Solana address" value={to} onChange={(e) => setTo(e.target.value.trim())} />
        </Field>
        <Field label="Amount" counter={`Available ${funder.balance.toFixed(3)} SOL`}>
          <div className="relative">
            <input className="input pr-16" type="number" placeholder="0.00" value={amt} onChange={(e) => setAmt(e.target.value)} />
            <button className="absolute right-2 top-1/2 -translate-y-1/2 chip bg-ink-700 text-ink-200 hover:bg-ink-600" onClick={() => setAmt(String(Math.max(0, funder.balance - 0.001).toFixed(4)))}>
              MAX
            </button>
          </div>
        </Field>
      </div>
    </Modal>
  )
}

/** Compact funder card for the sidebar. */
export function FunderCard() {
  const { funder, solPrice } = useStore()
  const [dep, setDep] = useState(false)
  const [wd, setWd] = useState(false)
  return (
    <div className="rounded-xl border border-ink-700 bg-gradient-to-b from-ink-800 to-ink-850 p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-ink-300">
          <WalletIcon size={14} className="text-lime" /> Funder
        </div>
        <CopyAddr address={funder.address} className="text-[11px]" />
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-xl font-semibold num flex items-center gap-1.5">
          <SolMark size={16} />
          {funder.balance.toFixed(2)}
        </span>
        <span className="text-xs text-ink-400 num">{fmtUsd(funder.balance * solPrice, false)}</span>
      </div>
      <div className="grid grid-cols-2 gap-2 mt-3">
        <button className="btn-ghost py-1.5 text-xs" onClick={() => setDep(true)}>
          <QrCode size={14} /> Deposit
        </button>
        <button className="btn-ghost py-1.5 text-xs" onClick={() => setWd(true)}>
          <ArrowUpFromLine size={14} /> Withdraw
        </button>
      </div>
      <DepositModal open={dep} onClose={() => setDep(false)} />
      <WithdrawModal open={wd} onClose={() => setWd(false)} />
    </div>
  )
}

export function FunderInline() {
  const { funder } = useStore()
  return <Sol v={funder.balance.toFixed(2)} />
}
