import { UnderstoodQuery, CandidateForRanking } from '../../search/types/search.types';

/**
 * Pass 2 of the two-pass search strategy.
 * Claude receives the pre-filtered shortlist (up to 15 candidates) from vector
 * search and re-ranks them with deep reasoning.
 *
 * Key prompt design choices:
 *  1. Structured candidate format — consistent layout helps Claude compare fairly.
 *  2. Explicit scoring rubric — prevents score inflation and keeps ranges meaningful.
 *  3. reasoning field references actual skills/projects — makes HR review faster.
 *  4. gaps field — honest about what's missing, builds trust with HR users.
 *  5. temperature: 0 — consistent ranking for the same input.
 */
export const RANK_CANDIDATES_SYSTEM = `You are a senior technical recruiter AI for a skills intelligence platform. You evaluate candidates objectively against job requirements. Output only a valid JSON array sorted from best to worst match. Never include markdown or text outside the array.`;

export function buildRankCandidatesPrompt(
  originalQuery: string,
  understood: UnderstoodQuery,
  candidates: CandidateForRanking[],
): string {
  const candidateList = candidates
    .map((c) => {
      const skills = c.skills
        .filter((s) => !s.isInferred)
        .map((s) => `${s.name}(${s.yearsExp}yr,${s.proficiency})`)
        .join(', ');

      const inferred = c.skills
        .filter((s) => s.isInferred)
        .map((s) => s.name)
        .join(', ');

      const projects = c.projectSummaries.slice(0, 2).join(' | ');
      const certs = c.certifications.join(', ') || 'none';

      return [
        `[${c.index}] ${c.name} — ${c.title} (${c.yearsTotal} years total)`,
        `  Skills: ${skills || 'not listed'}`,
        inferred ? `  Also proficient in (inferred): ${inferred}` : '',
        projects ? `  Projects: ${projects}` : '',
        `  Certifications: ${certs}`,
      ]
        .filter(Boolean)
        .join('\n');
    })
    .join('\n\n');

  const required = understood.requiredSkills.join(', ') || 'none specified';
  const preferred = understood.preferredSkills.join(', ') || 'none specified';
  const seniority = `${understood.seniorityLevel}${understood.minYearsExperience ? ` (${understood.minYearsExperience}+ years)` : ''}`;
  const domain = understood.domain ?? 'general';

  return `Rank the following candidates against the HR search requirement.

ORIGINAL QUERY: "${originalQuery}"

PARSED REQUIREMENTS:
- Intent: ${understood.intent}
- Required skills: ${required}
- Preferred skills: ${preferred}
- Seniority: ${seniority}
- Domain context: ${domain}
${understood.location ? `- Location mentioned: ${understood.location} (not filterable — note in reasoning if relevant)` : ''}

CANDIDATES (${candidates.length} total):
${candidateList}

Return a JSON array ranked from best to worst. Include ALL ${candidates.length} candidates:
[
  {
    "candidateIndex": number,
    "score": number,
    "reasoning": "string — 2-3 sentences explaining fit. Must reference the candidate's specific skills, years, and project names. Be concrete, not generic.",
    "strengths": ["string — specific matching attributes, e.g. '6yr expert React', 'real-time dashboard project'"],
    "gaps": ["string — specific missing requirements, e.g. 'no WebSocket listed', 'only 2yr experience vs 5yr required'"],
    "recommendation": "strong_match | good_match | partial_match | poor_match"
  }
]

SCORING RUBRIC:
- 90–100 (strong_match): Exceeds all requirements, directly relevant project experience
- 70–89 (good_match): Meets main requirements, minor gaps or inferred skills cover them
- 50–69 (partial_match): Meets some requirements, notable gaps in key skills or experience
- 0–49 (poor_match): Significant gaps in required skills or experience level

SCORING RULES:
- Be calibrated: reserve 90+ for genuinely exceptional matches
- Evidence from projects and certifications can compensate for slightly lower explicit skill years
- Inferred skills are weaker signal than explicit — don't score them as strongly as stated skills
- "Senior" requirement with only 2-3 years should score below 50 regardless of skill match
- Be honest about gaps — HR trusts accurate assessments, not inflated scores`;
}
