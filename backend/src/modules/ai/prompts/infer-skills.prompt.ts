import { ProfileExtraction } from '../types/extraction-result.types';

/**
 * Builds the inference prompt from an already-extracted profile.
 *
 * Design principles:
 *  1. Provide the full explicit skill set so Claude does NOT re-infer known skills.
 *  2. Anchored inference rules ensure consistent, defensible suggestions.
 *  3. The reasoning field is shown directly in the UI as a badge tooltip —
 *     it must be concise and human-readable.
 *  4. Confidence field drives the UI's display: high=solid badge, medium=outline,
 *     low=suppressed (not shown unless user expands).
 */
export const INFER_SKILLS_SYSTEM = `You are a skills inference API. You output only a valid JSON array. No markdown, no explanation, no text outside the array.`;

export function buildInferencePrompt(extracted: ProfileExtraction): string {
  const skillList = extracted.skills
    .map((s) => `${s.name} (${s.yearsExp}yr, ${s.proficiency})`)
    .join(', ');

  const projectTech = [
    ...new Set(extracted.projects.flatMap((p) => p.techStack)),
  ].join(', ');

  const certNames = extracted.certifications.map((c) => c.name).join(', ') || 'none';

  return `Given this professional profile, infer additional skills the person almost certainly possesses but did not explicitly list.

KNOWN PROFILE:
- Title: ${extracted.title}
- Total Experience: ${extracted.yearsTotal} years
- Explicit Skills: ${skillList || 'none listed'}
- Project Technologies: ${projectTech || 'none listed'}
- Certifications: ${certNames}

Return a JSON ARRAY (not object) of inferred skills:
[
  {
    "name": "string — canonical skill name",
    "category": "programming | framework | database | cloud | devops | data_science | mobile | security | management | soft_skill | other",
    "proficiency": "beginner | intermediate | advanced | expert",
    "yearsExp": "number — estimated years",
    "confidence": "high | medium | low",
    "reasoning": "string — one sentence explaining why this skill is inferred; must reference a specific skill or project from the profile"
  }
]

INFERENCE RULES (apply these to determine what to include):
- React → JavaScript, HTML, CSS (high confidence)
- Next.js → React, JavaScript, Vercel/deployment concepts (high)
- Kubernetes → Docker, Linux, YAML (high), networking basics (medium)
- AWS Lambda → serverless architecture, IAM, event-driven patterns (high)
- AWS Solutions Architect cert → VPC, EC2, S3, IAM, CloudFormation (high)
- Django → Python, SQL, ORM patterns, HTTP fundamentals (high)
- Spring Boot → Java, Maven/Gradle, REST APIs (high)
- TensorFlow or PyTorch → Python, NumPy, linear algebra basics (high)
- Senior/Lead title (5+ yr) → system design, code review, mentoring, technical planning (medium)
- Data Engineer → SQL, ETL patterns, shell scripting (high)
- DevOps role → Bash/shell scripting, monitoring, alerting, incident response (high)
- Mobile (Swift/iOS) → Xcode, Apple HIG, App Store deployment (high)
- Mobile (Kotlin/Android) → Android Studio, Google Play, Material Design (high)
- PostgreSQL advanced → query optimisation, indexing strategies, EXPLAIN (medium)
- GraphQL → REST API design, schema design (medium)
- Terraform → infrastructure-as-code, cloud provider APIs (high)
- Redis → caching patterns, pub/sub, session management (medium)

CONSTRAINTS:
- Maximum 10 inferred skills
- Skip any skill already present in the explicit skill list (case-insensitive)
- Only include skills with medium or high confidence
- reasoning must be one sentence and must reference a specific explicit skill or project
- Never infer soft skills unless the person has a management title`;
}
