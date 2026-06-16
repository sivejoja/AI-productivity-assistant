// Target categories + exclusion tags to refine future AI matches.
const KEY = "autoapply-prefs-v1";

export interface Prefs {
  targetCategories: string[];
  excludeTags: string[];
}

export function loadPrefs(): Prefs {
  if (typeof window === "undefined") return { targetCategories: [], excludeTags: [] };
  try {
    const p = JSON.parse(localStorage.getItem(KEY) || "{}");
    return {
      targetCategories: Array.isArray(p.targetCategories) ? p.targetCategories : [],
      excludeTags: Array.isArray(p.excludeTags) ? p.excludeTags : [],
    };
  } catch {
    return { targetCategories: [], excludeTags: [] };
  }
}

export function savePrefs(p: Prefs) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(p));
}
