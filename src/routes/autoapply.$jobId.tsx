import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import {
  Briefcase, ArrowLeft, ExternalLink, MapPin, Calendar, Building2, CheckCircle2,
} from "lucide-react";
import { FeatureShell } from "@/components/feature-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getMatch } from "@/lib/match-cache";

export const Route = createFileRoute("/autoapply/$jobId")({
  component: JobDetail,
});

function JobDetail() {
  const { jobId } = useParams({ from: "/autoapply/$jobId" });
  const decoded = decodeURIComponent(jobId);
  const m = getMatch(decoded);

  return (
    <FeatureShell
      title="Job details"
      description="Full description, application link, and match breakdown."
      icon={<Briefcase className="h-5 w-5" />}
    >
      <div className="mb-4">
        <Button asChild size="sm" variant="ghost">
          <Link to="/autoapply">
            <ArrowLeft className="h-3.5 w-3.5" />
            <span className="ml-1.5 text-xs">Back to shortlist</span>
          </Link>
        </Button>
      </div>

      {!m ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          This match is no longer in your current shortlist. Generate matches again to view it.
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          <article className="space-y-4 lg:col-span-2">
            <header className="rounded-lg border bg-card p-4">
              <h2 className="text-lg font-semibold leading-tight">{m.title}</h2>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><Building2 className="h-3 w-3" /> {m.company}</span>
                <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {m.location}</span>
                <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {m.posted}</span>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {m.match_percent > 0 && (
                  <Badge variant="secondary">{m.match_percent}% match</Badge>
                )}
                <Badge variant="outline">{m.interview_probability}</Badge>
                <Button asChild size="sm" className="ml-auto">
                  <a href={m.url} target="_blank" rel="noopener noreferrer">
                    Apply now <ExternalLink className="h-3 w-3" />
                  </a>
                </Button>
              </div>
            </header>

            <section className="rounded-lg border bg-card p-4">
              <h3 className="text-sm font-semibold">Full job description</h3>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                {m.description || "Full description not available from the source — open the apply link to see it."}
              </p>
            </section>

            {m.cover_letter && (
              <section className="rounded-lg border bg-card p-4">
                <h3 className="text-sm font-semibold">Tailored cover letter</h3>
                <p className="mt-2 whitespace-pre-wrap text-sm">{m.cover_letter}</p>
              </section>
            )}
          </article>

          <aside className="space-y-4">
            <section className="rounded-lg border bg-card p-4">
              <p className="flex items-center gap-1.5 text-xs font-semibold">
                <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                Why this job matches
              </p>
              <p className="mt-2 text-sm">{m.why_match}</p>
              {m.matched_keywords?.length ? (
                <div className="mt-3">
                  <p className="text-xs font-medium text-muted-foreground">Matched CV keywords</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {m.matched_keywords.map((k) => (
                      <Badge key={k} variant="outline" className="text-[10px]">{k}</Badge>
                    ))}
                  </div>
                </div>
              ) : null}
            </section>

            {m.checklist?.length ? (
              <section className="rounded-lg border bg-card p-4">
                <p className="text-xs font-semibold">Pre-submit checklist</p>
                <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-muted-foreground">
                  {m.checklist.map((c, i) => <li key={i}>{c}</li>)}
                </ul>
              </section>
            ) : null}
          </aside>
        </div>
      )}
    </FeatureShell>
  );
}
