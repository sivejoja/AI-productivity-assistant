// Edge function that proxies requests to the Lovable AI Gateway.
// Handles 5 feature modes: email, meeting, tasks, research, chat.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

type Feature = "email" | "meeting" | "tasks" | "research" | "chat" | "autoapply" | "cvrevamp";

interface Body {
  feature: Feature;
  input?: string;
  messages?: { role: "user" | "assistant" | "system"; content: string }[];
  options?: Record<string, string>;
}

function systemPromptFor(feature: Feature, options: Record<string, string> = {}): string {
  switch (feature) {
    case "email":
      return `You are a professional email writing assistant. Generate a clear, polished email.
Tone: ${options.tone || "professional"}.
Length: ${options.length || "medium"}.
Return ONLY the email body in plain text, starting with a greeting and ending with a sign-off. Do not include "Subject:" unless the user asks. Do not wrap in markdown code fences.`;
    case "meeting":
      return `You are an expert meeting notes summarizer. Take raw meeting notes or a transcript and return well-structured markdown with these sections:
## Summary
A 2-3 sentence overview.
## Key Decisions
- bullet list
## Action Items
- [ ] owner — task — due date if mentioned
## Open Questions
- bullet list
Be concise and faithful to the source. Do not invent participants or dates.`;
    case "tasks":
      return `You are an AI task planner. Given a goal or project description, break it down into a prioritized, actionable plan.
Return markdown with:
## Plan Overview
One paragraph.
## Tasks
A numbered list. For each task include: title, priority (High/Med/Low), estimated effort, and 1-line description.
## Suggested Order
A short rationale for sequencing.
Keep it pragmatic and realistic.`;
    case "research":
      return `You are an AI research assistant. Provide a structured briefing on the user's topic using your general knowledge.
Return markdown with:
## Overview
## Key Points
- bullets
## Considerations & Tradeoffs
## Suggested Next Steps
Be balanced and note uncertainty where relevant. Do not fabricate sources or statistics.`;
    case "chat":
      return `You are a helpful, concise AI workplace assistant. Use markdown formatting. Be direct, friendly, and professional. If a request is ambiguous, ask a brief clarifying question.`;
    case "autoapply":
      return `You are an AI Auto Apply assistant. Given a candidate's CV/resume and target preferences (role, location, work type), do THREE things:

1. Extract a short candidate profile (top skills, years of experience, seniority, domains).
2. Suggest 3 additional roles the user did NOT mention but that strongly fit their CV (adjacent titles, stretch roles, or transferable-skill paths).
3. Generate 6 realistic, high-probability job matches that maximize the chance of landing an interview. Bias toward roles where the CV clearly meets 80%+ of typical requirements. Mix the user's stated target with the suggested adjacent roles.

For every job match you MUST include a direct apply link. Use real, well-known company career pages and reputable job boards. Prefer this priority order:
  1. The company's own careers site search URL (e.g. https://www.company.com/careers?q=Role)
  2. LinkedIn Jobs search: https://www.linkedin.com/jobs/search/?keywords=ROLE&location=LOCATION
  3. Indeed search: https://www.indeed.com/jobs?q=ROLE&l=LOCATION
  4. Wellfound (AngelList): https://wellfound.com/role/ROLE
URL-encode spaces as %20 or +. Never invent fake job IDs or fabricated posting URLs — use search/listing URLs that are guaranteed to resolve.

Return markdown in this exact structure:

## Candidate Profile
- **Headline:** one-line summary
- **Top skills:** comma-separated
- **Experience:** years + seniority
- **Best-fit roles:** comma-separated

## Suggested Roles You Didn't Mention
A short list of 3 adjacent roles with a one-line "why this fits you" for each.

## High-Interview-Probability Job Matches
For each of 6 jobs, use this template:

### {n}. {Job Title} — {Company} *(Interview probability: {High/Very High}, Match: {%})*
- **Location:** {location} · {remote/hybrid/onsite}
- **Why you'll likely get an interview:** 1–2 sentences citing specific CV strengths that match top requirements.
- **🔗 Apply now:** [Apply on {Company/LinkedIn/Indeed}](FULL_DIRECT_URL_HERE)
- **Tailored cover letter:**
> A concise 4–6 sentence cover letter in first person, referencing specific CV strengths and the role.
- **Pre-submit checklist:** 3 short bullets.

End with a brief note that apply links open the employer's careers page or a job-board search and the user should confirm the specific opening is still live before submitting.`;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");
    const body = (await req.json()) as Body;
    const feature = body.feature;
    if (!feature) {
      return new Response(JSON.stringify({ error: "Missing 'feature'" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const system = systemPromptFor(feature, body.options);

    const messages =
      feature === "chat" && body.messages?.length
        ? [{ role: "system", content: system }, ...body.messages]
        : [
            { role: "system", content: system },
            { role: "user", content: body.input ?? "" },
          ];

    const resp = await fetch(GATEWAY_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages,
      }),
    });

    if (!resp.ok) {
      if (resp.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit reached. Please wait and try again." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (resp.status === 402) {
        return new Response(
          JSON.stringify({
            error: "AI credits exhausted. Add credits in Settings → Workspace → Usage.",
          }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const t = await resp.text();
      console.error("Gateway error", resp.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await resp.json();
    const content: string = data.choices?.[0]?.message?.content ?? "";

    return new Response(JSON.stringify({ content }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-assist error", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
