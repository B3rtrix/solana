#!/usr/bin/env python3
"""Regnskab for memecoin-launches på Solana.

  python regnskab.py hent           # henter alle transaktioner for dine wallets (caches i data/)
  python regnskab.py find-wallets   # foreslår wallets som dine wallets har sendt SOL til
  python regnskab.py rapport        # laver Excel-rapporten
  python regnskab.py alt            # hent + rapport

Se README.md.
"""

import argparse
import csv
import json
import sys
from collections import Counter
from datetime import date
from pathlib import Path

import classify as C
import prices
import report
from solana_rpc import Rpc, rpc_url_fra_miljo

HER = Path(__file__).resolve().parent


def laes_config(sti):
    cfg = json.loads(Path(sti).read_text())
    wallets = []
    for w in cfg.get("wallets", []):
        wallets.append(w if isinstance(w, dict) else {"adresse": w, "navn": ""})
    cfg["wallets"] = wallets
    cfg.setdefault("proxima", {}).setdefault("koebsgebyr", 0.05)
    cfg["proxima"].setdefault("salgsgebyr", 0.05)
    cfg["proxima"].setdefault("gebyr_wallets", [])
    cfg.setdefault("data_mappe", str(HER / "data"))
    if not wallets:
        sys.exit("Ingen wallets i config. Tilføj dine offentlige wallet-adresser under \"wallets\".")
    return cfg


def egne_adresser(cfg):
    return {w["adresse"] for w in cfg["wallets"]}


def hent(cfg):
    rpc = Rpc(rpc_url_fra_miljo(cfg), cfg["data_mappe"])
    alle_sigs = {}
    for i, w in enumerate(cfg["wallets"], 1):
        print(f"[{i}/{len(cfg['wallets'])}] {w['navn'] or w['adresse']}: henter signaturer")
        for s in rpc.signaturer(w["adresse"]):
            alle_sigs[s["signature"]] = s
    print(f"{len(alle_sigs)} unikke transaktioner i alt")
    return rpc.transaktioner(list(alle_sigs))


def indlaes_cache(cfg):
    rpc = Rpc(rpc_url_fra_miljo(cfg), cfg["data_mappe"])
    sigs = set()
    for w in cfg["wallets"]:
        sti = Path(cfg["data_mappe"]) / "sigs" / f"{w['adresse']}.json"
        if not sti.exists():
            sys.exit(f"Ingen data for {w['adresse']} endnu. Kør først: python regnskab.py hent")
        sigs |= {s["signature"] for s in json.loads(sti.read_text())}
    return rpc.transaktioner(sorted(sigs))


def klassificer_alle(txs, cfg):
    egne = egne_adresser(cfg)
    linjer, oprettet = [], set()
    for sig, tx in txs.items():
        if tx.get("blockTime") is None:
            continue
        linjer.extend(C.klassificer(sig, tx, egne, cfg))
        oprettet |= C.oprettede_mints(tx)
    return linjer, oprettet


def find_wallets(cfg, txs):
    """Adresser der har modtaget SOL fra dine wallets via system-transfer - kandidater til købs-wallets."""
    egne = egne_adresser(cfg)
    taeller, beloeb = Counter(), Counter()
    for tx in txs.values():
        if tx["meta"].get("err"):
            continue
        for ins in C._alle_instruktioner(tx):
            p = ins.get("parsed")
            if ins.get("program") == "system" and isinstance(p, dict) and p.get("type") == "transfer":
                info = p["info"]
                if info["source"] in egne and info["destination"] not in egne \
                        and info["destination"] not in C.JITO_TIP:
                    taeller[info["destination"]] += 1
                    beloeb[info["destination"]] += info["lamports"]
    ud = Path(cfg["data_mappe"]) / "wallet_kandidater.csv"
    with ud.open("w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["adresse", "antal_overfoersler", "sol_modtaget", "solscan"])
        for a, n in taeller.most_common():
            w.writerow([a, n, beloeb[a] / C.LAMPORTS, f"https://solscan.io/account/{a}"])
    print(f"{len(taeller)} kandidater skrevet til {ud}")
    print("Gennemgå listen – kun dine egne wallets må tilføjes til config (ikke børser eller andre personer).")


def rapport(cfg, txs, ud):
    fra = date.fromisoformat(cfg["periode"]["fra"])
    til = date.fromisoformat(cfg["periode"]["til"])
    linjer, oprettet = klassificer_alle(txs, cfg)
    if cfg.get("kurs_fil"):
        kurser = prices.laes_kurser(cfg["kurs_fil"])
    else:
        kurser = prices.hent_kurser(fra, til, Path(cfg["data_mappe"]) / "kurser.csv")
    navne = dict(cfg.get("navne", {}))
    navne.update({w["adresse"]: w["navn"] for w in cfg["wallets"] if w["navn"]})
    res = report.lav_rapport(linjer, fra, til, oprettet, kurser, navne, cfg, ud)
    print(f"Rapport gemt: {ud}")
    print(f"  {res['linjer']} linjer, {res['tokens']} tokens handlet ({res['egne_launches']} egne launches)")
    print(f"  Resultat: {res['resultat_sol']:,.4f} SOL = {res['resultat_dkk']:,.2f} DKK")
    if res["manglende_kurser"]:
        print(f"  ADVARSEL: {res['manglende_kurser']} dage uden SOL-kurs")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("kommando", choices=["hent", "find-wallets", "rapport", "alt"])
    ap.add_argument("--config", default=str(HER / "config.json"))
    ap.add_argument("--ud", help="Excel-fil (standard: regnskab_<fra>_<til>.xlsx)")
    a = ap.parse_args()
    cfg = laes_config(a.config)
    Path(cfg["data_mappe"]).mkdir(parents=True, exist_ok=True)
    ud = a.ud or str(HER / f"regnskab_{cfg['periode']['fra']}_{cfg['periode']['til']}.xlsx")

    if a.kommando == "hent":
        hent(cfg)
    elif a.kommando == "find-wallets":
        find_wallets(cfg, indlaes_cache(cfg))
    elif a.kommando == "rapport":
        rapport(cfg, indlaes_cache(cfg), ud)
    else:
        rapport(cfg, hent(cfg), ud)


if __name__ == "__main__":
    main()
