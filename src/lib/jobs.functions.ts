import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export interface AdzunaJob {
  id: string;
  title: string;
  company: string;
  location: string;
  description: string;
  created: string; // ISO date posted
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
  country: z
    .string()
    .regex(/^[a-z]{2}$/)
    .optional()
    .default("us"),
  page: z.number().int().min(1).max(20).optional().default(1),
  results_per_page: z.number().int().min(1).max(50).optional().default(20),
  max_days_old: z.number().int().min(1).max(90).optional(),
  sort_by: z.enum(["date", "relevance", "salary"]).optional().default("date"),
  full_time: z.boolean().optional(),
  remote: z.boolean().optional(),
});

export const searchJobs = createServerFn({ method: "POST" })
  .inputValidator((input) => SearchSchema.parse(input))
  .handler(async ({ data }) => {
    const appId = process.env.ADZUNA_APP_ID;
    const appKey = process.env.ADZUNA_APP_KEY;
    if (!appId || !appKey) {
      return { jobs: [] as AdzunaJob[], error: "Jobs API not configured.", total: 0 };
    }

    const params = new URLSearchParams({
      app_id: appId,
      app_key: appKey,
      results_per_page: String(data.results_per_page),
      "content-type": "application/json",
      sort_by: data.sort_by,
    });
    if (data.what) params.set("what", data.what);
    // Append remote hint to keywords for better matches
    if (data.remote) params.set("what_or", `${data.what} remote`.trim());
    if (data.where) params.set("where", data.where);
    if (data.max_days_old) params.set("max_days_old", String(data.max_days_old));
    if (data.full_time) params.set("full_time", "1");

    const url = `https://api.adzuna.com/v1/api/jobs/${data.country}/search/${data.page}?${params}`;
    try {
      const res = await fetch(url);
      if (!res.ok) {
        const text = await res.text();
        console.error("Adzuna error", res.status, text);
        return { jobs: [] as AdzunaJob[], error: `Jobs API error (${res.status})`, total: 0 };
      }
      const json = (await res.json()) as {
        count: number;
        results: Array<{
          id: string;
          title: string;
          company?: { display_name?: string };
          location?: { display_name?: string };
          description: string;
          created: string;
          redirect_url: string;
          salary_min?: number;
          salary_max?: number;
          salary_currency?: string;
          contract_type?: string;
          contract_time?: string;
          category?: { label?: string };
        }>;
      };
      const jobs: AdzunaJob[] = (json.results ?? []).map((j) => ({
        id: j.id,
        title: j.title,
        company: j.company?.display_name ?? "Unknown",
        location: j.location?.display_name ?? "—",
        description: j.description,
        created: j.created,
        redirect_url: j.redirect_url,
        salary_min: j.salary_min,
        salary_max: j.salary_max,
        salary_currency: j.salary_currency,
        contract_type: j.contract_type,
        contract_time: j.contract_time,
        category: j.category?.label,
      }));
      return { jobs, total: json.count ?? jobs.length, error: null as string | null };
    } catch (e) {
      console.error("Adzuna fetch failed", e);
      return { jobs: [] as AdzunaJob[], error: "Could not reach jobs API.", total: 0 };
    }
  });
