"use client";

import { Copy, ExternalLink, MapPin, ScrollText } from "lucide-react";
import Link from "next/link";
import { SIGNAL_LABEL, signalVar, type SignalRoot } from "@/lib/signals";
import type { GraphModel } from "@/lib/graphModel";
import type { ActorProfile, FusionModel, PairScore } from "@/lib/api";

/**
 * The node inspector (DEC-057).
 *
 * NO INVENTED FIELDS. Every line here is read from a payload the engine
 * actually returned; where a fact is unknown the row says so in words rather
 * than rendering a blank or a plausible default.
 *
 * The edge list is the point of the panel. For each edge it names the signal
 * root, the strength, the reliability exponent `r` applied to it, and — for a
 * persona-to-persona linkage — WHAT WAS DISCARDED in root-cause collapse.
 * Collapse is the most contestable step in the model and the one an opposing
 * expert will attack; a panel that showed only survivors would be hiding it.
 */

interface Props {
  model: GraphModel;
  profile: ActorProfile;
  selected: string | null;
  fusionModel: FusionModel | null;
  pair: PairScore | null;
  onOpenPair: (pairId: string) => void;
  onSelect: (id: string | null) => void;
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-2 border-b border-[var(--border)] py-1 last:border-0">
      <dt className="mono shrink-0 text-[9px] text-[var(--muted-2)]">{label}</dt>
      <dd className="mono min-w-0 break-all text-right text-[9.5px] text-[var(--text)]">{value}</dd>
    </div>
  );
}

function Action({
  children, onClick, href, title,
}: { children: React.ReactNode; onClick?: () => void; href?: string; title: string }) {
  const cls =
    "mono flex items-center gap-1 border border-[var(--border-2)] px-1.5 py-1 text-[8.5px] uppercase tracking-[0.1em] text-[var(--muted)] transition hover:border-[var(--accent-dim)] hover:text-[var(--c-high)]";
  if (href) {
    return (
      <Link href={href} className={cls} title={title}>
        {children}
      </Link>
    );
  }
  return (
    <button onClick={onClick} className={cls} title={title}>
      {children}
    </button>
  );
}

export default function NodeInspector({
  model, profile, selected, fusionModel, pair, onOpenPair, onSelect,
}: Props) {
  const node = model.nodes.find((n) => n.id === selected);

  if (!node) {
    return (
      <div className="p-3">
        <p className="mono text-[9.5px] leading-relaxed text-[var(--muted-2)]">
          Select a node to inspect it. The panel names every edge it carries, the signal root and
          reliability exponent applied to each, and which signals survived root-cause collapse.
        </p>
      </div>
    );
  }

  const edges = model.edges.filter((e) => e.source === node.id || e.target === node.id);
  const other = (e: (typeof edges)[number]) => (e.source === node.id ? e.target : e.source);
  const reliability = fusionModel?.reliability ?? {};

  // Aliases from the gazetteer: other identifiers carried by the same personas.
  const aliases = model.nodes.filter(
    (n) => n.id !== node.id && n.kind === node.kind && n.personas.some((p) => node.personas.includes(p))
  );

  const isWallet = node.kind === "wallet";
  const isHost = node.kind === "infra";

  return (
    <div className="slim h-full overflow-y-auto p-3">
      <div className="mb-2">
        <p className="mono text-[8.5px] uppercase tracking-[0.16em] text-[var(--muted-2)]">
          {node.kind}
          {node.inferred ? " · inferred" : ""}
        </p>
        <p className="mono mt-0.5 break-all text-[12px] font-bold text-[var(--text)]">{node.label}</p>
        <p className="mono mt-1 text-[9px] leading-relaxed text-[var(--muted-2)]">{node.detail}</p>
      </div>

      <dl className="mb-3">
        <Row label="Canonical id" value={node.value} />
        <Row label="Personas" value={node.personas.length ? node.personas.join(", ") : "none recorded"} />
        <Row label="First evidence" value={node.firstSeen?.slice(0, 10) ?? "not recorded"} />
        <Row label="Degree" value={String(edges.length)} />
        {node.inferred && (
          <Row
            label="Derivation"
            value="Pivoted from the actor's onion, not observed on a persona directly."
          />
        )}
      </dl>

      {/* ---- provenance ------------------------------------------------- */}
      <section className="mb-3">
        <h4 className="mono mb-1 text-[9px] uppercase tracking-[0.16em] text-[var(--muted)]">
          Provenance
        </h4>
        <dl>
          <Row label="Sources" value={profile.sources.length ? profile.sources.join(", ") : "not recorded"} />
          <Row label="Last scan" value={profile.last_scan?.slice(0, 10) ?? "not recorded"} />
          <Row label="Actor first seen" value={profile.first_seen?.slice(0, 10) ?? "not recorded"} />
        </dl>
      </section>

      {/* ---- aliases ---------------------------------------------------- */}
      {aliases.length > 0 && (
        <section className="mb-3">
          <h4 className="mono mb-1 text-[9px] uppercase tracking-[0.16em] text-[var(--muted)]">
            Same kind, same personas
          </h4>
          <ul className="space-y-0.5">
            {aliases.slice(0, 8).map((a) => (
              <li key={a.id}>
                <button
                  onClick={() => onSelect(a.id)}
                  className="mono w-full truncate text-left text-[9px] text-[var(--muted-2)] transition hover:text-[var(--text)]"
                >
                  {a.value}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ---- edges ------------------------------------------------------ */}
      <section className="mb-3">
        <h4 className="mono mb-1 text-[9px] uppercase tracking-[0.16em] text-[var(--muted)]">
          Edges ({edges.length})
        </h4>
        <ul className="space-y-1.5">
          {edges.length === 0 && (
            <li className="mono text-[9px] text-[var(--muted-2)]">No edges under the current filters.</li>
          )}
          {edges.map((e) => {
            const r = e.root ? reliability[e.root] : undefined;
            return (
              <li key={e.id} className="border border-[var(--border)] bg-[var(--surface-2)] p-1.5">
                <div className="mono flex items-center justify-between gap-2 text-[9.5px]">
                  <span className="flex min-w-0 items-center gap-1.5">
                    {e.root && (
                      <span
                        aria-hidden="true"
                        className="h-1.5 w-1.5 shrink-0 rounded-full"
                        style={{ background: `var(${signalVar(e.root)})` }}
                      />
                    )}
                    <button
                      onClick={() => onSelect(other(e))}
                      className="truncate text-[var(--text)] transition hover:text-[var(--c-high)]"
                    >
                      {model.nodes.find((n) => n.id === other(e))?.label ?? other(e)}
                    </button>
                  </span>
                  <span className="tnum shrink-0 text-[var(--c-high)]">{e.strength.toFixed(2)}</span>
                </div>
                <p className="mono mt-0.5 text-[8.5px] text-[var(--muted-2)]">
                  {e.kind}
                  {e.root ? ` · ${SIGNAL_LABEL[e.root]}` : " · no signal root"}
                  {" · reliability r = "}
                  {r === undefined ? "not published for this root" : r}
                </p>
                {e.pairId && (
                  <button
                    onClick={() => onOpenPair(e.pairId!)}
                    className="mono mt-1 text-[8.5px] uppercase tracking-[0.1em] text-[var(--muted)] underline decoration-dotted underline-offset-2 transition hover:text-[var(--c-high)]"
                  >
                    Open evidence trail
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      {/* ---- collapse, named -------------------------------------------- */}
      {pair && (
        <section className="mb-3" data-testid="collapse-detail">
          <h4 className="mono mb-1 text-[9px] uppercase tracking-[0.16em] text-[var(--muted)]">
            Root-cause collapse
          </h4>
          <p className="mono mb-1.5 text-[8.5px] leading-relaxed text-[var(--muted-2)]">
            Within each root only the strongest signal survives. Discarded signals are named here
            rather than dropped — this is the step most worth arguing with.
          </p>
          <ul className="space-y-1">
            {Object.entries(pair.roots_collapsed ?? {}).map(([root, names]) => (
              <li key={root} className="border border-[var(--border)] bg-[var(--surface-2)] p-1.5">
                <p className="mono flex items-center gap-1.5 text-[9px] text-[var(--text)]">
                  <span
                    aria-hidden="true"
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ background: `var(${signalVar(root as SignalRoot)})` }}
                  />
                  {SIGNAL_LABEL[root as SignalRoot] ?? root}
                </p>
                <ul className="mt-0.5">
                  {(names ?? []).map((n, i) => (
                    <li
                      key={n}
                      data-survived={i === 0 ? "true" : "false"}
                      className={`mono text-[8.5px] ${i === 0 ? "text-[var(--muted)]" : "text-[var(--muted-2)] line-through"}`}
                    >
                      {n} — {i === 0 ? "survived" : "discarded"}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
            {Object.keys(pair.roots_collapsed ?? {}).length === 0 && (
              <li className="mono text-[9px] text-[var(--muted-2)]">
                Nothing was collapsed for this pair.
              </li>
            )}
          </ul>
        </section>
      )}

      {/* ---- actions ---------------------------------------------------- */}
      <section>
        <h4 className="mono mb-1 text-[9px] uppercase tracking-[0.16em] text-[var(--muted)]">
          Actions
        </h4>
        <div className="flex flex-wrap gap-1.5">
          <Action title="Copy the canonical id" onClick={() => navigator.clipboard?.writeText(node.value)}>
            <Copy className="h-2.5 w-2.5" /> Copy id
          </Action>

          {/* Only offered where a chain trace is actually possible. Offering it
              on a PGP key would imply a capability that does not exist. */}
          {isWallet && (
            <Action
              title="Trace this address on the chain"
              href={`/workbench/actor/${model.actorId}/chain`}
            >
              <ExternalLink className="h-2.5 w-2.5" /> Trace on chain
            </Action>
          )}

          {isHost && (
            <Action title="Locate this host in SANGAM" href={`/sangam?host=${encodeURIComponent(node.value)}`}>
              <MapPin className="h-2.5 w-2.5" /> Open in SANGAM
            </Action>
          )}

          <Action title="Open the case ledger" href="/workbench/case/CASE-001">
            <ScrollText className="h-2.5 w-2.5" /> Case ledger
          </Action>
        </div>
        <p className="mono mt-1.5 text-[8.5px] leading-relaxed text-[var(--muted-2)]">
          Chain tracing is offered on wallet nodes only, and geolocation on hosts only — an action
          that cannot succeed should not be on screen.
        </p>
      </section>
    </div>
  );
}
