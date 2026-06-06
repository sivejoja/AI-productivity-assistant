import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ListTodo, Sparkles, BellRing, CalendarPlus } from "lucide-react";
import { FeatureShell } from "@/components/feature-shell";
import { AiOutput } from "@/components/ai-output";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { callAi } from "@/lib/ai";
import { downloadReminderIcs } from "@/lib/reminder-ics";
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

  const [reminderEmail, setReminderEmail] = useState("");
  const [reminderDays, setReminderDays] = useState("3");

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

  const scheduleReminder = () => {
    const email = reminderEmail.trim();
    const days = Number(reminderDays);
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      toast.error("Enter a valid email address.");
      return;
    }
    if (!Number.isFinite(days) || days < 1) {
      toast.error("Enter how many days from now.");
      return;
    }
    if (!goal.trim()) {
      toast.error("Add your goal first so the reminder has context.");
      return;
    }
    try {
      downloadReminderIcs({
        title: `Reminder: ${goal.slice(0, 80)}`,
        description: output || constraints || goal,
        email,
        daysFromNow: days,
      });
      toast.success(
        `Calendar invite downloaded. Open it to add the event — your calendar will email ${email} in ${days} day${days === 1 ? "" : "s"}.`,
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create reminder.");
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

          <div className="space-y-3 rounded-md border border-dashed bg-muted/30 p-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <BellRing className="h-4 w-4 text-primary" />
              Email reminder
            </div>
            <p className="text-xs text-muted-foreground">
              Enter your email and how many days from now to be reminded. We'll generate a
              calendar invite — open it to add the event, and your calendar app will email
              you the reminder on the scheduled day.
            </p>
            <div className="grid gap-3 sm:grid-cols-[1fr_120px]">
              <div className="space-y-1">
                <Label htmlFor="rem-email">Your email</Label>
                <Input
                  id="rem-email"
                  type="email"
                  placeholder="you@example.com"
                  value={reminderEmail}
                  onChange={(e) => setReminderEmail(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="rem-days">Days from now</Label>
                <Input
                  id="rem-days"
                  type="number"
                  min={1}
                  max={365}
                  value={reminderDays}
                  onChange={(e) => setReminderDays(e.target.value)}
                />
              </div>
            </div>
            <Button onClick={scheduleReminder} variant="secondary" className="w-full">
              <CalendarPlus className="h-4 w-4" />
              Schedule reminder (.ics)
            </Button>
          </div>
        </div>
        <AiOutput content={output} loading={loading} onChange={setOutput} />
      </div>
    </FeatureShell>
  );
}
