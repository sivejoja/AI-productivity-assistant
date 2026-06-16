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
    case "autoapply": {
      const strictness = Number(options.strictness ?? "55"); // default 55 (Balanced)
      const minMatch = Math.max(30, Math.min(95, strictness));
      const avoid = (options.avoid_titles || "").trim();
      const targets = (options.target_categories || "").trim();
      const excludes = (options.exclude_tags || "").trim();
      const avoidLine = avoid
        ? `\nUSER REJECTED THESE PREVIOUSLY (avoid anything similar): ${avoid}`
        : "";
      const targetLine = targets
        ? `\nUSER TARGET CATEGORIES (prefer these): ${targets}`
        : "";
      const excludeLine = excludes
        ? `\nUSER EXCLUSION TAGS (drop any listing mentioning these): ${excludes}`
        : "";
      return `You are an AI Auto Apply assistant. The user message contains the candidate's CV and a JSON array of LIVE job listings (id, title, company, location, posted, url, snippet).

CRITICAL RULES:
- Use the EXACT urls AND ids from the listings. NEVER invent URLs or ids.
- Aim to DROP jobs with match below ${minMatch}%. Strictness setting: ${strictness}/100.
- HOWEVER: if fewer than 3 listings meet the threshold, INCLUDE the top 5 best-fit listings anyway (mark them with a lower match_percent and explain the gap in why_match). The user must never see an empty screen when live jobs exist.${avoidLine}${targetLine}${excludeLine}

RETURN ONLY VALID JSON (no prose, no markdown fences) matching this exact shape:
{
  "profile": {
    "headline": "one-line summary",
    "skills": ["top","skills","from","cv"],
    "experience": "X years, seniority",
    "best_fit_roles": ["role1","role2"]
  },
  "suggested_roles": [
    { "role": "Adjacent role title", "why": "one-line fit reason" }
  ],
  "matches": [
    {
      "id": "<exact id from input>",
      "title": "<job title>",
      "company": "<company>",
      "location": "<location>",
      "posted": "<posted string from input>",
      "url": "<EXACT url from input>",
      "match_percent": 85,
      "interview_probability": "Low|Medium|High|Very High",
      "why_match": "1-2 sentence explanation of fit",
      "matched_keywords": ["specific","CV","skills","that","matched"],
      "cover_letter": "4-6 sentence first-person cover letter",
      "checklist": ["short tip","short tip","short tip"]
    }
  ],
  "note": "optional short note if fewer than 3 strong matches"
}

Rank matches best-first. Provide 3 suggested_roles. Output JSON only.`;
    }

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
