import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Briefcase, Sparkles, Upload } from "lucide-react";
import { FeatureShell } from "@/components/feature-shell";
import { AiOutput } from "@/components/ai-output";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { callAi } from "@/lib/ai";
import { toast } from "sonner";

export const Route = createFileRoute("/autoapply")({
  component: AutoApply,
});

function AutoApply() {
  const [cv, setCv] = useState("");
  const [role, setRole] = useState("");
  const [location, setLocation] = useState("");
  const [workType, setWorkType] = useState("");
  const [output, setOutput] = useState("");
  const [loading, setLoading] = useState(false);

  const onFile = async (file: File | null) => {
    if (!file) return;
    if (file.size > 200_000) {
      toast.error("Please upload a text file under 200KB. For PDFs, paste the text.");
      return;
    }
    try {
      const text = await file.text();
      setCv(text);
      toast.success(`Loaded ${file.name}`);
    } catch {
      toast.error("Could not read file. Paste your CV instead.");
    }
  };

  const generate = async () => {
    if (cv.trim().length < 50) {
      toast.error("Paste your CV (at least a few lines).");
      return;
    }
    setLoading(true);
    setOutput("");
    try {
      const input = `CANDIDATE CV / RESUME:
${cv}

TARGET PREFERENCES:
- Desired role: ${role || "(open)"}
- Preferred location: ${location || "(any)"}
- Work type: ${workType || "(any)"}`;
      const content = await callAi({ feature: "autoapply", input });
      setOutput(content);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to find matches");
    } finally {
      setLoading(false);
    }
  };

  return (
    <FeatureShell
      title="AI Auto Apply"
      description="Upload your CV, get matched jobs, and generate tailored applications instantly."
      icon={<Briefcase className="h-5 w-5" />}
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4 rounded-lg border bg-card p-4">
          <div className="space-y-2">
            <Label htmlFor="cv-file">Upload CV (.txt) or paste below</Label>
            <div className="flex items-center gap-2">
              <Input
                id="cv-file"
                type="file"
                accept=".txt,.md,text/plain"
                onChange={(e) => onFile(e.target.files?.[0] ?? null)}
                className="cursor-pointer"
              />
              <Upload className="h-4 w-4 text-muted-foreground" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="cv">Your CV *</Label>
            <Textarea
              id="cv"
              placeholder="Paste your CV / resume text here…"
              value={cv}
              onChange={(e) => setCv(e.target.value)}
              rows={10}
              className="font-mono text-xs"
            />
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
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                placeholder="e.g. Berlin or Remote EU"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="worktype">Work type</Label>
            <Input
              id="worktype"
              placeholder="Remote / Hybrid / Onsite · Full-time / Contract"
              value={workType}
              onChange={(e) => setWorkType(e.target.value)}
            />
          </div>
          <Button onClick={generate} disabled={loading} className="w-full">
            <Sparkles className="h-4 w-4" />
            {loading ? "Matching jobs…" : "Find Matches & Auto Apply"}
          </Button>
          <p className="text-xs text-muted-foreground">
            Matches are AI-generated suggestions. Always verify openings on the
            employer's site before submitting.
          </p>
        </div>
        <AiOutput content={output} loading={loading} onChange={setOutput} />
      </div>
    </FeatureShell>
  );
}
