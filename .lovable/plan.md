
## Goal
Fix the broken "upload CV → see matched jobs" flow on `/autoapply`, and add five new capabilities the user requested.

## 1. Bug fix — "upload CV doesn't fit my CV to jobs and doesn't show jobs"
Most likely causes (will confirm by running once):
- AI returning empty `matches` at the default 70% strictness — drop default to 55% and show raw live jobs as a fallback when AI returns zero matches, so the user always sees something.
- JSON parse failing on prose-wrapped output — make `parseJsonResponse` more tolerant and surface the raw AI text in a collapsible "debug" panel on parse failure.
- Hidden-by-feedback: if every match is filtered by previous "not for me", show an empty-state with a "Clear filters" button instead of a silent blank.

## 2. Job detail page
- New route `src/routes/autoapply.$jobId.tsx` showing: full title/company/location, full description from Adzuna, application link, full "Why this job matches" with all matched keywords, cover letter, checklist.
- Store the current shortlist in a small in-memory + `sessionStorage` cache (`src/lib/match-cache.ts`) keyed by job id so the detail page can read it without re-running AI.
- Each match card on the list gets a "View details" link.

## 3. Saved search presets
- New `src/lib/search-presets.ts` (localStorage). A preset captures: role, where, country, strictness, target categories, exclusion tags.
- New "Presets" dropdown on `/autoapply` and `/sa-gov-jobs` with Save / Load / Delete.

## 4. Email shortlist as PDF/CSV
- New `src/lib/email-shortlist.functions.ts` server fn using the existing Lovable email infra (POSTs to `/lovable/email/transactional/send`) with a base64 PDF attachment built server-side via `jspdf`.
- New email template `src/lib/email-templates/job-shortlist.tsx` summarising filters + top 5 matches, with the full shortlist attached.
- UI: "Email me this shortlist" button next to existing CSV/PDF buttons, takes recipient email.
- Note: file attachments are NOT supported by the scaffolded send route. Workaround: render full shortlist (titles, %, why, apply links) directly inside the email body, and also include CSV-as-text appendix. Honest with user about why no attachment.

## 5. Target categories + exclusion tags
- New `src/lib/preference-store.ts` storing `targetCategories: string[]` and `excludeTags: string[]` in localStorage.
- New "Preferences" section on `/autoapply`: chip-style inputs for both.
- Send both to AI in `options` (extend `autoapply` system prompt to honour `target_categories` and `exclude_tags`).

## 6. Match history log
- New `src/lib/match-history.ts` storing every generated shortlist (timestamp, filters, matches, feedback snapshot) in localStorage (cap 50 entries).
- New route `src/routes/autoapply.history.tsx` listing past runs with: when, filter summary, # matches, # marked relevant/not-for-me, "Re-export CSV/PDF" and "Re-email" buttons.

## Technical notes
- All persistence is localStorage — no DB migration needed.
- Email send uses existing Lovable email infrastructure; if not yet provisioned the UI will show "Set up email" call-to-action.
- AI prompt updated once to accept `target_categories`, `exclude_tags`, lowered default strictness, and to ALWAYS return at least the top 5 live jobs (even at low match) when the user has no other matches, so the screen is never blank.

## Files to add
- `src/lib/match-cache.ts`
- `src/lib/search-presets.ts`
- `src/lib/preference-store.ts`
- `src/lib/match-history.ts`
- `src/lib/email-shortlist.functions.ts`
- `src/lib/email-templates/job-shortlist.tsx`
- `src/routes/autoapply.$jobId.tsx`
- `src/routes/autoapply.history.tsx`

## Files to edit
- `src/routes/autoapply.tsx` — bug fix, presets UI, preferences UI, email button, detail link, history link
- `supabase/functions/ai-assist/index.ts` — accept new options, fallback rule
- `src/components/app-sidebar.tsx` — add "Match history" link

This is a sizeable change set. Want me to proceed with all of it, or trim to a subset (e.g. fix the bug + detail page + history first, then the rest)?
