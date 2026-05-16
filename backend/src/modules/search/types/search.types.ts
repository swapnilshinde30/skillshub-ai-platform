import { SearchRecommendation } from '../../../common/enums';

// ── Query understanding ─────────────────────────────────────────────────────

export type SeniorityLevel = 'junior' | 'mid' | 'senior' | 'lead' | 'any';

export interface StructuredFilters {
  /** Minimum total years of experience (hard filter, not soft) */
  minYears: number | null;
  /** Skill names that must appear in the profile (case-insensitive) */
  requiredSkillNames: string[] | null;
}

export interface UnderstoodQuery {
  /** One-sentence summary of what HR is looking for */
  intent: string;
  /** Skills that must be present — used for hard SQL filtering */
  requiredSkills: string[];
  /** Skills that are nice-to-have — used only by Claude re-ranker */
  preferredSkills: string[];
  seniorityLevel: SeniorityLevel;
  minYearsExperience: number;
  /** Industry or domain context extracted from the query */
  domain: string | null;
  /** Location mentioned in the query (stored for display — no location column in DB) */
  location: string | null;
  /**
   * Enriched query text sent to OpenAI for embedding.
   * Expands abbreviations, adds related terms, and widens semantic coverage.
   * e.g. "senior React devs with WS" → full sentence with TypeScript, real-time, etc.
   */
  embeddingText: string;
  structuredFilters: StructuredFilters;
}

// ── Candidate data passed to Claude for re-ranking ─────────────────────────

export interface CandidateSkillSummary {
  name: string;
  yearsExp: number;
  proficiency: string;
  isInferred: boolean;
}

export interface CandidateForRanking {
  /** 1-based index matching the prompt list */
  index: number;
  profileId: string;
  userId: string;
  name: string;
  title: string;
  yearsTotal: number;
  skills: CandidateSkillSummary[];
  projectSummaries: string[];
  certifications: string[];
  vectorScore: number;
}

// ── Re-ranking result from Claude ───────────────────────────────────────────

export interface ClaudeRankedEntry {
  candidateIndex: number;
  score: number;
  reasoning: string;
  strengths: string[];
  gaps: string[];
  recommendation: SearchRecommendation;
}

// ── Final search result returned to frontend ─────────────────────────────────

export interface SearchResultItem {
  profile: {
    id: string;
    userId: string;
    name: string;
    email: string;
    title: string;
    yearsTotal: number;
    skills: CandidateSkillSummary[];
    topProjects: string[];
    certifications: string[];
    avatarUrl: string | null;
  };
  scores: {
    /** Cosine similarity 0–1 */
    vector: number;
    /** Claude score 0–100 */
    claude: number;
    /** Weighted composite 0–1 */
    final: number;
  };
  reasoning: string;
  strengths: string[];
  gaps: string[];
  recommendation: SearchRecommendation;
}

export interface SearchResponse {
  searchId: string;
  query: string;
  understoodAs: Pick<
    UnderstoodQuery,
    'intent' | 'requiredSkills' | 'preferredSkills' | 'seniorityLevel' | 'domain' | 'location'
  >;
  results: SearchResultItem[];
  totalCandidatesConsidered: number;
  locationNote: string | null;
  executionTimeMs: number;
}
