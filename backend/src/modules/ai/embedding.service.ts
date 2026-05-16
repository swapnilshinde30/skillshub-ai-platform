import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import OpenAI from 'openai';
import { SkillProfile } from '../profiles/entities/skill-profile.entity';
import { EmployeeSkill } from '../profiles/entities/employee-skill.entity';

const EMBEDDING_MODEL = 'text-embedding-3-small';
const EMBEDDING_DIMENSIONS = 1536;

@Injectable()
export class EmbeddingService {
  private readonly client: OpenAI;
  private readonly logger = new Logger(EmbeddingService.name);

  constructor(
    config: ConfigService,
    @InjectRepository(SkillProfile)
    private readonly profileRepo: Repository<SkillProfile>,
    @InjectRepository(EmployeeSkill)
    private readonly skillRepo: Repository<EmployeeSkill>,
  ) {
    this.client = new OpenAI({
      apiKey: config.getOrThrow<string>('OPENAI_API_KEY'),
    });
  }

  // ── Profile-level embedding ──────────────────────────────────────────────

  async generateAndSaveProfileEmbedding(profileId: string): Promise<void> {
    const profile = await this.profileRepo.findOne({
      where: { id: profileId },
      relations: ['skills', 'projects', 'certifications'],
    });

    if (!profile) {
      this.logger.warn(`Profile ${profileId} not found for embedding`);
      return;
    }

    const text = this.buildProfileText(profile);
    const embedding = await this.embed(text);

    await this.profileRepo
      .createQueryBuilder()
      .update()
      .set({ embedding } as any)
      .where('id = :id', { id: profileId })
      .execute();

    this.logger.log(`Profile embedding saved for ${profileId}`);
  }

  // ── Per-skill embeddings ─────────────────────────────────────────────────

  async generateAndSaveSkillEmbeddings(profileId: string): Promise<void> {
    const skills = await this.skillRepo.findBy({ profileId });
    if (!skills.length) return;

    // Batch embed all skills in one API call to save latency
    const texts = skills.map((s) => this.buildSkillText(s));
    const embeddings = await this.embedBatch(texts);

    // Update each skill row with its embedding using raw SQL (vector type)
    for (let i = 0; i < skills.length; i++) {
      await this.skillRepo
        .createQueryBuilder()
        .update()
        .set({ embedding: embeddings[i] } as any)
        .where('id = :id', { id: skills[i].id })
        .execute();
    }

    this.logger.log(`${skills.length} skill embeddings saved for profile ${profileId}`);
  }

  // ── Embed arbitrary text (used by search) ───────────────────────────────

  async embed(text: string): Promise<number[]> {
    try {
      const response = await this.client.embeddings.create({
        model: EMBEDDING_MODEL,
        input: text.replace(/\n/g, ' '),
        dimensions: EMBEDDING_DIMENSIONS,
      });
      return response.data[0].embedding;
    } catch (err: any) {
      this.logger.warn(`Embedding failed (is OPENAI_API_KEY a real OpenAI key?): ${err?.message}`);
      return new Array(EMBEDDING_DIMENSIONS).fill(0);
    }
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    if (!texts.length) return [];
    try {
      const response = await this.client.embeddings.create({
        model: EMBEDDING_MODEL,
        input: texts.map((t) => t.replace(/\n/g, ' ')),
        dimensions: EMBEDDING_DIMENSIONS,
      });
      return response.data
        .sort((a, b) => a.index - b.index)
        .map((d) => d.embedding);
    } catch (err: any) {
      this.logger.warn(`Batch embedding failed: ${err?.message}`);
      return texts.map(() => new Array(EMBEDDING_DIMENSIONS).fill(0));
    }
  }

  // ── Text builders ────────────────────────────────────────────────────────

  /**
   * Assembles the profile-level text used for semantic search embedding.
   * Structure matters: put the most semantically dense content first.
   * This text is what will be retrieved when an HR manager searches.
   */
  buildProfileText(profile: SkillProfile): string {
    const skills = profile.skills ?? [];
    const explicit = skills.filter((s) => !s.isInferred);
    const inferred = skills.filter((s) => s.isInferred);

    const lines: string[] = [
      `Title: ${profile.title ?? 'Professional'}`,
      `Experience: ${profile.yearsTotal ?? 0} years total`,
      profile.summary ? `Summary: ${profile.summary}` : '',
      '',
      explicit.length
        ? `Core Skills:\n${explicit
            .map((s) => `  ${s.name}: ${s.yearsExp}yr, ${s.proficiency}`)
            .join('\n')}`
        : '',
      inferred.length
        ? `Also proficient in:\n${inferred.map((s) => `  ${s.name}`).join(', ')}`
        : '',
      profile.projects?.length
        ? `Projects:\n${profile.projects
            .map((p) => `  ${p.name}: ${p.description ?? ''}${p.impact ? '. ' + p.impact : ''}`)
            .join('\n')}`
        : '',
      profile.certifications?.length
        ? `Certifications: ${profile.certifications.map((c) => c.name).join(', ')}`
        : '',
    ];

    return lines.filter(Boolean).join('\n');
  }

  private buildSkillText(skill: EmployeeSkill): string {
    // Short, focused text for per-skill search granularity
    return `${skill.name}: ${skill.yearsExp} years experience, ${skill.proficiency} proficiency level`;
  }
}
