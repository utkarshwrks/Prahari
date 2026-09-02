/**
 * The generative skin engine.
 *
 * PRAHARI regenerates its look so the product feels freshly built each visit,
 * while every data feature stays identical. A skin is nothing but a palette +
 * type + shape token set, defined in globals.css under `html[data-skin="…"]`.
 *
 * ---------------------------------------------------------------------------
 * DEC-055 — the draw is a property of the VISIT, not of the page load.
 * ---------------------------------------------------------------------------
 *
 * The original picker re-rolled on every document load. Any full navigation,
 * hard refresh, or route that escaped the client router repainted the entire
 * product in a different palette mid-investigation -- and moved the rail from
 * one side to the other. In a tool where colour carries meaning that is not
 * cosmetic; see `lib/signals.ts` for the half of this bug that mattered most.
 *
 * Resolution order, applied synchronously in the pre-paint head script so there
 * is still no flash and no layout shift:
 *
 *   | # | Source                              | Lifetime                     |
 *   |---|-------------------------------------|------------------------------|
 *   | 1 | `?skin=` query param                | that request only            |
 *   | 2 | localStorage["prahari.skin.lock"]   | permanent, user-set          |
 *   | 3 | sessionStorage["prahari.skin.session"] | THE VISIT — the fix       |
 *   | 4 | fresh random draw                   | written to sessionStorage    |
 *
 * Tier 1 deliberately does NOT overwrite the session draw: `?skin=abyss` is for
 * screenshots and bug reports, and it must not silently repaint the analyst's
 * visit from under them when they navigate away from that one URL.
 */

export interface Skin {
  id: string;
  name: string;
  accent: string; // representative colour, for the swatch in the control
  mood: string;
}

export const SKINS: Skin[] = [
  { id: "ember",   name: "Ember",   accent: "#E8503A", mood: "near-black · ember" },
  { id: "abyss",   name: "Abyss",   accent: "#38BDF8", mood: "deep navy · cyan" },
  { id: "verdant", name: "Verdant", accent: "#34D399", mood: "black-green · emerald" },
  { id: "plasma",  name: "Plasma",  accent: "#C084FC", mood: "violet-black · magenta" },
  { id: "solar",   name: "Solar",   accent: "#FB923C", mood: "warm black · gold" },
  { id: "arctic",  name: "Arctic",  accent: "#22D3EE", mood: "blue-graphite · ice" },
];

export const LAYOUTS = ["a", "b"] as const;
export type LayoutId = (typeof LAYOUTS)[number];

/**
 * Display/mono type pairs, drawn independently of the skin.
 *
 * Previously each skin pinned its own `--font-disp`, so the type could only
 * change when the palette did. The font pair is now its own draw and lives in
 * the same session record -- because type shifting between routes is exactly as
 * disorienting as the palette shifting, and both were doing it.
 */
export const FONT_PAIRS = [0, 1, 2] as const;
export type FontPair = (typeof FONT_PAIRS)[number];

export const SKIN_IDS = SKINS.map((s) => s.id);

export const STORAGE_KEYS = {
  /** Permanent, user-set via ThemeControl. Survives new visits. */
  lock: "prahari.skin.lock",
  /** The visit. Cleared by the browser when the tab closes. */
  session: "prahari.skin.session",
  /** Pre-DEC-055 lock key, read once for migration. Never written. */
  legacyLock: "prahari-skin-lock",
} as const;

/** The session record. Versioned so an older shape is discarded, not crashed on. */
export interface SkinSession {
  skin: string;
  layout: LayoutId;
  fontPair: FontPair;
  drawnAt: number;
  v: 2;
}

export const SESSION_VERSION = 2 as const;

// ---------------------------------------------------------------------------
// Resolution, as a pure function.
//
// The pre-paint script below is a hand-written mirror of this logic: it has to
// be dependency-free inline JS, so it cannot import from here. The two are kept
// honest by `__tests__/skins.test.ts` (which asserts the script contains the
// same keys, tiers and guards) and, decisively, by the Phase 1 e2e walk, which
// drives the REAL script across six routes and a hard reload. Neither check
// alone would be enough; the pair is.
// ---------------------------------------------------------------------------

/** Minimal storage surface, so tests can inject a throwing or absent store. */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface ResolveInput {
  /** Value of `?skin=`, or null. */
  forced?: string | null;
  local?: StorageLike | null;
  session?: StorageLike | null;
  /** Injectable for determinism in tests. */
  random?: () => number;
  now?: () => number;
}

export interface ResolvedDraw {
  skin: string;
  layout: LayoutId;
  fontPair: FontPair;
  /** Which tier answered. Rendered by ThemeControl, and asserted in tests. */
  source: "query" | "lock" | "session" | "fresh";
  /** True when the draw must be persisted to sessionStorage by the caller. */
  persist: boolean;
}

const isSkin = (v: unknown): v is string => typeof v === "string" && SKIN_IDS.includes(v);
const isLayout = (v: unknown): v is LayoutId => v === "a" || v === "b";
const isFontPair = (v: unknown): v is FontPair =>
  typeof v === "number" && (FONT_PAIRS as readonly number[]).includes(v);

/**
 * In-memory fallback, module-scoped.
 *
 * Safari private mode, embedded webviews and some enterprise policies make even
 * READING storage throw. A skin is not worth a blank page, so every access is
 * guarded and falls back here -- the draw is then stable for the SPA lifetime,
 * which is the best that can be offered without storage.
 */
let memorySession: SkinSession | null = null;

export function readMemorySession(): SkinSession | null {
  return memorySession;
}
export function resetMemorySession(): void {
  memorySession = null;
}

function safeGet(store: StorageLike | null | undefined, key: string): string | null {
  try {
    return store?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

/** Parse a stored session record, rejecting anything of the wrong shape or version. */
export function parseSession(raw: string | null): SkinSession | null {
  if (!raw) return null;
  try {
    const o = JSON.parse(raw) as Partial<SkinSession>;
    if (!o || o.v !== SESSION_VERSION) return null; // older shape: discard, don't crash
    if (!isSkin(o.skin) || !isLayout(o.layout) || !isFontPair(o.fontPair)) return null;
    return {
      skin: o.skin,
      layout: o.layout,
      fontPair: o.fontPair,
      drawnAt: typeof o.drawnAt === "number" ? o.drawnAt : 0,
      v: SESSION_VERSION,
    };
  } catch {
    return null; // corrupt JSON is a discarded record, never an exception
  }
}

/** The four-tier resolution. Pure: it reads, it never writes. */
export function resolveDraw(input: ResolveInput = {}): ResolvedDraw {
  const { forced = null, local = null, session = null } = input;
  const random = input.random ?? Math.random;

  const stored = parseSession(safeGet(session, STORAGE_KEYS.session)) ?? memorySession;

  // Tier 1 — ?skin=, for this request only. Layout and type still come from the
  // visit, so a shared screenshot URL does not also reshuffle the furniture.
  if (isSkin(forced)) {
    return {
      skin: forced,
      layout: stored?.layout ?? LAYOUTS[Math.floor(random() * LAYOUTS.length)],
      fontPair: stored?.fontPair ?? (FONT_PAIRS[Math.floor(random() * FONT_PAIRS.length)] as FontPair),
      source: "query",
      persist: false,
    };
  }

  // Tier 2 — an explicit lock beats the session draw, and survives new visits.
  const lock =
    safeGet(local, STORAGE_KEYS.lock) ?? safeGet(local, STORAGE_KEYS.legacyLock);
  if (isSkin(lock)) {
    return {
      skin: lock,
      layout: stored?.layout ?? LAYOUTS[Math.floor(random() * LAYOUTS.length)],
      fontPair: stored?.fontPair ?? (FONT_PAIRS[Math.floor(random() * FONT_PAIRS.length)] as FontPair),
      source: "lock",
      persist: !stored,
    };
  }

  // Tier 3 — the visit. This is the fix.
  if (stored) {
    return { ...stored, source: "session", persist: false };
  }

  // Tier 4 — a fresh draw, which the caller must persist.
  return {
    skin: SKIN_IDS[Math.floor(random() * SKIN_IDS.length)],
    layout: LAYOUTS[Math.floor(random() * LAYOUTS.length)],
    fontPair: FONT_PAIRS[Math.floor(random() * FONT_PAIRS.length)] as FontPair,
    source: "fresh",
    persist: true,
  };
}

/** Persist a draw for the rest of the visit. Falls back to memory on throw. */
export function persistSession(
  draw: Pick<ResolvedDraw, "skin" | "layout" | "fontPair">,
  session?: StorageLike | null,
  now: () => number = Date.now
): SkinSession {
  const record: SkinSession = { ...draw, drawnAt: now(), v: SESSION_VERSION };
  memorySession = record;
  try {
    session?.setItem(STORAGE_KEYS.session, JSON.stringify(record));
  } catch {
    // Storage refused. The in-memory copy above still holds the draw stable
    // for the SPA lifetime, and first paint is unaffected.
  }
  return record;
}

/** Apply a draw to <html>. The single place these attributes are written. */
export function applyDraw(
  draw: Pick<ResolvedDraw, "skin" | "layout" | "fontPair">,
  root: { setAttribute(name: string, value: string): void }
): void {
  root.setAttribute("data-skin", draw.skin);
  root.setAttribute("data-layout", draw.layout);
  root.setAttribute("data-font", String(draw.fontPair));
}

// ---------------------------------------------------------------------------
// The pre-paint script.
//
// Injected into <head>. Dependency-free and synchronous so it applies before
// first paint. Every storage access is individually wrapped: a throw on read
// must not prevent the draw, and a throw on write must not prevent the paint.
// The outermost catch still sets a skin, so the worst case is a default
// palette, never an unstyled page.
// ---------------------------------------------------------------------------
export const SKIN_PICKER_SCRIPT = `
(function(){
  var ids=${JSON.stringify(SKIN_IDS)};
  var layouts=${JSON.stringify(LAYOUTS)};
  var fonts=${JSON.stringify(FONT_PAIRS)};
  var LOCK=${JSON.stringify(STORAGE_KEYS.lock)};
  var LEGACY=${JSON.stringify(STORAGE_KEYS.legacyLock)};
  var SESSION=${JSON.stringify(STORAGE_KEYS.session)};
  var V=${SESSION_VERSION};
  var d=document.documentElement;
  function get(store,key){ try{ return window[store].getItem(key); }catch(e){ return null; } }
  function pick(a){ return a[Math.floor(Math.random()*a.length)]; }
  try{
    var stored=null;
    try{
      var raw=get('sessionStorage',SESSION);
      if(raw){
        var o=JSON.parse(raw);
        if(o&&o.v===V&&ids.indexOf(o.skin)>=0&&layouts.indexOf(o.layout)>=0&&fonts.indexOf(o.fontPair)>=0){ stored=o; }
      }
    }catch(e){ stored=null; }

    var url=new URL(window.location.href);
    var forced=url.searchParams.get('skin');
    var lock=get('localStorage',LOCK)||get('localStorage',LEGACY);

    var skin,layout,font,src,persist;
    if(forced&&ids.indexOf(forced)>=0){
      skin=forced; src='query'; persist=false;
      layout=stored?stored.layout:pick(layouts); font=stored?stored.fontPair:pick(fonts);
    }else if(lock&&ids.indexOf(lock)>=0){
      skin=lock; src='lock'; persist=!stored;
      layout=stored?stored.layout:pick(layouts); font=stored?stored.fontPair:pick(fonts);
    }else if(stored){
      skin=stored.skin; layout=stored.layout; font=stored.fontPair; src='session'; persist=false;
    }else{
      skin=pick(ids); layout=pick(layouts); font=pick(fonts); src='fresh'; persist=true;
    }

    d.setAttribute('data-skin',skin);
    d.setAttribute('data-layout',layout);
    d.setAttribute('data-font',String(font));
    d.setAttribute('data-skin-source',src);
    d.setAttribute('data-fresh',src==='fresh'?'1':'0');

    if(persist){
      try{ window.sessionStorage.setItem(SESSION,JSON.stringify({skin:skin,layout:layout,fontPair:font,drawnAt:Date.now(),v:V})); }catch(e){}
    }
  }catch(e){
    d.setAttribute('data-skin','ember');
    d.setAttribute('data-layout','a');
    d.setAttribute('data-font','0');
    d.setAttribute('data-skin-source','fallback');
  }
})();
`;
