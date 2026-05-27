import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Search, Sparkles } from "lucide-react";
import { FeatureShell } from "@/components/feature-shell";
import { AiOutput } from "@/components/ai-output";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { callAi } from "@/lib/ai";
import { toast } from "sonner";

export const Route = createFileRoute("/research")({
  component: ResearchAssistant,
});

function ResearchAssistant() {
  const [topic, setTopic] = useState("");
  const [angle, setAngle] = useState("");
  const [output, setOutput] = useState("");
  const [loading, setLoading] = useState(false);

  const generate = async () => {
    if (!topic.trim()) {
      toast.error("Enter a topic to research.");
      return;
    }
    setLoading(true);
    setOutput("");
    try {
      const input = `Topic: ${topic}
Angle / focus: ${angle || "(general overview)"}`;
      const content = await callAi({ feature: "research", input });
      setOutput(content);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to research");
    } finally {
      setLoading(false);
    }
  };

  return (
    <FeatureShell
      title="AI Research Assistant"
      description="Get a structured briefing on any workplace topic."
      icon={<Search className="h-5 w-5" />}
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4 rounded-lg border bg-card p-4">
          <div className="space-y-2">
            <Label htmlFor="topic">Topic *</Label>
            <Input
              id="topic"
              placeholder="e.g. Async vs. sync standups for remote teams"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="angle">Angle or audience</Label>
            <Textarea
              id="angle"
              placeholder="e.g. Briefing for engineering managers; focus on tradeoffs"
              value={angle}
              onChange={(e) => setAngle(e.target.value)}
              rows={3}
            />
          </div>
          <Button onClick={generate} disabled={loading} className="w-full">
            <Sparkles className="h-4 w-4" />
            {loading ? "Researching…" : "Generate Briefing"}
          </Button>
          <p className="text-xs text-muted-foreground">
            Based on the model's training data. Verify facts before publishing.
          </p>
        </div>
        <AiOutput content={output} loading={loading} onChange={setOutput} />
      </div>
    </FeatureShell>
  );
}
