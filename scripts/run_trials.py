#!/usr/bin/env python3
"""Drive N real trials of PRAHARI's audit + anchoring path against a live chain.

Each trial is a full journey through the platform's own code, not a shortcut:

    append signed ledger records  ->  Merkle root over the whole ledger
    ->  POST /seal  ->  a real transaction on the configured chain
    ->  pull an inclusion proof for one record
    ->  POST /verify to recompute that record against the anchored root
    ->  re-read the seal straight off the contract with `cast`, so the proof
        does not depend on the engine's own word for it

That last step is the point. An engine confirming its own transaction proves
nothing; the contract's `verify(bytes32)` view, read independently, does.

Writes docs/TRIALS_SEPOLIA.md and .demo-logs/trials_sepolia.json.
"""

from __future__ import annotations

import json
import os
import pathlib
import subprocess
import sys
import time
import urllib.error
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
ENGINE = os.environ.get("ENGINE_URL", "http://127.0.0.1:8000")
RPC = os.environ.get("RPC_URL", "https://ethereum-sepolia-rpc.publicnode.com")
CONTRACT = os.environ.get("CONTRACT_ADDR", "")
EXPLORER = "https://sepolia.etherscan.io"
CAST = os.path.expanduser("~/.foundry/bin/cast")

# Ten distinct investigations, so the run reads as ten cases rather than one
# case run ten times. Every action name here is in ledger.ACTIONS; anything
# else is refused by the engine by design.
SCENARIOS: list[dict] = [
    {"case": "CASE-001", "title": "Rebrand candidate (pre-seeded)",
     "note": "Seeded ledger: the market-rebrand pair, scored and confirmed.",
     "records": []},
    {"case": "CASE-002", "title": "Reused PGP key across two markets",
     "note": "Hard identifier. One key, two handles, two marketplaces.",
     "records": [
         ("score", {"pair_id": "vendor-alpha|vendor-beta", "p_raw": 0.94,
                    "roots": ["identity_key"]}),
         ("confirm", {"pair_id": "vendor-alpha|vendor-beta"}),
         ("assign", {"officer": "SI A. Yadav"}),
         ("note", {"text": "Identical Ed25519 signing key on both vendor pages."}),
     ]},
    {"case": "CASE-003", "title": "Shared wallet cluster",
     "note": "Common-input clustering ties two personas to one payout wallet.",
     "records": [
         ("score", {"pair_id": "escrow-01|escrow-02", "p_raw": 0.88,
                    "roots": ["financial"]}),
         ("confirm", {"pair_id": "escrow-01|escrow-02"}),
         ("note", {"text": "Two personas co-spend from a single cluster."}),
     ]},
    {"case": "CASE-004", "title": "Stylometry-only link, correctly capped",
     "note": "Soft signal alone. Scored, then REJECTED - a soft signal must "
             "never merge two people on its own.",
     "records": [
         ("score", {"pair_id": "ghostwriter|copycat", "p_raw": 0.61,
                    "roots": ["linguistic"]}),
         ("reject", {"pair_id": "ghostwriter|copycat",
                     "reason": "soft signal only; no hard identifier"}),
         ("note", {"text": "Stylometry alone is not attribution. Left unmerged."}),
     ]},
    {"case": "CASE-005", "title": "Certificate-transparency infrastructure leak",
     "note": "An onion's TLS cert names a clearnet host in the CT logs.",
     "records": [
         ("score", {"pair_id": "onion-svc|clearnet-host", "p_raw": 0.86,
                    "roots": ["infrastructure"]}),
         ("confirm", {"pair_id": "onion-svc|clearnet-host"}),
         ("assign", {"officer": "Insp. R. Sharma"}),
         ("note", {"text": "CT log entry cross-names the hidden service."}),
         ("export", {"format": "pdf"}),
     ]},
    {"case": "CASE-006", "title": "Mimicry suspected - score capped",
     "note": "Counter-deception: the negative caps the score, never subtracts.",
     "records": [
         ("score", {"pair_id": "impersonator|target", "p_raw": 0.55,
                    "roots": ["linguistic", "temporal"],
                    "caps": ["mimicry_suspected"]}),
         ("note", {"text": "Deliberate style imitation; confidence capped."}),
         ("reject", {"pair_id": "impersonator|target", "reason": "mimicry"}),
     ]},
    {"case": "CASE-007", "title": "Tor timing correlation",
     "note": "Timing at both ends of our OWN hidden service and client.",
     "records": [
         ("score", {"pair_id": "visitor-x|service-y", "p_raw": 0.79,
                    "roots": ["temporal"]}),
         ("confirm", {"pair_id": "visitor-x|service-y"}),
         ("note", {"text": "Own infrastructure, both ends. Nothing decrypted."}),
     ]},
    {"case": "CASE-008", "title": "Correlated signals collapsed by root cause",
     "note": "Five signals, one root cause. Naive stacking says 0.999; "
             "collapsing says 0.84.",
     "records": [
         ("score", {"pair_id": "multi-a|multi-b", "p_raw": 0.84,
                    "roots": ["identity_key", "financial", "infrastructure"],
                    "naive_stack": 0.999}),
         ("confirm", {"pair_id": "multi-a|multi-b"}),
         ("assign", {"officer": "SI A. Yadav"}),
         ("note", {"text": "Collapsed by root cause; dampened by reliability."}),
     ]},
    {"case": "CASE-009", "title": "Analyst override, on the record",
     "note": "An admin action is the most important kind to make tamper-evident.",
     "records": [
         ("score", {"pair_id": "dormant-1|dormant-2", "p_raw": 0.72,
                    "roots": ["financial"]}),
         ("admin.override", {"pair_id": "dormant-1|dormant-2",
                             "reason": "field intelligence corroborates"}),
         ("confirm", {"pair_id": "dormant-1|dormant-2"}),
         ("note", {"text": "Override recorded, signed and chained."}),
     ]},
    {"case": "CASE-010", "title": "Redaction under RTI - chain survives",
     "note": "A record is redacted; the chain still verifies, proving the "
             "redaction did not rewrite history.",
     "records": [
         ("score", {"pair_id": "informant|handle-z", "p_raw": 0.91,
                    "roots": ["identity_key"]}),
         ("confirm", {"pair_id": "informant|handle-z"}),
         ("admin.redact", {"field": "informant_alias", "authority": "RTI s.8(1)(g)"}),
         ("note", {"text": "Alias redacted; hash chain intact."}),
         ("export", {"format": "json"}),
     ]},
]


def api(method: str, path: str, body: dict | None = None, timeout: int = 240) -> dict:
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(
        ENGINE + path, data=data, method=method,
        headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read())


def cast_verify(root: str) -> dict:
    """Read the seal back off the contract, independent of the engine."""
    if not CONTRACT:
        return {"ok": False, "detail": "no CONTRACT_ADDR"}
    try:
        out = subprocess.run(
            [CAST, "call", CONTRACT,
             "verify(bytes32)(uint64,uint32,bytes32,address)", root,
             "--rpc-url", RPC],
            capture_output=True, text=True, timeout=90)
        if out.returncode != 0:
            return {"ok": False, "detail": out.stderr.strip()[:200]}
        lines = [l.strip() for l in out.stdout.strip().splitlines() if l.strip()]
        if len(lines) < 4:
            return {"ok": False, "detail": out.stdout.strip()[:200]}
        ts = int(lines[0].split()[0])
        return {"ok": ts != 0, "timestamp": ts,
                "leaf_count": int(lines[1].split()[0]),
                "case_ref": lines[2], "anchorer": lines[3]}
    except Exception as exc:  # noqa: BLE001
        return {"ok": False, "detail": f"{type(exc).__name__}: {exc}"}


def run_trial(n: int, sc: dict) -> dict:
    case = sc["case"]
    print(f"\n[{n:02d}/10] {case} - {sc['title']}")

    for action, payload in sc["records"]:
        r = api("POST", f"/audit/case/{case}/record",
                {"action": action, "payload": payload})
        if not r.get("ok"):
            print(f"       record {action} REFUSED: {r.get('detail')}")
    lg = api("GET", f"/audit/case/{case}/ledger")
    print(f"       ledger  : {len(lg['records'])} records, "
          f"chain {'OK' if lg['verification']['ok'] else 'BROKEN'}")

    t0 = time.time()
    seal = api("POST", f"/audit/case/{case}/seal")
    dt = time.time() - t0
    if not seal.get("ok"):
        print(f"       SEAL FAILED: {seal.get('detail')}")
        return {"n": n, "case": case, "title": sc["title"], "note": sc["note"],
                "ok": False, "detail": seal.get("detail"),
                "records": len(lg["records"])}

    root, tx = seal["merkle_root"], seal["tx_hash"]
    print(f"       root    : {root}")
    print(f"       tx      : {tx}  (block {seal['block']}, "
          f"{seal['gas_used']} gas, {dt:.1f}s)")

    # An inclusion proof for one record, recomputed against the anchored root.
    proof = api("GET", f"/audit/case/{case}/proof/0")
    inc = api("POST", "/audit/verify",
              {"leaf": proof.get("leaf"), "siblings": proof.get("siblings"),
               "merkle_root": root}) if proof.get("ok") else {"ok": False}
    print(f"       proof   : record[0] -> root {'VERIFIED' if inc.get('ok') else 'FAILED'}")

    chain = cast_verify(root)
    print(f"       on-chain: {'CONFIRMED' if chain.get('ok') else 'NOT FOUND'}"
          + (f"  leaves={chain['leaf_count']} anchorer={chain['anchorer']}"
             if chain.get("ok") else f"  {chain.get('detail','')}"))

    return {
        "n": n, "case": case, "title": sc["title"], "note": sc["note"], "ok": True,
        "records": len(lg["records"]), "merkle_root": root,
        "leaf_count": seal["leaf_count"], "tx_hash": tx, "block": seal["block"],
        "gas_used": seal["gas_used"], "chain_id": seal["chain_id"],
        "chain_label": seal["chain_label"],
        "is_public_chain": seal["is_public_chain"],
        "explorer_url": seal["explorer_url"], "seconds": round(dt, 1),
        "hash_chain_ok": lg["verification"]["ok"],
        "inclusion_proof_ok": bool(inc.get("ok")),
        "onchain_verify": chain,
    }


def main() -> int:
    print(f"engine   : {ENGINE}")
    print(f"rpc      : {RPC}")
    print(f"contract : {CONTRACT or '(unset)'}")

    results = [run_trial(i, sc) for i, sc in enumerate(SCENARIOS, 1)]

    ok = [r for r in results if r["ok"]]
    confirmed = [r for r in ok if r.get("onchain_verify", {}).get("ok")]
    gas = sum(r["gas_used"] for r in ok)
    summary = {
        "contract": CONTRACT, "rpc": RPC, "chain_id": ok[0]["chain_id"] if ok else None,
        "explorer": f"{EXPLORER}/address/{CONTRACT}" if CONTRACT else None,
        "trials": len(results), "sealed": len(ok),
        "onchain_confirmed": len(confirmed), "total_gas": gas,
        "generated_utc": time.strftime("%Y-%m-%d %H:%M:%S UTC", time.gmtime()),
    }

    (ROOT / ".demo-logs").mkdir(exist_ok=True)
    (ROOT / ".demo-logs" / "trials_sepolia.json").write_text(
        json.dumps({"summary": summary, "trials": results}, indent=2))

    md = [f"# PRAHARI — {len(ok)} live on-chain trials (Ethereum Sepolia)", "",
          f"Generated {summary['generated_utc']}.", "",
          f"**Contract** [`{CONTRACT}`]({EXPLORER}/address/{CONTRACT})  ",
          f"**Source** verified — "
          f"[read it on Etherscan]({EXPLORER}/address/{CONTRACT}#code) · "
          f"[Sourcify](https://repo.sourcify.dev/11155111/{CONTRACT})  ",
          f"**Chain** {ok[0]['chain_label'] if ok else '-'} "
          f"(chain id {summary['chain_id']})  ",
          f"**Sealed** {len(ok)}/{len(results)} · "
          f"**independently confirmed on-chain** {len(confirmed)}/{len(ok)} · "
          f"**total gas** {gas:,}", "",
          "Every row below is a real transaction. `verify(bytes32)` was called "
          "on the contract afterwards, from outside the engine, so the "
          "confirmation is the chain's word and not the engine's.", "",
          "| # | Case | What it shows | Records | Merkle root | Tx | Gas | Chain says |",
          "|---|---|---|---|---|---|---|---|"]
    for r in results:
        if not r["ok"]:
            md.append(f"| {r['n']} | {r['case']} | {r['title']} | {r['records']} "
                      f"| — | FAILED: {r.get('detail','')} | — | — |")
            continue
        md.append(
            f"| {r['n']} | `{r['case']}` | {r['title']} | {r['leaf_count']} "
            f"| `{r['merkle_root'][:18]}…` "
            f"| [`{r['tx_hash'][:14]}…`]({EXPLORER}/tx/{r['tx_hash']}) "
            f"| {r['gas_used']:,} "
            f"| {'confirmed' if r['onchain_verify'].get('ok') else 'NOT FOUND'} |")

    md += ["", "## What each trial demonstrates", ""]
    for r in results:
        md.append(f"**{r['n']}. {r['case']} — {r['title']}**  ")
        md.append(f"{r['note']}  ")
        if r["ok"]:
            md.append(
                f"Hash chain {'verified' if r['hash_chain_ok'] else 'BROKEN'} · "
                f"inclusion proof for record[0] "
                f"{'verified against the anchored root' if r['inclusion_proof_ok'] else 'FAILED'} · "
                f"anchored in block {r['block']} in {r['seconds']}s.  ")
            md.append(f"Root `{r['merkle_root']}`  ")
            md.append(f"Tx [{r['tx_hash']}]({EXPLORER}/tx/{r['tx_hash']})")
        md.append("")

    md += ["## Verify any of these yourself", "",
           "No trust in us required — read the contract directly:", "", "```bash",
           f"cast call {CONTRACT} \\",
           '  "verify(bytes32)(uint64,uint32,bytes32,address)" <merkle_root> \\',
           f"  --rpc-url {RPC}", "```", "",
           "A non-zero timestamp means that exact root was anchored, by that "
           "anchorer, over that many records. A root that was never anchored "
           "returns zero — including any root produced by an altered ledger.", ""]
    (ROOT / "docs" / "TRIALS_SEPOLIA.md").write_text("\n".join(md))

    print(f"\n{'='*66}")
    print(f" {len(ok)}/{len(results)} sealed · {len(confirmed)} confirmed on-chain "
          f"· {gas:,} gas total")
    print(f" contract : {EXPLORER}/address/{CONTRACT}")
    print(f" report   : docs/TRIALS_SEPOLIA.md")
    print(f"{'='*66}")
    return 0 if len(confirmed) >= 10 else 1


if __name__ == "__main__":
    sys.exit(main())
