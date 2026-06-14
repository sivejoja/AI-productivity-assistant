import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export interface GovJob {
  id: string;
  title: string;
  source: string;
  snippet: string;
  url: string;
  posted: string;
}

const Schema = z.object({
  keyword: z.string().max(120).optional().default(""),
  province: z.string().max(60).optional().default(""),
  department: z.string().max(120).optional().default(""),
  max_days_old: z.number().int().min(1).max(365).optional().default(30),
  limit: z.number().int().min(5).max(30).optional().default(25),
});

const TBS_FROM_DAYS = (days: number) => {
  if (days <= 1) return "qdr:d";
  if (days <= 7) return "qdr:w";
  if (days <= 31) return "qdr:m";
  return "qdr:y";
};

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

function deriveSource(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "—";
  }
}

export const searchSaGovJobs = createServerFn({ method: "POST" })
  .inputValidator((input) => Schema.parse(input))
  .handler(async ({ data }) => {
    const apiKey = process.env.FIRECRAWL_API_KEY;
    if (!apiKey) {
      return { jobs: [] as GovJob[], error: "Search not configured.", total: 0 };
    }

    const filters = [data.keyword, data.department, data.province].filter(Boolean).join(" ");
    const query = `${filters || "vacancies"} South Africa government jobs (site:dpsa.gov.za OR site:govpage.co.za OR site:gov.za OR site:vacancies.gov.za OR site:careers.health.gov.za OR site:saps.gov.za/careers OR site:treasury.gov.za OR site:education.gov.za OR site:sars.gov.za OR site:eskom.co.za/careers OR site:transnet.net/careers OR site:southafrica.co.za/jobs OR site:careers24.com/jobs/government)`;

    try {
      const res = await fetch("https://api.firecrawl.dev/v2/search", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query,
          limit: data.limit,
          country: "za",
          tbs: TBS_FROM_DAYS(data.max_days_old),
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        console.error("SA gov search error", res.status, text);
        return { jobs: [] as GovJob[], error: `Search error (${res.status})`, total: 0 };
      }
      const json = await res.json() as {
        data?: { web?: Array<{ url: string; title?: string; description?: string }> }
          | Array<{ url: string; title?: string; description?: string }>;
      };
      const raw = Array.isArray(json.data) ? json.data : (json.data?.web ?? []);
      const seen = new Set<string>();
      const jobs: GovJob[] = [];
      for (const r of raw) {
        if (!r?.url || seen.has(r.url)) continue;
        seen.add(r.url);
        const snippet = (r.description || "").trim();
        jobs.push({
          id: r.url,
          title: (r.title || "Government vacancy").trim(),
          source: deriveSource(r.url),
          snippet,
          url: r.url,
          posted: derivePosted(snippet),
        });
      }
      jobs.sort((a, b) => new Date(b.posted).getTime() - new Date(a.posted).getTime());
      return { jobs, total: jobs.length, error: null as string | null };
    } catch (e) {
      console.error("SA gov fetch failed", e);
      return { jobs: [] as GovJob[], error: "Could not reach search service.", total: 0 };
    }
  });
