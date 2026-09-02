/**
 * Build identity, read from the environment at BUILD TIME (DEC-063).
 *
 * Never hardcoded. A version string typed into a source file is a version
 * string that is wrong the moment someone forgets to bump it — and a footer
 * confidently displaying the wrong commit is worse than one displaying nothing,
 * because it tells a judge the deployment is something it is not.
 *
 * Where a value genuinely is not available, the getters return null and the
 * footer renders "not reported" rather than a placeholder. DEC-047's rule
 * applies here as much as it does to the landing-page metrics: a number on
 * screen comes from somewhere real, or it does not appear.
 *
 * `NEXT_PUBLIC_` is required because this renders in the browser. A commit SHA
 * and an environment name are not secrets — the SHA is in the public repository
 * and the environment is visible from the URL.
 */

/** Seven characters is what a human reads and what `git log --oneline` shows. */
function shortSha(v: string | undefined): string | null {
  const s = v?.trim();
  return s ? s.slice(0, 7) : null;
}

/**
 * The commit SHA.
 *
 * Render exposes `RENDER_GIT_COMMIT`, Vercel exposes
 * `NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA`, and a local build has neither. All three
 * are checked so the footer is correct wherever it is deployed, rather than
 * correct on one platform and blank on the others.
 */
export const BUILD_SHA: string | null =
  shortSha(process.env.NEXT_PUBLIC_BUILD_SHA) ??
  shortSha(process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA) ??
  shortSha(process.env.NEXT_PUBLIC_RENDER_GIT_COMMIT);

/** The product version. Falls back to null, never to a guessed number. */
export const BUILD_VERSION: string | null =
  process.env.NEXT_PUBLIC_BUILD_VERSION?.trim() || null;

/**
 * The environment.
 *
 * `NODE_ENV` is deliberately NOT used as the source of truth here. `next start`
 * reports "production" for a local run over plain HTTP — the same mismatch that
 * broke the session cookie in DEC-059 — so a footer keyed to it would tell an
 * analyst on localhost that they were looking at production.
 */
export const BUILD_ENV: string | null =
  process.env.NEXT_PUBLIC_BUILD_ENV?.trim() || null;

export interface BuildInfo {
  version: string | null;
  sha: string | null;
  environment: string | null;
}

export const buildInfo: BuildInfo = {
  version: BUILD_VERSION,
  sha: BUILD_SHA,
  environment: BUILD_ENV,
};

/** One line for the footer. Omits what it does not know. */
export function buildLine(info: BuildInfo = buildInfo): string {
  const parts = [
    info.version ? `v${info.version}` : null,
    info.sha ? `build ${info.sha}` : null,
    info.environment,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : "build details not reported";
}
