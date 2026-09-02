/**
 * ONE SOURCE OF TRUTH FOR THE SELECTED ACTOR (DEC-056).
 *
 * The single-page cockpit fetched the profile in `Workbench.tsx` and passed it
 * down, which worked because there was one page. The workspace splits that page
 * into ten routes, and the obvious implementation -- each route fetching what it
 * needs -- would refetch on every tab change and, worse, could render two
 * different confidences for one actor if a refetch landed between them.
 *
 * In a product whose entire claim is "every published score reproduces from its
 * trail exactly" (INV-10), the dossier showing 0.991 while the context bar shows
 * 0.987 is not a rendering glitch. It is the screen contradicting itself about
 * evidence.
 *
 * So: one store, one cache keyed by actor id, one object read by the dossier,
 * the graph, the evidence trail, the timeline and the map. Navigating between
 * tabs does not refetch and cannot re-render a different number.
 * `__tests__/workspace.test.ts` asserts both properties.
 */
import { create } from "zustand";
import { api, detailOf, type ActorProfile, type Timeline } from "./api";

/** Why a load failed, kept distinct so the UI can be honest about which (INV-9). */
export type LoadError =
  | { kind: "offline"; detail: string }
  | { kind: "not-found"; detail: string }
  | { kind: "failed"; detail: string };

interface Entry {
  profile: ActorProfile | null;
  timeline: Timeline | null;
  error: LoadError | null;
  /** In flight, so two components mounting at once share one request. */
  pending: Promise<void> | null;
}

interface WorkspaceState {
  actorId: string | null;
  entries: Record<string, Entry>;
  /** Last route visited per actor, so returning restores the tab you left. */
  lastRoute: Record<string, string>;
  /** Counts every network call, so a test can prove there are no duplicates. */
  fetchCount: number;

  selectActor: (id: string | null) => void;
  loadActor: (id: string) => Promise<void>;
  rememberRoute: (actorId: string, route: string) => void;
  invalidate: (id: string) => void;
  reset: () => void;
}

const EMPTY: Entry = { profile: null, timeline: null, error: null, pending: null };

function classify(d: unknown): LoadError | null {
  const o = d as { ok?: boolean; engine?: string };
  // detailOf, not `o.detail`: a FastAPI 422 carries detail as an array of
  // objects, and rendering that threw React #31 and blanked the route.
  if (o?.engine === "offline") {
    return { kind: "offline", detail: detailOf(d, "Engine offline.") };
  }
  if (!o?.ok) {
    return { kind: "not-found", detail: detailOf(d, "Unknown actor.") };
  }
  return null;
}

export const useWorkspace = create<WorkspaceState>((set, get) => ({
  actorId: null,
  entries: {},
  lastRoute: {},
  fetchCount: 0,

  selectActor: (id) => set({ actorId: id }),

  loadActor: async (id) => {
    const existing = get().entries[id];

    // Already loaded, or already loading. Either way, do not fetch again --
    // this is the whole point of the store.
    if (existing?.profile || existing?.error) return;
    if (existing?.pending) return existing.pending;

    const run = (async () => {
      const d = await api.actor(id);
      const error = classify(d);
      set((s) => ({
        fetchCount: s.fetchCount + 1,
        entries: {
          ...s.entries,
          [id]: {
            profile: error ? null : (d as ActorProfile),
            timeline: null,
            error,
            pending: null,
          },
        },
      }));
      if (error) return;

      // The timeline is a second, independent call: a profile that renders
      // without it is far better than a dossier that renders not at all.
      const t = await api.timeline(id);
      set((s) => ({
        fetchCount: s.fetchCount + 1,
        entries: {
          ...s.entries,
          [id]: {
            ...(s.entries[id] ?? EMPTY),
            timeline: "ok" in t && t.ok ? (t as Timeline) : null,
          },
        },
      }));
    })();

    set((s) => ({
      entries: { ...s.entries, [id]: { ...(s.entries[id] ?? EMPTY), pending: run } },
    }));
    return run;
  },

  rememberRoute: (actorId, route) =>
    set((s) => ({ lastRoute: { ...s.lastRoute, [actorId]: route } })),

  /** Drop a cached actor, so a mutation elsewhere can force a real refetch. */
  invalidate: (id) =>
    set((s) => {
      const next = { ...s.entries };
      delete next[id];
      return { entries: next };
    }),

  reset: () => set({ actorId: null, entries: {}, lastRoute: {}, fetchCount: 0 }),
}));

/** The selected actor's entry, or an empty one. Never undefined. */
export function useActorEntry(id: string | null): Entry {
  return useWorkspace((s) => (id ? (s.entries[id] ?? EMPTY) : EMPTY));
}

/**
 * The confidence shown in the context bar.
 *
 * Deliberately derived from the SAME cached object the dossier renders, rather
 * than fetched or recomputed. The store invariant test asserts the two agree on
 * every route.
 */
export function useActorConfidence(id: string | null): number | null {
  return useWorkspace((s) => (id ? (s.entries[id]?.profile?.attribution_confidence ?? null) : null));
}

/** Confidence band, the triage vocabulary used across the workspace. */
export type Band = "strong" | "worth-a-look" | "weak";

export function bandOf(confidence: number | null): Band {
  if (confidence !== null && confidence >= 0.9) return "strong";
  if (confidence !== null && confidence >= 0.75) return "worth-a-look";
  return "weak";
}

export const BAND_LABEL: Record<Band, string> = {
  strong: "Strong case",
  "worth-a-look": "Worth a look",
  weak: "Weak / unresolved",
};

/** Bands are thresholds on a measured number, stated so the UI cannot drift. */
export const BAND_THRESHOLD: Record<Band, string> = {
  strong: "≥ 0.90",
  "worth-a-look": "≥ 0.75",
  weak: "< 0.75 or unresolved",
};
