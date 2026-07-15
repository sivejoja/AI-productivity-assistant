// Extracts skills, roles, and years-of-experience hints from raw CV text.
// Used to give the AI a structured preface so matching is more accurate.

const SKILL_LEXICON = [
  // languages
  "javascript","typescript","python","java","c#","c++","go","rust","kotlin","swift","php","ruby","scala","r","sql","bash","powershell","dart",
  // web / frontend
  "react","next.js","vue","angular","svelte","tailwind","redux","html","css","sass","webpack","vite",
  // backend
  "node.js","express","nest.js","django","flask","fastapi","spring","spring boot","rails","laravel","graphql","rest","grpc",
  // data / ai
  "pandas","numpy","pytorch","tensorflow","scikit-learn","langchain","llm","nlp","computer vision","spark","hadoop","airflow","dbt","snowflake","bigquery","databricks","tableau","power bi","looker",
  // cloud / devops
  "aws","azure","gcp","kubernetes","docker","terraform","ansible","jenkins","github actions","gitlab ci","circleci","helm","istio","prometheus","grafana",
  // db
  "postgres","postgresql","mysql","mongodb","redis","elasticsearch","dynamodb","cassandra","supabase","firebase",
  // pm / design / ops
  "jira","confluence","agile","scrum","kanban","figma","adobe xd","sketch",
  // security
  "owasp","penetration testing","siem","soc","incident response","iso 27001","gdpr","pci-dss",
  // government / admin (SA-focused)
  "public administration","policy analysis","procurement","stakeholder engagement","monitoring and evaluation","project management",
  "customer service","call centre","supply chain","logistics","hr","recruitment","payroll","bookkeeping","accounting","auditing","teaching","nursing","social work",
];

const ROLE_HINTS = [
  "engineer","developer","architect","analyst","scientist","manager","lead","director","officer","administrator",
  "coordinator","consultant","specialist","designer","technician","clerk","assistant","intern","teacher","nurse",
];

export interface CvSignals {
  skills: string[];
  recentRoles: string[];
  yearsExperience: number | null;
  location: string | null;
}

export function extractCvSignals(raw: string): CvSignals {
  const text = raw.replace(/\r/g, "");
  const lower = text.toLowerCase();

  // skills
  const found = new Set<string>();
  for (const s of SKILL_LEXICON) {
    const re = new RegExp(`\\b${s.replace(/[.+#()]/g, (m) => "\\" + m)}\\b`, "i");
    if (re.test(lower)) found.add(s);
  }

  // recent roles: look at lines that contain a role-hint word and a capital letter
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const roles: string[] = [];
  for (const line of lines) {
    if (line.length > 90) continue;
    const l = line.toLowerCase();
    if (ROLE_HINTS.some((h) => l.includes(h)) && /[A-Z]/.test(line)) {
      const clean = line.replace(/\s{2,}/g, " ").replace(/[•\-–·|]+/g, " ").trim();
      if (clean.length > 3 && !roles.includes(clean)) roles.push(clean);
    }
    if (roles.length >= 6) break;
  }

  // years of experience
  let years: number | null = null;
  const yrMatch = lower.match(/(\d{1,2})\+?\s*(?:years?|yrs?)\s+(?:of\s+)?experience/);
  if (yrMatch) years = Math.min(50, parseInt(yrMatch[1], 10));

  // location hint (first line containing a comma + capitalised token, or a common city marker)
  let location: string | null = null;
  const cityLine = lines.find((l) =>
    /,\s*[A-Z]/.test(l) && l.length < 80 && !/@/.test(l) && !/http/i.test(l),
  );
  if (cityLine) location = cityLine;

  return {
    skills: Array.from(found).slice(0, 40),
    recentRoles: roles.slice(0, 5),
    yearsExperience: years,
    location,
  };
}

export function formatCvPreface(sig: CvSignals): string {
  const lines: string[] = ["=== CV SIGNALS (pre-extracted for accuracy) ==="];
  if (sig.skills.length) lines.push(`DETECTED SKILLS: ${sig.skills.join(", ")}`);
  if (sig.recentRoles.length) lines.push(`RECENT ROLES/TITLES: ${sig.recentRoles.join(" | ")}`);
  if (sig.yearsExperience != null) lines.push(`YEARS OF EXPERIENCE: ${sig.yearsExperience}`);
  if (sig.location) lines.push(`CANDIDATE LOCATION HINT: ${sig.location}`);
  lines.push("=== END SIGNALS ===");
  return lines.join("\n");
}
