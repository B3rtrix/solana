"""Henter transaktioner fra en almindelig Solana JSON-RPC (fx Helius) og cacher dem på disk."""

import json
import os
import time
from pathlib import Path

import requests


def rpc_url_fra_miljo(config):
    url = os.environ.get("RPC_URL") or config.get("rpc_url")
    if url:
        return url
    key = os.environ.get("HELIUS_API_KEY")
    if key:
        return f"https://mainnet.helius-rpc.com/?api-key={key}"
    return "https://api.mainnet-beta.solana.com"


class Rpc:
    def __init__(self, url, cache_dir):
        self.url = url
        self.cache = Path(cache_dir)
        (self.cache / "tx").mkdir(parents=True, exist_ok=True)
        (self.cache / "sigs").mkdir(parents=True, exist_ok=True)
        self.session = requests.Session()

    def _post(self, payload):
        delay = 1.0
        for forsoeg in range(8):
            try:
                r = self.session.post(self.url, json=payload, timeout=60)
                if r.status_code == 429 or r.status_code >= 500:
                    raise requests.HTTPError(f"HTTP {r.status_code}")
                r.raise_for_status()
                return r.json()
            except (requests.RequestException, ValueError) as e:
                if forsoeg == 7:
                    raise
                print(f"  RPC-fejl ({e}), prøver igen om {delay:.0f}s")
                time.sleep(delay)
                delay = min(delay * 2, 30)

    def _call(self, method, params):
        res = self._post({"jsonrpc": "2.0", "id": 1, "method": method, "params": params})
        if "error" in res:
            raise RuntimeError(f"{method}: {res['error']}")
        return res["result"]

    def signaturer(self, adresse, fra_ts=None):
        """Alle signaturer for en adresse (nyeste først), stopper ved fra_ts."""
        sti = self.cache / "sigs" / f"{adresse}.json"
        kendte = json.loads(sti.read_text()) if sti.exists() else []
        kendte_set = {s["signature"] for s in kendte}

        # Hent nye signaturer ovenfra indtil vi rammer en vi kender
        nye, before = [], None
        while True:
            params = {"limit": 1000}
            if before:
                params["before"] = before
            side = self._call("getSignaturesForAddress", [adresse, params])
            if not side:
                break
            stop = False
            for s in side:
                if s["signature"] in kendte_set:
                    stop = True
                    break
                nye.append(s)
            if stop or len(side) < 1000:
                break
            if fra_ts and side[-1].get("blockTime") and side[-1]["blockTime"] < fra_ts:
                break
            before = side[-1]["signature"]

        # Hvis cachen ikke gik langt nok tilbage, fortsæt nedad fra den ældste
        alle = nye + kendte
        while alle and not (fra_ts and alle[-1].get("blockTime") and alle[-1]["blockTime"] < fra_ts):
            side = self._call("getSignaturesForAddress", [adresse, {"limit": 1000, "before": alle[-1]["signature"]}])
            alle.extend(side)
            if len(side) < 1000:
                break

        sti.write_text(json.dumps(alle))
        return alle

    def transaktioner(self, signaturer, batch=50):
        """Henter transaktioner (jsonParsed), bruger cache. Returnerer dict sig -> tx."""
        ud, mangler = {}, []
        for sig in signaturer:
            sti = self.cache / "tx" / f"{sig}.json"
            if sti.exists():
                ud[sig] = json.loads(sti.read_text())
            else:
                mangler.append(sig)
        for i in range(0, len(mangler), batch):
            bid = mangler[i:i + batch]
            payload = [
                {"jsonrpc": "2.0", "id": n, "method": "getTransaction",
                 "params": [sig, {"encoding": "jsonParsed", "maxSupportedTransactionVersion": 0,
                                  "commitment": "confirmed"}]}
                for n, sig in enumerate(bid)
            ]
            svar = self._post(payload)
            if isinstance(svar, dict):  # nogle RPC'er understøtter ikke batch
                svar = [self._post(p) for p in payload]
            for s in svar:
                sig = bid[s["id"]]
                tx = s.get("result")
                if tx is None:
                    continue
                (self.cache / "tx" / f"{sig}.json").write_text(json.dumps(tx))
                ud[sig] = tx
            print(f"  hentet {min(i + batch, len(mangler))}/{len(mangler)} transaktioner")
        return ud
