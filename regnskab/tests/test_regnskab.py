"""Tests med opdigtede transaktioner i samme format som Solana RPC (jsonParsed)."""

import sys
import tempfile
import unittest
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import classify as C  # noqa: E402
import report  # noqa: E402

L = C.LAMPORTS
DEV, B1, B2 = "Dev1111111111111111111111111111111111111111", "Buy1111111111111111111111111111111111111111", \
    "Buy2222222222222222222222222222222222222222"
EKSTERN = "Ext1111111111111111111111111111111111111111"
CURVE = "Curve11111111111111111111111111111111111111"
MINT = "Mint11111111111111111111111111111111111111"
ATA = "Ata1111111111111111111111111111111111111111"
PUMP = "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P"
JITO = "96gYZGLnJYVFmbjzopPSU6QiEV5fGqZNyN9nmNhvrZU5"
RENT = 2_039_280
FEE = 5000
TS = 1_735_725_600  # 2025-01-01 10:00 UTC
CFG = {"proxima": {"koebsgebyr": 0.05, "salgsgebyr": 0.05, "gebyr_wallets": []}}


def tx(konti, token=None, ins=None, err=None, fee=FEE, ts=TS):
    """konti: [(adresse, pre, post)], første er betaler. token: [(kontoindeks, ejer, mint, pre, post)]."""
    pre_tb, post_tb = [], []
    for ai, ejer, mint, a0, a1 in token or []:
        def tb(a):
            return {"accountIndex": ai, "mint": mint, "owner": ejer,
                    "uiTokenAmount": {"amount": str(a), "decimals": 6}}
        if a0 is not None:
            pre_tb.append(tb(a0))
        if a1 is not None:
            post_tb.append(tb(a1))
    return {
        "blockTime": ts,
        "meta": {"err": err, "fee": fee, "preBalances": [k[1] for k in konti], "postBalances": [k[2] for k in konti],
                 "preTokenBalances": pre_tb, "postTokenBalances": post_tb, "innerInstructions": []},
        "transaction": {"message": {"accountKeys": [{"pubkey": k[0]} for k in konti], "instructions": ins or []}},
    }


def koeb(wallet, betalt, tokens, ts=TS, jito=0, mint_init=False):
    ins = [{"programId": PUMP}]
    if mint_init:
        ins.append({"program": "spl-token", "parsed": {"type": "initializeMint2", "info": {"mint": MINT}}})
    w0 = 100 * L
    return tx([(wallet, w0, w0 - betalt - RENT - FEE - jito), (ATA + wallet[:3], 0, RENT),
               (CURVE, 50 * L, 50 * L + betalt), (JITO, 0, jito)],
              token=[(1, wallet, MINT, None, tokens)], ins=ins, ts=ts)


def salg(wallet, modtaget, tokens, ts=TS):
    w0 = 100 * L
    return tx([(wallet, w0, w0 + modtaget + RENT - FEE), (ATA + wallet[:3], RENT, 0),
               (CURVE, 50 * L, 50 * L - modtaget)],
              token=[(1, wallet, MINT, tokens, None)], ins=[{"programId": PUMP}], ts=ts)


class TestKlassificer(unittest.TestCase):
    egne = {DEV, B1, B2}

    def k(self, t):
        return C.klassificer("sig", t, self.egne, CFG)

    def test_koeb_trakker_rent_og_netvaerksgebyr_fra(self):
        [l] = self.k(koeb(B1, int(1.05 * L), 1_000_000))
        self.assertEqual(l["type"], C.KOEB)
        self.assertEqual(l["sol"], -int(1.05 * L))
        self.assertEqual(l["rent"], RENT)
        self.assertEqual(l["netvaerksgebyr"], FEE)
        self.assertEqual(l["proxima_gebyr"], round(1.05 * L * 0.05 / 1.05))  # 0.05 SOL
        self.assertTrue(l["gebyr_estimeret"])

    def test_salg_med_lukket_konto(self):
        [l] = self.k(salg(B1, int(0.95 * L), 1_000_000))
        self.assertEqual(l["type"], C.SALG)
        self.assertEqual(l["sol"], int(0.95 * L))
        self.assertEqual(l["rent"], -RENT)
        self.assertEqual(l["proxima_gebyr"], round(0.95 * L * 0.05 / 0.95))  # 0.05 SOL

    def test_jito_tip_er_separat(self):
        [l] = self.k(koeb(B2, L, 500, jito=1_000_000))
        self.assertEqual(l["sol"], -L)
        self.assertEqual(l["jito"], 1_000_000)

    def test_intern_overfoersel(self):
        linjer = self.k(tx([(DEV, 10 * L, 8 * L - FEE), (B2, 0, 2 * L)]))
        self.assertEqual({l["type"] for l in linjer}, {C.INTERN_SOL})
        self.assertEqual(sum(l["sol"] for l in linjer), 0)

    def test_ekstern_indskud(self):
        [l] = self.k(tx([(EKSTERN, 50 * L, 40 * L - FEE), (DEV, 0, 10 * L)]))
        self.assertEqual(l["type"], C.SOL_IND)
        self.assertEqual(l["netvaerksgebyr"], 0)  # betalt af ekstern

    def test_creator_fee(self):
        [l] = self.k(tx([(DEV, L, L + 300_000_000 - FEE), (CURVE, 5 * L, 5 * L - 300_000_000)],
                        ins=[{"programId": PUMP}]))
        self.assertEqual(l["type"], C.CREATOR_FEE)
        self.assertEqual(l["sol"], 300_000_000)

    def test_fejlet_transaktion_koster_kun_gebyr(self):
        [l] = self.k(tx([(B1, L, L - FEE)], err={"InstructionError": [0, "Custom"]}))
        self.assertEqual(l["type"], C.FEJLET)
        self.assertEqual(l["netvaerksgebyr"], FEE)

    def test_praecist_proxima_gebyr_fra_gebyr_wallet(self):
        cfg = {"proxima": {"koebsgebyr": 0.05, "salgsgebyr": 0.05, "gebyr_wallets": ["ProximaFee"]}}
        w0 = 100 * L
        t = tx([(B1, w0, w0 - L - RENT - FEE), (ATA, 0, RENT), (CURVE, 0, 950_000_000), ("ProximaFee", 0, 50_000_000)],
               token=[(1, B1, MINT, None, 10)])
        [l] = C.klassificer("s", t, self.egne, cfg)
        self.assertEqual(l["proxima_gebyr"], 50_000_000)
        self.assertFalse(l["gebyr_estimeret"])

    def test_oprettet_mint(self):
        self.assertEqual(C.oprettede_mints(koeb(DEV, L, 10, mint_init=True)), {MINT})


class TestRapport(unittest.TestCase):
    def test_hel_launch(self):
        txs = {
            "a": koeb(DEV, int(1.05 * L), 2_000_000, ts=TS, mint_init=True),
            "b": koeb(B1, int(0.525 * L), 1_000_000, ts=TS + 10),
            "c": salg(DEV, int(1.9 * L), 2_000_000, ts=TS + 600),
            "d": salg(B1, int(0.95 * L), 1_000_000, ts=TS + 610),
        }
        egne = {DEV, B1}
        linjer, oprettet = [], set()
        for sig, t in txs.items():
            linjer += C.klassificer(sig, t, egne, CFG)
            oprettet |= C.oprettede_mints(t)
        kurser = {date(2025, 1, 1): (200.0, 7.0, 1400.0)}
        with tempfile.TemporaryDirectory() as d:
            res = report.lav_rapport(linjer, date(2025, 1, 1), date(2025, 12, 31), oprettet, kurser, {}, CFG,
                                     Path(d) / "r.xlsx")
        handel = (1.9 + 0.95) - (1.05 + 0.525)
        self.assertAlmostEqual(res["resultat_sol"], handel - 4 * FEE / L, places=9)
        self.assertAlmostEqual(res["resultat_dkk"], res["resultat_sol"] * 1400, places=4)
        self.assertEqual(res["egne_launches"], 1)


if __name__ == "__main__":
    unittest.main()
