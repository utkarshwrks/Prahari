/**
 * Optional IP allowlist for the Command Panel (DEC-058).
 *
 * `ADMIN_IP_ALLOWLIST` is a comma-separated list of CIDR ranges or bare
 * addresses. OFF BY DEFAULT: an empty variable allows everything, because a
 * hackathon deployment and a district office have very different networks and
 * an allowlist that defaults to "localhost only" would silently lock out every
 * demo.
 *
 * When it IS set, it is enforced before anything else in the guard — a
 * deployment that restricted the panel to an office range means it, and should
 * not be spending bcrypt or ledger writes on traffic it has already refused.
 *
 * The address comes from `x-forwarded-for`, which is spoofable by anyone who
 * can reach the app directly. That is stated rather than papered over: this is
 * a control that works BEHIND a trusted proxy that overwrites the header, and
 * it is defence in depth, never the only gate. The role check and the step-up
 * do not trust it.
 */

export interface Rule {
  /** IPv4 as a 32-bit integer, or null for an IPv6/opaque literal match. */
  base: number | null;
  bits: number;
  literal: string | null;
}

function parseIpv4(ip: string): number | null {
  const parts = ip.trim().split(".");
  if (parts.length !== 4) return null;
  let out = 0;
  for (const p of parts) {
    if (!/^\d{1,3}$/.test(p)) return null;
    const n = Number(p);
    if (n > 255) return null;
    out = (out << 8) | n;
  }
  return out >>> 0;
}

export function parseRule(entry: string): Rule | null {
  const raw = entry.trim();
  if (!raw) return null;
  const [addr, maskPart] = raw.split("/");
  const base = parseIpv4(addr);
  if (base === null) {
    // IPv6 or something unparseable: fall back to an exact string match rather
    // than silently dropping the rule, which would widen the allowlist.
    return { base: null, bits: 0, literal: addr.trim().toLowerCase() };
  }
  const bits = maskPart === undefined ? 32 : Number(maskPart);
  if (!Number.isInteger(bits) || bits < 0 || bits > 32) return null;
  return { base, bits, literal: null };
}

export function parseAllowlist(value: string | undefined): Rule[] {
  if (!value?.trim()) return [];
  return value
    .split(",")
    .map(parseRule)
    .filter((r): r is Rule => r !== null);
}

export function matches(rules: Rule[], ip: string): boolean {
  const clean = ip.trim().toLowerCase();
  const v4 = parseIpv4(clean);
  return rules.some((r) => {
    if (r.literal !== null) return r.literal === clean;
    if (v4 === null || r.base === null) return false;
    if (r.bits === 0) return true;
    const mask = r.bits === 32 ? 0xffffffff : (0xffffffff << (32 - r.bits)) >>> 0;
    return (v4 & mask) >>> 0 === (r.base & mask) >>> 0;
  });
}

/** First hop of x-forwarded-for, else x-real-ip. */
export function clientIp(headers: Headers): string {
  return (
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headers.get("x-real-ip") ||
    ""
  );
}

/**
 * The gate. An unset allowlist allows everything; a set one that cannot
 * identify the caller REFUSES, because "we could not tell who this is" is not
 * a reason to admit them to an admin panel.
 */
export function ipAllowed(headers: Headers, env: string | undefined = process.env.ADMIN_IP_ALLOWLIST): boolean {
  const rules = parseAllowlist(env);
  if (rules.length === 0) return true;
  const ip = clientIp(headers);
  if (!ip) return false;
  return matches(rules, ip);
}
