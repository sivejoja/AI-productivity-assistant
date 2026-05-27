import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { FileText, Sparkles } from "lucide-react";
import { FeatureShell } from "@/components/feature-shell";
import { AiOutput } from "@/components/ai-output";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { callAi } from "@/lib/ai";
import { toast } from "sonner";

export const Route = createFileRoute("/meetings")({
  component: MeetingSummarizer,
});

function MeetingSummarizer() {
  const [notes, setNotes] = useState("");
  const [output, setOutput] = useState("");
  const [loading, setLoading] = useState(false);

  const generate = async () => {
    if (!notes.trim()) {
      toast.error("Paste your meeting notes or transcript first.");
      return;
    }
    setLoading(true);
    setOutput("");
    try {
      const content = await callAi({ feature: "meeting", input: notes });
      setOutput(content);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to summarize");
    } finally {
      setLoading(false);
    }
  };

  return (
    <FeatureShell
      title="Meeting Notes Summarizer"
      description="Turn raw notes or transcripts into structured summaries with decisions and action items."
      icon={<FileText className="h-5 w-5" />}
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4 rounded-lg border bg-card p-4">
          <div className="space-y-2">
            <Label htmlFor="notes">Meeting notes or transcript *</Label>
            <Textarea
              id="notes"
              placeholder="Paste your meeting notes, bullet points, or full transcript here…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={16}
            />
          </div>
          <Button onClick={generate} disabled={loading} className="w-full">
            <Sparkles className="h-4 w-4" />
            {loading ? "Summarizing…" : "Summarize Meeting"}
          </Button>
        </div>
        <AiOutput content={output} loading={loading} onChange={setOutput} />
      </div>
    </FeatureShell>
  );
}
