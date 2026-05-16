/**
 * Produces the system + user message pair sent to Claude for resume extraction.
 *
 * Design principles:
 *  1. Schema-first — embed the exact JSON contract so Claude cannot deviate.
 *  2. Rules block — normalize edge cases (skill names, date formats, missing fields).
 *  3. Evidence field — forces Claude to ground every skill in the actual text,
 *     making HR review faster and more trustworthy.
 *  4. Confidence scoring — lets the UI highlight uncertain extractions.
 *  5. temperature:0 at call site — deterministic output for structured extraction.
 */
export const EXTRACT_PROFILE_SYSTEM = `You are a resume parsing API. You output only valid JSON that strictly matches the schema provided by the user. You never include markdown fences, explanations, or any text outside the JSON object. If information is genuinely absent, use null or empty arrays — never fabricate data.`;

export function buildExtractionPrompt(rawText: string): string {
  return `Extract professional information from the resume below and return a single JSON object matching this exact schema. Do not include any text before or after the JSON.

SCHEMA:
{
  "title": "string — most recent or current job title",
  "summary": "string — a 2–3 sentence professional summary YOU compose based on the resume",
  "yearsTotal": "number — total years of professional experience (calculate from earliest to latest date if not stated)",
  "extractionConfidence": "number 0.0–1.0 — your overall confidence in the quality of this extraction",
  "skills": [
    {
      "name": "string — canonical skill name (Python not python3, PostgreSQL not postgres, TypeScript not TS)",
      "category": "one of: programming | framework | database | cloud | devops | data_science | mobile | security | management | soft_skill | other",
      "proficiency": "one of: beginner | intermediate | advanced | expert",
      "yearsExp": "number — years using this skill",
      "confidence": "number 0.0–1.0 — 1.0=explicitly stated, 0.7=clearly implied, 0.5=inferred from context",
      "evidence": "string — direct quote or paraphrase from the resume that supports this skill"
    }
  ],
  "projects": [
    {
      "name": "string",
      "description": "string — what the project was and what the person built or did",
      "impact": "string | null — quantified outcome if mentioned, e.g. 'Reduced latency 40%'",
      "techStack": ["string — technologies used"],
      "startDate": "string | null — YYYY-MM format",
      "endDate": "string | null — YYYY-MM format",
      "isCurrent": "boolean"
    }
  ],
  "certifications": [
    {
      "name": "string",
      "issuer": "string | null",
      "issueDate": "string | null — YYYY-MM-DD",
      "expiryDate": "string | null — YYYY-MM-DD",
      "credentialId": "string | null"
    }
  ],
  "education": [
    {
      "degree": "string",
      "fieldOfStudy": "string | null",
      "institution": "string",
      "startYear": "number | null",
      "endYear": "number | null",
      "gpa": "number | null"
    }
  ]
}

EXTRACTION RULES:
- Canonicalize skill names: JavaScript not JS, Kubernetes not k8s, AWS not Amazon Web Services
- Proficiency estimation: 0–1 yr=beginner, 1–3 yr=intermediate, 3–6 yr=advanced, 6+ yr=expert; also use job title and project complexity as signal
- Extract ALL technologies mentioned in job descriptions and projects — these are skills
- For yearsExp: calculate from date ranges if possible; estimate if only job title/level given
- evidence must reference actual resume content — never fabricate
- extractionConfidence: 0.9+ for clear resumes, 0.6–0.8 for partial info, <0.6 for very sparse resumes
- Return [] for sections with no data, never omit a field

RESUME TEXT:
${rawText}`;
}
