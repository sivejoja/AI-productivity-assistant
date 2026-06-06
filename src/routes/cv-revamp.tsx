import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { FileEdit, Sparkles, Upload } from "lucide-react";
import { FeatureShell } from "@/components/feature-shell";
import { AiOutput } from "@/components/ai-output";
import { CvDownload } from "@/components/cv-download";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { callAi } from "@/lib/ai";
import { extractCvText } from "@/lib/cv-parser";
import { loadCv, saveCv } from "@/lib/cv-store";
import { toast } from "sonner";

export const Route = createFileRoute("/cv-revamp")({
  component: CvRevamp,
});

function CvRevamp() {
  const [cv, setCv] = useState(() => loadCv() ?? "");
  const [targetRole, setTargetRole] = useState("");
  const [industry, setIndustry] = useState("");
  const [output, setOutput] = useState("");
  const [loading, setLoading] = useState(false);
  const [parsing, setParsing] = useState(false);

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

  const revamp = async () => {
    if (cv.trim().length < 50) {
      toast.error("Paste or upload your CV first.");
      return;
    }
    setLoading(true);
    setOutput("");
    saveCv(cv);
    try {
      const input = `CURRENT CV:
${cv}

TARGET ROLE: ${targetRole || "(open – suggest best-fit in-demand roles based on the CV)"}
INDUSTRY / FOCUS: ${industry || "(open)"}`;
      const content = await callAi({ feature: "cvrevamp", input });
      setOutput(content);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Revamp failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <FeatureShell
      title="CV Revamp Assistant"
      description="Tailor your CV to today's in-demand roles. ATS-friendly, achievement-driven, recruiter-ready."
      icon={<FileEdit className="h-5 w-5" />}
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
            <Label htmlFor="cv">Your current CV *</Label>
            <Textarea
              id="cv"
              value={cv}
              onChange={(e) => {
                setCv(e.target.value);
                saveCv(e.target.value);
              }}
              rows={12}
              placeholder="Paste your CV text here…"
              className="font-mono text-xs"
            />
            <p className="text-xs text-muted-foreground">
              Saved automatically to this browser. Used across Auto Apply too.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="target">Target role (optional)</Label>
              <Input
                id="target"
                placeholder="e.g. Product Manager"
                value={targetRole}
                onChange={(e) => setTargetRole(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="industry">Industry / focus</Label>
              <Input
                id="industry"
                placeholder="e.g. Fintech, AI, Healthcare"
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
              />
            </div>
          </div>
          <Button onClick={revamp} disabled={loading} className="w-full">
            <Sparkles className="h-4 w-4" />
            {loading ? "Revamping…" : "Revamp my CV"}
          </Button>
        </div>
        <AiOutput content={output} loading={loading} onChange={setOutput} />
      </div>
    </FeatureShell>
  );
}
