import { Injectable, NotFoundException, ForbiddenException, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TeamRequest } from './entities/team-request.entity';
import { TeamRole } from './entities/team-role.entity';
import { TeamRoleCandidate } from './entities/team-role-candidate.entity';
import { SkillProfile } from '../profiles/entities/skill-profile.entity';
import { AiService } from '../ai/ai.service';
import { TeamStatus } from '../../common/enums';
import { CreateTeamDto, AddRoleDto, UpdateTeamDto, AssignRoleDto, SetSelectionsDto } from './dto/teams.dto';

const CANDIDATES_PER_ROLE = 5;
/** Candidate pool fed per role to AI (pre-filtered by skill relevance) */
const POOL_PER_ROLE = 12;

@Injectable()
export class TeamsService {
  private readonly logger = new Logger(TeamsService.name);

  constructor(
    @InjectRepository(TeamRequest)       private readonly teamRepo:      Repository<TeamRequest>,
    @InjectRepository(TeamRole)          private readonly roleRepo:       Repository<TeamRole>,
    @InjectRepository(TeamRoleCandidate) private readonly candidateRepo:  Repository<TeamRoleCandidate>,
    @InjectRepository(SkillProfile)      private readonly profileRepo:    Repository<SkillProfile>,
    private readonly aiService: AiService,
  ) {}

  // ── CRUD ─────────────────────────────────────────────────────────────────

  async create(hrUserId: string, dto: CreateTeamDto): Promise<TeamRequest> {
    const team = this.teamRepo.create({
      hrUserId,
      projectName: dto.projectName,
      projectDescription: dto.projectDescription ?? null,
      status: TeamStatus.DRAFT,
    });
    return this.teamRepo.save(team);
  }

  async list(hrUserId: string): Promise<TeamRequest[]> {
    return this.teamRepo.find({
      where: { hrUserId },
      relations: [
        'roles',
        'roles.assignedProfile',
        'roles.assignedProfile.user',
        'roles.candidates',
        'roles.candidates.profile',
        'roles.candidates.profile.user',
        'roles.candidates.profile.skills',
      ],
      order: { createdAt: 'DESC' },
    });
  }

  async getOne(id: string, hrUserId: string): Promise<TeamRequest> {
    const team = await this.teamRepo.findOne({
      where: { id },
      relations: [
        'roles',
        'roles.assignedProfile',
        'roles.assignedProfile.user',
        'roles.candidates',
        'roles.candidates.profile',
        'roles.candidates.profile.user',
        'roles.candidates.profile.skills',
      ],
    });
    if (!team) throw new NotFoundException('Team not found');
    if (team.hrUserId !== hrUserId) throw new ForbiddenException();
    return team;
  }

  async update(id: string, hrUserId: string, dto: UpdateTeamDto): Promise<TeamRequest> {
    const team = await this.getOne(id, hrUserId);
    Object.assign(team, dto);
    return this.teamRepo.save(team);
  }

  async remove(id: string, hrUserId: string): Promise<void> {
    const team = await this.getOne(id, hrUserId);
    await this.teamRepo.remove(team);
  }

  // ── Roles ─────────────────────────────────────────────────────────────────

  async addRole(teamId: string, hrUserId: string, dto: AddRoleDto): Promise<TeamRole> {
    await this.getOne(teamId, hrUserId);
    const role = this.roleRepo.create({
      teamRequestId: teamId,
      roleTitle: dto.roleTitle,
      requirements: dto.requirements,
      priority: dto.priority ?? 1,
      headcount: dto.headcount ?? 1,
    });
    return this.roleRepo.save(role);
  }

  async removeRole(teamId: string, roleId: string, hrUserId: string): Promise<void> {
    await this.getOne(teamId, hrUserId);
    const role = await this.roleRepo.findOne({ where: { id: roleId, teamRequestId: teamId } });
    if (!role) throw new NotFoundException('Role not found');
    await this.roleRepo.remove(role);
  }

  // ── AI Team Builder ───────────────────────────────────────────────────────

  /**
   * Builds AI-matched candidates per role using a 2-step approach:
   *   1. Pre-filter: For each role, rank all approved profiles by skill keyword overlap.
   *      Only the top POOL_PER_ROLE candidates are sent to AI (ensures skill relevance).
   *   2. AI ranks the pre-filtered pool per role and returns scores + reasoning.
   *
   * Status becomes IN_PROGRESS. Team completes only when HR fills all headcount slots.
   */
  async buildTeam(teamId: string, hrUserId: string): Promise<TeamRequest> {
    const team = await this.getOne(teamId, hrUserId);
    if (!team.roles?.length) throw new BadRequestException('Add at least one role before building');

    await this.teamRepo.update(teamId, { status: TeamStatus.IN_PROGRESS });

    const allProfiles = await this.profileRepo.find({
      where: { status: 'approved' as any },
      relations: ['user', 'skills', 'certifications'],
    });

    if (!allProfiles.length) {
      await this.teamRepo.update(teamId, {
        status: TeamStatus.DRAFT,
        aiSummary: 'No approved profiles available to match against.',
      });
      return this.getOne(teamId, hrUserId);
    }

    // ── Per-role candidate matching ──────────────────────────────────────────

    // Clear old suggestions
    const roleIds = team.roles.map((r) => r.id);
    await this.candidateRepo
      .createQueryBuilder()
      .delete()
      .where('team_role_id IN (:...ids)', { ids: roleIds })
      .execute();

    // Reset previous selections
    await this.roleRepo.update(
      { teamRequestId: teamId },
      { assignedProfileId: null, assignmentReasoning: null, selectedCandidateIds: [] },
    );

    let overallSummary = '';
    let coverageGaps: string[] = [];

    for (const role of team.roles) {
      // Step 1: pre-filter by skill keyword overlap
      const relevantProfiles = this.rankBySkillRelevance(allProfiles, role.requirements, POOL_PER_ROLE);

      if (!relevantProfiles.length) {
        this.logger.warn(`No skill-relevant candidates found for role "${role.roleTitle}"`);
        continue;
      }

      const pool = relevantProfiles.map((p, i) => ({
        index: i + 1,
        profileId: p.id,
        name: p.user?.name ?? 'Unknown',
        title: p.title ?? 'Professional',
        yearsTotal: p.yearsTotal ?? 0,
        skills: p.skills?.map((s) => `${s.name}(${s.yearsExp}yr,${s.proficiency})`).join(', ') ?? '',
        certs: p.certifications?.map((c) => c.name).join(', ') ?? '',
      }));

      const prompt = `You are an expert HR analyst. A company needs to hire for this role:

ROLE: "${role.roleTitle}"
REQUIREMENTS: ${role.requirements}
HEADCOUNT NEEDED: ${role.headcount}

CANDIDATES (pre-filtered to those with relevant skills — DO NOT suggest candidates outside this list):
${pool.map((t) => `[${t.index}] ${t.name} | ${t.title} | ${t.yearsTotal}yr exp\n    Skills: ${t.skills || 'none'}\n    Certs: ${t.certs || 'none'}`).join('\n')}

RULES:
- Only suggest candidates whose skills DIRECTLY match the requirements above.
- Score 0–100 based on skill alignment: 80+ means strong direct match, 50–79 means partial match, below 50 means weak match.
- If a candidate has NO relevant skills, assign score < 30 and mention the gap.
- Pick the TOP ${CANDIDATES_PER_ROLE} candidates (fewer is fine if not enough qualify).

Return ONLY this JSON:
{
  "candidates": [
    { "rank": 1, "candidateIndex": <number>, "score": <0-100>, "reasoning": "<why they match or don't>" }
  ],
  "coverageNote": "<note if pool lacks strong matches>"
}`;

      try {
        const response = await this.aiService['client'].chat.completions.create({
          model: 'llama-3.3-70b-versatile',
          max_tokens: 1024,
          temperature: 0,
          messages: [
            { role: 'system', content: 'You are an expert HR analyst. Return only valid JSON, no other text.' },
            { role: 'user', content: prompt },
          ],
        });

        const raw     = response.choices[0]?.message?.content?.trim() ?? '';
        const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
        const parsed  = JSON.parse(cleaned);

        const aiCandidates: { rank: number; candidateIndex: number; score: number; reasoning: string }[] =
          parsed.candidates ?? [];

        if (parsed.coverageNote) coverageGaps.push(parsed.coverageNote);

        const profileByIndex = new Map(pool.map((p) => [p.index, p]));
        const toSave: TeamRoleCandidate[] = [];

        for (const c of aiCandidates) {
          const talent = profileByIndex.get(c.candidateIndex);
          if (!talent) continue;
          // Only keep candidates with a meaningful score
          if (c.score < 40) continue;
          toSave.push(
            this.candidateRepo.create({
              teamRoleId: role.id,
              profileId:  talent.profileId,
              score:      Math.min(100, Math.max(0, c.score)),
              reasoning:  c.reasoning ?? null,
              rank:       c.rank ?? toSave.length + 1,
            }),
          );
        }

        if (toSave.length) await this.candidateRepo.save(toSave);

      } catch (err: any) {
        this.logger.error(`AI matching failed for role "${role.roleTitle}": ${err.message}`);
      }
    }

    // Single AI call for overall team summary
    try {
      const summaryResponse = await this.aiService['client'].chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        max_tokens: 512,
        temperature: 0,
        messages: [
          { role: 'system', content: 'Return only valid JSON.' },
          {
            role: 'user',
            content: `Summarize talent availability for this project in 2 sentences and list major coverage gaps.
Project: ${team.projectName}
Roles: ${team.roles.map((r) => `${r.roleTitle} (${r.requirements})`).join('; ')}
Return: { "summary": "...", "gaps": ["...", "..."] }`,
          },
        ],
      });

      const raw     = summaryResponse.choices[0]?.message?.content?.trim() ?? '';
      const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
      const parsed  = JSON.parse(cleaned);
      overallSummary = parsed.summary ?? '';
      if (Array.isArray(parsed.gaps)) coverageGaps = [...new Set([...coverageGaps, ...parsed.gaps])];
    } catch (_) {/* non-critical */}

    await this.teamRepo.update(teamId, {
      status: TeamStatus.IN_PROGRESS,
      aiSummary: overallSummary,
      coverageGaps,
    });

    return this.getOne(teamId, hrUserId);
  }

  // ── HR Selection ──────────────────────────────────────────────────────────

  /**
   * HR selects a candidate for a role slot.
   * Supports headcount > 1: the same role can be called multiple times until headcount is met.
   * Team completes only when every role has selectedCandidateIds.length >= headcount.
   */
  async assignToRole(teamId: string, roleId: string, hrUserId: string, dto: AssignRoleDto): Promise<TeamRequest> {
    await this.getOne(teamId, hrUserId);
    const role = await this.roleRepo.findOne({ where: { id: roleId, teamRequestId: teamId } });
    if (!role) throw new NotFoundException('Role not found');

    const current = role.selectedCandidateIds ?? [];
    if (current.includes(dto.profileId)) {
      throw new BadRequestException('This candidate is already selected for this role');
    }
    if (current.length >= role.headcount) {
      throw new BadRequestException(
        `Role "${role.roleTitle}" already has ${role.headcount} candidate(s) selected`,
      );
    }

    const suggestion = await this.candidateRepo.findOne({
      where: { teamRoleId: roleId, profileId: dto.profileId },
    });

    const updated = [...current, dto.profileId];
    await this.roleRepo.update(roleId, {
      selectedCandidateIds: updated,
      assignedProfileId:    updated[0],          // keep for backward-compat (first pick)
      assignmentReasoning:  suggestion?.reasoning ?? null,
    });

    // Complete team only when every role's headcount is fully filled
    const refreshed = await this.getOne(teamId, hrUserId);
    const allFilled = refreshed.roles.every(
      (r) => (r.selectedCandidateIds ?? []).length >= r.headcount,
    );
    if (allFilled) {
      await this.teamRepo.update(teamId, { status: TeamStatus.COMPLETED });
    }

    return this.getOne(teamId, hrUserId);
  }

  // ── Bulk Selection ────────────────────────────────────────────────────────

  /**
   * Replaces the full selectedCandidateIds list for a single role.
   * HR uses this to save all their picks at once (supports add and remove).
   */
  async setRoleSelections(teamId: string, roleId: string, hrUserId: string, dto: SetSelectionsDto): Promise<TeamRequest> {
    await this.getOne(teamId, hrUserId);
    const role = await this.roleRepo.findOne({ where: { id: roleId, teamRequestId: teamId } });
    if (!role) throw new NotFoundException('Role not found');

    if (dto.profileIds.length > role.headcount) {
      throw new BadRequestException(`Cannot select more than ${role.headcount} candidate(s) for this role`);
    }

    // Look up reasoning for the first selected candidate (backward-compat)
    let reasoning: string | null = null;
    if (dto.profileIds.length) {
      const suggestion = await this.candidateRepo.findOne({
        where: { teamRoleId: roleId, profileId: dto.profileIds[0] },
      });
      reasoning = suggestion?.reasoning ?? null;
    }

    await this.roleRepo.update(roleId, {
      selectedCandidateIds: dto.profileIds,
      assignedProfileId:    dto.profileIds[0] ?? null,
      assignmentReasoning:  reasoning,
    });

    // Re-evaluate team completion
    const refreshed = await this.getOne(teamId, hrUserId);
    const allFilled = refreshed.roles.every(
      (r) => (r.selectedCandidateIds ?? []).length >= r.headcount,
    );
    await this.teamRepo.update(teamId, {
      status: allFilled ? TeamStatus.COMPLETED : TeamStatus.IN_PROGRESS,
    });

    return this.getOne(teamId, hrUserId);
  }

  // ── Reset ─────────────────────────────────────────────────────────────────

  async resetTeam(teamId: string, hrUserId: string): Promise<TeamRequest> {
    const team = await this.getOne(teamId, hrUserId);
    const rIds = team.roles.map((r) => r.id);

    if (rIds.length) {
      await this.candidateRepo
        .createQueryBuilder()
        .delete()
        .where('team_role_id IN (:...ids)', { ids: rIds })
        .execute();
    }

    await this.roleRepo.update(
      { teamRequestId: teamId },
      { assignedProfileId: null, assignmentReasoning: null, selectedCandidateIds: [] },
    );
    await this.teamRepo.update(teamId, {
      status: TeamStatus.DRAFT,
      aiSummary: null,
      coverageGaps: [],
    });
    return this.getOne(teamId, hrUserId);
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  /**
   * Ranks profiles by how many requirement keywords appear in their skill names.
   * Returns top `maxCount` profiles with at least one keyword match (or all profiles
   * if none match, so there's always a pool to work with).
   */
  private rankBySkillRelevance(
    profiles: SkillProfile[],
    requirements: string,
    maxCount: number,
  ): SkillProfile[] {
    // Tokenise requirements into meaningful keywords (≥ 3 chars)
    const keywords = requirements
      .toLowerCase()
      .replace(/[^a-z0-9#+.\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length >= 3);

    const scored = profiles.map((p) => {
      const skillNames = (p.skills ?? []).map((s) => s.name.toLowerCase());
      const matchCount = keywords.filter((kw) =>
        skillNames.some((s) => s.includes(kw) || kw.includes(s)),
      ).length;
      return { profile: p, matchCount };
    });

    scored.sort((a, b) => b.matchCount - a.matchCount);

    // Prefer those with matches; fall back to all if nothing matches
    const withMatch = scored.filter((s) => s.matchCount > 0);
    const pool = withMatch.length ? withMatch : scored;
    return pool.slice(0, maxCount).map((s) => s.profile);
  }
}
