"use client";

import { useCallback, useEffect, useState } from "react";
import { Link2, Lock, ShieldCheck, ShieldX, Upload } from "lucide-react";
import { toast } from "sonner";
import TacticalPanel from "../../ui/TacticalPanel";

/**
 * The audit ledger: hash chain, seal, and verify.
 *
 * The LOCAL CHAIN badge is not decoration. When the network is down the demo
 * seals to a local Anvil node, and it must be impossible to mistake that for a
 * public anchor -- a Sepolia explorer link on a local transaction would be a
 * fabricated evidence trail. The engine derives `is_public_chain` from the
 * chain id it actually connected to; this panel only renders what it is told,
 * and shows no link when there is none.
 */

interface Record {
  seq: number;
  action: string;
  actor: string;
  ts: string;
  prev_hash: string;
  hash: string;
  signature: string | null;
}

interface Seal {
  chain_label?: string;
  chain_id?: number | null;
  tx_hash?: string | null;
  block?: number | null;
  gas_used?: number | null;
  is_public_chain?: boolean;
  explorer_url?: string | null;
  root?: string;
}

interface LedgerData {
  ok: boolean;
  case_id: string;
  records: Record[];
  merkle_root: string;
  leaf_count: number;
  verification: { ok: boolean; failing_index: number | null; reason: string | null; checks: Record_ };
  seal: Seal | null;
  detail?: string;
}
type Record_ = { signatures_verified?: number; chain?: string };

const short = (h: string) => (h?.length > 18 ? `${h.slice(0, 10)}…${h.slice(-6)}` : h);

export default function AuditLedger({ caseId = "CASE-001" }: { caseId?: string }) {
  const [data, setData] = useState<LedgerData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [verdict, setVerdict] = useState<
    { ok: boolean; index: number | null; reason: string } | null
  >(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/engine/audit/case/${caseId}/ledger`);
      const d = await r.json();
      if (d?.engine === "offline") setError(d.detail ?? "Engine offline.");
      else if (!d?.ok) setError(d?.detail ?? "No ledger.");
      else {
        setData(d);
        setError(null);
      }
    } catch {
      setError("Engine unreachable.");
    }
  }, [caseId]);

  useEffect(() => {
    load();
  }, [load]);

  async function seal() {
    setBusy(true);
    try {
      const r = await fetch(`/api/engine/audit/case/${caseId}/seal`, { method: "POST" });
      const d = await r.json();
      if (d?.ok) {
        toast.success(`Sealed on ${d.chain_label} at block ${d.block}`);
        await load();
      } else {
        toast.error(d?.detail ?? "Sealing failed.");
      }
    } catch {
      toast.error("Engine unreachable.");
    } finally {
      setBusy(false);
    }
  }

  async function verifyFile(file: File) {
    setBusy(true);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const r = await fetch("/api/engine/audit/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          records: parsed.records,
          merkle_root: parsed.sealed_root ?? parsed.merkle_root,
        }),
      });
      const d = await r.json();
      setVerdict({
        ok: Boolean(d.ok),
        index: d.failing_index ?? null,
        reason: d.reason ?? (d.ok ? "Chain intact and root matches." : "Verification failed."),
      });
    } catch {
      setVerdict({ ok: false, index: null, reason: "That file is not a PRAHARI case export." });
    } finally {
      setBusy(false);
    }
  }

  const seal_ = data?.seal;
  const local = seal_ && seal_.is_public_chain === false;

  return (
    <TacticalPanel title="Audit Ledger" tourId="audit">
      <div className="slim-scroll h-full overflow-y-auto p-3">
        {error && (
          <div className="mono border border-border-2 bg-panel-2/50 p-2 text-[10px] text-muted">
            {error}
          </div>
        )}

        {data && (
          <>
            <div className="mono flex items-center justify-between text-[10px] text-muted">
              <span>{data.case_id}</span>
              <span
                className={
                  data.verification.ok ? "text-red-bright" : "text-muted-2"
                }
              >
                {data.verification.ok
                  ? `CHAIN INTACT · ${data.verification.checks?.signatures_verified ?? 0} SIGNED`
                  : `BROKEN AT ${data.verification.failing_index}`}
              </span>
            </div>

            {/* The chain, with prev_hash visible. */}
            <div className="mt-2 space-y-1">
              {data.records.map((r) => (
                <div key={r.seq} className="border border-border bg-panel-2/40 px-2 py-1.5">
                  <div className="mono flex items-center justify-between text-[10px]">
                    <span className="text-text">
                      [{r.seq}] {r.action}
                    </span>
                    <span className="text-muted-2">{r.signature ? "signed" : "unsigned"}</span>
                  </div>
                  <div className="mono mt-0.5 flex items-center gap-1 text-[9px] text-muted-2">
                    <Link2 className="h-2.5 w-2.5 shrink-0" />
                    <span className="truncate">prev {short(r.prev_hash)}</span>
                  </div>
                  <div className="mono text-[9px] text-muted">hash {short(r.hash)}</div>
                </div>
              ))}
            </div>

            <div className="mono mt-2 border-t border-border pt-2 text-[10px] text-muted">
              <div className="flex justify-between">
                <span>Merkle root</span>
                <span className="text-text">{short(data.merkle_root)}</span>
              </div>
              <div className="flex justify-between">
                <span>Leaves</span>
                <span className="tabular-nums text-text">{data.leaf_count}</span>
              </div>
            </div>

            {/* Seal state. */}
            {seal_ ? (
              <div
                className={`mt-2 border p-2 ${
                  local ? "border-border-2 bg-panel-2/50" : "border-red/50 bg-red/10"
                }`}
              >
                <div className="mono flex items-center justify-between text-[10px]">
                  <span className={local ? "text-muted" : "text-red-bright"}>
                    {seal_.chain_label}
                  </span>
                  <span className="text-muted-2">block {seal_.block}</span>
                </div>
                <div className="mono mt-1 truncate text-[9px] text-muted-2">
                  tx {short(seal_.tx_hash ?? "")}
                </div>
                {seal_.gas_used && (
                  <div className="mono text-[9px] text-muted-2">gas {seal_.gas_used}</div>
                )}
                {seal_.explorer_url ? (
                  <a
                    href={seal_.explorer_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mono mt-1 inline-block text-[9px] text-red-bright underline"
                  >
                    View on explorer
                  </a>
                ) : (
                  /* No link, and we say why. Silence here would let a viewer
                     assume the seal is public when it is not. */
                  <div className="mono mt-1 text-[9px] text-muted-2">
                    Local chain — no public explorer record.
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={seal}
                disabled={busy}
                className="mono mt-2 flex w-full items-center justify-center gap-1.5 border border-red bg-red/10 py-2 text-[10px] uppercase tracking-[0.16em] text-red-bright transition hover:bg-red/20 disabled:opacity-50"
              >
                <Lock className="h-3 w-3" />
                {busy ? "Sealing…" : "Seal case on chain"}
              </button>
            )}

            {/* Verify drop-zone. */}
            <label
              className="mono mt-2 flex cursor-pointer items-center justify-center gap-1.5 border border-dashed border-border-2 py-3 text-[10px] uppercase tracking-[0.16em] text-muted transition hover:border-red/40 hover:text-text"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const f = e.dataTransfer.files?.[0];
                if (f) verifyFile(f);
              }}
            >
              <Upload className="h-3 w-3" />
              Drop a case export to verify
              <input
                type="file"
                accept="application/json"
                className="hidden"
                aria-label="Upload a case export to verify"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) verifyFile(f);
                }}
              />
            </label>

            {verdict && (
              <div
                role="status"
                aria-live="polite"
                className={`mt-2 border p-2 ${
                  verdict.ok
                    ? "border-red/50 bg-red/10"
                    : "border-border-2 bg-panel-2/60"
                }`}
              >
                <div className="mono flex items-center gap-1.5 text-[10px] uppercase tracking-[0.16em]">
                  {verdict.ok ? (
                    <ShieldCheck className="h-3.5 w-3.5 text-red-bright" />
                  ) : (
                    <ShieldX className="h-3.5 w-3.5 text-muted" />
                  )}
                  <span className={verdict.ok ? "text-red-bright" : "text-muted"}>
                    {verdict.ok ? "Verified" : "Tamper detected"}
                  </span>
                </div>
                <div className="mono mt-1 text-[9px] text-muted">
                  {verdict.index !== null && `Record ${verdict.index}: `}
                  {verdict.reason}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </TacticalPanel>
  );
}
