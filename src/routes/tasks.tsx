import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ListTodo, Sparkles } from "lucide-react";
import { FeatureShell } from "@/components/feature-shell";
import { AiOutput } from "@/components/ai-output";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { callAi } from "@/lib/ai";
import { toast } from "sonner";

export const Route = createFileRoute("/tasks")({
  component: TaskPlanner,
});

function TaskPlanner() {
  const [goal, setGoal] = useState("");
  const [deadline, setDeadline] = useState("");
  const [constraints, setConstraints] = useState("");
  const [output, setOutput] = useState("");
  const [loading, setLoading] = useState(false);

  const generate = async () => {
    if (!goal.trim()) {
      toast.error("Describe the goal or project.");
      return;
    }
    setLoading(true);
    setOutput("");
    try {
      const input = `Goal: ${goal}
Deadline: ${deadline || "(none specified)"}
Constraints / context: ${constraints || "(none)"}`;
      const content = await callAi({ feature: "tasks", input });
      setOutput(content);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to plan");
    } finally {
      setLoading(false);
    }
  };

  return (
    <FeatureShell
      title="AI Task Planner"
      description="Break a goal into a prioritized, actionable plan."
      icon={<ListTodo className="h-5 w-5" />}
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4 rounded-lg border bg-card p-4 shadow-sm">
          <div className="space-y-2">
            <Label htmlFor="goal">Goal or project *</Label>
            <Textarea
              id="goal"
              placeholder="e.g. Launch a new product landing page"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="deadline">Deadline (optional)</Label>
            <Input
              id="deadline"
              placeholder="e.g. 2 weeks from today"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="constraints">Constraints / context</Label>
            <Textarea
              id="constraints"
              placeholder="Team size, budget, existing assets…"
              value={constraints}
              onChange={(e) => setConstraints(e.target.value)}
              rows={3}
            />
          </div>
          <Button onClick={generate} disabled={loading} className="w-full">
            <Sparkles className="h-4 w-4" />
            {loading ? "Planning…" : "Generate Plan"}
          </Button>
        </div>
        <AiOutput content={output} loading={loading} onChange={setOutput} />
      </div>
    </FeatureShell>
  );
}
