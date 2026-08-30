/**
 * Engine client. Every call goes through the server-side proxy, so the browser
 * never learns the engine's URL or holds a key.
 */

export interface EngineError {
  ok: false;
  engine?: "offline";
  detail?: string;
}

async function call<T>(path: string, init?: RequestInit): Promise<T | EngineError> {
  try {
    const res = await fetch(`/api/engine/${path}`, { cache: "no-store", ...init });
    return (await res.json()) as T;
  } catch {
    return { ok: false, engine: "offline", detail: "Engine unreachable." };
  }
}

export const api = {
  actors: (q = "", minConfidence = 0, limit = 60) =>
    call<ActorList>(
      `actors?q=${encodeURIComponent(q)}&min_confidence=${minConfidence}&limit=${limit}`
    ),
  actor: (id: string) => call<ActorProfile>(`actor/${encodeURIComponent(id)}`),
  timeline: (id: string, bucket = "week") =>
    call<Timeline>(`actor/${encodeURIComponent(id)}/timeline?bucket=${bucket}`),
  pair: (pairId: string) => call<PairScore>(`fusion/pair/${encodeURIComponent(pairId)}`),
  example: () => call<PairScore>("fusion/example"),
  threshold: (alpha: number) => call<Threshold>(`fusion/threshold?alpha=${alpha}`),
  metrics: () => call<EvalMetrics>("fusion/metrics"),
  model: () => call<FusionModel>("fusion/model"),
  infraPivot: (onion: string) => call<InfraPivot>(`infra/pivot?onion=${encodeURIComponent(onion)}`),
  certificates: (domain: string) => call<CertResult>(`infra/certificates?domain=${encodeURIComponent(domain)}`),
  ledger: (caseId: string) => call<Ledger>(`audit/case/${caseId}/ledger`),
  seal: (caseId: string) => call<SealResult>(`audit/case/${caseId}/seal`, { method: "POST" }),
  verify: (body: unknown) =>
    call<VerifyResult>("audit/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  sources: () => call<SourcesResult>("sources"),
  version: () => call<VersionResult>("version"),
  torStart: (n = 24) => call<TorStatus>(`tor/experiment?n=${n}`, { method: "POST" }),
  torStatus: () => call<TorStatus>("tor/status"),
  extract: (text: string) =>
    call<ExtractResult>("extract", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    }),
};

// ---- shapes ---------------------------------------------------------------

export interface ActorRow {
  actor_id: string;
  label: string;
  personas: number;
  markets: string[];
  categories: string[];
  attribution_confidence: number | null;
  flags: string[];
  first_seen: string | null;
  last_seen: string | null;
  post_count: number;
}
export interface ActorList { ok: boolean; total: number; count: number; actors: ActorRow[] }

export interface PersonaSummary {
  id: string; handle: string; market: string;
  first_seen: string | null; last_seen: string | null;
  post_count: number; categories: string[]; role: string;
}
export interface Identifier { kind: string; value: string; personas: string[]; shared: boolean }
export interface Linkage {
  persona_a: string; persona_b: string; confidence: number;
  roots: string[]; negatives: string[]; basis: string;
}
export interface ActorProfile {
  ok: boolean;
  actor_id: string; label: string;
  personas: PersonaSummary[];
  identifiers: Identifier[];
  infrastructure: { clearnet_host: string; strength: number; evidence: InfraEvidence[] }[];
  linkages: Linkage[];
  attribution_confidence: number | null;
  confidence_basis: string;
  categories: string[]; markets: string[];
  first_seen: string | null; last_seen: string | null; last_scan: string | null;
  sources: string[]; post_count: number; flags: string[];
  detail?: string;
}
export interface InfraEvidence { rule: string; strength: number; detail: string; source: string }
export interface InfraPivot {
  ok: boolean; onion: string; count: number;
  results: { clearnet_host: string; strength: number; evidence: InfraEvidence[] }[];
  detail?: string;
}
export interface CertResult {
  ok: boolean; domain: string; source: string | null; count: number;
  certificates: { sha256: string | null; dns_names: string[]; issuer: string | null }[];
  error?: string | null;
}
export interface Timeline {
  ok: boolean; actor_id: string; bucket: string; buckets: string[];
  series: { persona_id: string; handle: string; counts: number[] }[];
  detail?: string;
}
export interface RootRow { signal: string; s: number; lr: number; r: number; lr_pow_r: number }
export interface PairScore {
  ok: boolean; pair_id: string; p_raw: number; p_calibrated: number | null;
  naive_stack: number; cap_applied: number | null;
  roots_used: Record<string, RootRow>;
  roots_collapsed: Record<string, string[]>;
  negatives: { name: string; root: string }[];
  trail: {
    prior_odds: number; prior_label: string; lr_total: number;
    posterior_odds: number; caps: string[]; dropped_roots: string[]; roots_absent: string[];
  };
  reproduced_from_trail?: number;
  detail?: string;
}
export interface Threshold {
  ok: boolean; alpha: number; tau: number;
  empirical_false_merge_rate: number; guarantee_holds: boolean;
  accepted: number; detail: string;
}
export interface EvalMetrics {
  ok: boolean; precision: number; recall: number; f1: number;
  false_merge_rate: number; brier: number; ece: number; tau: number; alpha: number;
  guarantee_holds: boolean; n_pairs: number;
}
export interface FusionModel {
  ok: boolean; roots: string[]; reliability: Record<string, number>;
  caps: Record<string, number>; formula: string; naive_baseline: string;
}
export interface LedgerRecord {
  seq: number; action: string; actor: string; ts: string;
  prev_hash: string; hash: string; signature: string | null;
}
export interface Ledger {
  ok: boolean; case_id: string; records: LedgerRecord[];
  merkle_root: string; leaf_count: number;
  verification: { ok: boolean; failing_index: number | null; reason: string | null; checks: Record<string, unknown> };
  seal: SealResult | null; detail?: string; engine?: string;
}
export interface SealResult {
  ok: boolean; chain_label?: string; chain_id?: number | null;
  tx_hash?: string | null; block?: number | null; gas_used?: number | null;
  is_public_chain?: boolean; explorer_url?: string | null;
  merkle_root?: string; detail?: string | null;
}
export interface VerifyResult {
  ok: boolean; failing_index?: number | null; reason?: string | null;
  merkle_root_matches?: boolean; n_records?: number; detail?: string;
}
export interface SourcesResult {
  ok: boolean; count: number; database: boolean;
  scheduler: { running: boolean; jobs: string[]; last_graph_reload: string | null };
  sources: { name: string; kind: string; requires_key: boolean; key_present: boolean; freshness_s: number | null; items_24h: number }[];
}
export interface VersionResult {
  service: string; version: string; environment: string;
  capabilities: Record<string, { enabled: boolean; detail: string }>;
}
export interface TorResult {
  confidence: number; peak_lag_ms: number; pearson: number;
  n_client: number; n_service: number; matched: number; bin_ms: number; detail: string;
}
export interface TorStatus {
  ok: boolean; state: string; transport: string; onion: string | null;
  bootstrap_pct: number; client_events: number[]; service_events: number[];
  result: TorResult | null; detail: string;
}

export interface ExtractResult {
  ok: boolean; source: string;
  entities: Record<string, string[]>;
  unresolved_locations: number;
}
