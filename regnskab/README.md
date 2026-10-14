# Regnskab for memecoin-launches (Solana)

Henter alle transaktioner for dine wallets direkte fra Solana-blockchainen og laver en Excel-fil
til revisoren: resultat per launch, per wallet, alle transaktioner med DKK-kurs, og en liste over
bevægelser der skal gennemgås.

**Brug kun offentlige wallet-adresser. Private keys, seed phrases og Proxima-login skal aldrig bruges her.**

## Opsætning

1. Python 3.10+ og `pip install requests openpyxl`
2. Netværksadgang til (i cloud-miljøet: Network access → Allowed domains):
   - `mainnet.helius-rpc.com` (eller en anden Solana RPC)
   - `data-api.binance.vision` (SOL/USD-kurser)
   - `data-api.ecb.europa.eu` (USD/DKK-kurser)
3. Gratis API-nøgle fra helius.dev, sat som miljøvariablen `HELIUS_API_KEY`
   (eller `RPC_URL` med en fuld RPC-adresse).
4. `cp config.example.json config.json` og udfyld periode og wallets.

## Kørsel

```bash
python regnskab.py hent           # henter alt (gemmes i data/, så næste kørsel er hurtig)
python regnskab.py find-wallets   # adresser dine wallets har sendt SOL til -> data/wallet_kandidater.csv
python regnskab.py rapport        # laver regnskab_<fra>_<til>.xlsx
```

Med mange launches: start med kun dev-/funder-walleten, kør `hent` og `find-wallets`, tilføj de
købs-wallets fra kandidatlisten der er dine, og kør `hent` + `rapport` igen.

## Excel-faner

| Fane | Indhold |
| --- | --- |
| Resumé | Salg, køb, handelsresultat, creator fees, netværksgebyrer, Jito tips, resultat i SOL og DKK |
| Launches | Én linje per token: egen launch ja/nej, wallets, køb/salg/netto, Proxima-gebyrer, usolgte tokens |
| Wallets | Én linje per wallet |
| Transaktioner | Hver bevægelse med tid, type, SOL, gebyrer, kurs, DKK og Solscan-link |
| Til gennemgang | Ind/ud til fremmede adresser (indskud, hævninger, glemte wallets) |
| Kurser | SOL/DKK per dag |
| Forklaring | Hvordan tallene er lavet |

## Proxima-gebyrer (5% køb / 5% salg)

Køb og salg er de beløb der faktisk gik ud og ind af walleten, så gebyrerne er allerede trukket.
De vises separat til information: ved køb = betalt × 5/105, ved salg = modtaget × 5/95.
Kender du Proximas gebyr-wallet, så skriv den i `proxima.gebyr_wallets` – så aflæses gebyret præcist.

## Tests

```bash
python -m unittest discover -s tests
```
