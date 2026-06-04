import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Globe, Search, MapPin, Calendar, Building2, ExternalLink, Banknote } from "lucide-react";
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
import { searchJobs, type AdzunaJob } from "@/lib/jobs.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/jobs")({
  component: JobsPortal,
});

const COUNTRIES: { code: string; name: string }[] = [
  { code: "us", name: "United States" },
  { code: "gb", name: "United Kingdom" },
  { code: "au", name: "Australia" },
  { code: "ca", name: "Canada" },
  { code: "de", name: "Germany" },
  { code: "fr", name: "France" },
  { code: "nl", name: "Netherlands" },
  { code: "in", name: "India" },
  { code: "za", name: "South Africa" },
  { code: "sg", name: "Singapore" },
  { code: "br", name: "Brazil" },
  { code: "mx", name: "Mexico" },
  { code: "it", name: "Italy" },
  { code: "es", name: "Spain" },
  { code: "pl", name: "Poland" },
  { code: "at", name: "Austria" },
  { code: "be", name: "Belgium" },
  { code: "ch", name: "Switzerland" },
  { code: "nz", name: "New Zealand" },
];

function formatPosted(iso: string) {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days} days ago`;
  return d.toLocaleDateString();
}

function formatSalary(j: AdzunaJob) {
  if (!j.salary_min && !j.salary_max) return null;
  const cur = j.salary_currency ?? "";
  const min = j.salary_min ? Math.round(j.salary_min).toLocaleString() : "";
  const max = j.salary_max ? Math.round(j.salary_max).toLocaleString() : "";
  if (min && max) return `${cur} ${min}–${max}`;
  return `${cur} ${min || max}`;
}

function JobsPortal() {
  const [what, setWhat] = useState("");
  const [where, setWhere] = useState("");
  const [country, setCountry] = useState("us");
  const [maxDays, setMaxDays] = useState("30");
  const search = useServerFn(searchJobs);

  const mutation = useMutation({
    mutationFn: () =>
      search({
        data: {
          what,
          where,
          country,
          page: 1,
          results_per_page: 30,
          max_days_old: Number(maxDays) || undefined,
          sort_by: "date",
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
      title="Job Seeker Portal"
      description="Search live job listings worldwide. Direct links to the original posting."
      icon={<Globe className="h-5 w-5" />}
    >
      <div className="rounded-lg border bg-card p-4">
        <div className="grid gap-3 md:grid-cols-12">
          <div className="space-y-2 md:col-span-4">
            <Label htmlFor="what">Keywords / role</Label>
            <Input
              id="what"
              placeholder="e.g. Senior React Engineer"
              value={what}
              onChange={(e) => setWhat(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && mutation.mutate()}
            />
          </div>
          <div className="space-y-2 md:col-span-3">
            <Label htmlFor="where">Location</Label>
            <Input
              id="where"
              placeholder="City, region or 'remote'"
              value={where}
              onChange={(e) => setWhere(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && mutation.mutate()}
            />
          </div>
          <div className="space-y-2 md:col-span-3">
            <Label>Country</Label>
            <Select value={country} onValueChange={setCountry}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {COUNTRIES.map((c) => (
                  <SelectItem key={c.code} value={c.code}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Posted within</Label>
            <Select value={maxDays} onValueChange={setMaxDays}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">24 hours</SelectItem>
                <SelectItem value="3">3 days</SelectItem>
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
          {mutation.isPending ? "Searching live jobs…" : "Search jobs"}
        </Button>
      </div>

      {mutation.data && (
        <p className="text-xs text-muted-foreground">
          Showing {jobs.length} of {mutation.data.total.toLocaleString()} matching jobs.
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
                    <Building2 className="h-3 w-3" /> {j.company}
                  </span>
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" /> {j.location}
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" /> Posted {formatPosted(j.created)}
                  </span>
                  {formatSalary(j) && (
                    <span className="flex items-center gap-1">
                      <Banknote className="h-3 w-3" /> {formatSalary(j)}
                    </span>
                  )}
                  {j.contract_time && (
                    <span className="rounded bg-muted px-1.5 py-0.5 capitalize">
                      {j.contract_time.replace("_", " ")}
                    </span>
                  )}
                </div>
                <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">
                  {j.description}
                </p>
              </div>
              <Button asChild size="sm">
                <a href={j.redirect_url} target="_blank" rel="noopener noreferrer">
                  Apply <ExternalLink className="h-3 w-3" />
                </a>
              </Button>
            </div>
          </article>
        ))}
        {mutation.data && jobs.length === 0 && !mutation.data.error && (
          <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            No jobs found. Try broader keywords or a different country.
          </p>
        )}
      </div>
    </FeatureShell>
  );
}
