// Tiny localStorage-backed CV store shared across features.
const KEY = "ai-workplace:cv";

export function loadCv(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function saveCv(text: string): void {
  if (typeof window === "undefined") return;
  try {
    if (text.trim().length === 0) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, text);
  } catch {
    /* ignore quota errors */
  }
}

export function clearCv(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
