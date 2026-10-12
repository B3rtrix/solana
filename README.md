# Kiln — token launch desk (UI)

A front-end for planning, funding and running token launches across many wallets.
Everything runs in the browser with **simulated** chain data — no real keys, RPC or transactions.

## Run

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # type-check + production build
```

## What's in it

| Area | Route | |
| --- | --- | --- |
| Dashboard | `/` | All-time PnL (smoothed area chart, 7D/30D/90D/All), stats, launches, tracked wallets |
| Tracker | `/tracker` | Follow any address, give it a nickname + emoji or uploaded picture, live activity feed |
| My Wallets | `/wallets` | Create wallets in bulk, groups, fund from Funder, reclaim, move, rename, delete |
| Funder | sidebar | Main bankroll wallet — deposit (address + QR) and withdraw |
| New Launch | `/launch/new` | 1) network + launchpad (only Solana / Pump.fun enabled) 2) token details 3) dev buy %, holders buy %, pick wallets |
| Draft launch | `/launch/:id` | Edit per-wallet %, see cost per wallet, **1. Distribute** from Funder, **2. Launch** |
| Live launch | `/launch/:id` | Candlestick chart (market cap), per-wallet quick buy/sell, bulk buy/sell panel, Nuke (sell all), Withdraw to Funder |

## Structure

- `src/lib/curve.ts` — constant-product bonding curve (pump.fun parameters) used for cost estimates, buys and sells
- `src/store/useStore.ts` — zustand store, persisted to `localStorage` (`kiln-v1`); clear it to reset the demo
- `src/store/sim.ts` — simulated outside market activity, ticks once per second for live launches
- `src/pages/*` — screens, `src/components/*` — shared UI

To hook up a real backend, replace the actions in `useStore.ts` (`fundPosition`, `goLive`, `trade`, `sweepLaunch`, …) with calls to your API.
