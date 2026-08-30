"use client";

import { useCallback, useEffect, useState } from "react";
import { Link2, Lock, ShieldCheck, ShieldX, Upload } from "lucide-react";
import { toast } from "sonner";
import { api, type Ledger, type SealResult } from "@/lib/api";
import Panel from "../ui/Panel";

/**
 * Chain of custody: hash chain, seal, verify.
 *
 * The chain label is rendered from what the engine reports, and the engine
 * derives it from the chain id it actually connected to. When there is no
 * public anchor there is no link, and the panel SAYS SO — silence there would
 * let a viewer assume a local seal was public.
 */

const short = (h?: string | null) =>
  !h ? "—" : h.length > 20 ? `${h.slice(0, 10)}…${h.slice(-6)}` : h;

export default function AuditPanel({ caseId = "CASE-001" }: { caseId?: string }) {
  const [d, setD] = useState<Ledger | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [verdict, setVerdict] = useState<{ ok: boolean; index: number | null; reason: string } | null>(null);

  const load = useCallback(async () => {
    const r = await api.ledger(caseId);
    if ("engine" in r && r.engine === "offline") setErr(r.detail ?? "Engine offline.");
    else if ("ok" in r && r.ok) { setD(r as Ledger); setErr(null); }
    else setErr((r as Ledger).detail ?? "No ledger.");
  }, [caseId]);

  useEffect(() => { load(); }, [load]);

  async function seal() {
    setBusy(true);
    const r = (await api.seal(caseId)) as SealResult;
    if (r.ok) { toast.success(`Sealed on ${r.chain_label} at block ${r.block}`); await load(); }
    else toast.error(r.detail ?? "Sealing failed.");
    setBusy(false);
  }

  async function verifyFile(file: File) {
    setBusy(true);
    try {
      const parsed = JSON.parse(await file.text());
      const r = await api.verify({
        records: parsed.records,
        merkle_root: parsed.sealed_root ?? parsed.merkle_root,
      });
      setVerdict({
        ok: Boolean(r.ok),
        index: ("failing_index" in r ? r.failing_index : null) ?? null,
        reason: ("reason" in r ? r.reason : null) ?? (r.ok ? "Chain intact and root matches." : "Verification failed."),
      });
    } catch {
      setVerdict({ ok: false, index: null, reason: "That file is not a PRAHARI case export." });
    }
    setBusy(false);
  }

  const s = d?.seal;
  const local = s && s.is_public_chain === false;

  return (
    <Panel title="Chain of custody" marked className="h-full" bodyClassName="min-h-0">
      <div className="slim h-full overflow-y-auto p-3">
        {err && <p className="mono text-[10px] text-[var(--muted)]">{err}</p>}

        {d && (
          <div className="space-y-2">
            <div className="mono flex items-center justify-between text-[10px]">
              <span className="text-[var(--muted)]">{d.case_id}</span>
              <span className={d.verification.ok ? "text-[var(--ok)]" : "text-[var(--c-high)]"}>
                {d.verification.ok
                  ? `chain intact · ${(d.verification.checks as { signatures_verified?: number }).signatures_verified ?? 0} signed`
                  : `broken at ${d.verification.failing_index}`}
              </span>
            </div>

            <ul className="space-y-1">
              {d.records.map((r) => (
                <li key={r.seq} className="border border-[var(--border)] bg-[var(--surface-2)] px-2 py-1.5">
                  <div className="mono flex items-center justify-between text-[10px]">
                    <span className="text-[var(--text)]">[{r.seq}] {r.action}</span>
                    <span className="text-[var(--muted-2)]">{r.signature ? "signed" : "unsigned"}</span>
                  </div>
                  <div className="mono mt-0.5 flex items-center gap-1 text-[9px] text-[var(--muted-2)]">
                    <Link2 className="h-2.5 w-2.5 shrink-0" />
                    prev {short(r.prev_hash)}
                  </div>
                  <div className="mono text-[9px] text-[var(--muted-2)]">hash {short(r.hash)}</div>
                </li>
              ))}
            </ul>

            <dl className="mono border-t border-[var(--border)] pt-2 text-[10px]">
              <div className="flex justify-between">
                <dt className="text-[var(--muted)]">Merkle root</dt>
                <dd className="text-[var(--text)]">{short(d.merkle_root)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-[var(--muted)]">Leaves</dt>
                <dd className="tnum text-[var(--text)]">{d.leaf_count}</dd>
              </div>
            </dl>

            {s ? (
              <div className={`border p-2 ${local ? "border-[var(--border-2)] bg-[var(--surface-2)]" : "border-[color-mix(in_srgb,var(--ok)_45%,transparent)] bg-[color-mix(in_srgb,var(--ok)_8%,transparent)]"}`}>
                <div className="mono flex items-center justify-between text-[10px]">
                  <span className={local ? "text-[var(--muted)]" : "text-[var(--ok)]"}>{s.chain_label}</span>
                  <span className="text-[var(--muted-2)]">block {s.block}</span>
                </div>
                <p className="mono mt-1 truncate text-[9px] text-[var(--muted-2)]">tx {short(s.tx_hash)}</p>
                {s.explorer_url ? (
                  <a href={s.explorer_url} target="_blank" rel="noopener noreferrer"
                     className="mono mt-1 inline-block text-[9px] text-[var(--ok)] underline">
                    View on explorer
                  </a>
                ) : (
                  <p className="mono mt-1 text-[9px] text-[var(--muted-2)]">
                    Local chain — no public explorer record.
                  </p>
                )}
              </div>
            ) : (
              <button onClick={seal} disabled={busy}
                className="mono flex w-full items-center justify-center gap-1.5 border border-[var(--accent-dim)] bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] py-2 text-[10px] uppercase tracking-[0.16em] text-[var(--c-high)] transition hover:bg-[color-mix(in_srgb,var(--accent)_18%,transparent)] disabled:opacity-50">
                <Lock className="h-3 w-3" />
                {busy ? "Sealing…" : "Seal case on chain"}
              </button>
            )}

            <label
              className="mono flex cursor-pointer items-center justify-center gap-1.5 border border-dashed border-[var(--border-2)] py-3 text-[10px] uppercase tracking-[0.16em] text-[var(--muted-2)] transition hover:border-[var(--accent-dim)] hover:text-[var(--muted)]"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) verifyFile(f); }}
            >
              <Upload className="h-3 w-3" /> Drop a case export to verify
              <input type="file" accept="application/json" className="hidden"
                aria-label="Upload a case export to verify"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) verifyFile(f); }} />
            </label>

            {verdict && (
              <div role="status" aria-live="polite"
                className={`border p-2 ${verdict.ok ? "border-[color-mix(in_srgb,var(--ok)_45%,transparent)] bg-[color-mix(in_srgb,var(--ok)_8%,transparent)]" : "border-[color-mix(in_srgb,var(--accent)_45%,transparent)] bg-[color-mix(in_srgb,var(--accent)_8%,transparent)]"}`}>
                <p className="mono flex items-center gap-1.5 text-[10px] uppercase tracking-[0.16em]">
                  {verdict.ok
                    ? <><ShieldCheck className="h-3.5 w-3.5 text-[var(--ok)]" /><span className="text-[var(--ok)]">Verified</span></>
                    : <><ShieldX className="h-3.5 w-3.5 text-[var(--c-high)]" /><span className="text-[var(--c-high)]">Tamper detected</span></>}
                </p>
                <p className="mono mt-1 text-[9px] text-[var(--muted)]">
                  {verdict.index !== null && `Record ${verdict.index}: `}{verdict.reason}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </Panel>
  );
}
