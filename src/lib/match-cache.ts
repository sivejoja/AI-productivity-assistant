// In-memory + sessionStorage cache for the currently-displayed shortlist,
// so the detail page can read a match without re-running the AI.
export interface CachedMatch {
  id: string;
  title: string;
  company: string;
  location: string;
  posted: string;
  url: string;
  match_percent: number;
  interview_probability: string;
  why_match: string;
  matched_keywords: string[];
  cover_letter: string;
  checklist: string[];
  description?: string; // full Adzuna description
}

const KEY = "autoapply-current-shortlist-v1";
let mem: Record<string, CachedMatch> = {};

function load(): Record<string, CachedMatch> {
  if (Object.keys(mem).length) return mem;
  if (typeof window === "undefined") return {};
  try {
    mem = JSON.parse(sessionStorage.getItem(KEY) || "{}");
  } catch {
    mem = {};
  }
  return mem;
}

function persist() {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(KEY, JSON.stringify(mem));
  } catch {
    /* ignore */
  }
}

export function setShortlist(matches: CachedMatch[]) {
  mem = {};
  for (const m of matches) mem[m.id] = m;
  persist();
}

export function getMatch(id: string): CachedMatch | null {
  return load()[id] ?? null;
}

export function getAllMatches(): CachedMatch[] {
  return Object.values(load());
}
