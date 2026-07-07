"use client";

import { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Cell,
  ResponsiveContainer,
  AreaChart,
  Area,
  ReferenceDot,
} from "recharts";
import { Activity, ShieldAlert, Bitcoin, AtSign } from "lucide-react";
import { useIntel, selectCategoryBreakdown } from "@/store/intel";
import { ContrabandCategory } from "@/lib/mockIntel";
import { activityBuckets, spikeIndex } from "@/lib/analytics";
import AnimatedNumber from "../AnimatedNumber";
import TacticalPanel from "../../ui/TacticalPanel";
import { OPEN_RECORDS_EVENT } from "../RecordsButton";

const CAT_COLOR: Record<ContrabandCategory, string> = {
  Drugs: "#FF2A1F",
  Weapons: "#E10600",
  Data: "#B00020",
  Counterfeit: "#71717A",
};

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Activity;
  label: string;
  value: number;
}) {
  return (
    <button
      onClick={() => window.dispatchEvent(new Event(OPEN_RECORDS_EVENT))}
      title="Open analytics & records"
      className="border border-border bg-panel-2/50 px-3 py-2.5 text-left transition hover:border-red/40 hover:bg-panel-2"
    >
      <div className="mb-1 flex items-center gap-1.5">
        <Icon className="h-3.5 w-3.5 text-red-bright" strokeWidth={1.75} />
        <span className="mono text-[9px] uppercase tracking-[0.16em] text-muted-2">
          {label}
        </span>
      </div>
      <div className="mono text-2xl font-bold tabular-nums text-text">
        <AnimatedNumber value={value} />
      </div>
    </button>
  );
}

export default function ThreatAnalytics() {
  const intercepts = useIntel((s) => s.intercepts);
  const total = useIntel((s) => s.totalIntercepts);
  const breaches = useIntel((s) => s.geofenceBreaches);
  const wallets = useIntel((s) => s.walletsTracked);
  const handles = useIntel((s) => s.handlesFlagged);

  const [now, setNow] = useState<number>(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 2000);
    return () => clearInterval(id);
  }, []);

  const breakdown = selectCategoryBreakdown(intercepts);
  const barData = (Object.keys(breakdown) as ContrabandCategory[]).map((k) => ({
    name: k,
    value: breakdown[k],
  }));
  const buckets = activityBuckets(intercepts, now);
  const spike = spikeIndex(buckets);

  return (
    <TacticalPanel title="Threat Analytics" live>
      <div className="space-y-3 p-3">
        {/* counters */}
        <div className="grid grid-cols-2 gap-2">
          <Stat icon={Activity} label="Intercepts" value={total} />
          <Stat icon={ShieldAlert} label="Breaches" value={breaches} />
          <Stat icon={Bitcoin} label="Wallets" value={wallets} />
          <Stat icon={AtSign} label="Handles" value={handles} />
        </div>

        {/* contraband breakdown */}
        <div>
          <div className="label mb-1.5">Contraband Breakdown</div>
          <div className="h-[120px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} layout="vertical" margin={{ left: 0, right: 12, top: 2, bottom: 2 }}>
                <XAxis type="number" hide />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={78}
                  tick={{ fill: "#A1A1AA", fontSize: 10, fontFamily: "var(--font-mono)" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Bar dataKey="value" radius={[0, 2, 2, 0]} barSize={12} isAnimationActive>
                  {barData.map((d) => (
                    <Cell key={d.name} fill={CAT_COLOR[d.name as ContrabandCategory]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* activity sparkline */}
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="label">Activity · Last 90s</span>
            {spike >= 0 && (
              <span className="mono text-[9px] tracking-widest text-red-bright">
                ▲ SPIKE
              </span>
            )}
          </div>
          <div className="h-[56px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={buckets} margin={{ top: 4, right: 2, bottom: 0, left: 2 }}>
                <defs>
                  <linearGradient id="act" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#E10600" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="#E10600" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey="v"
                  stroke="#FF2A1F"
                  strokeWidth={1.5}
                  fill="url(#act)"
                  isAnimationActive={false}
                />
                {spike >= 0 && (
                  <ReferenceDot x={spike} y={buckets[spike].v} r={3} fill="#FFFFFF" stroke="#FF2A1F" />
                )}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </TacticalPanel>
  );
}
