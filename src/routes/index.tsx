import { createFileRoute, Link } from "@tanstack/react-router";
import { Mail, FileText, ListTodo, Search, MessageSquare, Sparkles, ArrowRight } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import heroBg from "@/assets/hero-ai-bg.jpg";



export const Route = createFileRoute("/")({
  component: Dashboard,
});

const features = [
  {
    title: "Smart Email Generator",
    description: "Draft polished, on-brand emails in seconds with tone and length controls.",
    url: "/email",
    icon: Mail,
  },
  {
    title: "Meeting Notes Summarizer",
    description: "Turn raw notes or transcripts into clear summaries, decisions, and action items.",
    url: "/meetings",
    icon: FileText,
  },
  {
    title: "AI Task Planner",
    description: "Break goals into prioritized, actionable plans with effort estimates.",
    url: "/tasks",
    icon: ListTodo,
  },
  {
    title: "AI Research Assistant",
    description: "Get structured briefings with key points, tradeoffs, and next steps.",
    url: "/research",
    icon: Search,
  },
  {
    title: "AI Chatbot",
    description: "A general-purpose assistant for quick questions and ideation.",
    url: "/chat",
    icon: MessageSquare,
  },
] as const;

function Dashboard() {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-8 p-4 md:p-8">
      <section
        className="relative overflow-hidden rounded-xl border p-6 md:p-10"
        style={{
          backgroundImage: `linear-gradient(135deg, oklch(0.15 0.05 264 / 0.85), oklch(0.2 0.08 290 / 0.7)), url(${heroBg})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div className="relative">
          <div className="flex items-center gap-2 text-sm text-white/90">
            <Sparkles className="h-4 w-4" />
            <span className="font-medium">Welcome back</span>
          </div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white md:text-4xl">
            Your AI workplace, organized.
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-white/80 md:text-base">
            Automate the busywork — write emails, summarize meetings, plan projects, and
            research topics. Pick a tool to get started.
          </p>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">Tools</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <Link key={f.url} to={f.url} className="group">
              <Card className="h-full transition-all hover:border-primary/50 hover:shadow-md">
                <CardHeader>
                  <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <f.icon className="h-5 w-5" />
                  </div>
                  <CardTitle className="mt-2 text-base">{f.title}</CardTitle>
                  <CardDescription>{f.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-1 text-sm font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
                    Open <ArrowRight className="h-3.5 w-3.5" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
