import { MapPin, Flag, Bitcoin, AtSign } from "lucide-react";
import { Entities } from "@/lib/mockIntel";

const truncateWallet = (w: string) =>
  w.length > 12 ? `${w.slice(0, 6)}…${w.slice(-4)}` : w;

function Chip({
  icon,
  children,
  className,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
  className: string;
}) {
  return (
    <span
      className={`mono inline-flex items-center gap-1 border px-1.5 py-0.5 text-[10px] ${className}`}
    >
      {icon}
      {children}
    </span>
  );
}

export default function EntityChips({ entities }: { entities: Entities }) {
  const { locations, contraband, wallets, handles } = entities;
  return (
    <div className="flex flex-wrap gap-1.5">
      {locations.map((l) => (
        <Chip
          key={`loc-${l}`}
          icon={<MapPin className="h-3 w-3" />}
          className="border-red/50 bg-red/10 text-red-bright"
        >
          {l}
        </Chip>
      ))}
      {contraband.map((c) => (
        <Chip
          key={`con-${c}`}
          icon={<Flag className="h-3 w-3" />}
          className="border-border-2 bg-panel-2 text-text"
        >
          {c}
        </Chip>
      ))}
      {wallets.map((w) => (
        <Chip
          key={`wal-${w}`}
          icon={<Bitcoin className="h-3 w-3" />}
          className="border-border-2 bg-panel-2 text-muted"
        >
          {truncateWallet(w)}
        </Chip>
      ))}
      {handles.map((h) => (
        <Chip
          key={`han-${h}`}
          icon={<AtSign className="h-3 w-3" />}
          className="border-white/20 bg-white/[0.03] text-text"
        >
          {h.replace(/^@/, "")}
        </Chip>
      ))}
    </div>
  );
}
