/**
 * Two-pass search strategy:
 *   Pass 1 (this prompt) — Claude parses the raw HR query into structured form.
 *   Pass 2 (rank-candidates.prompt.ts) — Claude re-ranks shortlisted candidates.
 *
 * Why separate passes?
 *   - Understanding is fast (<500 tokens) and produces the embeddingText used for
 *     vector search. We MUST understand the query BEFORE we can search.
 *   - Ranking requires passing candidate profiles which can be large; keeping it
 *     separate allows better token budget control and independent retries.
 *
 * temperature: 0 — query understanding should be deterministic.
 */
export const UNDERSTAND_QUERY_SYSTEM = `You are a search query parser for an HR skills intelligence platform. Output only valid JSON. Never include markdown, explanations, or any text outside the JSON object.`;

export function buildUnderstandQueryPrompt(query: string): string {
  return `Parse this HR search query into structured requirements.

QUERY: "${query}"

Return a single JSON object:
{
  "intent": "string — one sentence describing what HR is looking for",
  "requiredSkills": ["string — skills that must be present; normalize names: React not ReactJS, PostgreSQL not postgres, TypeScript not TS"],
  "preferredSkills": ["string — nice-to-have skills mentioned or strongly implied"],
  "seniorityLevel": "junior | mid | senior | lead | any",
  "minYearsExperience": number,
  "domain": "string or null — industry context like fintech, healthcare, ecommerce, etc.",
  "location": "string or null — city or region mentioned",
  "embeddingText": "string — an enriched, full-sentence description for semantic vector search (see rules below)",
  "structuredFilters": {
    "minYears": number or null,
    "requiredSkillNames": ["lowercase skill names for SQL matching"] or null
  }
}

SENIORITY → YEARS MAPPING:
- "junior" or "entry-level" → minYears: 1, seniorityLevel: "junior"
- "mid" or "intermediate" → minYears: 3, seniorityLevel: "mid"
- "senior" → minYears: 5, seniorityLevel: "senior"
- "lead", "principal", "staff" → minYears: 7, seniorityLevel: "lead"
- no seniority mentioned → minYears: 0, seniorityLevel: "any"

EMBEDDING TEXT RULES (critical for search quality):
- Expand abbreviations: WS → WebSocket, TS → TypeScript, k8s → Kubernetes
- Add canonical skill names for mentioned technologies
- Include the seniority level and experience range explicitly
- Add domain-relevant implied skills (React → JavaScript, TypeScript; AWS → cloud, devops)
- Write 2–3 rich sentences, NOT just a list
- Example: "senior React devs with WebSocket" →
  "Senior frontend engineer with expert-level React.js and TypeScript skills, 5+ years of experience. Proficient in WebSocket real-time communication, browser performance, and modern JavaScript ecosystem tools like Redux, Next.js, and component architecture patterns."

EXAMPLES:
Query: "Find senior React developers with WebSocket experience"
→ requiredSkills: ["React","WebSocket"], seniorityLevel: "senior", minYears: 5

Query: "Backend Java developers in Pune with payment gateway experience"
→ requiredSkills: ["Java"], preferredSkills: ["payment gateway","Spring Boot"], location: "Pune", domain: "fintech"

Query: "Frontend engineers available next month"
→ requiredSkills: [], preferredSkills: [], intent: "Find available frontend engineers"
  Note: Availability is not stored — location/availability constraints should be reflected in intent only`;
}
