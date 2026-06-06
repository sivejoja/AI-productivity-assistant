// CV state is intentionally NOT persisted across sessions.
// Every time the user opens the app, they start with a fresh CV.
export function loadCv(): string | null {
  return null;
}

export function saveCv(_text: string): void {
  /* no-op: do not remember uploaded CV across reloads */
}

export function clearCv(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem("ai-workplace:cv");
  } catch {
    /* ignore */
  }
}
