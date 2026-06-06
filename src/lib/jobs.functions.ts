import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export interface AdzunaJob {
  id: string;
  title: string;
  company: string;
  location: string;
  description: string;
  created: string; // ISO date posted (best effort)
  redirect_url: string; // direct apply link
  salary_min?: number;
  salary_max?: number;
  salary_currency?: string;
  contract_type?: string;
  contract_time?: string;
  category?: string;
}

const SearchSchema = z.object({
  what: z.string().max(200).optional().default(""),
  where: z.string().max(120).optional().default(""),
  country: z.string().regex(/^[a-z]{2}$/).optional().default("us"),
  page: z.number().int().min(1).max(20).optional().default(1),
  results_per_page: z.number().int().min(1).max(50).optional().default(20),
  max_days_old: z.number().int().min(1).max(365).optional(),
  sort_by: z.enum(["date", "relevance", "salary"]).optional().default("date"),
  full_time: z.boolean().optional(),
  remote: z.boolean().optional(),
});

const COUNTRY_NAMES: Record<string, string> = {
  us: "United States", gb: "United Kingdom", au: "Australia", ca: "Canada",
  de: "Germany", fr: "France", nl: "Netherlands", in: "India",
  za: "South Africa", sg: "Singapore", br: "Brazil", mx: "Mexico",
  it: "Italy", es: "Spain", pl: "Poland", at: "Austria",
  be: "Belgium", ch: "Switzerland", nz: "New Zealand",
};

const TBS_FROM_DAYS = (days?: number) => {
  if (!days) return undefined;
  if (days <= 1) return "qdr:d";
  if (days <= 7) return "qdr:w";
  if (days <= 31) return "qdr:m";
  return "qdr:y";
};

// Try to extract a company-ish string from a snippet/title; fallback to host.
function deriveCompany(title: string, description: string, url: string): string {
  const dashMatch = title.match(/(?:\s[-–|·]\s)([^-–|·]{2,60})$/);
  if (dashMatch) return dashMatch[1].trim();
  const atMatch = description.match(/\bat\s+([A-Z][A-Za-z0-9&.,'\- ]{1,50})/);
  if (atMatch) return atMatch[1].trim();
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    return host.split(".")[0].replace(/-/g, " ").replace(/^\w/, (c) => c.toUpperCase());
  } catch {
    return "—";
  }
}

// Heuristic posted-date parser from snippet ("2 days ago", "1 week ago", …)
function derivePosted(description: string): string {
  const m = description.match(/(\d+)\s+(hour|day|week|month)s?\s+ago/i);
  if (!m) return new Date().toISOString();
  const n = parseInt(m[1], 10);
  const unit = m[2].toLowerCase();
  const ms = unit === "hour" ? n * 36e5
    : unit === "day" ? n * 864e5
    : unit === "week" ? n * 7 * 864e5
    : n * 30 * 864e5;
  return new Date(Date.now() - ms).toISOString();
}

export const searchJobs = createServerFn({ method: "POST" })
  .inputValidator((input) => SearchSchema.parse(input))
  .handler(async ({ data }) => {
    const apiKey = process.env.FIRECRAWL_API_KEY;
    if (!apiKey) {
      return { jobs: [] as AdzunaJob[], error: "Search not configured.", total: 0 };
    }

    const countryName = COUNTRY_NAMES[data.country] ?? data.country.toUpperCase();
    const parts = [
      data.what || "jobs",
      data.what ? "jobs" : "",
      data.where ? `in ${data.where}` : `in ${countryName}`,
      data.remote ? "remote" : "",
      data.full_time ? "full time" : "",
    ].filter(Boolean);
    // Bias toward real job boards so results are apply-ready.
    const query = `${parts.join(" ")} (site:linkedin.com/jobs OR site:indeed.com OR site:glassdoor.com OR site:weworkremotely.com OR site:remoteok.com OR site:lever.co OR site:greenhouse.io OR site:workable.com OR site:jobs.ashbyhq.com OR site:smartrecruiters.com OR site:bamboohr.com OR site:wellfound.com OR site:careers.google.com OR site:builtin.com)`;

    const body = {
      query,
      limit: Math.min(Math.max(data.results_per_page, 10), 30),
      country: data.country,
      tbs: TBS_FROM_DAYS(data.max_days_old),
    };

    try {
      const res = await fetch("https://api.firecrawl.dev/v2/search", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const text = await res.text();
        console.error("Firecrawl search error", res.status, text);
        return { jobs: [] as AdzunaJob[], error: `Search error (${res.status})`, total: 0 };
      }
      const json = await res.json() as {
        success?: boolean;
        data?: { web?: Array<{ url: string; title?: string; description?: string }> } | Array<{ url: string; title?: string; description?: string }>;
      };
      const raw = Array.isArray(json.data)
        ? json.data
        : (json.data?.web ?? []);
      const seen = new Set<string>();
      const jobs: AdzunaJob[] = [];
      for (const r of raw) {
        if (!r?.url || seen.has(r.url)) continue;
        seen.add(r.url);
        const title = (r.title || "Job listing").trim();
        const description = (r.description || "").trim();
        jobs.push({
          id: r.url,
          title,
          company: deriveCompany(title, description, r.url),
          location: data.where || countryName,
          description,
          created: derivePosted(description),
          redirect_url: r.url,
        });
      }
      jobs.sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime());
      return { jobs, total: jobs.length, error: null as string | null };
    } catch (e) {
      console.error("Firecrawl fetch failed", e);
      return { jobs: [] as AdzunaJob[], error: "Could not reach search service.", total: 0 };
    }
  });
