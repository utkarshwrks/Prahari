/**
 * SEMANTIC COLOUR — the colours that carry meaning.
 *
 * This is the fix hiding underneath the skin bug (DEC-055).
 *
 * PRAHARI reskins itself, and that is fine for atmosphere: palette, type and
 * shape are decoration. But in this product some colour is not decoration. In
 * the relationship graph colour IS the entity type; on the evidence trail
 * colour IS the signal root. If those move when the skin is redrawn, an analyst
 * comparing two actors sees the colour semantics shift under them mid-
 * investigation. That is not cosmetic -- it is an evidence-integrity problem.
 *
 * So they live here, in one module, as literals:
 *
 *   - defined ONCE, never inside an `html[data-skin]` block,
 *   - mirrored into `:root` in globals.css as `--sig-*` / `--ent-*` tokens for
 *     anything that styles through CSS,
 *   - exported as hex for the DOM and as 0xRRGGBB for three.js, from the same
 *     source, so the 3D graph and its legend cannot drift apart.
 *
 * `__tests__/signals.test.ts` asserts all four of those properties, including
 * that no skin block redefines a semantic token.
 *
 * Chosen for distinguishability under the common colour-vision deficiencies and
 * for legibility on every one of the six skin backgrounds, which are all dark.
 * Shape and label always carry the same information as colour (INV-11), so a
 * colour-blind or monochrome reader loses nothing.
 */

/** The six signal roots the fusion engine collapses evidence into. */
export type SignalRoot =
  | "identity_key"
  | "infra"
  | "financial"
  | "temporal"
  | "linguistic"
  | "social";

/** Entity kinds drawn as nodes in the relationship graph. */
export type EntityKind =
  | "actor"
  | "persona"
  | "pgp"
  | "wallet"
  | "email"
  | "onion"
  | "infra";

/**
 * Signal-root colour. Read by the evidence trail, the LR table and the graph's
 * edge colouring.
 *
 * Before DEC-055 every root's bar was drawn with
 * `linear-gradient(var(--accent-dim), var(--accent))` -- so all six roots were
 * the SAME colour, and that colour changed with the skin. Bar length was the
 * only encoding, and the one thing colour did carry was skin-dependent.
 */
export const SIGNAL_COLOR: Record<SignalRoot, string> = {
  identity_key: "#e8503a", // red    — keys and fingerprints
  infra: "#9b7fd8",        // violet — hosts, certificates, ASNs
  financial: "#d9a441",    // amber  — wallets and flows
  temporal: "#5b9bd5",     // blue   — timing and activity
  linguistic: "#4fa97e",   // green  — style and authorship
  social: "#c98bb0",       // pink   — co-presence and reference
};

/** Human labels, so the legend and the trail cannot disagree. */
export const SIGNAL_LABEL: Record<SignalRoot, string> = {
  identity_key: "Identity key",
  infra: "Infrastructure",
  financial: "Financial",
  temporal: "Temporal",
  linguistic: "Linguistic",
  social: "Social",
};

/** Entity-kind colour. Node colour in the graph, and its legend. */
export const ENTITY_COLOR: Record<EntityKind, string> = {
  actor: "#e8503a",
  persona: "#e9e9ee",
  pgp: "#e8503a",
  wallet: "#d9a441",
  email: "#5b9bd5",
  onion: "#7fb77e",
  infra: "#9b7fd8",
};

/** The same entity colours as three.js integers, from the same literals. */
export const ENTITY_COLOR_HEX: Record<EntityKind, number> = Object.fromEntries(
  Object.entries(ENTITY_COLOR).map(([k, v]) => [k, Number.parseInt(v.slice(1), 16)])
) as Record<EntityKind, number>;

/** CSS custom-property name for a signal root. Mirrored in globals.css :root. */
export const signalVar = (root: SignalRoot): string =>
  `--sig-${root === "identity_key" ? "identity" : root}`;

/** CSS custom-property name for an entity kind. */
export const entityVar = (kind: EntityKind): string => `--ent-${kind}`;

export const SIGNAL_ROOTS = Object.keys(SIGNAL_COLOR) as SignalRoot[];
export const ENTITY_KINDS = Object.keys(ENTITY_COLOR) as EntityKind[];
