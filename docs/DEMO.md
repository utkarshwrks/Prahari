# PRAHARI v2 — Demo Script (~5 minutes)

Local: `./scripts/demo.sh` (engine :8000, web :3000), or deploy per DEPLOYMENT.md.
Sign in at http://localhost:3000 with the pre-filled `analyst@prahari.local` /
`prahari123`.

## 1. The pitch (30s)
"Threat actors wear many masks on the dark web. PRAHARI links those masks into
one actor from PUBLIC footprints, and says how sure it is — with a published
error rate and a record nobody can quietly edit. We never break Tor."

## 2. The actor list (30s)
Point at the confidence bands. "Sorted by how strong the case is. Let's open the
strongest."

## 3. The relationship graph (60s)
"Colour is the entity type, size is importance, edge thickness is evidence
strength. The shared PGP key and wallet pull these personas into one actor —
while this decoy, sharing nothing hard, drifts to the rim." Hover a node; click
one for the detail card. Press **maximise** for the fullscreen holo view.

## 4. The evidence trail (60s)
"Here is the whole argument, shown. Naive stacking says 0.999 — false certainty.
We collapse correlated signals by root cause and dampen by reliability. The
honest answer is 0.84 — the number that survives cross-examination. And the trail
recomputes the score exactly."

## 5. Live Tor timing (45s)
Open the Tor timing tab, press **Run**. "This is a real Tor circuit to our own
hidden service. In ~30–40s the timing at both ends lines up — proving timing
alone links a visitor to a service, without decrypting anything."

## 6. Chain flow + ledger (45s)
Chain flow: "Wallet clustering follows the money to a real-world off-ramp; a
mixer in the path drops the signal." Ledger: "Every action is hashed, chained,
signed, and the case Merkle root is anchored on-chain — verifiable, tamper-
evident, zero-gas."

## 7. The report (20s)
Actor profile → **Preview → Download**: a one-page PDF attribution report.

## 8. Close (20s)
"Calibrated confidence, a published false-merge rate, and a record you can prove.
₹0 to run, on-premise, open source. Reload the page — it even regenerates its
look each time, same data."
