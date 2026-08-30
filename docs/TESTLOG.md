# TESTLOG

Every phase has three test layers — Automated, Manual, Claude-driven. A phase closes only on **PASS**
in all three. Format per the playbook D1 contract.

---

## Phase 1 — SYNC — 30 August 2026

### Automated

| Command | Result | Count |
|---|---|---|
| `npm test` | **PASS** | 45 passed, 0 failed (2 files) |
| `npm run build` | **PASS** | clean, 12/12 static pages, no type errors, middleware 49.1 kB |
| `grep -rnP "[\x{1F300}-\x{1FAFF}]"` over `*.ts *.tsx *.md *.css` | **PASS** | 0 files |
| DEC-002 widened glyph grep over `app components lib store types` | **PASS** | 0 glyphs-as-icons; 6 permitted `→` in comments/prose/error strings |

Breakdown of `npm test`:

```
✓ __tests__/cities.test.ts     (17 tests)
✓ __tests__/extractor.test.ts  (28 tests)
  Test Files  2 passed (2)
       Tests  45 passed (45)
```

`cities.test.ts` covers: exact `ZONE_CITIES` set equality; zone/other partition with no overlap;
Katni 83.4 km < 95; Sagar 146.8 km > 95; Narsinghpur 85.3 km with its margin asserted > 5 km;
haversine symmetry and self-distance; breach predicate over every city, case-insensitive, non-throwing
on unknown input; **INV-2 — the national gazetteer can never trigger a breach** (six cities checked);
core ring strictly tighter than the zone ring; gazetteer uniqueness and MP coordinate bounds.

`extractor.test.ts` covers: BTC bech32 / legacy P2PKH / ETH extraction, plus negative cases (short hex,
wrong-length ETH, invalid base58); dedup; contraband substring suppression in both directions
(`pistol parts` suppresses `pistol`, but bare `aadhaar` still reports when alone); word-boundary city
matching (`Katnipur` must not match `Katni`); handle extraction; total-function behaviour on empty,
whitespace, regex-hostile and 10k-character input; **INV-3 — `analyze()` never throws, and reports the
engine that actually ran** including the invalid-key fallback path.

### Manual

**Not yet run.** Requires a second person per the tester rule (a teammate who did not write the phase,
starting from a fresh clone, reading only `README.md`).

Checklist to execute — playbook Part D2, Phase 1:

- [ ] `docs/AUDIT_V1.md` lists every file in `lib/`, `store/`, `app/api/`, `components/dashboard/` — spot-check five at random
- [ ] `docs/ARCHITECTURE.md` diagram matches the six stages in the blueprint
- [ ] `PROGRESS.md` shows Phase 2 as Current
- [ ] `npm test` passes; `__tests__/cities.test.ts` asserts Katni < 95 km and Sagar > 95 km
- [ ] Search the UI for any emoji at 1440 px — feed cards, entity chips, modals, README badges
- [ ] v1 demo journey still fires the Jabalpur breach at ~6 s and Katni at ~15 s

### Claude

**Not yet run.** D3.1 with N = 1, in a fresh session with repo access, Part A pasted first.
Must return PASS.

### Verdict

**PASS (automated layer only) — phase NOT yet closed.**

The automated layer is green and the acceptance criteria are objectively met: six docs exist and are
cross-consistent, `npm test` and `npm run build` pass, both emoji greps are clean, and `PROGRESS.md`
names Phase 2 as Current. Per the D1 contract a phase may only close once all three layers pass, so
Phase 1 stays open pending the manual and Claude layers.

Phase 2 work may begin on the author's judgement, but Phase 1 is not marked closed in `PROGRESS.md`
until the two outstanding layers are logged here.

### Notes carried forward

- Three playbook corrections found by audit — DEC-003 (naive baseline is noisy-OR, not LR-product),
  FINDING-01 (stale emoji debt item), FINDING-02 (two `document.write` sites, not one). All recorded.
- Four open blockers (B-01 Docker, B-02 Foundry, B-03 Shodan free tier, B-04 manual dataset downloads).
  None resolved by substituting a paid service.
