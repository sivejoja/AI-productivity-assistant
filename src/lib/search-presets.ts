// Saved search presets for the AutoApply page.
const KEY = "autoapply-presets-v1";

export interface SearchPreset {
  id: string;
  name: string;
  role: string;
  where: string;
  country: string;
  strictness: number;
  targetCategories: string[];
  excludeTags: string[];
  ts: number;
}

function read(): SearchPreset[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
}

function write(list: SearchPreset[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(list));
}

export function listPresets(): SearchPreset[] {
  return read().sort((a, b) => b.ts - a.ts);
}

export function savePreset(p: Omit<SearchPreset, "id" | "ts">): SearchPreset {
  const list = read();
  const existing = list.find((x) => x.name === p.name);
  const entry: SearchPreset = {
    ...p,
    id: existing?.id ?? crypto.randomUUID(),
    ts: Date.now(),
  };
  const next = existing
    ? list.map((x) => (x.id === existing.id ? entry : x))
    : [...list, entry];
  write(next);
  return entry;
}

export function deletePreset(id: string) {
  write(read().filter((p) => p.id !== id));
}
