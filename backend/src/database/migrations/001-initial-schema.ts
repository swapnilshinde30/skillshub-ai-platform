import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Creates all tables, then ALTERs every embedding column from TEXT to vector(1536).
 * TypeORM entities declare embedding as text+transformer so the ORM can read/write
 * without knowing about the vector type; raw queries handle all similarity math.
 */
export class InitialSchema1700000000000 implements MigrationInterface {
  name = 'InitialSchema1700000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── Extensions ──────────────────────────────────────────────────────────
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS vector`);

    // ── Enum types ──────────────────────────────────────────────────────────
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE user_role             AS ENUM ('employee','hr');
        CREATE TYPE profile_status        AS ENUM ('draft','pending','approved','rejected');
        CREATE TYPE proficiency_level     AS ENUM ('beginner','intermediate','advanced','expert');
        CREATE TYPE skill_source          AS ENUM ('resume','linkedin','manual','inferred');
        CREATE TYPE inference_confidence  AS ENUM ('high','medium','low');
        CREATE TYPE search_recommendation AS ENUM ('strong_match','good_match','partial_match','poor_match');
        CREATE TYPE upload_status         AS ENUM ('pending','processing','completed','failed');
        CREATE TYPE team_status           AS ENUM ('draft','in_progress','completed');
        CREATE TYPE skill_category        AS ENUM (
          'programming','framework','database','cloud','devops',
          'data_science','mobile','security','management','soft_skill','other'
        );
      EXCEPTION WHEN duplicate_object THEN null;
      END $$
    `);

    // ── Tables ──────────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE users (
        id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
        email         TEXT        UNIQUE NOT NULL,
        password_hash TEXT        NOT NULL,
        name          TEXT        NOT NULL,
        role          user_role   NOT NULL DEFAULT 'employee',
        avatar_url    TEXT,
        is_active     BOOLEAN     NOT NULL DEFAULT TRUE,
        last_login_at TIMESTAMPTZ,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE skill_taxonomy (
        id              UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
        name            TEXT          NOT NULL,
        normalized_name TEXT          UNIQUE NOT NULL,
        category        skill_category NOT NULL DEFAULT 'other',
        description     TEXT,
        parent_id       UUID          REFERENCES skill_taxonomy(id) ON DELETE SET NULL,
        aliases         JSONB         NOT NULL DEFAULT '[]',
        is_verified     BOOLEAN       NOT NULL DEFAULT FALSE,
        usage_count     INT           NOT NULL DEFAULT 0,
        embedding       TEXT,
        created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE skill_profiles (
        id           UUID           PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id      UUID           UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        status       profile_status NOT NULL DEFAULT 'draft',
        title        TEXT,
        summary      TEXT,
        years_total  DECIMAL(4,1),
        source       TEXT           NOT NULL DEFAULT 'resume',
        embedding    TEXT,
        reviewed_by  UUID           REFERENCES users(id),
        reviewed_at  TIMESTAMPTZ,
        review_notes TEXT,
        created_at   TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
        updated_at   TIMESTAMPTZ    NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE employee_skills (
        id                   UUID              PRIMARY KEY DEFAULT uuid_generate_v4(),
        profile_id           UUID              NOT NULL REFERENCES skill_profiles(id) ON DELETE CASCADE,
        taxonomy_id          UUID              REFERENCES skill_taxonomy(id) ON DELETE SET NULL,
        name                 TEXT              NOT NULL,
        category             skill_category    NOT NULL DEFAULT 'other',
        proficiency          proficiency_level NOT NULL DEFAULT 'intermediate',
        years_exp            DECIMAL(4,1)      NOT NULL DEFAULT 0,
        is_inferred          BOOLEAN           NOT NULL DEFAULT FALSE,
        inference_confidence inference_confidence,
        inference_reasoning  TEXT,
        source               skill_source      NOT NULL DEFAULT 'resume',
        embedding            TEXT,
        created_at           TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
        updated_at           TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
        UNIQUE (profile_id, name)
      )
    `);

    await queryRunner.query(`
      CREATE TABLE projects (
        id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
        profile_id  UUID        NOT NULL REFERENCES skill_profiles(id) ON DELETE CASCADE,
        name        TEXT        NOT NULL,
        description TEXT,
        impact      TEXT,
        url         TEXT,
        start_date  DATE,
        end_date    DATE,
        is_current  BOOLEAN     NOT NULL DEFAULT FALSE,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE project_skills (
        id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
        project_id  UUID        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        skill_name  TEXT        NOT NULL,
        taxonomy_id UUID        REFERENCES skill_taxonomy(id) ON DELETE SET NULL,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (project_id, skill_name)
      )
    `);

    await queryRunner.query(`
      CREATE TABLE resume_uploads (
        id                UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id           UUID          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        original_filename TEXT          NOT NULL,
        file_size_bytes   INT,
        mime_type         TEXT,
        raw_text          TEXT,
        processing_status upload_status NOT NULL DEFAULT 'pending',
        error_message     TEXT,
        processing_time_ms INT,
        profile_id        UUID          REFERENCES skill_profiles(id) ON DELETE SET NULL,
        created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
        processed_at      TIMESTAMPTZ
      )
    `);

    await queryRunner.query(`
      CREATE TABLE certifications (
        id             UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
        profile_id     UUID        NOT NULL REFERENCES skill_profiles(id) ON DELETE CASCADE,
        name           TEXT        NOT NULL,
        issuer         TEXT,
        issue_date     DATE,
        expiry_date    DATE,
        credential_id  TEXT,
        credential_url TEXT,
        created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE education (
        id             UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
        profile_id     UUID        NOT NULL REFERENCES skill_profiles(id) ON DELETE CASCADE,
        degree         TEXT        NOT NULL,
        field_of_study TEXT,
        institution    TEXT        NOT NULL,
        start_year     INT,
        end_year       INT,
        gpa            DECIMAL(3,2),
        created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE search_queries (
        id                UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
        hr_user_id        UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        query_text        TEXT        NOT NULL,
        query_embedding   TEXT,
        filters           JSONB       NOT NULL DEFAULT '{}',
        result_count      INT         NOT NULL DEFAULT 0,
        execution_time_ms INT,
        created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE search_results (
        id             UUID                  PRIMARY KEY DEFAULT uuid_generate_v4(),
        query_id       UUID                  NOT NULL REFERENCES search_queries(id) ON DELETE CASCADE,
        profile_id     UUID                  NOT NULL REFERENCES skill_profiles(id) ON DELETE CASCADE,
        rank_position  INT                   NOT NULL,
        vector_score   DECIMAL(6,5),
        claude_score   DECIMAL(5,2),
        final_score    DECIMAL(6,5),
        reasoning      TEXT,
        strengths      JSONB                 NOT NULL DEFAULT '[]',
        gaps           JSONB                 NOT NULL DEFAULT '[]',
        recommendation search_recommendation NOT NULL DEFAULT 'partial_match',
        created_at     TIMESTAMPTZ           NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE team_requests (
        id                  UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
        hr_user_id          UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        project_name        TEXT        NOT NULL,
        project_description TEXT,
        status              team_status NOT NULL DEFAULT 'draft',
        ai_summary          TEXT,
        coverage_gaps       JSONB       NOT NULL DEFAULT '[]',
        created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE team_roles (
        id                     UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
        team_request_id        UUID        NOT NULL REFERENCES team_requests(id) ON DELETE CASCADE,
        role_title             TEXT        NOT NULL,
        requirements           TEXT        NOT NULL,
        requirements_embedding TEXT,
        priority               INT         NOT NULL DEFAULT 1,
        assigned_profile_id    UUID        REFERENCES skill_profiles(id) ON DELETE SET NULL,
        assignment_reasoning   TEXT,
        created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // ── ALTER TEXT columns to vector(1536) ──────────────────────────────────
    // TypeORM writes/reads these as text strings; Postgres stores as vectors.
    const vectorColumns: [string, string][] = [
      ['skill_taxonomy',  'embedding'],
      ['skill_profiles',  'embedding'],
      ['employee_skills', 'embedding'],
      ['search_queries',  'query_embedding'],
      ['team_roles',      'requirements_embedding'],
    ];

    for (const [table, col] of vectorColumns) {
      await queryRunner.query(`
        ALTER TABLE ${table}
        ALTER COLUMN ${col} TYPE vector(1536)
        USING CASE WHEN ${col} IS NULL THEN NULL ELSE ${col}::vector END
      `);
    }

    // ── HNSW indexes ────────────────────────────────────────────────────────
    await queryRunner.query(`CREATE INDEX idx_skill_profiles_embedding  ON skill_profiles  USING hnsw (embedding vector_cosine_ops) WITH (m=16, ef_construction=64)`);
    await queryRunner.query(`CREATE INDEX idx_employee_skills_embedding ON employee_skills USING hnsw (embedding vector_cosine_ops) WITH (m=16, ef_construction=64)`);
    await queryRunner.query(`CREATE INDEX idx_search_queries_embedding  ON search_queries  USING hnsw (query_embedding vector_cosine_ops) WITH (m=16, ef_construction=64)`);
    await queryRunner.query(`CREATE INDEX idx_team_roles_embedding      ON team_roles      USING hnsw (requirements_embedding vector_cosine_ops) WITH (m=16, ef_construction=64)`);
    await queryRunner.query(`CREATE INDEX idx_taxonomy_embedding        ON skill_taxonomy  USING hnsw (embedding vector_cosine_ops) WITH (m=16, ef_construction=64)`);

    // ── Scalar indexes ───────────────────────────────────────────────────────
    await queryRunner.query(`CREATE INDEX idx_profiles_status           ON skill_profiles(status)`);
    await queryRunner.query(`CREATE INDEX idx_profiles_status_updated   ON skill_profiles(status, updated_at DESC)`);
    await queryRunner.query(`CREATE INDEX idx_emp_skills_profile_id     ON employee_skills(profile_id)`);
    await queryRunner.query(`CREATE INDEX idx_emp_skills_name_lower     ON employee_skills(LOWER(name))`);
    await queryRunner.query(`CREATE INDEX idx_emp_skills_is_inferred    ON employee_skills(is_inferred)`);
    await queryRunner.query(`CREATE INDEX idx_taxonomy_category         ON skill_taxonomy(category)`);
    await queryRunner.query(`CREATE INDEX idx_uploads_user_id           ON resume_uploads(user_id)`);
    await queryRunner.query(`CREATE INDEX idx_uploads_status            ON resume_uploads(processing_status)`);
    await queryRunner.query(`CREATE INDEX idx_search_queries_hr         ON search_queries(hr_user_id)`);
    await queryRunner.query(`CREATE INDEX idx_search_queries_created    ON search_queries(created_at DESC)`);
    await queryRunner.query(`CREATE INDEX idx_search_results_query      ON search_results(query_id)`);
    await queryRunner.query(`CREATE INDEX idx_search_results_rank       ON search_results(query_id, rank_position)`);
    await queryRunner.query(`CREATE INDEX idx_team_requests_hr          ON team_requests(hr_user_id)`);
    await queryRunner.query(`CREATE INDEX idx_team_roles_request        ON team_roles(team_request_id)`);

    // ── updated_at triggers ─────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION set_updated_at()
      RETURNS TRIGGER AS $$
      BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
      $$ LANGUAGE plpgsql
    `);

    for (const table of ['users', 'skill_profiles', 'employee_skills', 'team_requests']) {
      await queryRunner.query(`
        CREATE TRIGGER trg_${table}_updated_at
        BEFORE UPDATE ON ${table}
        FOR EACH ROW EXECUTE FUNCTION set_updated_at()
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const tables = [
      'team_roles', 'team_requests', 'search_results', 'search_queries',
      'education', 'certifications', 'resume_uploads', 'project_skills',
      'projects', 'employee_skills', 'skill_profiles', 'skill_taxonomy', 'users',
    ];
    for (const table of tables) {
      await queryRunner.query(`DROP TABLE IF EXISTS ${table} CASCADE`);
    }
    const enums = [
      'user_role', 'profile_status', 'proficiency_level', 'skill_source',
      'inference_confidence', 'search_recommendation', 'upload_status',
      'team_status', 'skill_category',
    ];
    for (const e of enums) {
      await queryRunner.query(`DROP TYPE IF EXISTS ${e}`);
    }
    await queryRunner.query(`DROP FUNCTION IF EXISTS set_updated_at`);
  }
}
