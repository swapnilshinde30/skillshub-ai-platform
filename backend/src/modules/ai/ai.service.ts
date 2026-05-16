import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import {
  ProfileExtraction,
  InferredSkill,
  ClaudeExtractionResponse,
  ClaudeInferenceResponse,
} from './types/extraction-result.types';
import {
  UnderstoodQuery,
  CandidateForRanking,
  ClaudeRankedEntry,
} from '../search/types/search.types';
import {
  UNDERSTAND_QUERY_SYSTEM,
  buildUnderstandQueryPrompt,
} from './prompts/understand-query.prompt';
import {
  RANK_CANDIDATES_SYSTEM,
  buildRankCandidatesPrompt,
} from './prompts/rank-candidates.prompt';
import { SearchRecommendation } from '../../common/enums';
import {
  EXTRACT_PROFILE_SYSTEM,
  buildExtractionPrompt,
} from './prompts/extract-profile.prompt';
import {
  INFER_SKILLS_SYSTEM,
  buildInferencePrompt,
} from './prompts/infer-skills.prompt';

const MODEL = 'llama-3.3-70b-versatile';
const MAX_PARSE_ATTEMPTS = 3;

@Injectable()
export class AiService {
  private readonly client: OpenAI;
  private readonly logger = new Logger(AiService.name);

  constructor(config: ConfigService) {
    this.client = new OpenAI({
      apiKey: config.getOrThrow<string>('OPENAI_API_KEY'),
      baseURL: 'https://api.groq.com/openai/v1',
    });
  }

  // ── Resume extraction ────────────────────────────────────────────────────

  async extractProfile(rawText: string): Promise<ClaudeExtractionResponse> {
    const truncated = this.truncateToTokenBudget(rawText, 12_000);
    let parseAttempts = 0;
    let lastError: Error | null = null;

    while (parseAttempts < MAX_PARSE_ATTEMPTS) {
      parseAttempts++;

      const stricterSuffix =
        parseAttempts > 1
          ? '\n\nCRITICAL: Your previous response could not be parsed as JSON. Return ONLY the JSON object, starting with { and ending with }. Zero other text.'
          : '';

      try {
        const response = await this.client.chat.completions.create({
          model: MODEL,
          max_tokens: 4096,
          temperature: 0,
          messages: [
            { role: 'system', content: EXTRACT_PROFILE_SYSTEM },
            { role: 'user', content: buildExtractionPrompt(truncated) + stricterSuffix },
          ],
        });

        const rawJson = this.extractText(response);
        const extraction = this.parseJson<ProfileExtraction>(rawJson);

        this.validateExtraction(extraction);
        this.normaliseExtraction(extraction);

        return {
          extraction,
          parseAttempts,
          tokensUsed: (response.usage?.prompt_tokens ?? 0) + (response.usage?.completion_tokens ?? 0),
        };
      } catch (err) {
        lastError = err as Error;
        this.logger.warn(
          `Extraction attempt ${parseAttempts}/${MAX_PARSE_ATTEMPTS} failed: ${lastError.message}`,
        );
      }
    }

    throw new Error(
      `AI extraction failed after ${MAX_PARSE_ATTEMPTS} attempts: ${lastError?.message}`,
    );
  }

  // ── Skill inference ──────────────────────────────────────────────────────

  async inferSkills(extracted: ProfileExtraction): Promise<ClaudeInferenceResponse> {
    let parseAttempts = 0;
    let lastError: Error | null = null;

    while (parseAttempts < MAX_PARSE_ATTEMPTS) {
      parseAttempts++;

      try {
        const response = await this.client.chat.completions.create({
          model: MODEL,
          max_tokens: 2048,
          temperature: 0,
          messages: [
            { role: 'system', content: INFER_SKILLS_SYSTEM },
            { role: 'user', content: buildInferencePrompt(extracted) },
          ],
        });

        const rawJson = this.extractText(response);
        const skills = this.parseJson<InferredSkill[]>(rawJson);

        if (!Array.isArray(skills)) {
          throw new Error('Inference response is not an array');
        }

        this.normaliseInferredSkills(skills, extracted);

        return {
          skills,
          parseAttempts,
          tokensUsed: (response.usage?.prompt_tokens ?? 0) + (response.usage?.completion_tokens ?? 0),
        };
      } catch (err) {
        lastError = err as Error;
        this.logger.warn(
          `Inference attempt ${parseAttempts}/${MAX_PARSE_ATTEMPTS} failed: ${lastError.message}`,
        );
      }
    }

    this.logger.error(`Skill inference failed: ${lastError?.message}`);
    return { skills: [], parseAttempts, tokensUsed: 0 };
  }

  // ── Query understanding ──────────────────────────────────────────────────

  async understandQuery(query: string): Promise<UnderstoodQuery> {
    const response = await this.client.chat.completions.create({
      model: MODEL,
      max_tokens: 1024,
      temperature: 0,
      messages: [
        { role: 'system', content: UNDERSTAND_QUERY_SYSTEM },
        { role: 'user', content: buildUnderstandQueryPrompt(query) },
      ],
    });

    const raw = this.extractText(response);
    const parsed = this.parseJson<UnderstoodQuery>(raw);

    parsed.requiredSkills    = parsed.requiredSkills    ?? [];
    parsed.preferredSkills   = parsed.preferredSkills   ?? [];
    parsed.minYearsExperience = parsed.minYearsExperience ?? 0;
    parsed.seniorityLevel    = parsed.seniorityLevel    ?? 'any';
    parsed.domain            = parsed.domain            ?? null;
    parsed.location          = parsed.location          ?? null;
    parsed.embeddingText     = parsed.embeddingText     || query;
    parsed.structuredFilters = {
      minYears: parsed.structuredFilters?.minYears ?? null,
      requiredSkillNames: parsed.structuredFilters?.requiredSkillNames?.map((s) =>
        s.toLowerCase(),
      ) ?? null,
    };

    return parsed;
  }

  // ── Candidate re-ranking ─────────────────────────────────────────────────

  async rankCandidates(
    originalQuery: string,
    understood: UnderstoodQuery,
    candidates: CandidateForRanking[],
  ): Promise<ClaudeRankedEntry[]> {
    if (!candidates.length) return [];

    const response = await this.client.chat.completions.create({
      model: MODEL,
      max_tokens: 4096,
      temperature: 0,
      messages: [
        { role: 'system', content: RANK_CANDIDATES_SYSTEM },
        {
          role: 'user',
          content: buildRankCandidatesPrompt(originalQuery, understood, candidates),
        },
      ],
    });

    const raw = this.extractText(response);
    const ranked = this.parseJson<ClaudeRankedEntry[]>(raw);

    if (!Array.isArray(ranked)) {
      this.logger.error('rankCandidates: AI returned non-array');
      return [];
    }

    const validRecs = ['strong_match', 'good_match', 'partial_match', 'poor_match'];
    for (const entry of ranked) {
      entry.score      = Math.min(100, Math.max(0, entry.score ?? 0));
      entry.strengths  = Array.isArray(entry.strengths) ? entry.strengths : [];
      entry.gaps       = Array.isArray(entry.gaps)      ? entry.gaps      : [];
      if (!validRecs.includes(entry.recommendation)) {
        entry.recommendation = entry.score >= 75
          ? SearchRecommendation.GOOD_MATCH
          : SearchRecommendation.PARTIAL_MATCH;
      }
    }

    return ranked.sort((a, b) => b.score - a.score);
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  private extractText(response: OpenAI.Chat.Completions.ChatCompletion): string {
    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error('AI returned empty response');
    return content.trim();
  }

  private parseJson<T>(raw: string): T {
    const cleaned = raw
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```\s*$/, '')
      .trim();

    try {
      return JSON.parse(cleaned) as T;
    } catch {
      const objectMatch = cleaned.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
      if (objectMatch) {
        return JSON.parse(objectMatch[1]) as T;
      }
      throw new Error(`Cannot parse JSON from AI response: ${cleaned.slice(0, 200)}`);
    }
  }

  private validateExtraction(e: ProfileExtraction): void {
    if (!e || typeof e !== 'object') throw new Error('Extraction is not an object');
    if (!Array.isArray(e.skills))         throw new Error('skills must be an array');
    if (!Array.isArray(e.projects))       throw new Error('projects must be an array');
    if (!Array.isArray(e.certifications)) throw new Error('certifications must be an array');
    if (!Array.isArray(e.education))      throw new Error('education must be an array');
  }

  private normaliseExtraction(e: ProfileExtraction): void {
    e.title              = e.title || 'Professional';
    e.summary            = e.summary || '';
    e.yearsTotal         = typeof e.yearsTotal === 'number' ? e.yearsTotal : 0;
    e.extractionConfidence = Math.min(1, Math.max(0, e.extractionConfidence ?? 0.7));

    for (const skill of e.skills) {
      skill.yearsExp    = typeof skill.yearsExp === 'number' ? skill.yearsExp : 0;
      skill.confidence  = Math.min(1, Math.max(0, skill.confidence ?? 0.7));
      skill.evidence    = skill.evidence || '';
      skill.proficiency = this.normaliseProficiency(skill.proficiency as string);
      skill.category    = this.normaliseCategory(skill.category as string);
    }
  }

  private normaliseInferredSkills(skills: InferredSkill[], extracted: ProfileExtraction): void {
    const explicitNames = new Set(extracted.skills.map((s) => s.name.toLowerCase()));
    for (let i = skills.length - 1; i >= 0; i--) {
      if (explicitNames.has(skills[i].name.toLowerCase())) skills.splice(i, 1);
    }
    for (const skill of skills) {
      skill.yearsExp    = typeof skill.yearsExp === 'number' ? skill.yearsExp : 1;
      skill.proficiency = this.normaliseProficiency(skill.proficiency as string);
      skill.category    = this.normaliseCategory(skill.category as string);
      skill.confidence  = this.normaliseConfidence(skill.confidence as string);
    }
  }

  private normaliseProficiency(raw: string): any {
    const valid = ['beginner', 'intermediate', 'advanced', 'expert'];
    return valid.includes(raw?.toLowerCase()) ? raw.toLowerCase() : 'intermediate';
  }

  private normaliseCategory(raw: string): any {
    const valid = [
      'programming', 'framework', 'database', 'cloud', 'devops',
      'data_science', 'mobile', 'security', 'management', 'soft_skill', 'other',
    ];
    return valid.includes(raw?.toLowerCase()) ? raw.toLowerCase() : 'other';
  }

  private normaliseConfidence(raw: string): any {
    const valid = ['high', 'medium', 'low'];
    return valid.includes(raw?.toLowerCase()) ? raw.toLowerCase() : 'medium';
  }

  private truncateToTokenBudget(text: string, approxTokens: number): string {
    const maxChars = approxTokens * 4;
    if (text.length <= maxChars) return text;
    this.logger.warn(`Resume truncated from ${text.length} to ${maxChars} chars`);
    return text.slice(0, maxChars);
  }
}
