// Match history log — every generated shortlist with filters + feedback snapshot.
import type { CachedMatch } from "./match-cache";

const KEY = "autoapply-history-v1";
const MAX = 50;

export interface HistoryEntry {
  id: string;
  ts: number;
  filters: {
    role: string;
    where: string;
    country: string;
    strictness: number;
    targetCategories: string[];
    excludeTags: string[];
  };
  matches: CachedMatch[];
  feedback: Record<string, "relevant" | "not_for_me">;
}

function read(): HistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
}
function write(list: HistoryEntry[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
}

export function listHistory(): HistoryEntry[] {
  return read().sort((a, b) => b.ts - a.ts);
}

export function getHistoryEntry(id: string): HistoryEntry | null {
  return read().find((e) => e.id === id) ?? null;
}

export function recordHistory(entry: Omit<HistoryEntry, "id" | "ts">): HistoryEntry {
  const next: HistoryEntry = { ...entry, id: crypto.randomUUID(), ts: Date.now() };
  write([next, ...read()]);
  return next;
}

export function deleteHistory(id: string) {
  write(read().filter((e) => e.id !== id));
}

export function clearHistory() {
  write([]);
}
