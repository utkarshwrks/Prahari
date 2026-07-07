import { IntelSource } from "@/lib/mockIntel";

const STYLE: Record<IntelSource, string> = {
  Marketplace: "border-red/50 text-red-bright",
  Forum: "border-red-deep/60 text-red-deep",
  Paste: "border-border-2 text-muted",
  Bridge: "border-white/25 text-text",
};

export default function SourceBadge({ source }: { source: IntelSource }) {
  return (
    <span
      className={`mono border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.15em] ${STYLE[source]}`}
    >
      {source}
    </span>
  );
}
