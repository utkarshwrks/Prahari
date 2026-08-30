import { create } from "zustand";
import { persist } from "zustand/middleware";

export type CaseStatus = "Open" | "In Progress" | "Escalated" | "Closed";
export type CaseSeverity = "low" | "medium" | "high";

export interface CaseRecord {
  id: string;
  title: string;
  city: string;
  category: string; // Drugs | Weapons | Data | Counterfeit | Other
  severity: CaseSeverity;
  status: CaseStatus;
  assignee: string;
  wallet?: string;
  handle?: string;
  notes: string;
  sourceText?: string;
  createdAt: number;
  updatedAt: number;
}

export const CASE_STATUSES: CaseStatus[] = ["Open", "In Progress", "Escalated", "Closed"];
export const CASE_CATEGORIES = ["Drugs", "Weapons", "Data", "Counterfeit", "Other"];
export const CASE_OFFICERS = ["Insp. R. Verma", "SI A. Yadav", "SI P. Nema", "HC S. Ali", "Unassigned"];

function makeId() {
  return `CASE-${Date.now().toString(36).toUpperCase().slice(-5)}-${Math.floor(Math.random() * 1296)
    .toString(36)
    .toUpperCase()
    .padStart(2, "0")}`;
}

// A few seed records so the module is populated on first open.
const SEED: CaseRecord[] = [
  {
    id: "CASE-SEED-01",
    title: "MDMA/LSD ring — Jabalpur delivery",
    city: "Jabalpur",
    category: "Drugs",
    severity: "high",
    status: "In Progress",
    assignee: "SI A. Yadav",
    handle: "@nightowl_mp",
    wallet: "bc1q7xk3f2m9v0",
    notes: "Repeat handle across 3 listings. Field unit notified.",
    sourceText: "Marketplace listing: MDMA & LSD, delivery across Jabalpur and Katni. @nightowl_mp",
    createdAt: Date.now() - 1000 * 60 * 60 * 26,
    updatedAt: Date.now() - 1000 * 60 * 60 * 3,
  },
  {
    id: "CASE-SEED-02",
    title: "Aadhaar/PAN data dump — MP region",
    city: "Bhopal",
    category: "Data",
    severity: "medium",
    status: "Open",
    assignee: "Unassigned",
    wallet: "1A1zP1eP5QGefi2",
    notes: "Awaiting triage.",
    sourceText: "Data dump: ~50k Aadhaar+PAN records, MP region (Bhopal, Indore).",
    createdAt: Date.now() - 1000 * 60 * 60 * 12,
    updatedAt: Date.now() - 1000 * 60 * 60 * 12,
  },
  {
    id: "CASE-SEED-03",
    title: "Counterfeit currency pickup — Katni",
    city: "Katni",
    category: "Counterfeit",
    severity: "high",
    status: "Escalated",
    assignee: "Insp. R. Verma",
    handle: "@rupeeforge",
    notes: "Escalated to district SP. In-zone breach.",
    sourceText: "Paste: counterfeit currency, pickup Katni. @rupeeforge",
    createdAt: Date.now() - 1000 * 60 * 60 * 5,
    updatedAt: Date.now() - 1000 * 60 * 30,
  },
];

interface RecordsState {
  records: CaseRecord[];
  addRecord: (r: Partial<CaseRecord>) => string;
  updateRecord: (id: string, patch: Partial<CaseRecord>) => void;
  deleteRecord: (id: string) => void;
  clearAll: () => void;
}

export const useRecords = create<RecordsState>()(
  persist(
    (set) => ({
      records: SEED,
      addRecord: (r) => {
        const id = r.id ?? makeId();
        const now = Date.now();
        const rec: CaseRecord = {
          id,
          title: r.title?.trim() || "Untitled case",
          city: r.city ?? "",
          category: r.category ?? "Other",
          severity: r.severity ?? "medium",
          status: r.status ?? "Open",
          assignee: r.assignee ?? "Unassigned",
          wallet: r.wallet,
          handle: r.handle,
          notes: r.notes ?? "",
          sourceText: r.sourceText,
          createdAt: now,
          updatedAt: now,
        };
        set((s) => ({ records: [rec, ...s.records] }));
        return id;
      },
      updateRecord: (id, patch) =>
        set((s) => ({
          records: s.records.map((r) =>
            r.id === id ? { ...r, ...patch, updatedAt: Date.now() } : r
          ),
        })),
      deleteRecord: (id) =>
        set((s) => ({ records: s.records.filter((r) => r.id !== id) })),
      clearAll: () => set({ records: [] }),
    }),
    { name: "prahari-records-v1" }
  )
);
