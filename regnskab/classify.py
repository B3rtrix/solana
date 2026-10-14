"""Gør rå Solana-transaktioner til bogføringslinjer for dine egne wallets.

Alt beregnes ud fra saldoændringer (pre/post balances) i hver transaktion, så det virker
uanset hvilken launchpad/DEX der er brugt. Beløb er i lamports (1 SOL = 1e9 lamports)
indtil de vises.
"""

from collections import defaultdict

LAMPORTS = 1_000_000_000
WSOL = "So11111111111111111111111111111111111111112"

# Jito tip-konti (bundles). SOL sendt hertil er en handelsomkostning, ikke en del af købet.
JITO_TIP = {
    "96gYZGLnJYVFmbjzopPSU6QiEV5fGqZNyN9nmNhvrZU5",
    "HFqU5x63VTqvQss8hp11i4wVV8bD44PvwucfZ2bU7gRe",
    "Cw8CFyM9FkoMi7K7Crf6HNQqf4uEMzpKw6QNghXLvLkY",
    "ADaUMid9yfUytqMBgopwjb2DTLSokTSzL1zt6iGPaS49",
    "DfXygSm4jCyNCybVYYK6DwvWqjKee8pbDmJGcLWNDXjh",
    "ADuUkR4vqLUMWXxW9gh6D6L8pMSawimctcNZ5pGwDcEt",
    "DttWaMuVvTiduZRnguLF7jNxTgiMBZ1hyAumKUiL2KRL",
    "3AVi9Tg9Uo68tJfuvoKvqKNWKkC5wPdSSdeBnizKZ6jT",
}

# Programmer hvor SOL ind uden token-handel tolkes som creator fee (indtægt)
CREATOR_FEE_PROGRAMMER = {
    "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P",  # pump.fun bonding curve
    "pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA",  # pump.fun AMM
}

# Typer
KOEB = "KØB"
SALG = "SALG"
CREATOR_FEE = "CREATOR FEE"
INTERN_SOL = "INTERN OVERFØRSEL (SOL)"
INTERN_TOKEN = "INTERN OVERFØRSEL (TOKEN)"
SOL_IND = "SOL IND (ekstern)"
SOL_UD = "SOL UD (ekstern)"
TOKEN_IND = "TOKEN IND (ekstern)"
TOKEN_UD = "TOKEN UD (ekstern)"
KUN_GEBYR = "KUN NETVÆRKSGEBYR"
FEJLET = "FEJLET TRANSAKTION"

GENNEMGANG = {SOL_IND, SOL_UD, TOKEN_IND, TOKEN_UD}

# Afrundingsstøj vi ignorerer (5000 lamports = 0.000005 SOL)
STOEJ = 5000


def _keys(tx):
    return [k["pubkey"] if isinstance(k, dict) else k for k in tx["transaction"]["message"]["accountKeys"]]


def _alle_instruktioner(tx):
    yield from tx["transaction"]["message"].get("instructions", [])
    for inner in tx["meta"].get("innerInstructions") or []:
        yield from inner.get("instructions", [])


def oprettede_mints(tx):
    """Mints der bliver oprettet (initializeMint) i transaktionen."""
    ud = set()
    for ins in _alle_instruktioner(tx):
        p = ins.get("parsed")
        if isinstance(p, dict) and p.get("type", "").startswith("initializeMint"):
            m = p.get("info", {}).get("mint")
            if m:
                ud.add(m)
    return ud


def _programmer(tx, keys):
    ud = set()
    for ins in _alle_instruktioner(tx):
        if "programId" in ins:
            ud.add(ins["programId"])
        elif "programIdIndex" in ins:
            ud.add(keys[ins["programIdIndex"]])
    return ud


def _fordel(total, vaegte):
    """Fordel et heltal proportionalt efter vægte (bevarer summen)."""
    s = sum(vaegte.values())
    if not s or not total:
        return {k: 0 for k in vaegte}
    ud, rest = {}, total
    keys = list(vaegte)
    for k in keys[:-1]:
        ud[k] = total * vaegte[k] // s
        rest -= ud[k]
    ud[keys[-1]] = rest
    return ud


def klassificer(sig, tx, egne, cfg):
    """Returnerer en liste af linjer (dicts) for egne wallets i én transaktion."""
    meta = tx["meta"]
    keys = _keys(tx)
    pre, post = meta["preBalances"], meta["postBalances"]
    ts = tx.get("blockTime")
    payer = keys[0]
    netvaerk = meta.get("fee", 0)

    basis = {"signatur": sig, "ts": ts}

    if meta.get("err"):
        if payer in egne:
            return [dict(basis, wallet=payer, type=FEJLET, mint=None, sol=0, token=0, decimals=0,
                         netvaerksgebyr=netvaerk, jito=0, rent=0, proxima_gebyr=0, gebyr_estimeret=False)]
        return []

    idx = {k: i for i, k in enumerate(keys)}

    # SOL-ændring per egen wallet (lamports)
    sol = {w: post[idx[w]] - pre[idx[w]] for w in egne if w in idx}

    # Token-ændringer per (ejer, mint), og rent for token-konti oprettet/lukket
    tok = defaultdict(int)
    decimals = {}
    rent = defaultdict(int)  # positiv = betalt depositum, negativ = fået depositum retur
    pre_tb = {(b["accountIndex"]): b for b in meta.get("preTokenBalances") or []}
    post_tb = {(b["accountIndex"]): b for b in meta.get("postTokenBalances") or []}
    for ai in set(pre_tb) | set(post_tb):
        b0, b1 = pre_tb.get(ai), post_tb.get(ai)
        ref = b1 or b0
        ejer, mint = ref.get("owner"), ref["mint"]
        if ejer not in egne:
            continue
        a0 = int(b0["uiTokenAmount"]["amount"]) if b0 else 0
        a1 = int(b1["uiTokenAmount"]["amount"]) if b1 else 0
        decimals[mint] = ref["uiTokenAmount"]["decimals"]
        if mint == WSOL:
            # Wrapped SOL tæller som SOL. Selve kontoens lamports ligger på token-kontoen.
            sol[ejer] = sol.get(ejer, 0) + (post[ai] - pre[ai])
        else:
            tok[(ejer, mint)] += a1 - a0
            if b0 is None and b1 is not None:
                rent[ejer] += post[ai] - pre[ai]
            elif b0 is not None and b1 is None:
                rent[ejer] -= pre[ai] - post[ai]

    # Netværksgebyr trækkes fra betaleren
    if payer in sol:
        sol[payer] += netvaerk

    # Jito tips og Proxima-gebyr-wallets: hvad de modtog i denne tx
    def modtaget(adresser):
        return sum(max(0, post[idx[a]] - pre[idx[a]]) for a in adresser if a in idx)

    jito_total = modtaget(JITO_TIP)
    proxima_wallets = set(cfg.get("proxima", {}).get("gebyr_wallets") or [])
    proxima_total = modtaget(proxima_wallets) if proxima_wallets else 0

    # Fjern rent fra handelsbeløbet
    for w, r in rent.items():
        sol[w] = sol.get(w, 0) + r

    # Jito tip tilskrives betaleren hvis egen, ellers de egne wallets der betaler SOL
    jito = defaultdict(int)
    if jito_total:
        if payer in egne:
            jito[payer] = jito_total
        else:
            betalere = {w: -v for w, v in sol.items() if v < 0}
            jito.update(_fordel(jito_total, betalere))
        for w, j in jito.items():
            sol[w] = sol.get(w, 0) + j

    mints_per_wallet = defaultdict(list)
    for (w, m), d in tok.items():
        if d:
            mints_per_wallet[w].append(m)

    programmer = _programmer(tx, keys)
    kb_rate = cfg.get("proxima", {}).get("koebsgebyr", 0.05)
    sg_rate = cfg.get("proxima", {}).get("salgsgebyr", 0.05)

    linjer = []
    netto_egne_sol = sum(v for w, v in sol.items() if not mints_per_wallet.get(w))

    for w in egne:
        if w not in idx and w not in rent and not mints_per_wallet.get(w):
            continue
        s = sol.get(w, 0)
        fee_w = netvaerk if w == payer else 0
        felles = dict(basis, wallet=w, netvaerksgebyr=fee_w, jito=jito.get(w, 0), rent=rent.get(w, 0),
                      proxima_gebyr=0, gebyr_estimeret=False)

        mints = mints_per_wallet.get(w, [])
        if mints:
            # SOL fordeles på mints hvis der er flere (sjældent) - markeres til gennemgang
            andel = _fordel(s, {m: abs(tok[(w, m)]) for m in mints}) if len(mints) > 1 else {mints[0]: s}
            for m in mints:
                d = tok[(w, m)]
                s_m = andel[m]
                if d > 0 and s_m < -STOEJ:
                    typ = KOEB
                elif d < 0 and s_m > STOEJ:
                    typ = SALG
                else:
                    modpart = any(tok.get((w2, m), 0) * d < 0 for w2 in egne if w2 != w)
                    if modpart:
                        typ = INTERN_TOKEN
                    else:
                        typ = TOKEN_IND if d > 0 else TOKEN_UD
                    s_m = 0 if abs(s_m) <= STOEJ else s_m
                linje = dict(felles, type=typ, mint=m, sol=s_m, token=d, decimals=decimals.get(m, 0),
                             flere_mints=len(mints) > 1)
                linjer.append(linje)
                felles = dict(felles, netvaerksgebyr=0, jito=0, rent=0)  # kun én gang per wallet
        else:
            if abs(s) <= STOEJ:
                if fee_w or rent.get(w) or jito.get(w):
                    linjer.append(dict(felles, type=KUN_GEBYR, mint=None, sol=0, token=0, decimals=0))
                continue
            if abs(netto_egne_sol) <= STOEJ * 2 and any(v * s < 0 for w2, v in sol.items() if w2 != w):
                typ = INTERN_SOL
            elif s > 0 and programmer & CREATOR_FEE_PROGRAMMER:
                typ = CREATOR_FEE
            else:
                typ = SOL_IND if s > 0 else SOL_UD
            linjer.append(dict(felles, type=typ, mint=None, sol=s, token=0, decimals=0))

    # Proxima-gebyr: præcist hvis gebyr-wallets er kendt, ellers estimeret ud fra satserne
    handler = [l for l in linjer if l["type"] in (KOEB, SALG)]
    if proxima_total and handler:
        fordeling = _fordel(proxima_total, {i: abs(l["sol"]) for i, l in enumerate(handler)})
        for i, l in enumerate(handler):
            l["proxima_gebyr"] = fordeling[i]
    else:
        for l in handler:
            if l["type"] == KOEB:
                # Betalt S inkl. gebyr: S = handel * (1 + r)  ->  gebyr = S * r / (1 + r)
                l["proxima_gebyr"] = round(-l["sol"] * kb_rate / (1 + kb_rate))
            else:
                # Modtaget R efter gebyr: R = handel * (1 - r)  ->  gebyr = R * r / (1 - r)
                l["proxima_gebyr"] = round(l["sol"] * sg_rate / (1 - sg_rate))
            l["gebyr_estimeret"] = True

    for l in linjer:
        l.setdefault("flere_mints", False)
    return linjer
