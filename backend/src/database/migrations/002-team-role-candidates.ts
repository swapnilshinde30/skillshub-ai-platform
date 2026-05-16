import { MigrationInterface, QueryRunner } from 'typeorm';

export class TeamRoleCandidates1716000000000 implements MigrationInterface {
  name = 'TeamRoleCandidates1716000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    // Add headcount column to team_roles
    await queryRunner.query(`
      ALTER TABLE "team_roles"
      ADD COLUMN IF NOT EXISTS "headcount" integer NOT NULL DEFAULT 1
    `);

    // Create team_role_candidates table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "team_role_candidates" (
        "id"           uuid          NOT NULL DEFAULT uuid_generate_v4(),
        "created_at"   TIMESTAMP     NOT NULL DEFAULT now(),
        "team_role_id" uuid          NOT NULL,
        "profile_id"   uuid          NOT NULL,
        "score"        float         NOT NULL DEFAULT 0,
        "reasoning"    text,
        "rank"         integer       NOT NULL DEFAULT 1,
        CONSTRAINT "PK_team_role_candidates" PRIMARY KEY ("id"),
        CONSTRAINT "FK_trc_team_role"
          FOREIGN KEY ("team_role_id") REFERENCES "team_roles"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_trc_profile"
          FOREIGN KEY ("profile_id") REFERENCES "skill_profiles"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_trc_team_role_id"
      ON "team_role_candidates" ("team_role_id")
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "team_role_candidates"`);
    await queryRunner.query(`ALTER TABLE "team_roles" DROP COLUMN IF EXISTS "headcount"`);
  }
}
