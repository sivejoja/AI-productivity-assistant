// Persistent per-job feedback so the AI learns the user's preferences.
const KEY = "autoapply-feedback-v1";

export type FeedbackValue = "relevant" | "not_for_me";

export interface FeedbackEntry {
  url: string;
  title: string;
  company: string;
  value: FeedbackValue;
  ts: number;
}

function read(): Record<string, FeedbackEntry> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(KEY) || "{}");
  } catch {
    return {};
  }
}

function write(map: Record<string, FeedbackEntry>) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(map));
}

export function getAllFeedback(): FeedbackEntry[] {
  return Object.values(read()).sort((a, b) => b.ts - a.ts);
}

export function getFeedback(url: string): FeedbackValue | null {
  return read()[url]?.value ?? null;
}

export function setFeedback(entry: Omit<FeedbackEntry, "ts">) {
  const map = read();
  map[entry.url] = { ...entry, ts: Date.now() };
  write(map);
}

export function clearFeedback(url: string) {
  const map = read();
  delete map[url];
  write(map);
}

// Compact string of "Not for me" titles+companies for the AI prompt.
export function buildAvoidList(limit = 25): string {
  return getAllFeedback()
    .filter((e) => e.value === "not_for_me")
    .slice(0, limit)
    .map((e) => `"${e.title} @ ${e.company}"`)
    .join(", ");
}
