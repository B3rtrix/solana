"""SOL -> DKK dagskurser.

Kilde: SOL/USDT dagslukkekurs fra Binance og USD/DKK fra Den Europæiske Centralbank (ECB).
Danmarks Nationalbanks kurser følger ECB's referencekurser. Weekender/helligdage bruger seneste
kendte kurs. Kan overstyres med en CSV-fil (dato,sol_dkk).
"""

import csv
import io
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

import requests

BINANCE = "https://data-api.binance.vision/api/v3/klines"
ECB = "https://data-api.ecb.europa.eu/service/data/EXR/D.USD+DKK.EUR.SP00.A"


def _binance_sol_usd(fra, til):
    ud = {}
    start = int(datetime(fra.year, fra.month, fra.day, tzinfo=timezone.utc).timestamp() * 1000)
    slut = int(datetime(til.year, til.month, til.day, tzinfo=timezone.utc).timestamp() * 1000)
    while start <= slut:
        r = requests.get(BINANCE, params={"symbol": "SOLUSDT", "interval": "1d", "startTime": start,
                                          "endTime": slut, "limit": 1000}, timeout=60)
        r.raise_for_status()
        rows = r.json()
        if not rows:
            break
        for k in rows:
            d = datetime.fromtimestamp(k[0] / 1000, tz=timezone.utc).date()
            ud[d] = float(k[4])  # lukkekurs
        start = rows[-1][0] + 86_400_000
    return ud


def _ecb_usd_dkk(fra, til):
    r = requests.get(ECB, params={"startPeriod": fra.isoformat(), "endPeriod": til.isoformat(),
                                  "format": "csvdata"}, timeout=60)
    r.raise_for_status()
    per_valuta = {"USD": {}, "DKK": {}}
    for row in csv.DictReader(io.StringIO(r.text)):
        per_valuta[row["CURRENCY"]][date.fromisoformat(row["TIME_PERIOD"])] = float(row["OBS_VALUE"])
    # EUR/DKK / EUR/USD = USD/DKK
    return {d: per_valuta["DKK"][d] / per_valuta["USD"][d]
            for d in per_valuta["USD"] if d in per_valuta["DKK"]}


def _fremfyld(serie, fra, til):
    ud, sidste = {}, None
    # find en startværdi før perioden hvis muligt
    tidligere = [d for d in serie if d < fra]
    if tidligere:
        sidste = serie[max(tidligere)]
    d = fra
    while d <= til:
        if d in serie:
            sidste = serie[d]
        if sidste is not None:
            ud[d] = sidste
        d += timedelta(days=1)
    return ud


def hent_kurser(fra, til, cache_fil):
    """Returnerer {dato: (sol_usd, usd_dkk, sol_dkk)} og gemmer i cache_fil."""
    cache_fil = Path(cache_fil)
    kurser = laes_kurser(cache_fil) if cache_fil.exists() else {}
    if kurser and min(kurser) <= fra and max(kurser) >= til:
        return kurser
    buffer = fra - timedelta(days=10)
    sol_usd = _fremfyld(_binance_sol_usd(buffer, til), fra, til)
    usd_dkk = _fremfyld(_ecb_usd_dkk(buffer, til), fra, til)
    for d in sol_usd:
        if d in usd_dkk:
            kurser[d] = (sol_usd[d], usd_dkk[d], sol_usd[d] * usd_dkk[d])
    with cache_fil.open("w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["dato", "sol_usd", "usd_dkk", "sol_dkk"])
        for d in sorted(kurser):
            w.writerow([d.isoformat(), *kurser[d]])
    return kurser


def laes_kurser(fil):
    """Læser kurs-CSV. Kræver kolonnerne dato og sol_dkk; sol_usd/usd_dkk er valgfri."""
    ud = {}
    with Path(fil).open() as f:
        for row in csv.DictReader(f):
            sd = float(row["sol_dkk"])
            ud[date.fromisoformat(row["dato"])] = (float(row.get("sol_usd") or 0), float(row.get("usd_dkk") or 0), sd)
    return ud
