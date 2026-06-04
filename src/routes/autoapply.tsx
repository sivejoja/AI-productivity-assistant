import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Briefcase, Sparkles, Upload, ExternalLink, MapPin, Calendar, Building2 } from "lucide-react";
import { FeatureShell } from "@/components/feature-shell";
import { AiOutput } from "@/components/ai-output";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { callAi } from "@/lib/ai";
import { extractCvText } from "@/lib/cv-parser";
import { loadCv, saveCv } from "@/lib/cv-store";
import { searchJobs, type AdzunaJob } from "@/lib/jobs.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/autoapply")({
  component: AutoApply,
});

const COUNTRIES = [
  ["us", "United States"],
  ["gb", "United Kingdom"],
  ["au", "Australia"],
  ["ca", "Canada"],
  ["de", "Germany"],
  ["fr", "France"],
  ["nl", "Netherlands"],
  ["in", "India"],
  ["za", "South Africa"],
  ["sg", "Singapore"],
] as const;

function postedAgo(iso: string) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  return `${days} days ago`;
}

function AutoApply() {
  const [cv, setCv] = useState(() => loadCv() ?? "");
  const [role, setRole] = useState("");
  const [where, setWhere] = useState("");
  const [country, setCountry] = useState("us");
  const [jobs, setJobs] = useState<AdzunaJob[]>([]);
  const [output, setOutput] = useState("");
  const [loading, setLoading] = useState(false);
  const [parsing, setParsing] = useState(false);
  const searchFn = useServerFn(searchJobs);

  const onFile = async (file: File | null) => {
    if (!file) return;
    if (file.size > 10_000_000) {
      toast.error("File too large (max 10MB).");
      return;
    }
    setParsing(true);
    try {
      const text = (await extractCvText(file)).replace(/\s+\n/g, "\n").trim();
      if (text.length < 30) {
        toast.error("Couldn't extract readable text.");
        return;
      }
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
    if (cv.trim().length < 50) {
      toast.error("Upload or paste your CV first.");
      return;
    }
    saveCv(cv);
    setLoading(true);
    setOutput("");
    setJobs([]);
    try {
      // 1. Pull real live jobs from Adzuna
      const search = await searchFn({
        data: {
          what: role,
          where,
          country,
          page: 1,
          results_per_page: 15,
          max_days_old: 30,
          sort_by: "date",
        },
      });
      if (search.error) {
        toast.error(search.error);
      }
      const live = search.jobs ?? [];
      setJobs(live);
      if (live.length === 0) {
        toast.error("No live jobs found. Try a broader keyword or different country.");
        setLoading(false);
        return;
      }

      // 2. Send CV + real jobs to AI to rank + write tailored letters
      const jobsForAi = live.slice(0, 12).map((j, i) => ({
        n: i + 1,
        id: j.id,
        title: j.title,
        company: j.company,
        location: j.location,
        posted: postedAgo(j.created),
        url: j.redirect_url,
        snippet: j.description.slice(0, 600),
      }));
      const input = `CANDIDATE CV:
${cv}

PREFERENCES: role="${role || "(open)"}", location="${where || "(any)"}", country=${country}

LIVE JOB LISTINGS (use these EXACT urls — do not invent any):
${JSON.stringify(jobsForAi, null, 2)}`;
      const content = await callAi({ feature: "autoapply", input });
      setOutput(content);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Match failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <FeatureShell
      title="AI Auto Apply"
      description="We save your CV, pull live jobs, rank the best matches, and draft tailored applications with direct apply links."
      icon={<Briefcase className="h-5 w-5" />}
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4 rounded-lg border bg-card p-4">
          <div className="space-y-2">
            <Label htmlFor="cv-file">Upload CV (PDF, Word, or text)</Label>
            <div className="flex items-center gap-2">
              <Input
                id="cv-file"
                type="file"
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
              id="cv"
              placeholder="Paste your CV / resume text here…"
              value={cv}
              onChange={(e) => {
                setCv(e.target.value);
                saveCv(e.target.value);
              }}
              rows={9}
              className="font-mono text-xs"
            />
            <p className="text-xs text-muted-foreground">
              Your CV is saved in this browser so you don't re-upload every time.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="role">Desired role</Label>
              <Input
                id="role"
                placeholder="e.g. Senior Frontend Engineer"
                value={role}
                onChange={(e) => setRole(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="where">Location</Label>
              <Input
                id="where"
                placeholder="City or 'remote'"
                value={where}
                onChange={(e) => setWhere(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Country</Label>
            <Select value={country} onValueChange={setCountry}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {COUNTRIES.map(([c, n]) => (
                  <SelectItem key={c} value={c}>
                    {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={generate} disabled={loading} className="w-full">
            <Sparkles className="h-4 w-4" />
            {loading ? "Finding & ranking live jobs…" : "Find live matches & draft applications"}
          </Button>
          <p className="text-xs text-muted-foreground">
            Job data is live from Adzuna. Apply links go directly to the original posting.
          </p>
        </div>

        <div className="space-y-4">
          {jobs.length > 0 && (
            <div className="rounded-lg border bg-card p-3">
              <h3 className="mb-2 text-sm font-semibold">
                {jobs.length} live jobs pulled
              </h3>
              <ul className="space-y-2 max-h-72 overflow-auto pr-1">
                {jobs.map((j) => (
                  <li key={j.id} className="flex items-start justify-between gap-2 text-xs">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{j.title}</p>
                      <p className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Building2 className="h-3 w-3" />
                          {j.company}
                        </span>
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {j.location}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {postedAgo(j.created)}
                        </span>
                      </p>
                    </div>
                    <a
                      href={j.redirect_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 text-primary underline-offset-2 hover:underline"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <AiOutput content={output} loading={loading} onChange={setOutput} />
        </div>
      </div>
    </FeatureShell>
  );
}
