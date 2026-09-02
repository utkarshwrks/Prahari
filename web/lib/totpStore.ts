/**
 * Where a user's TOTP enrolment lives (DEC-059).
 *
 * `data/totp.json`, alongside `data/users.json`, for the same reason: the
 * playbook forbids a managed service and the deployment target is a single
 * node. It is gitignored — an enrolment file in version control is a shared
 * second factor, which is no second factor.
 *
 * The secret is stored as issued. That is a real limitation and it is stated
 * rather than hidden: encrypting it at rest would need a key that lives on the
 * same disk, which moves the problem rather than solving it. What protects it
 * is file permissions and the fact that reaching it already means having the
 * server. The recovery codes ARE hashed, because those are the ones a user
 * might reuse elsewhere.
 */
import "server-only";
import { promises as fs } from "fs";
import path from "path";
import { enrol, type TotpState } from "./totp";
import { pepper } from "./passwords";

const FILE = path.join(process.cwd(), "data", "totp.json");

type Store = Record<string, TotpState & { enrolledAt: string }>;

async function read(): Promise<Store> {
  try {
    const raw = await fs.readFile(FILE, "utf8");
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as Store) : {};
  } catch {
    return {};
  }
}

async function write(store: Store): Promise<void> {
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  // 0600: the file holds second-factor secrets, so it is readable by the
  // service account and nothing else.
  await fs.writeFile(FILE, JSON.stringify(store, null, 2), { encoding: "utf8", mode: 0o600 });
}

export async function stateFor(userId: string): Promise<TotpState | null> {
  const store = await read();
  return store[userId] ?? null;
}

export async function isEnrolled(userId: string): Promise<boolean> {
  return (await stateFor(userId)) !== null;
}

/** Enrol, returning the plaintext codes ONCE. Refuses to overwrite silently. */
export async function beginEnrolment(userId: string, account: string, force: boolean) {
  const store = await read();
  if (store[userId] && !force) return { ok: false as const, error: "already-enrolled" };

  const e = enrol(account, pepper());
  store[userId] = {
    secret: e.secret,
    recoveryHashes: e.recoveryHashes,
    usedCodes: [],
    usedRecovery: [],
    enrolledAt: new Date().toISOString(),
  };
  await write(store);
  return { ok: true as const, uri: e.uri, recoveryCodes: e.recoveryCodes };
}

/** Persist the replay bookkeeping a verification mutated. */
export async function persist(userId: string, state: TotpState): Promise<void> {
  const store = await read();
  const existing = store[userId];
  if (!existing) return;
  store[userId] = { ...existing, usedCodes: state.usedCodes, usedRecovery: state.usedRecovery };
  await write(store);
}

/** Drop an enrolment entirely — an admin resetting a lost authenticator. */
export async function clearEnrolment(userId: string): Promise<boolean> {
  const store = await read();
  if (!store[userId]) return false;
  delete store[userId];
  await write(store);
  return true;
}
