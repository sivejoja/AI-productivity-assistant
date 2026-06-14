import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Landmark, Search, ExternalLink, Calendar, Building2 } from "lucide-react";
import { FeatureShell } from "@/components/feature-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { searchSaGovJobs } from "@/lib/sa-gov-jobs.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/sa-gov-jobs")({
  component: SaGovJobs,
});

const PROVINCES = [
  "",
  "Gauteng",
  "Western Cape",
  "KwaZulu-Natal",
  "Eastern Cape",
  "Free State",
  "Limpopo",
  "Mpumalanga",
  "North West",
  "Northern Cape",
];

function formatPosted(iso: string) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  return `${days} days ago`;
}

function SaGovJobs() {
  const [keyword, setKeyword] = useState("");
  const [department, setDepartment] = useState("");
  const [province, setProvince] = useState("");
  const [maxDays, setMaxDays] = useState("30");
  const search = useServerFn(searchSaGovJobs);

  const mutation = useMutation({
    mutationFn: () =>
      search({
        data: {
          keyword,
          department,
          province,
          max_days_old: Number(maxDays) || 30,
          limit: 30,
        },
      }),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Search failed"),
    onSuccess: (d) => {
      if (d.error) toast.error(d.error);
    },
  });

  const jobs = mutation.data?.jobs ?? [];

  return (
    <FeatureShell
      title="SA Government Jobs"
      description="Live vacancies from DPSA, GovPage, national & provincial departments and SOEs. Direct apply links."
      icon={<Landmark className="h-5 w-5" />}
    >
      <div className="rounded-lg border bg-card p-4">
        <div className="grid gap-3 md:grid-cols-12">
          <div className="space-y-2 md:col-span-4">
            <Label htmlFor="kw">Role / keyword</Label>
            <Input
              id="kw"
              placeholder="e.g. administrator, nurse, engineer"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && mutation.mutate()}
            />
          </div>
          <div className="space-y-2 md:col-span-3">
            <Label htmlFor="dept">Department</Label>
            <Input
              id="dept"
              placeholder="e.g. Health, SAPS, Education"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && mutation.mutate()}
            />
          </div>
          <div className="space-y-2 md:col-span-3">
            <Label>Province</Label>
            <Select value={province || "all"} onValueChange={(v) => setProvince(v === "all" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="All provinces" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All provinces</SelectItem>
                {PROVINCES.filter(Boolean).map((p) => (
                  <SelectItem key={p} value={p}>{p}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Posted within</Label>
            <Select value={maxDays} onValueChange={setMaxDays}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="1">24 hours</SelectItem>
                <SelectItem value="7">7 days</SelectItem>
                <SelectItem value="30">30 days</SelectItem>
                <SelectItem value="90">90 days</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <Button
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending}
          className="mt-4 w-full md:w-auto"
        >
          <Search className="h-4 w-4" />
          {mutation.isPending ? "Searching government vacancies…" : "Search government jobs"}
        </Button>
      </div>

      {mutation.data && (
        <p className="text-xs text-muted-foreground">
          {jobs.length} vacancies found across SA government sources.
        </p>
      )}

      <div className="space-y-3">
        {jobs.map((j) => (
          <article key={j.id} className="rounded-lg border bg-card p-4 transition-colors hover:bg-accent/30">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h3 className="text-base font-semibold leading-tight">{j.title}</h3>
                <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Building2 className="h-3 w-3" /> {j.source}
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" /> {formatPosted(j.posted)}
                  </span>
                </div>
                {j.snippet && (
                  <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{j.snippet}</p>
                )}
              </div>
              <Button asChild size="sm">
                <a href={j.url} target="_blank" rel="noopener noreferrer">
                  View <ExternalLink className="h-3 w-3" />
                </a>
              </Button>
            </div>
          </article>
        ))}
        {mutation.data && jobs.length === 0 && !mutation.data.error && (
          <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            No vacancies found. Try a broader keyword or remove the province filter.
          </p>
        )}
      </div>
    </FeatureShell>
  );
}
