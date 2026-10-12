import clsx from 'clsx'
import { Check, Copy, X } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { shortAddr } from '../lib/format'

export const cx = clsx

export function Modal({
  open, onClose, title, subtitle, children, width = 'max-w-md', footer,
}: {
  open: boolean
  onClose: () => void
  title: ReactNode
  subtitle?: ReactNode
  children: ReactNode
  width?: string
  footer?: ReactNode
}) {
  useEffect(() => {
    if (!open) return
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/75" onClick={onClose} />
      <div className={cx('relative w-full panel bg-ink-900 rounded-xl shadow-2xl shadow-black animate-pop flex flex-col max-h-[90vh]', width)}>
        <div className="flex items-start justify-between gap-4 px-5 pt-5 pb-4 border-b border-ink-750">
          <div>
            <h3 className="text-base font-semibold">{title}</h3>
            {subtitle && <p className="text-sm text-ink-400 mt-0.5">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="text-ink-400 hover:text-ink-100 p-1 -m-1 rounded-md">
            <X size={18} />
          </button>
        </div>
        <div className="p-5 overflow-y-auto">{children}</div>
        {footer && <div className="px-5 py-4 border-t border-ink-750 flex justify-end gap-2">{footer}</div>}
      </div>
    </div>
  )
}

export function CopyAddr({ address, head = 4, tail = 4, className }: { address: string; head?: number; tail?: number; className?: string }) {
  const [done, setDone] = useState(false)
  return (
    <button
      onClick={(e) => {
        e.stopPropagation()
        navigator.clipboard?.writeText(address).catch(() => {})
        setDone(true)
        setTimeout(() => setDone(false), 1200)
      }}
      className={cx('group inline-flex items-center gap-1.5 font-mono text-xs text-ink-300 hover:text-ink-100', className)}
      title={address}
    >
      {shortAddr(address, head, tail)}
      {done ? <Check size={12} className="text-up" /> : <Copy size={12} className="opacity-50 group-hover:opacity-100" />}
    </button>
  )
}

export function SolMark({ size = 14, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={cx('text-ink-400', className)} aria-hidden>
      <path fill="currentColor" d="M5 16.5h13.5l-2.5 3H2.5zM5 4.5h13.5l-2.5 3H2.5zM16 10.5H2.5l2.5 3h13.5z" />
    </svg>
  )
}

export function Sol({ v, className, digits }: { v: string | number; className?: string; digits?: number }) {
  return (
    <span className={cx('inline-flex items-center gap-1 num', className)}>
      <SolMark size={12} />
      {typeof v === 'number' ? Number(v.toFixed(digits ?? 3)) : v}
    </span>
  )
}

export function Segmented<T extends string>({
  value, onChange, options, size = 'md',
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: ReactNode }[]
  size?: 'sm' | 'md'
}) {
  return (
    <div className="inline-flex rounded-full bg-ink-900 border border-ink-750 p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={cx(
            'rounded-full font-medium transition',
            size === 'sm' ? 'px-2 py-1 text-[11px]' : 'px-3 py-1.5 text-xs',
            value === o.value ? 'bg-ink-100 text-ink-950' : 'text-ink-400 hover:text-ink-200',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function TokenAvatar({ image, symbol, size = 40, className }: { image?: string; symbol: string; size?: number; className?: string }) {
  return image ? (
    <img src={image} alt="" style={{ width: size, height: size }} className={cx('rounded-md object-cover bg-ink-800', className)} />
  ) : (
    <div
      style={{ width: size, height: size, fontSize: size * 0.38 }}
      className={cx('rounded-md grid place-items-center font-semibold bg-ink-800 border border-ink-700 text-ink-200', className)}
    >
      {symbol.slice(0, 2).toUpperCase() || '?'}
    </div>
  )
}

export function Empty({ icon, title, text, action }: { icon: ReactNode; title: string; text: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-14 px-6">
      <div className="w-12 h-12 rounded-lg bg-ink-900 border border-dashed border-ink-600 grid place-items-center text-ink-300 mb-4">{icon}</div>
      <div className="font-medium">{title}</div>
      <p className="text-sm text-ink-400 mt-1 max-w-sm">{text}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function Field({ label, hint, children, counter }: { label: ReactNode; hint?: ReactNode; children: ReactNode; counter?: string }) {
  return (
    <label className="block">
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="text-sm font-medium text-ink-200">
          {label} {hint && <span className="text-ink-500 font-normal">{hint}</span>}
        </span>
        {counter && <span className="text-[11px] text-ink-500 num">{counter}</span>}
      </div>
      {children}
    </label>
  )
}

export function PageHeader({ title, subtitle, right }: { title: ReactNode; subtitle?: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm text-ink-400 mt-1">{subtitle}</p>}
      </div>
      {right && <div className="flex items-center gap-2">{right}</div>}
    </div>
  )
}

/** Muted tones — enough to tell groups apart without turning the UI into a rainbow. */
export const GROUP_COLORS = ['#ededed', '#9fb3c8', '#c8b79f', '#b8a3c4', '#9fc4b3', '#c49f9f', '#8a8a8a']
