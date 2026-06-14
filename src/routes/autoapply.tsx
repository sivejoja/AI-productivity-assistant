import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Briefcase, Sparkles, Upload, ExternalLink, MapPin, Calendar, Building2,
  ThumbsUp, ThumbsDown, FileDown, FileSpreadsheet, Target, CheckCircle2,
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
import { callAi } from "@/lib/ai";
import { extractCvText } from "@/lib/cv-parser";
import { loadCv, saveCv } from "@/lib/cv-store";
import { searchJobs } from "@/lib/jobs.functions";
import {
  buildAvoidList, getFeedback, setFeedback, clearFeedback, type FeedbackValue,
} from "@/lib/job-feedback";
import { downloadMatchesCsv, downloadMatchesPdf, type ExportMatch } from "@/lib/match-export";
import { toast } from "sonner";

export const Route = createFileRoute("/autoapply")({
  component: AutoApply,
});

const COUNTRIES = [
  ["us", "United States"], ["gb", "United Kingdom"], ["au", "Australia"],
  ["ca", "Canada"], ["de", "Germany"], ["fr", "France"], ["nl", "Netherlands"],
  ["in", "India"], ["za", "South Africa"], ["sg", "Singapore"],
] as const;

interface Match {
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
}

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
  // strip optional ```json fences
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) text = fenced[1].trim();
  // fallback: first { ... last }
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
  const x = p.toLowerCase();
  if (x.includes("very high")) return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30";
  if (x.includes("high")) return "bg-green-500/15 text-green-700 dark:text-green-300 border-green-500/30";
  if (x.includes("medium")) return "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30";
  return "bg-muted text-muted-foreground";
}

function AutoApply() {
  const [cv, setCv] = useState(() => loadCv() ?? "");
  const [role, setRole] = useState("");
  const [where, setWhere] = useState("");
  const [country, setCountry] = useState("us");
  const [strictness, setStrictness] = useState(70);
  const [result, setResult] = useState<AiResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [feedbackTick, setFeedbackTick] = useState(0);
  const searchFn = useServerFn(searchJobs);

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
        },
      });
      const parsed = parseJsonResponse(content);
      if (!parsed || !Array.isArray(parsed.matches)) {
        toast.error("AI returned an unexpected format. Try again.");
        setLoading(false);
        return;
      }
      setResult(parsed);
      if (parsed.matches.length === 0) {
        toast.message("No strong matches at this strictness level. Try loosening the slider.");
      }
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
      toast.success(value === "relevant" ? "Marked relevant — future runs will favour similar roles." : "Hidden — future runs will avoid similar roles.");
    }
    setFeedbackTick((n) => n + 1);
  };

  // Hide jobs the user marked not_for_me from the current display.
  const visibleMatches = useMemo(() => {
    if (!result?.matches) return [];
    return result.matches.filter((m) => getFeedback(m.url) !== "not_for_me");
    // feedbackTick triggers re-eval
  }, [result, feedbackTick]); // eslint-disable-line react-hooks/exhaustive-deps

  const exportData: ExportMatch[] = useMemo(
    () => visibleMatches.map((m) => ({
      title: m.title, company: m.company, location: m.location, posted: m.posted,
      url: m.url, match_percent: m.match_percent,
      interview_probability: m.interview_probability,
      why_match: m.why_match, matched_keywords: m.matched_keywords ?? [],
    })),
    [visibleMatches],
  );

  return (
    <FeatureShell
      title="AI Auto Apply"
      description="Live jobs ranked against your CV. Tune strictness, give thumbs up/down to teach the AI, and export your shortlist."
      icon={<Briefcase className="h-5 w-5" />}
    >
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

          <Button onClick={generate} disabled={loading} className="w-full">
            <Sparkles className="h-4 w-4" />
            {loading ? "Ranking matches…" : "Find matches"}
          </Button>
        </div>

        {/* RIGHT: results */}
        <div className="space-y-4">
          {!result && !loading && (
            <div className="rounded-lg border border-dashed bg-muted/20 p-8 text-center text-sm text-muted-foreground">
              Your ranked job matches will appear here.
            </div>
          )}

          {loading && (
            <div className="animate-pulse rounded-lg border bg-muted/30 p-6 text-sm text-muted-foreground">
              Pulling live jobs and ranking against your CV…
            </div>
          )}

          {result && (
            <>
              {result.profile && (
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

              {result.suggested_roles?.length ? (
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
                <div className="flex gap-2">
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

              {result.note && (
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
                          <Badge variant="secondary" className="text-xs">
                            {m.match_percent}% match
                          </Badge>
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

                      {m.cover_letter && (
                        <details className="mt-3 text-sm">
                          <summary className="cursor-pointer text-xs font-medium text-muted-foreground hover:text-foreground">
                            Tailored cover letter
                          </summary>
                          <p className="mt-2 whitespace-pre-wrap rounded-md border bg-background p-3 text-sm">
                            {m.cover_letter}
                          </p>
                        </details>
                      )}

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
                        <Button asChild size="sm">
                          <a href={m.url} target="_blank" rel="noopener noreferrer">
                            Apply <ExternalLink className="h-3 w-3" />
                          </a>
                        </Button>
                      </div>
                    </article>
                  );
                })}

                {visibleMatches.length === 0 && (
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
