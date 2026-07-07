// Pure selectors over the current intercept window — feed the analytics panels.

import { Intercept } from "./mockIntel";

export interface WalletCluster {
  wallet: string;
  count: number;
}

export interface HandleWatch {
  handle: string;
  count: number;
  lastCity: string | null;
}

/** Recurring wallet addresses — reuse across listings is a correlation signal. */
export function walletClusters(intercepts: Intercept[], limit = 7): WalletCluster[] {
  const counts: Record<string, number> = {};
  for (const i of intercepts)
    for (const w of i.entities.wallets) counts[w] = (counts[w] ?? 0) + 1;
  return Object.entries(counts)
    .map(([wallet, count]) => ({ wallet, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

/** Most-seen @handles with the most recent city they were seen near. */
export function handleWatch(intercepts: Intercept[], limit = 7): HandleWatch[] {
  const counts: Record<string, number> = {};
  const lastCity: Record<string, string | null> = {};
  for (const i of intercepts) {
    const city = i.entities.locations[0] ?? null;
    for (const h of i.entities.handles) {
      counts[h] = (counts[h] ?? 0) + 1;
      if (!(h in lastCity)) lastCity[h] = city;
      else if (lastCity[h] === null && city) lastCity[h] = city;
    }
  }
  return Object.entries(counts)
    .map(([handle, count]) => ({ handle, count, lastCity: lastCity[handle] ?? null }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

/** Bucket recent intercept volume into `n` time slots over a rolling window. */
export function activityBuckets(
  intercepts: Intercept[],
  now: number,
  windowMs = 90_000,
  n = 24
): { t: number; v: number }[] {
  const buckets = new Array(n).fill(0);
  const slot = windowMs / n;
  for (const i of intercepts) {
    const age = now - i.timestamp;
    if (age < 0 || age >= windowMs) continue;
    const idx = n - 1 - Math.floor(age / slot);
    if (idx >= 0 && idx < n) buckets[idx] += 1;
  }
  return buckets.map((v, i) => ({ t: i, v }));
}

/** Index of a volume spike (bucket clearly above the local average), or -1. */
export function spikeIndex(buckets: { v: number }[]): number {
  const vals = buckets.map((b) => b.v);
  const nonZero = vals.filter((v) => v > 0);
  if (nonZero.length === 0) return -1;
  const mean = nonZero.reduce((a, b) => a + b, 0) / nonZero.length;
  let maxIdx = -1;
  let maxVal = 0;
  vals.forEach((v, i) => {
    if (v > maxVal) {
      maxVal = v;
      maxIdx = i;
    }
  });
  return maxVal >= 2 && maxVal > mean * 1.5 ? maxIdx : -1;
}
