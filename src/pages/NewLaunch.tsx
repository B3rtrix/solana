import { AlertTriangle, ArrowLeft, ArrowRight, Check, ChefHat, Globe, ImagePlus, Lock, Send, Shuffle, Users, X as XIcon } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChainGlyph, CHAINS, LAUNCHPADS, PadGlyph } from '../components/brand'
import { cx, Field, Segmented, Sol, TokenAvatar } from '../components/ui'
import { WalletPicker } from '../components/WalletPicker'
import { mcapSol, planBuys } from '../lib/curve'
import { fmtUsd } from '../lib/format'
import { fileToAvatar, videoToAvatar } from '../lib/image'
import type { ChainId } from '../store/types'
import { TX_BUFFER, useStore } from '../store/useStore'

const STEPS = ['Network', 'Token', 'Buy setup']
const MAX_SUPPLY_PCT = 79

/** Splits `total` % across wallets, evenly or with stable per-wallet variation. */
export const splitPct = (ids: string[], total: number, mode: 'even' | 'varied') => {
  if (!ids.length || !(total > 0)) return ids.map(() => 0)
  const weights = ids.map((id) =>
    mode === 'even' ? 1 : 0.6 + (([...id].reduce((a, c) => a * 31 + c.charCodeAt(0), 7) >>> 0) % 1000) / 1250,
  )
  const sum = weights.reduce((a, b) => a + b, 0)
  return weights.map((w) => Math.round((total * w * 100) / sum) / 100)
}

function Stepper({ step }: { step: number }) {
  return (
    <div className="flex items-center gap-3">
      {STEPS.map((s, i) => (
        <div key={s} className="flex items-center gap-3">
          <div className={cx('flex items-center gap-2 text-sm', i === step ? 'text-ink-100' : i < step ? 'text-accent' : 'text-ink-500')}>
            <span className={cx('w-6 h-6 rounded-full grid place-items-center text-[11px] font-semibold border', i === step ? 'border-accent text-accent' : i < step ? 'bg-accent border-accent text-ink-950' : 'border-ink-600')}>
              {i < step ? <Check size={12} strokeWidth={3} /> : i + 1}
            </span>
            {s}
          </div>
          {i < STEPS.length - 1 && <div className={cx('w-10 h-px', i < step ? 'bg-accent/60' : 'bg-ink-700')} />}
        </div>
      ))}
    </div>
  )
}

export default function NewLaunch() {
  const nav = useNavigate()
  const { wallets, funder, solPrice, createLaunch, toast } = useStore()
  const [step, setStep] = useState(0)

  // step 1
  const [chain, setChain] = useState<ChainId>('solana')
  const [pad, setPad] = useState('pumpfun')

  // step 2
  const [name, setName] = useState('')
  const [symbol, setSymbol] = useState('')
  const [desc, setDesc] = useState('')
  const [image, setImage] = useState<string | undefined>()
  const [isVideo, setIsVideo] = useState(false)
  const [twitter, setTwitter] = useState('')
  const [telegram, setTelegram] = useState('')
  const [website, setWebsite] = useState('')
  const [drag, setDrag] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // step 3
  const [devWallet, setDevWallet] = useState<string>('')
  const [devPct, setDevPct] = useState('')
  const [holdersPct, setHoldersPct] = useState('')
  const [holderIds, setHolderIds] = useState<string[]>([])
  const [split, setSplit] = useState<'even' | 'varied'>('varied')
  const [picker, setPicker] = useState(false)

  const onFile = async (f?: File) => {
    if (!f) return
    try {
      const video = f.type.startsWith('video/')
      setImage(video ? await videoToAvatar(f) : await fileToAvatar(f, 400))
      setIsVideo(video)
    } catch {
      toast('Could not read that file', 'err')
    }
  }

  const holderPcts = splitPct(holderIds, +holdersPct, split)
  const plan = useMemo(() => {
    const pcts = [...(devWallet ? [+devPct || 0] : []), ...holderPcts]
    return planBuys(pcts)
  }, [devWallet, devPct, holderPcts.join(',')]) // eslint-disable-line react-hooks/exhaustive-deps
  const totalPct = (devWallet ? +devPct || 0 : 0) + (+holdersPct || 0)
  const solNeeded = plan.costs.reduce((a, b) => a + b, 0) + (holderIds.length + (devWallet ? 1 : 0)) * TX_BUFFER
  const walletsById = Object.fromEntries(wallets.map((w) => [w.id, w]))

  const step2Valid = name.trim() && symbol.trim() && image
  const step3Valid =
    devWallet &&
    totalPct <= MAX_SUPPLY_PCT &&
    (holderIds.length === 0 || +holdersPct > 0) &&
    (+holdersPct > 0 ? holderIds.length > 0 : true)

  const create = () => {
    const id = createLaunch({
      chain, launchpad: pad, name: name.trim(), symbol: symbol.trim().toUpperCase(), description: desc, image,
      twitter, telegram, website,
      positions: [
        { walletId: devWallet, role: 'dev', buyPct: +devPct || 0 },
        ...holderIds.map((w, i) => ({ walletId: w, role: 'holder' as const, buyPct: holderPcts[i] })),
      ],
    })
    toast(`$${symbol.toUpperCase()} draft created`)
    nav(`/launch/${id}`)
  }

  return (
    <div className="min-h-full flex flex-col animate-in">
      <div className="h-16 shrink-0 border-b border-ink-750 px-8 flex items-center justify-between">
        <button className="btn-quiet -ml-3" onClick={() => nav(-1)}><XIcon size={16} /> Cancel</button>
        <Stepper step={step} />
        <div className="w-24" />
      </div>

      <div className="flex-1 px-8 py-10">
        {/* ---------- STEP 1 ---------- */}
        {step === 0 && (
          <div className="max-w-4xl mx-auto">
            <h1 className="text-3xl font-semibold tracking-tight">Where are we launching?</h1>
            <p className="text-ink-400 mt-2">Pick a network, then the launchpad that will host your bonding curve.</p>

            <div className="mt-8 grid grid-cols-2 md:grid-cols-3 gap-3">
              {CHAINS.map((c) => (
                <button
                  key={c.id}
                  disabled={!c.available}
                  onClick={() => setChain(c.id)}
                  className={cx(
                    'relative text-left rounded-lg border p-4 transition',
                    !c.available && 'opacity-45 cursor-not-allowed border-ink-800 bg-ink-900',
                    c.available && chain === c.id && 'border-accent/70 bg-accent/[0.06]',
                    c.available && chain !== c.id && 'border-ink-700 bg-ink-900 hover:border-ink-500',
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-10 rounded-xl bg-ink-800 grid place-items-center"><ChainGlyph id={c.id} /></div>
                    {c.available ? (
                      chain === c.id && <span className="w-5 h-5 rounded-full bg-accent grid place-items-center"><Check size={12} strokeWidth={3} className="text-ink-950" /></span>
                    ) : (
                      <span className="chip bg-ink-800 text-ink-400"><Lock size={10} /> Unavailable</span>
                    )}
                  </div>
                  <div className="mt-4 font-medium">{c.name}</div>
                  <div className="text-xs text-ink-500 mt-0.5">{c.note}</div>
                </button>
              ))}
            </div>

            <div className="mt-10 flex items-center gap-3">
              <span className="label">Launchpads on Solana</span>
              <div className="flex-1 h-px bg-ink-750" />
            </div>
            <div className="mt-4 grid md:grid-cols-2 gap-2">
              {LAUNCHPADS.map((p) => (
                <button
                  key={p.id}
                  disabled={!p.available}
                  onClick={() => setPad(p.id)}
                  className={cx(
                    'flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition',
                    !p.available && 'opacity-45 cursor-not-allowed border-ink-800',
                    p.available && pad === p.id && 'border-accent/70 bg-accent/[0.06]',
                    p.available && pad !== p.id && 'border-ink-700 hover:border-ink-500',
                  )}
                >
                  <PadGlyph id={p.id} size={28} />
                  <div className="flex-1">
                    <div className="font-medium text-sm">{p.name}</div>
                    <div className="text-[11px] text-ink-500">{p.available ? 'Bonding curve · 1B supply · graduates at ~85 SOL' : 'Not supported yet'}</div>
                  </div>
                  {p.available ? (
                    <span className={cx('w-4 h-4 rounded-full border-2', pad === p.id ? 'border-accent bg-accent' : 'border-ink-500')} />
                  ) : (
                    <span className="chip bg-ink-800 text-ink-400">Unavailable</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ---------- STEP 2 ---------- */}
        {step === 1 && (
          <div className="max-w-5xl mx-auto grid lg:grid-cols-[1fr_320px] gap-10">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">Shape your token</h1>
              <p className="text-ink-400 mt-2">This is what traders see on explorers, wallets and the launchpad.</p>

              <div className="mt-8 space-y-5">
                <div className="grid grid-cols-[1fr_180px] gap-4">
                  <Field label="Name" counter={`${name.length}/32`}>
                    <input className="input" maxLength={32} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Ember" />
                  </Field>
                  <Field label="Ticker" counter={`${symbol.length}/10`}>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-500 text-sm">$</span>
                      <input className="input pl-6 uppercase" maxLength={10} value={symbol} onChange={(e) => setSymbol(e.target.value.replace(/[^a-zA-Z0-9]/g, ''))} placeholder="EMBER" />
                    </div>
                  </Field>
                </div>
                <Field label="Description" hint="(optional)" counter={`${desc.length}/280`}>
                  <textarea className="input min-h-[92px] resize-none" maxLength={280} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="One or two lines about the token." />
                </Field>

                <div>
                  <div className="text-sm font-medium text-ink-200 mb-1.5">Artwork</div>
                  <div
                    onDragOver={(e) => { e.preventDefault(); setDrag(true) }}
                    onDragLeave={() => setDrag(false)}
                    onDrop={(e) => { e.preventDefault(); setDrag(false); onFile(e.dataTransfer.files?.[0]) }}
                    onClick={() => fileRef.current?.click()}
                    className={cx(
                      'cursor-pointer rounded-xl border border-dashed p-5 flex items-center gap-5 transition',
                      drag ? 'border-accent bg-accent/[0.05]' : 'border-ink-600 bg-ink-900 hover:border-ink-500',
                    )}
                  >
                    <div className="w-20 h-20 rounded-xl bg-ink-800 grid place-items-center overflow-hidden shrink-0">
                      {image ? <img src={image} className="w-full h-full object-cover" alt="" /> : <ImagePlus size={24} className="text-ink-400" />}
                    </div>
                    <div>
                      <div className="text-sm font-medium">{image ? 'Looks good — click to replace' : 'Drop an image or video here'}</div>
                      <div className="text-xs text-ink-500 mt-1">PNG, JPG, GIF, WEBP, MP4 or WEBM · square works best{isVideo && ' · using first frame as cover'}</div>
                    </div>
                    <input ref={fileRef} type="file" hidden accept="image/*,video/mp4,video/webm" onChange={(e) => onFile(e.target.files?.[0])} />
                  </div>
                </div>

                <div>
                  <div className="text-sm font-medium text-ink-200 mb-1.5">Links <span className="text-ink-500 font-normal">(optional)</span></div>
                  <div className="space-y-2">
                    {[
                      { icon: <span className="text-[13px] font-bold">𝕏</span>, v: twitter, s: setTwitter, p: 'x.com/yourtoken' },
                      { icon: <Send size={14} />, v: telegram, s: setTelegram, p: 't.me/yourtoken' },
                      { icon: <Globe size={14} />, v: website, s: setWebsite, p: 'yourtoken.xyz' },
                    ].map((l, i) => (
                      <div key={i} className="flex items-center rounded-lg border border-ink-700 bg-ink-850 focus-within:border-accent/60">
                        <span className="w-10 grid place-items-center text-ink-400 border-r border-ink-700 self-stretch">{l.icon}</span>
                        <input className="flex-1 bg-transparent px-3 py-2.5 text-sm outline-none placeholder:text-ink-500" value={l.v} onChange={(e) => l.s(e.target.value)} placeholder={l.p} />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="lg:pt-[88px]">
              <div className="label mb-3">Live preview</div>
              <div className="panel p-4 sticky top-6">
                <div className="aspect-square rounded-lg overflow-hidden bg-ink-800 grid place-items-center">
                  {image ? <img src={image} className="w-full h-full object-cover" alt="" /> : <TokenAvatar symbol={symbol || '?'} size={96} />}
                </div>
                <div className="mt-4 flex items-baseline gap-2">
                  <span className="font-semibold text-lg truncate">{name || 'Token name'}</span>
                  <span className="text-ink-400 text-sm">${(symbol || 'TICKER').toUpperCase()}</span>
                </div>
                <p className="text-xs text-ink-400 mt-1 line-clamp-3 min-h-[16px]">{desc || 'Your description shows here.'}</p>
                <div className="flex items-center gap-2 mt-3 text-ink-400">
                  <PadGlyph id={pad} size={18} />
                  <span className="text-xs">{LAUNCHPADS.find((p) => p.id === pad)?.name}</span>
                  <span className="ml-auto text-xs num">{fmtUsd(mcapSol({ vSol: 30, vTok: 1_073_000_000 }) * solPrice)} mc</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ---------- STEP 3 ---------- */}
        {step === 2 && (
          <div className="max-w-5xl mx-auto grid lg:grid-cols-[1fr_320px] gap-10">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">Who buys at launch?</h1>
              <p className="text-ink-400 mt-2">Set how much of the supply your dev and holder wallets take in the first block. You decide the numbers.</p>

              <div className="mt-8 rounded-lg border border-ink-750 bg-ink-900 p-5">
                <div className="flex items-center gap-2 font-medium"><ChefHat size={15} className="text-ink-400" /> Developer</div>
                <div className="grid grid-cols-2 gap-4 mt-4">
                  <Field label="Dev wallet">
                    <select className="input" value={devWallet} onChange={(e) => { setDevWallet(e.target.value); setHolderIds((h) => h.filter((x) => x !== e.target.value)) }}>
                      <option value="">Select a wallet…</option>
                      {wallets.map((w) => <option key={w.id} value={w.id}>{w.label} · {w.balance.toFixed(2)} SOL</option>)}
                    </select>
                  </Field>
                  <Field label="Dev buy" hint="(% of supply, optional)">
                    <div className="relative">
                      <input className="input pr-8" type="number" min={0} value={devPct} onChange={(e) => setDevPct(e.target.value)} placeholder="" />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-500 text-sm">%</span>
                    </div>
                  </Field>
                </div>
              </div>

              <div className="mt-4 rounded-lg border border-ink-750 bg-ink-900 p-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-medium"><Users size={15} className="text-ink-400" /> Holders</div>
                  <Segmented
                    size="sm"
                    value={split}
                    onChange={setSplit}
                    options={[{ value: 'even', label: 'Even split' }, { value: 'varied', label: <span className="flex items-center gap-1"><Shuffle size={11} /> Varied</span> }]}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4 mt-4">
                  <Field label="Holders buy" hint="(% of supply, total)">
                    <div className="relative">
                      <input className="input pr-8" type="number" min={0} value={holdersPct} onChange={(e) => setHoldersPct(e.target.value)} placeholder="" />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-500 text-sm">%</span>
                    </div>
                  </Field>
                  <Field label="Holder wallets">
                    <button className="input text-left flex items-center justify-between hover:border-ink-500" onClick={() => setPicker(true)}>
                      <span className={holderIds.length ? 'text-ink-100' : 'text-ink-500'}>{holderIds.length ? `${holderIds.length} wallet${holderIds.length > 1 ? 's' : ''} selected` : 'Choose wallets…'}</span>
                      <ArrowRight size={14} className="text-ink-400" />
                    </button>
                  </Field>
                </div>

                {holderIds.length > 0 && (
                  <div className="mt-4 rounded-xl border border-ink-750 overflow-hidden">
                    <div className="grid grid-cols-[1fr_90px_100px_28px] gap-2 px-3 py-2 text-[11px] text-ink-500 bg-ink-850">
                      <span>Wallet</span><span className="text-right">Supply</span><span className="text-right">Est. cost</span><span />
                    </div>
                    <div className="max-h-64 overflow-y-auto divide-y divide-ink-800">
                      {holderIds.map((id, i) => {
                        const w = walletsById[id]
                        const cost = plan.costs[(devWallet ? 1 : 0) + i] ?? 0
                        return (
                          <div key={id} className="grid grid-cols-[1fr_90px_100px_28px] gap-2 px-3 py-2 items-center text-sm">
                            <span className="truncate">{w?.label ?? 'Removed wallet'} <span className="text-ink-500 font-mono text-[11px]">{w?.address.slice(0, 4)}</span></span>
                            <span className="text-right num">{holderPcts[i] ? `${holderPcts[i]}%` : '—'}</span>
                            <Sol v={cost.toFixed(3)} className="justify-end text-xs" />
                            <button className="text-ink-500 hover:text-down" onClick={() => setHolderIds((h) => h.filter((x) => x !== id))}><XIcon size={14} /></button>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="lg:pt-[88px]">
              <div className="panel p-5 sticky top-6">
                <div className="flex items-center gap-3">
                  <TokenAvatar image={image} symbol={symbol} size={40} />
                  <div>
                    <div className="font-medium">{name}</div>
                    <div className="text-xs text-ink-400">${symbol.toUpperCase()} · {LAUNCHPADS.find((p) => p.id === pad)?.name}</div>
                  </div>
                </div>
                <div className="mt-5 space-y-2.5 text-sm">
                  <div className="flex justify-between"><span className="text-ink-400">Supply bought</span><span className={cx('num', totalPct > MAX_SUPPLY_PCT && 'text-down')}>{totalPct ? `${Number(totalPct.toFixed(2))}%` : '—'}</span></div>
                  <div className="flex justify-between"><span className="text-ink-400">Wallets</span><span className="num">{holderIds.length + (devWallet ? 1 : 0)}</span></div>
                  <div className="flex justify-between"><span className="text-ink-400">Mcap after block</span><span className="num">{fmtUsd(mcapSol(plan.curve) * solPrice)}</span></div>
                  <div className="h-px bg-ink-750 my-1" />
                  <div className="flex justify-between font-medium"><span>Required SOL</span><Sol v={solNeeded.toFixed(3)} /></div>
                  <div className="flex justify-between text-xs"><span className="text-ink-500">Funder balance</span><Sol v={funder.balance.toFixed(2)} className={cx(funder.balance < solNeeded ? 'text-warn' : 'text-ink-300')} /></div>
                </div>
                {totalPct > MAX_SUPPLY_PCT && (
                  <div className="mt-4 rounded-lg bg-down/10 border border-down/30 p-3 text-xs text-down flex gap-2">
                    <AlertTriangle size={14} className="shrink-0" /> The curve only sells ~{MAX_SUPPLY_PCT}% before graduating.
                  </div>
                )}
                {funder.balance < solNeeded && totalPct <= MAX_SUPPLY_PCT && (
                  <div className="mt-4 rounded-lg bg-warn/10 border border-warn/30 p-3 text-xs text-warn flex gap-2">
                    <AlertTriangle size={14} className="shrink-0" /> Funder is short — you can top it up before distributing.
                  </div>
                )}
                <p className="text-[11px] text-ink-500 mt-4">Includes 1% launchpad fee and {TX_BUFFER} SOL per wallet for fees & rent.</p>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="sticky bottom-0 border-t border-ink-750 bg-ink-950/90 backdrop-blur px-8 py-4 flex items-center justify-between">
        <button className="btn-ghost" disabled={step === 0} onClick={() => setStep(step - 1)}><ArrowLeft size={16} /> Back</button>
        {step < 2 ? (
          <button className="btn-primary px-6" disabled={step === 1 && !step2Valid} onClick={() => setStep(step + 1)}>
            Continue <ArrowRight size={16} />
          </button>
        ) : (
          <button className="btn-primary px-6" disabled={!step3Valid} onClick={create}>
            Create launch <ArrowRight size={16} />
          </button>
        )}
      </div>

      <WalletPicker
        open={picker}
        onClose={() => setPicker(false)}
        value={holderIds}
        exclude={devWallet ? [devWallet] : []}
        onConfirm={setHolderIds}
        title="Choose holder wallets"
      />
    </div>
  )
}
