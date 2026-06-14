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
      return `You are an AI Auto Apply assistant. The user message contains the candidate's CV and a JSON array of LIVE job listings (each with id, title, company, location, posted, url, snippet).

CRITICAL: You MUST use the EXACT urls from the listings as the apply links. Do NOT invent or modify URLs. Do NOT use LinkedIn/Indeed search URLs — the provided urls are direct links to the live posting.

BE STRICT ABOUT RELEVANCE. Silently DROP any job that is not a strong fit for the candidate's CV. A strong fit means:
- Title/seniority within ONE step of what the CV supports (no junior CVs for director roles, no backend CVs for pure design roles).
- At least 60% of the listing's core required skills appear in the CV or are clearly transferable.
- Industry/domain or tech stack overlaps meaningfully.
Quality over quantity: 3 excellent matches beat 12 mediocre ones. If fewer than 3 jobs qualify, return only those and add a short note suggesting better search terms. NEVER pad the list with weak matches.

Do THREE things:
1. Extract a short candidate profile (top skills, years of experience, seniority, domains).
2. Suggest 3 adjacent roles the candidate did NOT mention but that fit their CV.
3. Rank STRONG-FIT jobs only (match ≥ 70%) by interview probability, best matches first.

Return markdown in this exact structure:

## Candidate Profile
- **Headline:** one-line summary
- **Top skills:** comma-separated
- **Experience:** years + seniority
- **Best-fit roles:** comma-separated

## Suggested Roles You Didn't Mention
3 adjacent roles, each with a one-line "why this fits you".

## Ranked Live Job Matches
For EACH job, in ranked order, use this template:

### {n}. {Job Title} — {Company} *(Match: {%}, Interview probability: {Low/Medium/High/Very High})*
- **Location:** {location} · Posted {posted}
- **Why you'll likely get an interview:** 1–2 sentences citing specific CV strengths that match the listing's requirements.
- **🔗 Apply now:** [Apply directly]({url})  ← use the EXACT url from the listing
- **Tailored cover letter:**
> A concise 4–6 sentence first-person cover letter referencing specific CV strengths and the role.
- **Pre-submit checklist:** 3 short bullets (CV tweak, portfolio link, recruiter follow-up, etc.).

End with a one-line reminder to confirm the role is still open before submitting.`;
    case "cvrevamp":
      return `You are an elite CV/resume writer who specializes in modern, ATS-friendly resumes for high-demand roles (AI/ML, product, data, cloud/devops, cybersecurity, full-stack, etc.).

The user provides their current CV and (optionally) a target role and industry. Do the following:

1. Diagnose what's weak in the current CV (clarity, impact, keywords, structure, ATS issues).
2. Rewrite the CV from scratch into a clean, ATS-friendly, achievement-driven format.
3. Tailor wording/keywords toward the target role and toward 2026's most in-demand skills in that field.
4. Quantify achievements where the source data implies it; never fabricate numbers — use [X], [Y] placeholders if unknown.

Return markdown in this exact structure:

## CV Health Check
3–5 bullets diagnosing concrete issues in the current CV.

## Recommended Target Role(s)
The best 1–3 in-demand roles this CV positions for (with a one-line rationale).

## Revamped CV

### {Full Name}
{Headline / title} · {Location} · {email} · {phone} · {LinkedIn} · {Portfolio}

**Professional Summary**
3–4 punchy sentences tailored to the target role.

**Core Skills**
Comma-separated, ATS-keyword rich, grouped briefly (Languages · Frameworks · Cloud · Tools · Soft skills).

**Experience**
For each role:
**{Title}** — {Company} · {Location} · {Dates}
- Action-verb bullet with measurable impact ({metric}).
- 3–5 bullets per role, results-first.

**Projects** (if relevant)
- {Name} — what + tech + outcome.

**Education**
{Degree}, {School} — {Year}

**Certifications**
- Listed concisely.

## ATS & Recruiter Tips
4–6 bullets the user should action before sending (file format, keyword check, LinkedIn alignment, etc.).`;
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
