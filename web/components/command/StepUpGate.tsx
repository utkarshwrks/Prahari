"use client";

import { useCallback, useEffect, useState } from "react";
import { KeyRound, Loader2, ShieldCheck, TriangleAlert } from "lucide-react";
import { trapFocus } from "@/lib/a11y";
import { useRef } from "react";
import { beginEnrolment, refreshStatus, verifyStepUp, type AdminStatus } from "@/lib/adminClient";

/**
 * The step-up prompt (DEC-059).
 *
 * Shown when the server refuses a write for want of a second factor. It never
 * decides on its own that a step-up is needed — the server does, and this
 * renders that decision. A client-side gate that thought it knew when a step-up
 * was required would be a client-side gate someone could skip.
 *
 * Enrolment happens here too, because a panel that can only tell you "you need
 * an authenticator" without offering to set one up is a dead end.
 */

export default function StepUpGate({
  open, needFresh, onClose, onGranted,
}: {
  open: boolean;
  needFresh: boolean;
  onClose: () => void;
  onGranted: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<AdminStatus | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enrolment, setEnrolment] = useState<{
    qr: string | null;
    uri: string;
    recoveryCodes: string[];
  } | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setCode("");
    void refreshStatus().then(setStatus);
  }, [open]);

  // The DEC-042 focus trap, as the command palette does (FINDING-07).
  useEffect(() => {
    if (!open || !panelRef.current) return;
    const release = trapFocus(panelRef.current, onClose);
    inputRef.current?.focus();
    return release;
  }, [open, onClose]);

  const submit = useCallback(async () => {
    setBusy(true);
    setError(null);
    const { status: httpStatus, body } = await verifyStepUp(code);
    setBusy(false);
    if (httpStatus === 200 && body?.ok) {
      setCode("");
      onGranted();
      return;
    }
    setError(String(body?.detail ?? "That code was not accepted."));
    if (body?.needsEnrolment) setStatus((s) => (s ? { ...s, enrolled: false } : s));
  }, [code, onGranted]);

  async function enrol(force: boolean) {
    setBusy(true);
    setError(null);
    const { status: httpStatus, body } = await beginEnrolment(force);
    setBusy(false);
    if (httpStatus === 200 && body?.ok) {
      setEnrolment({ qr: body.qr ?? null, uri: body.uri, recoveryCodes: body.recoveryCodes });
      setStatus((s) => (s ? { ...s, enrolled: true } : s));
      return;
    }
    setError(String(body?.detail ?? "Enrolment failed."));
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-start justify-center bg-[color-mix(in_srgb,black_66%,transparent)] pt-[10vh]">
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Step-up authentication"
        className="glass w-[min(520px,94vw)] p-4"
      >
        <h2 className="mono flex items-center gap-1.5 text-[11px] uppercase tracking-[0.16em] text-[var(--text)]">
          <ShieldCheck className="h-3.5 w-3.5" />
          {needFresh ? "Confirm this destructive action" : "Step-up required"}
        </h2>

        <p className="mono mt-1.5 text-[9.5px] leading-relaxed text-[var(--muted)]">
          {needFresh
            ? "This action cannot be undone, so it needs a code entered just now — an earlier step-up is not enough."
            : "Writes in the Command Panel need a code from your authenticator. One step-up covers fifteen minutes."}
        </p>

        {status && status.enrolled === false && !enrolment && (
          <div className="mt-3 border border-[var(--border)] bg-[var(--surface-2)] p-2.5">
            <p className="mono flex items-center gap-1.5 text-[10px] text-[var(--c-high)]">
              <TriangleAlert className="h-3 w-3" /> No authenticator is enrolled
            </p>
            <p className="mono mt-1 text-[9px] leading-relaxed text-[var(--muted-2)]">
              Enrol one to make any change. Your eight recovery codes are shown once and stored only
              as hashes — if you lose them, an administrator must reset your enrolment.
            </p>
            <button
              onClick={() => void enrol(false)}
              disabled={busy}
              className="mono mt-2 border border-[var(--border-2)] px-2 py-1 text-[9px] uppercase tracking-[0.12em] text-[var(--muted)] transition hover:border-[var(--accent-dim)] hover:text-[var(--c-high)]"
            >
              Enrol an authenticator
            </button>
          </div>
        )}

        {enrolment && (
          <div className="mt-3 border border-[var(--accent-dim)] bg-[var(--surface-2)] p-2.5">
            <p className="mono text-[10px] text-[var(--text)]">Scan this, then enter a code below.</p>
            {/*
              The QR is a data: URI generated server-side from the otpauth URL.
              next/image cannot optimise a data URI and would only put a loader
              in front of bytes we already hold -- and routing a TOTP secret
              through an image optimiser would be actively wrong.
            */}
            {enrolment.qr && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={enrolment.qr}
                alt="TOTP enrolment QR code"
                className="mt-2 h-[180px] w-[180px] bg-white p-1"
              />
            )}
            <p className="mono mt-2 break-all text-[8px] text-[var(--muted-2)]">{enrolment.uri}</p>
            <p className="mono mt-2 text-[9px] uppercase tracking-[0.14em] text-[var(--c-high)]">
              Recovery codes — copy these now
            </p>
            <ul className="mono mt-1 grid grid-cols-2 gap-x-3 text-[10px] text-[var(--text)]">
              {enrolment.recoveryCodes.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          </div>
        )}

        <label className="mt-3 block">
          <span className="mono text-[8.5px] uppercase tracking-[0.16em] text-[var(--muted-2)]">
            Six-digit code, or a recovery code
          </span>
          <input
            ref={inputRef}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && code) void submit();
            }}
            inputMode="text"
            autoComplete="one-time-code"
            placeholder="123456"
            className="mono mt-1 w-full border border-[var(--border)] bg-[var(--surface-2)] px-2 py-2 text-[13px] tracking-[0.2em] text-[var(--text)] outline-none focus:border-[var(--accent-dim)]"
          />
        </label>

        {error && (
          <p role="alert" className="mono mt-2 text-[10px] text-[var(--c-high)]">
            {error}
          </p>
        )}

        <div className="mt-3 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="mono border border-[var(--border-2)] px-2 py-1.5 text-[9px] uppercase tracking-[0.12em] text-[var(--muted-2)] transition hover:text-[var(--text)]"
          >
            Cancel
          </button>
          <button
            onClick={() => void submit()}
            disabled={busy || !code}
            className="mono flex items-center gap-1.5 border border-[var(--accent-dim)] bg-[color-mix(in_srgb,var(--accent)_14%,transparent)] px-3 py-1.5 text-[9px] uppercase tracking-[0.12em] text-[var(--c-high)] transition disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <KeyRound className="h-3 w-3" />}
            Verify
          </button>
        </div>
      </div>
    </div>
  );
}
