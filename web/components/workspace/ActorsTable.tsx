"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowDown, ArrowUp, Search } from "lucide-react";
import { api, detailOf, type ActorList, type ActorRow } from "@/lib/api";
import { BAND_LABEL, BAND_THRESHOLD, bandOf, useWorkspace, type Band } from "@/lib/workspace";

/**
 * The full-width, faceted, sortable actor list (DEC-056).
 *
 * ALL of its state lives in the query string -- search, band, sort field and
 * direction. That is the deep-linkable requirement, and it is not decoration:
 * an analyst who has narrowed 123 actors to the four worth arguing about needs
 * to send that view to a colleague, not a description of how to rebuild it.
 *
 * Sorting and band filtering happen client-side over the fetched page, and the
 * caption says so. The engine's `min_confidence` does the server-side work; a
 * UI that implied it was sorting the whole index when it was sorting 500 rows
 * would be overstating what it did.
 */

type SortKey = "confidence" | "label" | "personas" | "posts" | "last_seen";

const SORTS: { key: SortKey; label: string }[] = [
  { key: "confidence", label: "Confidence" },
  { key: "label", label: "Handle" },
  { key: "personas", label: "Personas" },
  { key: "posts", label: "Posts" },
  { key: "last_seen", label: "Last seen" },
];

const BANDS: (Band | "all")[] = ["all", "strong", "worth-a-look", "weak"];

/** The engine caps `limit` at 200. Asking for more returns 422, not more rows. */
export const ACTOR_PAGE = 200;

function valueFor(r: ActorRow, k: SortKey): string | number {
  switch (k) {
    case "confidence":
      return r.attribution_confidence ?? -1;
    case "label":
      return r.label.toLowerCase();
    case "personas":
      return r.personas;
    case "posts":
      return r.post_count;
    case "last_seen":
      return r.last_seen ?? "";
  }
}

export default function ActorsTable() {
  const router = useRouter();
  const params = useSearchParams();
  const selectActor = useWorkspace((s) => s.selectActor);

  const q = params.get("q") ?? "";
  const band = (params.get("band") as Band | null) ?? "all";
  const sort = (params.get("sort") as SortKey | null) ?? "confidence";
  const dir = params.get("dir") === "asc" ? "asc" : "desc";

  const [data, setData] = useState<ActorList | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [draft, setDraft] = useState(q);

  // One writer for the URL, so every control round-trips identically.
  const setParam = useCallback(
    (patch: Record<string, string | null>) => {
      const next = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v === null || v === "") next.delete(k);
        else next.set(k, v);
      }
      router.replace(`/workbench/actors${next.toString() ? `?${next}` : ""}`, { scroll: false });
    },
    [params, router]
  );

  useEffect(() => setDraft(q), [q]);

  // Debounce the search box into the URL rather than into local state, so the
  // address bar is always the source of truth.
  useEffect(() => {
    if (draft === q) return;
    const t = setTimeout(() => setParam({ q: draft || null }), 220);
    return () => clearTimeout(t);
  }, [draft, q, setParam]);

  useEffect(() => {
    let alive = true;
    setErr(null);
    (async () => {
      // 200 is the engine's ceiling (`limit: int = Query(50, ge=1, le=200)`).
      // Asking for more is a 422, not a bigger page.
      const res = await api.actors(q, 0, ACTOR_PAGE);
      if (!alive) return;
      if ("ok" in res && res.ok) setData(res as ActorList);
      else setErr(detailOf(res, "Engine offline."));
    })();
    return () => {
      alive = false;
    };
  }, [q]);

  const rows = useMemo(() => {
    let out = data?.actors ?? [];
    if (band !== "all") out = out.filter((r) => bandOf(r.attribution_confidence) === band);
    const mult = dir === "asc" ? 1 : -1;
    return [...out].sort((a, b) => {
      const av = valueFor(a, sort);
      const bv = valueFor(b, sort);
      if (av === bv) return a.actor_id.localeCompare(b.actor_id); // stable tiebreak
      return av > bv ? mult : -mult;
    });
  }, [data, band, sort, dir]);

  return (
    <div className="glass flex h-[calc(100vh-96px)] min-h-[420px] flex-col overflow-hidden">
      {/* ---- facets ---------------------------------------------------- */}
      <div className="hairline shrink-0 space-y-2 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <label className="relative flex-1 min-w-[200px]">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--muted-2)]" />
            <span className="sr-only">Search actors</span>
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="handle, PGP, wallet, actor id"
              className="mono w-full border border-[var(--border)] bg-[var(--surface-2)] py-2 pl-8 pr-2 text-[11px] text-[var(--text)] outline-none transition focus:border-[var(--accent-dim)] placeholder:text-[var(--muted-2)]"
            />
          </label>

          <div role="group" aria-label="Confidence band" className="flex flex-wrap gap-1">
            {BANDS.map((b) => (
              <button
                key={b}
                onClick={() => setParam({ band: b === "all" ? null : b })}
                aria-pressed={band === b}
                title={b === "all" ? "Every actor" : BAND_THRESHOLD[b]}
                className={`mono border px-2 py-1.5 text-[9px] uppercase tracking-[0.12em] transition ${
                  band === b
                    ? "border-[var(--accent)] text-[var(--c-high)]"
                    : "border-[var(--border)] text-[var(--muted-2)] hover:text-[var(--muted)]"
                }`}
              >
                {b === "all" ? "All" : BAND_LABEL[b]}
              </button>
            ))}
          </div>
        </div>

        <p className="mono text-[9px] leading-relaxed text-[var(--muted-2)]">
          {data
            ? `${rows.length} of ${data.total} actors. Search runs on the engine; band and sort are applied to the ${data.count} rows fetched${data.total > data.count ? ` (the engine returns at most ${ACTOR_PAGE} per page, so narrow the search to sort the rest)` : ""}.`
            : err
              ? err
              : "Loading actors…"}
        </p>
      </div>

      {/* ---- table ----------------------------------------------------- */}
      <div className="slim min-h-0 flex-1 overflow-auto">
        <table className="w-full border-collapse">
          <thead className="sticky top-0 z-10 bg-[var(--surface)]">
            <tr>
              {SORTS.map((s) => {
                const active = sort === s.key;
                return (
                  <th
                    key={s.key}
                    scope="col"
                    aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : "none"}
                    className="border-b border-[var(--border)] px-2.5 py-2 text-left"
                  >
                    <button
                      onClick={() =>
                        setParam({
                          sort: s.key,
                          dir: active && dir === "desc" ? "asc" : "desc",
                        })
                      }
                      className={`mono flex items-center gap-1 text-[8.5px] uppercase tracking-[0.16em] transition ${
                        active ? "text-[var(--c-high)]" : "text-[var(--muted-2)] hover:text-[var(--muted)]"
                      }`}
                    >
                      {s.label}
                      {active &&
                        (dir === "asc" ? (
                          <ArrowUp className="h-2.5 w-2.5" />
                        ) : (
                          <ArrowDown className="h-2.5 w-2.5" />
                        ))}
                    </button>
                  </th>
                );
              })}
              <th scope="col" className="border-b border-[var(--border)] px-2.5 py-2 text-left">
                <span className="mono text-[8.5px] uppercase tracking-[0.16em] text-[var(--muted-2)]">
                  Markets
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="mono px-2.5 py-6 text-center text-[10px] text-[var(--muted-2)]">
                  {data ? "No actors match this view." : err ? "Engine offline." : "Loading…"}
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.actor_id} className="border-b border-[var(--border)] last:border-0">
                <td className="px-2.5 py-2">
                  <span className="mono tnum text-[11px] font-bold text-[var(--c-high)]">
                    {r.attribution_confidence === null
                      ? "not measured"
                      : r.attribution_confidence.toFixed(2)}
                  </span>
                </td>
                <td className="px-2.5 py-2">
                  <Link
                    href={`/workbench/actor/${r.actor_id}`}
                    onClick={() => selectActor(r.actor_id)}
                    className="mono text-[11px] text-[var(--text)] transition hover:text-[var(--c-high)]"
                  >
                    {r.label}
                  </Link>
                  <span className="mono ml-2 text-[9px] text-[var(--muted-2)]">{r.actor_id}</span>
                </td>
                <td className="mono tnum px-2.5 py-2 text-[10px] text-[var(--muted)]">{r.personas}</td>
                <td className="mono tnum px-2.5 py-2 text-[10px] text-[var(--muted)]">{r.post_count}</td>
                <td className="mono px-2.5 py-2 text-[10px] text-[var(--muted-2)]">
                  {r.last_seen ?? "not recorded"}
                </td>
                <td className="mono max-w-[22ch] truncate px-2.5 py-2 text-[9.5px] text-[var(--muted-2)]">
                  {r.markets.join(", ")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
