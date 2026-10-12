import {
  CandlestickSeries, ColorType, createChart, createSeriesMarkers, CrosshairMode, HistogramSeries, LineStyle,
  type IChartApi, type IPriceLine, type ISeriesApi, type ISeriesMarkersPluginApi, type SeriesMarker, type Time, type UTCTimestamp,
} from 'lightweight-charts'
import { useEffect, useMemo, useRef } from 'react'
import { fmtUsd } from '../lib/format'
import type { Candle, Trade } from '../store/types'

const aggregate = (candles: Candle[], sec: number): Candle[] => {
  if (sec <= 5) return candles
  const out: Candle[] = []
  for (const c of candles) {
    const t = Math.floor(c.time / sec) * sec
    const last = out[out.length - 1]
    if (last && last.time === t) {
      last.high = Math.max(last.high, c.high)
      last.low = Math.min(last.low, c.low)
      last.close = c.close
      last.volume += c.volume
    } else out.push({ ...c, time: t })
  }
  return out
}

export function CandleChart({
  candles, tf, myTrades, avgBuy, avgSell, showMarkers,
}: {
  candles: Candle[]
  tf: number
  myTrades: Trade[]
  avgBuy?: number
  avgSell?: number
  showMarkers: boolean
}) {
  const el = useRef<HTMLDivElement>(null)
  const chart = useRef<IChartApi | null>(null)
  const series = useRef<ISeriesApi<'Candlestick'> | null>(null)
  const vol = useRef<ISeriesApi<'Histogram'> | null>(null)
  const markers = useRef<ISeriesMarkersPluginApi<Time> | null>(null)
  const lines = useRef<IPriceLine[]>([])
  const data = useMemo(() => aggregate(candles, tf), [candles, tf])

  useEffect(() => {
    if (!el.current) return
    const c = createChart(el.current, {
      autoSize: true,
      layout: { background: { type: ColorType.Solid, color: 'transparent' }, textColor: '#6e767d', fontFamily: 'Inter', attributionLogo: false },
      grid: { vertLines: { color: 'rgba(255,255,255,0.03)' }, horzLines: { color: 'rgba(255,255,255,0.03)' } },
      rightPriceScale: { borderVisible: false, scaleMargins: { top: 0.12, bottom: 0.22 } },
      timeScale: { borderVisible: false, timeVisible: true, secondsVisible: true, rightOffset: 6, barSpacing: 9 },
      crosshair: { mode: CrosshairMode.Normal, vertLine: { color: '#4a5157', labelBackgroundColor: '#22262a' }, horzLine: { color: '#4a5157', labelBackgroundColor: '#22262a' } },
      localization: { locale: 'en-US', priceFormatter: (p: number) => fmtUsd(p) },
    })
    const s = c.addSeries(CandlestickSeries, {
      upColor: '#3ddc97', downColor: '#ff5c6c', borderVisible: false, wickUpColor: '#3ddc97', wickDownColor: '#ff5c6c',
      priceFormat: { type: 'custom', formatter: (p: number) => fmtUsd(p), minMove: 0.01 },
    })
    const v = c.addSeries(HistogramSeries, { priceScaleId: 'vol', priceFormat: { type: 'volume' }, lastValueVisible: false, priceLineVisible: false })
    c.priceScale('vol').applyOptions({ scaleMargins: { top: 0.84, bottom: 0 } })
    chart.current = c
    series.current = s
    vol.current = v
    markers.current = createSeriesMarkers(s, [])
    return () => {
      c.remove()
      chart.current = null
    }
  }, [])

  useEffect(() => {
    if (!series.current || !vol.current) return
    series.current.setData(data.map((c) => ({ time: c.time as UTCTimestamp, open: c.open, high: c.high, low: c.low, close: c.close })))
    vol.current.setData(
      data.map((c) => ({ time: c.time as UTCTimestamp, value: c.volume, color: c.close >= c.open ? 'rgba(61,220,151,0.25)' : 'rgba(255,92,108,0.25)' })),
    )
  }, [data])

  useEffect(() => {
    if (!markers.current) return
    if (!showMarkers || !data.length) return markers.current.setMarkers([])
    const first = data[0].time
    // One bubble per bar and side, with a count when several of my wallets traded together.
    const counts = new Map<string, number>()
    for (const t of myTrades) {
      const time = Math.floor(t.ts / 1000 / tf) * tf
      if (time < first) continue
      const k = `${time}:${t.side}`
      counts.set(k, (counts.get(k) ?? 0) + 1)
    }
    const m: SeriesMarker<Time>[] = [...counts.entries()]
      .map(([k, n]) => {
        const [time, side] = k.split(':')
        return { time: +time, side, n }
      })
      .sort((a, b) => a.time - b.time)
      .map((t) => ({
        time: t.time as UTCTimestamp,
        position: t.side === 'buy' ? 'belowBar' : 'aboveBar',
        color: t.side === 'buy' ? '#3ddc97' : '#ff5c6c',
        shape: 'circle',
        text: `${t.side === 'buy' ? 'B' : 'S'}${t.n > 1 ? `×${t.n}` : ''}`,
        size: 1,
      }))
    markers.current.setMarkers(m)
  }, [myTrades, showMarkers, tf, data])

  useEffect(() => {
    const s = series.current
    if (!s) return
    lines.current.forEach((l) => s.removePriceLine(l))
    lines.current = []
    if (avgBuy) lines.current.push(s.createPriceLine({ price: avgBuy, color: '#3ddc97', lineStyle: LineStyle.Dashed, lineWidth: 1, title: 'Avg buy' }))
    if (avgSell) lines.current.push(s.createPriceLine({ price: avgSell, color: '#ff5c6c', lineStyle: LineStyle.Dashed, lineWidth: 1, title: 'Avg sell' }))
  }, [avgBuy, avgSell])

  return <div ref={el} className="w-full h-full" />
}
