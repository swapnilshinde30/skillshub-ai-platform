import { MigrationInterface, QueryRunner } from 'typeorm';

export class TeamRoleSelectedIds1716100000000 implements MigrationInterface {
  name = 'TeamRoleSelectedIds1716100000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "team_roles"
      ADD COLUMN IF NOT EXISTS "selected_candidate_ids" jsonb NOT NULL DEFAULT '[]'
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "team_roles" DROP COLUMN IF EXISTS "selected_candidate_ids"
    `);
  }
}
