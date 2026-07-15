import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Briefcase, Sparkles, Upload, ExternalLink, MapPin, Calendar, Building2,
  ThumbsUp, ThumbsDown, FileDown, FileSpreadsheet, Target, CheckCircle2,
  Save, History as HistoryIcon, Mail, X, Trash2, ChevronRight, Play, SlidersHorizontal, Eye,
} from "lucide-react";
import { FeatureShell } from "@/components/feature-shell";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { callAi } from "@/lib/ai";
import { extractCvText } from "@/lib/cv-parser";
import { extractCvSignals, formatCvPreface } from "@/lib/cv-signals";
import { loadCv, saveCv } from "@/lib/cv-store";
import { searchJobs } from "@/lib/jobs.functions";
import {
  buildAvoidList, getFeedback, setFeedback, clearFeedback, type FeedbackValue,
} from "@/lib/job-feedback";
import { downloadMatchesCsv, downloadMatchesPdf, matchesToCsvString, type ExportMatch } from "@/lib/match-export";
import { setShortlist, type CachedMatch } from "@/lib/match-cache";
import {
  listPresets, savePreset, deletePreset, type SearchPreset,
} from "@/lib/search-presets";
import { loadPrefs, savePrefs } from "@/lib/preference-store";
import { recordHistory } from "@/lib/match-history";
import { toast } from "sonner";

export const Route = createFileRoute("/autoapply")({
  component: AutoApply,
});


const COUNTRIES = [
  ["us", "United States"], ["gb", "United Kingdom"], ["au", "Australia"],
  ["ca", "Canada"], ["de", "Germany"], ["fr", "France"], ["nl", "Netherlands"],
  ["in", "India"], ["za", "South Africa"], ["sg", "Singapore"],
] as const;

interface Match extends CachedMatch {}

interface AiResult {
  profile?: {
    headline?: string;
    skills?: string[];
    experience?: string;
    best_fit_roles?: string[];
  };
  suggested_roles?: { role: string; why: string }[];
  matches?: Match[];
  note?: string;
}

function postedAgo(iso: string) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  return `${days} days ago`;
}

function parseJsonResponse(raw: string): AiResult | null {
  if (!raw) return null;
  let text = raw.trim();
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) text = fenced[1].trim();
  if (!text.startsWith("{")) {
    const first = text.indexOf("{");
    const last = text.lastIndexOf("}");
    if (first !== -1 && last !== -1) text = text.slice(first, last + 1);
  }
  try {
    return JSON.parse(text) as AiResult;
  } catch {
    return null;
  }
}

function strictnessLabel(v: number) {
  if (v >= 85) return "Very strict";
  if (v >= 70) return "Strict";
  if (v >= 55) return "Balanced";
  if (v >= 40) return "Flexible";
  return "Very flexible";
}

function probabilityColor(p: string) {
  const x = (p || "").toLowerCase();
  if (x.includes("very high")) return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30";
  if (x.includes("high")) return "bg-green-500/15 text-green-700 dark:text-green-300 border-green-500/30";
  if (x.includes("medium")) return "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30";
  return "bg-muted text-muted-foreground";
}

// Small chip-input for category / tag lists.
function ChipInput({
  value, onChange, placeholder,
}: { value: string[]; onChange: (v: string[]) => void; placeholder: string }) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const v = draft.trim();
    if (!v) return;
    if (!value.includes(v)) onChange([...value, v]);
    setDraft("");
  };
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add(); }
          }}
          placeholder={placeholder}
        />
        <Button type="button" size="sm" variant="outline" onClick={add}>Add</Button>
      </div>
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {value.map((v) => (
            <Badge key={v} variant="secondary" className="gap-1 text-xs">
              {v}
              <button
                onClick={() => onChange(value.filter((x) => x !== v))}
                className="ml-0.5 rounded-full hover:bg-muted-foreground/20"
                aria-label={`Remove ${v}`}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

function AutoApply() {
  const [cv, setCv] = useState(() => loadCv() ?? "");
  const [role, setRole] = useState("");
  const [where, setWhere] = useState("");
  const [country, setCountry] = useState("us");
  const [strictness, setStrictness] = useState(55);
  const initialPrefs = typeof window !== "undefined" ? loadPrefs() : { targetCategories: [], excludeTags: [] };
  const [targetCategories, setTargetCategories] = useState<string[]>(initialPrefs.targetCategories);
  const [excludeTags, setExcludeTags] = useState<string[]>(initialPrefs.excludeTags);
  const [result, setResult] = useState<AiResult | null>(null);
  const [rawLiveFallback, setRawLiveFallback] = useState<Match[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [feedbackTick, setFeedbackTick] = useState(0);
  const [presets, setPresets] = useState<SearchPreset[]>(() =>
    typeof window !== "undefined" ? listPresets() : [],
  );
  const [presetName, setPresetName] = useState("");
  const [emailTo, setEmailTo] = useState("");
  const searchFn = useServerFn(searchJobs);

  useEffect(() => {
    savePrefs({ targetCategories, excludeTags });
  }, [targetCategories, excludeTags]);

  const onFile = async (file: File | null) => {
    if (!file) return;
    if (file.size > 10_000_000) return toast.error("File too large (max 10MB).");
    setParsing(true);
    try {
      const text = (await extractCvText(file)).replace(/\s+\n/g, "\n").trim();
      if (text.length < 30) return toast.error("Couldn't extract readable text.");
      setCv(text);
      saveCv(text);
      toast.success(`Loaded ${file.name}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not read file.");
    } finally {
      setParsing(false);
    }
  };

  const generate = async () => {
    if (cv.trim().length < 50) return toast.error("Upload or paste your CV first.");
    saveCv(cv);
    setLoading(true);
    setResult(null);
    setRawLiveFallback(null);
    try {
      const search = await searchFn({
        data: {
          what: role, where, country,
          page: 1, results_per_page: 20, max_days_old: 30, sort_by: "date",
        },
      });
      if (search.error) toast.error(search.error);
      const live = search.jobs ?? [];
      if (live.length === 0) {
        toast.error("No live jobs found. Try a broader keyword or different country.");
        setLoading(false);
        return;
      }
      const jobsForAi = live.slice(0, 15).map((j) => ({
        id: j.id, title: j.title, company: j.company, location: j.location,
        posted: postedAgo(j.created), url: j.redirect_url,
        snippet: j.description.slice(0, 600),
      }));
      const input = `CANDIDATE CV:\n${cv}\n\nPREFERENCES: role="${role || "(open)"}", location="${where || "(any)"}", country=${country}\n\nLIVE JOB LISTINGS:\n${JSON.stringify(jobsForAi, null, 2)}`;
      const content = await callAi({
        feature: "autoapply",
        input,
        options: {
          strictness: String(strictness),
          avoid_titles: buildAvoidList(),
          target_categories: targetCategories.join(", "),
          exclude_tags: excludeTags.join(", "),
        },
      });
      const parsed = parseJsonResponse(content);

      // Build raw-live fallback regardless, so the screen is never empty.
      const fallback: Match[] = live.slice(0, 10).map((j) => ({
        id: j.id,
        title: j.title,
        company: j.company,
        location: j.location,
        posted: postedAgo(j.created),
        url: j.redirect_url,
        match_percent: 0,
        interview_probability: "Unknown",
        why_match: "AI ranking unavailable — showing raw live listing.",
        matched_keywords: [],
        cover_letter: "",
        checklist: [],
        description: j.description,
      }));

      if (!parsed || !Array.isArray(parsed.matches) || parsed.matches.length === 0) {
        setRawLiveFallback(fallback);
        setShortlist(fallback);
        toast.message(
          !parsed ? "AI returned unexpected format — showing raw live listings."
                  : "No AI matches — showing raw live listings instead.",
        );
        setLoading(false);
        return;
      }

      // Enrich each match with the full description from live listings.
      const liveById = new Map(live.map((j) => [j.id, j]));
      const enriched: Match[] = parsed.matches.map((m) => ({
        ...m,
        description: liveById.get(m.id)?.description ?? "",
      }));
      const finalResult: AiResult = { ...parsed, matches: enriched };
      setResult(finalResult);
      setShortlist(enriched);

      // Record to history (strip description to keep localStorage small)
      recordHistory({
        filters: { role, where, country, strictness, targetCategories, excludeTags },
        matches: enriched.map(({ description: _d, ...rest }) => rest),
        feedback: {},
      });

    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Match failed");
    } finally {
      setLoading(false);
    }
  };

  const handleFeedback = (m: Match, value: FeedbackValue) => {
    const current = getFeedback(m.url);
    if (current === value) {
      clearFeedback(m.url);
      toast.success("Feedback cleared");
    } else {
      setFeedback({ url: m.url, title: m.title, company: m.company, value });
      toast.success(value === "relevant"
        ? "Marked relevant — future runs will favour similar roles."
        : "Hidden — future runs will avoid similar roles.");
    }
    setFeedbackTick((n) => n + 1);
  };

  const allMatches: Match[] = result?.matches ?? rawLiveFallback ?? [];
  const visibleMatches = useMemo(() => {
    return allMatches.filter((m) => getFeedback(m.url) !== "not_for_me");
  }, [allMatches, feedbackTick]); // eslint-disable-line react-hooks/exhaustive-deps

  const exportData: ExportMatch[] = useMemo(
    () => visibleMatches.map((m) => ({
      title: m.title, company: m.company, location: m.location, posted: m.posted,
      url: m.url, match_percent: m.match_percent,
      interview_probability: m.interview_probability,
      why_match: m.why_match, matched_keywords: m.matched_keywords ?? [],
    })),
    [visibleMatches],
  );

  const handleSavePreset = () => {
    if (!presetName.trim()) return toast.error("Name your preset first.");
    const p = savePreset({
      name: presetName.trim(), role, where, country, strictness,
      targetCategories, excludeTags,
    });
    setPresets(listPresets());
    setPresetName("");
    toast.success(`Saved "${p.name}"`);
  };

  const handleLoadPreset = (id: string) => {
    const p = presets.find((x) => x.id === id);
    if (!p) return;
    setRole(p.role); setWhere(p.where); setCountry(p.country);
    setStrictness(p.strictness);
    setTargetCategories(p.targetCategories ?? []);
    setExcludeTags(p.excludeTags ?? []);
    toast.success(`Loaded "${p.name}"`);
  };

  const handleDeletePreset = (id: string) => {
    deletePreset(id);
    setPresets(listPresets());
  };

  const handleEmailShortlist = () => {
    if (!emailTo.trim()) return toast.error("Enter an email address.");
    if (!exportData.length) return toast.error("No matches to email.");
    const subject = `Your job shortlist (${exportData.length} matches)`;
    const lines = [
      `Generated: ${new Date().toLocaleString()}`,
      `Filters: role="${role || "(open)"}", where="${where || "(any)"}", country=${country}, strictness=${strictness}%`,
      targetCategories.length ? `Target categories: ${targetCategories.join(", ")}` : "",
      excludeTags.length ? `Excluded tags: ${excludeTags.join(", ")}` : "",
      "",
      "── MATCHES ──",
      "",
      ...exportData.map((m, i) =>
        `${i + 1}. ${m.title} — ${m.company}\n   Match ${m.match_percent}% · ${m.interview_probability} · ${m.location} · ${m.posted}\n   Why: ${m.why_match}\n   Apply: ${m.url}\n`,
      ),
      "",
      "Tip: download the CSV/PDF from the AI Auto Apply page to attach a file copy.",
    ].filter(Boolean).join("\n");
    const href = `mailto:${encodeURIComponent(emailTo)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(lines)}`;
    window.location.href = href;
    toast.success("Opening your email client…");
  };

  return (
    <FeatureShell
      title="AI Auto Apply"
      description="Live jobs ranked against your CV. Tune strictness, give thumbs up/down to teach the AI, save presets, and export your shortlist."
      icon={<Briefcase className="h-5 w-5" />}
    >
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Button asChild size="sm" variant="outline">
          <Link to="/autoapply/history">
            <HistoryIcon className="h-3.5 w-3.5" />
            <span className="ml-1.5 text-xs">Match history</span>
          </Link>
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* LEFT: inputs */}
        <div className="space-y-4 rounded-lg border bg-card p-4">
          <div className="space-y-2">
            <Label htmlFor="cv-file">Upload CV (PDF, Word, or text)</Label>
            <div className="flex items-center gap-2">
              <Input
                id="cv-file" type="file"
                accept=".pdf,.docx,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                onChange={(e) => onFile(e.target.files?.[0] ?? null)}
                disabled={parsing}
                className="cursor-pointer"
              />
              <Upload className="h-4 w-4 text-muted-foreground" />
            </div>
            {parsing && <p className="text-xs text-muted-foreground">Extracting text…</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="cv">Your CV *</Label>
            <Textarea
              id="cv" rows={8} value={cv}
              onChange={(e) => { setCv(e.target.value); saveCv(e.target.value); }}
              placeholder="Paste your CV / resume text here…"
              className="font-mono text-xs"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="role">Desired role</Label>
              <Input id="role" placeholder="e.g. Senior Frontend Engineer"
                value={role} onChange={(e) => setRole(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="where">Location</Label>
              <Input id="where" placeholder="City or 'remote'"
                value={where} onChange={(e) => setWhere(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Country</Label>
            <Select value={country} onValueChange={setCountry}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {COUNTRIES.map(([c, n]) => (
                  <SelectItem key={c} value={c}>{n}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2 rounded-md border bg-muted/30 p-3">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2">
                <Target className="h-4 w-4" /> Match strictness
              </Label>
              <span className="text-xs font-medium">
                {strictness}% · {strictnessLabel(strictness)}
              </span>
            </div>
            <Slider
              value={[strictness]} min={30} max={95} step={5}
              onValueChange={(v) => setStrictness(v[0])}
            />
            <p className="text-xs text-muted-foreground">
              Lower = more jobs, looser fit. Higher = fewer jobs, stronger fit.
            </p>
          </div>

          {/* Preferences: target categories + exclusion tags */}
          <div className="space-y-3 rounded-md border bg-muted/30 p-3">
            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Learning preferences
            </Label>
            <div className="space-y-1">
              <Label className="text-xs">Target job categories</Label>
              <ChipInput
                value={targetCategories} onChange={setTargetCategories}
                placeholder="e.g. Data Science, DevOps, Remote-first"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Exclusion tags (drop listings mentioning these)</Label>
              <ChipInput
                value={excludeTags} onChange={setExcludeTags}
                placeholder="e.g. on-site only, sales, night shift"
              />
            </div>
          </div>

          {/* Saved search presets */}
          <div className="space-y-2 rounded-md border bg-muted/30 p-3">
            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Saved search presets
            </Label>
            <div className="flex gap-2">
              <Input
                placeholder="Preset name…" value={presetName}
                onChange={(e) => setPresetName(e.target.value)}
              />
              <Button type="button" size="sm" variant="outline" onClick={handleSavePreset}>
                <Save className="h-3.5 w-3.5" />
                <span className="ml-1.5 text-xs">Save</span>
              </Button>
            </div>
            {presets.length > 0 ? (
              <ul className="space-y-1">
                {presets.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-2 rounded border bg-background px-2 py-1 text-xs">
                    <button onClick={() => handleLoadPreset(p.id)} className="min-w-0 flex-1 truncate text-left hover:underline">
                      {p.name}
                      <span className="ml-1 text-muted-foreground">
                        — {p.country}, {p.strictness}%
                      </span>
                    </button>
                    <button onClick={() => handleDeletePreset(p.id)} className="text-muted-foreground hover:text-destructive">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-muted-foreground">No presets saved yet.</p>
            )}
          </div>

          <Button onClick={generate} disabled={loading} className="w-full">
            <Sparkles className="h-4 w-4" />
            {loading ? "Ranking matches…" : "Find matches"}
          </Button>
        </div>

        {/* RIGHT: results */}
        <div className="space-y-4">
          {!result && !rawLiveFallback && !loading && (
            <div className="rounded-lg border border-dashed bg-muted/20 p-8 text-center text-sm text-muted-foreground">
              Your ranked job matches will appear here.
            </div>
          )}

          {loading && (
            <div className="animate-pulse rounded-lg border bg-muted/30 p-6 text-sm text-muted-foreground">
              Pulling live jobs and ranking against your CV…
            </div>
          )}

          {(result || rawLiveFallback) && (
            <>
              {result?.profile && (
                <div className="rounded-lg border bg-card p-4">
                  <h3 className="text-sm font-semibold">Candidate profile</h3>
                  {result.profile.headline && (
                    <p className="mt-1 text-sm">{result.profile.headline}</p>
                  )}
                  {result.profile.experience && (
                    <p className="mt-1 text-xs text-muted-foreground">{result.profile.experience}</p>
                  )}
                  {result.profile.skills?.length ? (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {result.profile.skills.map((s) => (
                        <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>
                      ))}
                    </div>
                  ) : null}
                </div>
              )}

              {result?.suggested_roles?.length ? (
                <div className="rounded-lg border bg-card p-4">
                  <h3 className="text-sm font-semibold">Adjacent roles to consider</h3>
                  <ul className="mt-2 space-y-1 text-sm">
                    {result.suggested_roles.map((r) => (
                      <li key={r.role}>
                        <span className="font-medium">{r.role}</span>
                        <span className="text-muted-foreground"> — {r.why}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold">
                  {visibleMatches.length} matches shown
                </h3>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline"
                    onClick={() => downloadMatchesCsv(exportData)}
                    disabled={!exportData.length}>
                    <FileSpreadsheet className="h-3.5 w-3.5" />
                    <span className="ml-1.5 text-xs">CSV</span>
                  </Button>
                  <Button size="sm" variant="outline"
                    onClick={() => downloadMatchesPdf(exportData)}
                    disabled={!exportData.length}>
                    <FileDown className="h-3.5 w-3.5" />
                    <span className="ml-1.5 text-xs">PDF</span>
                  </Button>
                </div>
              </div>

              {/* Email shortlist */}
              <div className="rounded-md border bg-muted/30 p-3">
                <Label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <Mail className="h-3.5 w-3.5" /> Email this shortlist
                </Label>
                <div className="mt-2 flex gap-2">
                  <Input
                    type="email" placeholder="you@example.com" value={emailTo}
                    onChange={(e) => setEmailTo(e.target.value)}
                  />
                  <Button size="sm" onClick={handleEmailShortlist} disabled={!exportData.length}>
                    Send
                  </Button>
                </div>
                <p className="mt-1.5 text-[11px] text-muted-foreground">
                  Opens your mail client with the shortlist in the body. Use the CSV / PDF buttons above if you want a file to attach.
                </p>
              </div>

              {result?.note && (
                <p className="rounded-md border border-dashed bg-muted/20 p-3 text-xs text-muted-foreground">
                  {result.note}
                </p>
              )}

              <div className="space-y-3">
                {visibleMatches.map((m, i) => {
                  const fb = getFeedback(m.url);
                  return (
                    <article key={m.url} className="rounded-lg border bg-card p-4">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <h4 className="text-sm font-semibold leading-tight">
                            {i + 1}. {m.title}
                          </h4>
                          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1"><Building2 className="h-3 w-3" /> {m.company}</span>
                            <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {m.location}</span>
                            <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {m.posted}</span>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          {m.match_percent > 0 && (
                            <Badge variant="secondary" className="text-xs">
                              {m.match_percent}% match
                            </Badge>
                          )}
                          <span className={`rounded border px-1.5 py-0.5 text-[10px] font-medium ${probabilityColor(m.interview_probability)}`}>
                            {m.interview_probability}
                          </span>
                        </div>
                      </div>

                      <div className="mt-3 rounded-md bg-muted/40 p-3">
                        <p className="flex items-center gap-1.5 text-xs font-semibold">
                          <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                          Why this job matches
                        </p>
                        <p className="mt-1 text-sm">{m.why_match}</p>
                        {m.matched_keywords?.length ? (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {m.matched_keywords.map((k) => (
                              <Badge key={k} variant="outline" className="text-[10px]">{k}</Badge>
                            ))}
                          </div>
                        ) : null}
                      </div>

                      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant={fb === "relevant" ? "default" : "outline"}
                            onClick={() => handleFeedback(m, "relevant")}
                          >
                            <ThumbsUp className="h-3.5 w-3.5" />
                            <span className="ml-1.5 text-xs">Relevant</span>
                          </Button>
                          <Button
                            size="sm"
                            variant={fb === "not_for_me" ? "default" : "outline"}
                            onClick={() => handleFeedback(m, "not_for_me")}
                          >
                            <ThumbsDown className="h-3.5 w-3.5" />
                            <span className="ml-1.5 text-xs">Not for me</span>
                          </Button>
                        </div>
                        <div className="flex gap-2">
                          <Button asChild size="sm" variant="outline">
                            <Link to="/autoapply/$jobId" params={{ jobId: encodeURIComponent(m.id) }}>
                              Details <ChevronRight className="h-3 w-3" />
                            </Link>
                          </Button>
                          <Button asChild size="sm">
                            <a href={m.url} target="_blank" rel="noopener noreferrer">
                              Apply <ExternalLink className="h-3 w-3" />
                            </a>
                          </Button>
                        </div>
                      </div>
                    </article>
                  );
                })}

                {visibleMatches.length === 0 && allMatches.length > 0 && (
                  <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                    All matches are hidden by your "Not for me" feedback.
                    <Button
                      variant="link" size="sm"
                      onClick={() => { allMatches.forEach((m) => clearFeedback(m.url)); setFeedbackTick((n) => n + 1); }}
                    >
                      Clear filters
                    </Button>
                  </div>
                )}
                {allMatches.length === 0 && (
                  <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                    No matches at this strictness level. Lower the slider or broaden your keywords.
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </FeatureShell>
  );
}
