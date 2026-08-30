/**
 * Attribution confidence, rendered as a degree rather than a verdict.
 *
 * Deliberately not a red/green pass-fail. The whole argument of this system is
 * that attribution is a calibrated probability with a published error rate, and
 * a binary colour would undo that in one glance.
 */
export function confidenceClass(p: number | null | undefined): string {
  if (p == null) return "conf-low";
  if (p >= 0.75) return "conf-high";
  if (p >= 0.4) return "conf-mid";
  return "conf-low";
}

export function confidenceColor(p: number | null | undefined): string {
  if (p == null) return "var(--c-low)";
  if (p >= 0.75) return "var(--c-high)";
  if (p >= 0.4) return "var(--c-mid)";
  return "var(--c-low)";
}

export default function Confidence({
  value, size = "md", showBar = true,
}: { value: number | null | undefined; size?: "sm" | "md" | "lg"; showBar?: boolean }) {
  const pct = value == null ? 0 : Math.round(value * 100);
  const text = size === "lg" ? "text-3xl" : size === "md" ? "text-lg" : "text-xs";
  return (
    <span className="inline-flex flex-col gap-1">
      <span className={`mono tnum font-bold ${text} ${confidenceClass(value)}`}>
        {value == null ? "—" : value.toFixed(3)}
      </span>
      {showBar && (
        <span className="bar w-full" title={`${pct}% attribution confidence`}>
          <span style={{ width: `${pct}%`, background: confidenceColor(value) }} />
        </span>
      )}
    </span>
  );
}
