import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  History as HistoryIcon, ArrowLeft, Trash2, FileSpreadsheet, FileDown, ThumbsUp, ThumbsDown,
} from "lucide-react";
import { FeatureShell } from "@/components/feature-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  listHistory, deleteHistory, clearHistory, type HistoryEntry,
} from "@/lib/match-history";
import { downloadMatchesCsv, downloadMatchesPdf, type ExportMatch } from "@/lib/match-export";
import { getFeedback } from "@/lib/job-feedback";
import { toast } from "sonner";

export const Route = createFileRoute("/autoapply/history")({
  component: HistoryPage,
});

function toExport(e: HistoryEntry): ExportMatch[] {
  return e.matches.map((m) => ({
    title: m.title, company: m.company, location: m.location, posted: m.posted,
    url: m.url, match_percent: m.match_percent,
    interview_probability: m.interview_probability,
    why_match: m.why_match, matched_keywords: m.matched_keywords ?? [],
  }));
}

function HistoryPage() {
  const [items, setItems] = useState<HistoryEntry[]>(() =>
    typeof window !== "undefined" ? listHistory() : [],
  );

  const refresh = () => setItems(listHistory());

  return (
    <FeatureShell
      title="Match history"
      description="Review past shortlists, re-export them, and see how you reacted."
      icon={<HistoryIcon className="h-5 w-5" />}
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <Button asChild size="sm" variant="ghost">
          <Link to="/autoapply">
            <ArrowLeft className="h-3.5 w-3.5" />
            <span className="ml-1.5 text-xs">Back to AI Auto Apply</span>
          </Link>
        </Button>
        {items.length > 0 && (
          <Button size="sm" variant="outline"
            onClick={() => { clearHistory(); refresh(); toast.success("Cleared history."); }}>
            <Trash2 className="h-3.5 w-3.5" />
            <span className="ml-1.5 text-xs">Clear all</span>
          </Button>
        )}
      </div>

      {items.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          No runs yet — generate a shortlist on the AI Auto Apply page.
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((e) => {
            const relevant = e.matches.filter((m) => getFeedback(m.url) === "relevant").length;
            const not = e.matches.filter((m) => getFeedback(m.url) === "not_for_me").length;
            return (
              <article key={e.id} className="rounded-lg border bg-card p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">
                      {new Date(e.ts).toLocaleString()}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      role="{e.filters.role || "(open)"}" · {e.filters.country.toUpperCase()} ·
                      strict {e.filters.strictness}% · {e.matches.length} matches
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {e.filters.targetCategories.map((t) => (
                        <Badge key={t} variant="secondary" className="text-[10px]">+{t}</Badge>
                      ))}
                      {e.filters.excludeTags.map((t) => (
                        <Badge key={t} variant="outline" className="text-[10px]">-{t}</Badge>
                      ))}
                    </div>
                    <div className="mt-2 flex gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><ThumbsUp className="h-3 w-3" /> {relevant}</span>
                      <span className="flex items-center gap-1"><ThumbsDown className="h-3 w-3" /> {not}</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline"
                      onClick={() => downloadMatchesCsv(toExport(e), `shortlist-${e.id.slice(0, 6)}`)}>
                      <FileSpreadsheet className="h-3.5 w-3.5" />
                      <span className="ml-1.5 text-xs">CSV</span>
                    </Button>
                    <Button size="sm" variant="outline"
                      onClick={() => downloadMatchesPdf(toExport(e), `shortlist-${e.id.slice(0, 6)}`)}>
                      <FileDown className="h-3.5 w-3.5" />
                      <span className="ml-1.5 text-xs">PDF</span>
                    </Button>
                    <Button size="sm" variant="ghost"
                      onClick={() => { deleteHistory(e.id); refresh(); }}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                <ul className="mt-3 space-y-1 text-xs">
                  {e.matches.slice(0, 5).map((m) => (
                    <li key={m.url} className="truncate text-muted-foreground">
                      • {m.title} — {m.company}
                      {m.match_percent > 0 && <span className="ml-1">({m.match_percent}%)</span>}
                    </li>
                  ))}
                  {e.matches.length > 5 && (
                    <li className="text-[11px] text-muted-foreground">…and {e.matches.length - 5} more</li>
                  )}
                </ul>
              </article>
            );
          })}
        </div>
      )}
    </FeatureShell>
  );
}
