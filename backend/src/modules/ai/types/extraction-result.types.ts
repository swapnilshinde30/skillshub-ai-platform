import { InferenceConfidence, ProficiencyLevel, SkillCategory } from '../../../common/enums';

// ── Per-field extraction ────────────────────────────────────────────────────

export interface SkillExtraction {
  name: string;
  category: SkillCategory;
  proficiency: ProficiencyLevel;
  yearsExp: number;
  /** 0–1: 1.0 = explicitly stated, 0.7 = clearly implied, 0.5 = context-inferred */
  confidence: number;
  /** Direct quote or paraphrase from resume that supports this skill */
  evidence: string;
}

export interface ProjectExtraction {
  name: string;
  description: string;
  impact: string | null;
  techStack: string[];
  startDate: string | null;   // "YYYY-MM"
  endDate: string | null;     // "YYYY-MM"
  isCurrent: boolean;
}

export interface CertificationExtraction {
  name: string;
  issuer: string | null;
  issueDate: string | null;   // "YYYY-MM-DD"
  expiryDate: string | null;
  credentialId: string | null;
}

export interface EducationExtraction {
  degree: string;
  fieldOfStudy: string | null;
  institution: string;
  startYear: number | null;
  endYear: number | null;
  gpa: number | null;
}

// ── Root extraction result ──────────────────────────────────────────────────

export interface ProfileExtraction {
  title: string;
  summary: string;
  yearsTotal: number;
  /** Overall confidence in the extraction quality (0–1) */
  extractionConfidence: number;
  skills: SkillExtraction[];
  projects: ProjectExtraction[];
  certifications: CertificationExtraction[];
  education: EducationExtraction[];
}

// ── Inference result ────────────────────────────────────────────────────────

export interface InferredSkill {
  name: string;
  category: SkillCategory;
  proficiency: ProficiencyLevel;
  yearsExp: number;
  confidence: InferenceConfidence;
  /** Why this skill was inferred — shown as a tooltip in the UI */
  reasoning: string;
}

// ── Claude raw response wrapper ─────────────────────────────────────────────

export interface ClaudeExtractionResponse {
  extraction: ProfileExtraction;
  parseAttempts: number;
  tokensUsed: number;
}

export interface ClaudeInferenceResponse {
  skills: InferredSkill[];
  parseAttempts: number;
  tokensUsed: number;
}
