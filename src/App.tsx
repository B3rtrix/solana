import { AlertCircle, CheckCircle2, Info } from 'lucide-react'
import { useEffect } from 'react'
import { Route, Routes } from 'react-router-dom'
import { Sidebar } from './components/Sidebar'
import { cx } from './components/ui'
import Dashboard from './pages/Dashboard'
import LaunchPage from './pages/LaunchPage'
import NewLaunch from './pages/NewLaunch'
import Tracker from './pages/Tracker'
import Wallets from './pages/Wallets'
import { useStore } from './store/useStore'

function Toasts() {
  const toasts = useStore((s) => s.toasts)
  const dismiss = useStore((s) => s.dismissToast)
  return (
    <div className="fixed top-4 right-4 z-[60] flex flex-col gap-2 w-80">
      {toasts.map((t) => (
        <button
          key={t.id}
          onClick={() => dismiss(t.id)}
          className="panel bg-ink-850 px-3.5 py-3 flex items-center gap-3 text-sm text-left shadow-xl animate-in"
        >
          {t.kind === 'ok' && <CheckCircle2 size={16} className="text-up shrink-0" />}
          {t.kind === 'err' && <AlertCircle size={16} className="text-down shrink-0" />}
          {t.kind === 'info' && <Info size={16} className="text-ink-300 shrink-0" />}
          <span className={cx(t.kind === 'err' && 'text-down')}>{t.text}</span>
        </button>
      ))}
    </div>
  )
}

/** Drives the simulated market for every live launch. */
function MarketEngine() {
  const tick = useStore((s) => s.tick)
  useEffect(() => {
    const t = setInterval(tick, 1000)
    return () => clearInterval(t)
  }, [tick])
  return null
}

export default function App() {
  return (
    <div className="h-full flex overflow-hidden">
      <Sidebar />
      <main className="flex-1 min-w-0 h-full overflow-y-auto grid-bg">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/tracker" element={<Tracker />} />
          <Route path="/wallets" element={<Wallets />} />
          <Route path="/launch/new" element={<NewLaunch />} />
          <Route path="/launch/:id" element={<LaunchPage />} />
        </Routes>
      </main>
      <Toasts />
      <MarketEngine />
    </div>
  )
}
