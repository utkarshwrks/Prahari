import { Fingerprint } from "lucide-react";

/** PRAHARI — प्रहरी, "the sentinel". Attribution, not surveillance. */
export default function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <span
        className="flex h-8 w-8 items-center justify-center border"
        style={{ borderColor: "var(--accent-dim)", background: "color-mix(in srgb, var(--accent) 10%, transparent)" }}
      >
        <Fingerprint className="h-4 w-4" style={{ color: "var(--accent)" }} strokeWidth={1.75} />
      </span>
      <span className="leading-none">
        <span className="display block text-[15px] font-bold tracking-[0.18em] text-[var(--text)]">
          PRAHARI
        </span>
        {!compact && (
          <span className="mono mt-0.5 block text-[8.5px] uppercase tracking-[0.22em] text-[var(--muted-2)]">
            Threat actor attribution
          </span>
        )}
      </span>
    </span>
  );
}
