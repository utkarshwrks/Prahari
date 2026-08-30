import Link from "next/link";
import { ShieldAlert } from "lucide-react";

export default function Logo({
  href = "/",
  compact = false,
}: {
  href?: string;
  compact?: boolean;
}) {
  return (
    <Link href={href} className="group flex items-center gap-2.5">
      <span className="flex h-9 w-9 items-center justify-center border border-red bg-red/10 shadow-glow-sm transition group-hover:bg-red/20">
        <ShieldAlert className="h-5 w-5 text-red-bright" strokeWidth={2} />
      </span>
      <span className="leading-none">
        <span className="flex items-baseline gap-1.5">
          <span className="mono text-lg font-bold tracking-[0.28em] text-white">
            PRAHARI
          </span>
          <span className="text-base text-red-bright">प्रहरी</span>
        </span>
        {!compact && (
          <span className="mono mt-0.5 block text-[9px] tracking-[0.22em] text-muted-2">
            SENTINEL · THREAT INTEL
          </span>
        )}
      </span>
    </Link>
  );
}
