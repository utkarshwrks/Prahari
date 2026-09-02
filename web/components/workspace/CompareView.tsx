"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { GitCompare } from "lucide-react";
import { api, detailOf, type ActorProfile, type ActorRow } from "@/lib/api";
import { ACTOR_PAGE } from "./ActorsTable";
import { SIGNAL_LABEL, signalVar, type SignalRoot } from "@/lib/signals";
import { bandOf, BAND_LABEL } from "@/lib/workspace";

/**
 * Side-by-side actor comparison (DEC-056) — the one genuinely new surface in
 * this phase.
 *
 * The question it answers is the one the cockpit could not: are these two
 * actors the same operator under two names, or two operators who look alike?
 * It answers by SHOWING THE OVERLAP -- shared identifiers, shared hosts, shared
 * markets -- and by refusing to conclude.
 *
 * The honesty rule here is strict, because a comparison view is exactly where a
 * tool starts implying things. Shared identifiers are FACTS: this PGP key
 * appears under both. The inference from that to "same person" is the fusion
 * engine's job, it is published with a calibrated confidence and a false-merge
 * rate, and it is not restated here. This page computes no score.
 */

const KEY_LABEL: Record<string, string> = {
  pgp: "PGP key",
  wallet: "Wallet",
  email: "Email",
  onion: "Onion",
};

function useActor(id: string | null) {
  const [profile, setProfile] = useState<ActorProfile | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    if (!id) {
      setProfile(null);
      setErr(null);
      return;
    }
    let alive = true;
    setProfile(null);
    setErr(null);
    (async () => {
      const d = await api.actor(id);
      if (!alive) return;
      if ("ok" in d && d.ok) setProfile(d as ActorProfile);
      else setErr(detailOf(d, "Not available."));
    })();
    return () => {
      alive = false;
    };
  }, [id]);
  return { profile, err };
}

function Picker({
  label, value, options, onChange,
}: {
  label: string;
  value: string | null;
  options: ActorRow[];
  onChange: (id: string | null) => void;
}) {
  return (
    <label className="flex flex-1 flex-col gap-1">
      <span className="mono text-[8.5px] uppercase tracking-[0.16em] text-[var(--muted-2)]">
        {label}
      </span>
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
        className="mono border border-[var(--border)] bg-[var(--surface-2)] px-2 py-2 text-[11px] text-[var(--text)] outline-none transition focus:border-[var(--accent-dim)]"
      >
        <option value="">Select an actor</option>
        {options.map((o) => (
          <option key={o.actor_id} value={o.actor_id}>
            {o.label} · {o.actor_id}
            {o.attribution_confidence === null ? "" : ` · ${o.attribution_confidence.toFixed(2)}`}
          </option>
        ))}
      </select>
    </label>
  );
}

function Column({ profile, err }: { profile: ActorProfile | null; err: string | null }) {
  if (err) return <p className="mono text-[10px] text-[var(--muted-2)]">{err}</p>;
  if (!profile) return <p className="mono text-[10px] text-[var(--muted-2)]">No actor selected.</p>;
  const c = profile.attribution_confidence;
  return (
    <div className="space-y-2">
      <div>
        <p className="mono text-[13px] font-bold text-[var(--text)]">{profile.label}</p>
        <p className="mono text-[9px] text-[var(--muted-2)]">
          {profile.actor_id} · {profile.personas.length} personas · {profile.post_count} posts
        </p>
      </div>
      <div className="border border-[var(--border)] bg-[var(--surface-2)] p-2">
        <p className="mono text-[8.5px] uppercase tracking-[0.16em] text-[var(--muted-2)]">
          Attribution confidence
        </p>
        <p className="mono tnum text-xl font-bold text-[var(--c-high)]">
          {c === null ? "not measured" : c.toFixed(3)}
        </p>
        <p className="mono text-[8.5px] text-[var(--muted-2)]">{BAND_LABEL[bandOf(c)]}</p>
      </div>
      <dl className="mono space-y-0.5 text-[10px]">
        <div className="flex justify-between gap-2">
          <dt className="text-[var(--muted-2)]">Markets</dt>
          <dd className="truncate text-right text-[var(--muted)]">{profile.markets.join(", ") || "none"}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-[var(--muted-2)]">Identifiers</dt>
          <dd className="tnum text-[var(--muted)]">{profile.identifiers.length}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-[var(--muted-2)]">Hosts</dt>
          <dd className="tnum text-[var(--muted)]">{profile.infrastructure.length}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-[var(--muted-2)]">Last scan</dt>
          <dd className="text-[var(--muted)]">{profile.last_scan ?? "not recorded"}</dd>
        </div>
      </dl>
      <Link
        href={`/workbench/actor/${profile.actor_id}`}
        className="mono inline-block border border-[var(--border-2)] px-2 py-1 text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] transition hover:border-[var(--accent-dim)] hover:text-[var(--c-high)]"
      >
        Open dossier
      </Link>
    </div>
  );
}

export default function CompareView() {
  const router = useRouter();
  const params = useSearchParams();
  const a = params.get("a");
  const b = params.get("b");

  const [options, setOptions] = useState<ActorRow[]>([]);
  const left = useActor(a);
  const right = useActor(b);

  useEffect(() => {
    let alive = true;
    (async () => {
      const res = await api.actors("", 0, ACTOR_PAGE);
      if (alive && "ok" in res && res.ok) setOptions(res.actors);
    })();
    return () => {
      alive = false;
    };
  }, []);

  const set = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    router.replace(`/workbench/compare${next.toString() ? `?${next}` : ""}`, { scroll: false });
  };

  /** What the two genuinely have in common. Facts only, no inference. */
  const overlap = useMemo(() => {
    const p = left.profile;
    const q = right.profile;
    if (!p || !q) return null;

    const idsOf = (x: ActorProfile) => new Set(x.identifiers.map((i) => `${i.kind}:${i.value}`));
    const shared = [...idsOf(p)].filter((v) => idsOf(q).has(v));
    const hostsOf = (x: ActorProfile) => new Set(x.infrastructure.map((i) => i.clearnet_host));
    const sharedHosts = [...hostsOf(p)].filter((v) => hostsOf(q).has(v));
    const sharedMarkets = p.markets.filter((m) => q.markets.includes(m));
    const rootsOf = (x: ActorProfile) => new Set(x.linkages.flatMap((l) => l.roots));
    const sharedRoots = [...rootsOf(p)].filter((r) => rootsOf(q).has(r));

    return { shared, sharedHosts, sharedMarkets, sharedRoots };
  }, [left.profile, right.profile]);

  return (
    <div className="space-y-3">
      <div className="glass p-3">
        <h2 className="mono mb-2 flex items-center gap-1.5 text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">
          <GitCompare className="h-3 w-3" /> Compare two actors
        </h2>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Picker label="Actor A" value={a} options={options} onChange={(v) => set({ a: v })} />
          <Picker label="Actor B" value={b} options={options} onChange={(v) => set({ b: v })} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <div className="glass p-3">
          <Column profile={left.profile} err={left.err} />
        </div>
        <div className="glass p-3">
          <Column profile={right.profile} err={right.err} />
        </div>
      </div>

      {overlap && (
        <div className="glass p-3">
          <h3 className="mono mb-2 text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">
            What they share
          </h3>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <p className="mono text-[8.5px] uppercase tracking-[0.16em] text-[var(--muted-2)]">
                Shared identifiers
              </p>
              {overlap.shared.length === 0 ? (
                <p className="mono mt-1 text-[10px] text-[var(--muted-2)]">
                  None. These two actors share no identifier.
                </p>
              ) : (
                <ul className="mt-1 space-y-0.5">
                  {overlap.shared.map((s) => {
                    const [kind, ...rest] = s.split(":");
                    return (
                      <li key={s} className="mono break-all text-[10px] text-[var(--c-high)]">
                        <span className="text-[var(--muted-2)]">{KEY_LABEL[kind] ?? kind}</span>{" "}
                        {rest.join(":")}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div>
              <p className="mono text-[8.5px] uppercase tracking-[0.16em] text-[var(--muted-2)]">
                Shared infrastructure
              </p>
              {overlap.sharedHosts.length === 0 ? (
                <p className="mono mt-1 text-[10px] text-[var(--muted-2)]">No shared host.</p>
              ) : (
                <ul className="mt-1 space-y-0.5">
                  {overlap.sharedHosts.map((h) => (
                    <li key={h} className="mono break-all text-[10px] text-[var(--c-high)]">
                      {h}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <p className="mono text-[8.5px] uppercase tracking-[0.16em] text-[var(--muted-2)]">
                Shared markets
              </p>
              <p className="mono mt-1 text-[10px] text-[var(--muted)]">
                {overlap.sharedMarkets.join(", ") || "None."}
              </p>
            </div>

            <div>
              <p className="mono text-[8.5px] uppercase tracking-[0.16em] text-[var(--muted-2)]">
                Signal roots present in both
              </p>
              {overlap.sharedRoots.length === 0 ? (
                <p className="mono mt-1 text-[10px] text-[var(--muted-2)]">None.</p>
              ) : (
                <ul className="mt-1 flex flex-wrap gap-1.5">
                  {overlap.sharedRoots.map((r) => (
                    <li
                      key={r}
                      className="mono flex items-center gap-1 border border-[var(--border-2)] px-1.5 py-0.5 text-[9px] text-[var(--muted)]"
                    >
                      <span
                        aria-hidden="true"
                        className="h-2 w-2 rounded-full"
                        style={{ background: `var(${signalVar(r as SignalRoot)})` }}
                      />
                      {SIGNAL_LABEL[r as SignalRoot] ?? r}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* The refusal, stated. This is the sentence that keeps the page honest. */}
          <p className="mono mt-3 border-l-2 border-[var(--accent-dim)] pl-2 text-[9.5px] leading-relaxed text-[var(--muted)]">
            These are observations, not a verdict. Shared identifiers and shared hosts are facts about
            what two actors published; whether they are the same operator is a fused judgement with a
            calibrated confidence and a published false-merge rate, and this page does not compute one.
            Two actors sharing a market share it with hundreds of others.
          </p>
        </div>
      )}
    </div>
  );
}
