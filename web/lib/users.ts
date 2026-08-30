// Server-only local user store. Persists new signups to data/users.json via fs,
// so auth works fully offline with no external database. Passwords are bcrypt-
// hashed. A seeded demo officer account ALWAYS works for the pitch.
import "server-only";
import { promises as fs } from "fs";
import path from "path";
import bcrypt from "bcryptjs";

export interface AppUser {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  role?: string;
}

const DATA_DIR = path.join(process.cwd(), "data");
const USERS_FILE = path.join(DATA_DIR, "users.json");

// Seeded demo officer — credentials shown on the login page.
export const DEMO_EMAIL = "officer@mp.gov.in";
export const DEMO_PASSWORD = "prahari123";

const DEMO_USER: AppUser = {
  id: "demo-officer",
  email: DEMO_EMAIL,
  name: "Officer · MP Cyber Cell",
  role: "officer",
  // hashed once per process from the constant above
  passwordHash: bcrypt.hashSync(DEMO_PASSWORD, 10),
};

async function ensureFile(): Promise<void> {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.access(USERS_FILE);
  } catch {
    await fs.writeFile(USERS_FILE, "[]", "utf8");
  }
}

async function readFileUsers(): Promise<AppUser[]> {
  await ensureFile();
  try {
    const raw = await fs.readFile(USERS_FILE, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as AppUser[]) : [];
  } catch {
    return [];
  }
}

/** All users = seeded demo + everyone who signed up. */
export async function getAllUsers(): Promise<AppUser[]> {
  const fileUsers = await readFileUsers();
  return [DEMO_USER, ...fileUsers];
}

export async function findUserByEmail(email: string): Promise<AppUser | null> {
  const norm = email.trim().toLowerCase();
  const all = await getAllUsers();
  return all.find((u) => u.email.toLowerCase() === norm) ?? null;
}

export interface CreateUserInput {
  email: string;
  name: string;
  password: string;
}

export interface CreateUserResult {
  ok: boolean;
  error?: string;
  user?: Omit<AppUser, "passwordHash">;
}

/** Persist a new user to data/users.json (bcrypt-hashed). */
export async function createUser(
  input: CreateUserInput
): Promise<CreateUserResult> {
  const email = input.email.trim().toLowerCase();
  const name = input.name.trim();

  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
    return { ok: false, error: "Enter a valid email address." };
  if (!name) return { ok: false, error: "Enter your name." };
  if (!input.password || input.password.length < 6)
    return { ok: false, error: "Password must be at least 6 characters." };

  const existing = await findUserByEmail(email);
  if (existing) return { ok: false, error: "An account with that email already exists." };

  const fileUsers = await readFileUsers();
  const user: AppUser = {
    id: `usr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    email,
    name,
    role: "officer",
    passwordHash: await bcrypt.hash(input.password, 10),
  };
  fileUsers.push(user);
  await fs.writeFile(USERS_FILE, JSON.stringify(fileUsers, null, 2), "utf8");

  return {
    ok: true,
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
  };
}

/** Verify credentials — used by the NextAuth Credentials provider. */
export async function verifyCredentials(
  email: string,
  password: string
): Promise<Omit<AppUser, "passwordHash"> | null> {
  const user = await findUserByEmail(email);
  if (!user) return null;
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return null;
  return { id: user.id, email: user.email, name: user.name, role: user.role };
}
