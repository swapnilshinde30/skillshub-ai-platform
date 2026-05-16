-- =============================================================
-- SkillsHub — Complete PostgreSQL Schema
-- =============================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS vector;

-- =============================================================
-- ENUM TYPES
-- =============================================================
CREATE TYPE user_role             AS ENUM ('employee', 'hr');
CREATE TYPE profile_status        AS ENUM ('draft', 'pending', 'approved', 'rejected');
CREATE TYPE proficiency_level     AS ENUM ('beginner', 'intermediate', 'advanced', 'expert');
CREATE TYPE skill_source          AS ENUM ('resume', 'linkedin', 'manual', 'inferred');
CREATE TYPE inference_confidence  AS ENUM ('high', 'medium', 'low');
CREATE TYPE search_recommendation AS ENUM ('strong_match', 'good_match', 'partial_match', 'poor_match');
CREATE TYPE upload_status         AS ENUM ('pending', 'processing', 'completed', 'failed');
CREATE TYPE team_status           AS ENUM ('draft', 'in_progress', 'completed');
CREATE TYPE skill_category        AS ENUM (
  'programming', 'framework', 'database', 'cloud', 'devops',
  'data_science', 'mobile', 'security', 'management', 'soft_skill', 'other'
);

-- =============================================================
-- USERS
-- =============================================================
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
);

-- =============================================================
-- SKILL TAXONOMY  (canonical skill dictionary)
-- =============================================================
CREATE TABLE skill_taxonomy (
  id              UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            TEXT          NOT NULL,
  normalized_name TEXT          UNIQUE NOT NULL,   -- lowercase, deduped
  category        skill_category NOT NULL DEFAULT 'other',
  description     TEXT,
  parent_id       UUID          REFERENCES skill_taxonomy(id) ON DELETE SET NULL,
  aliases         JSONB         NOT NULL DEFAULT '[]',       -- ["TS","Typescript","ts"]
  is_verified     BOOLEAN       NOT NULL DEFAULT FALSE,
  usage_count     INT           NOT NULL DEFAULT 0,
  embedding       vector(1536),                              -- for similar-skill suggestions
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- =============================================================
-- SKILL PROFILES  (one per employee)
-- =============================================================
CREATE TABLE skill_profiles (
  id           UUID           PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID           UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status       profile_status NOT NULL DEFAULT 'draft',
  title        TEXT,                                         -- "Senior Full Stack Engineer"
  summary      TEXT,                                         -- AI-generated summary
  years_total  DECIMAL(4,1),
  source       TEXT           NOT NULL DEFAULT 'resume',     -- resume | linkedin | manual
  embedding    vector(1536),                                 -- whole-profile semantic vector
  reviewed_by  UUID           REFERENCES users(id),
  reviewed_at  TIMESTAMPTZ,
  review_notes TEXT,
  created_at   TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

-- =============================================================
-- EMPLOYEE SKILLS
-- =============================================================
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
  inference_reasoning  TEXT,              -- "Used in 3 listed projects requiring React ecosystem"
  source               skill_source      NOT NULL DEFAULT 'resume',
  embedding            vector(1536),      -- per-skill semantic vector for granular matching
  created_at           TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ       NOT NULL DEFAULT NOW(),

  UNIQUE (profile_id, name)
);

-- =============================================================
-- PROJECTS
-- =============================================================
CREATE TABLE projects (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id  UUID        NOT NULL REFERENCES skill_profiles(id) ON DELETE CASCADE,
  name        TEXT        NOT NULL,
  description TEXT,
  impact      TEXT,        -- "Reduced API latency by 40%, serving 2M daily users"
  url         TEXT,
  start_date  DATE,
  end_date    DATE,
  is_current  BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================
-- PROJECT SKILLS  (technologies used per project)
-- =============================================================
CREATE TABLE project_skills (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id  UUID        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  skill_name  TEXT        NOT NULL,
  taxonomy_id UUID        REFERENCES skill_taxonomy(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (project_id, skill_name)
);

-- =============================================================
-- RESUME UPLOADS  (full audit trail of every ingestion)
-- =============================================================
CREATE TABLE resume_uploads (
  id                UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id           UUID          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  original_filename TEXT          NOT NULL,
  file_size_bytes   INT,
  mime_type         TEXT,
  raw_text          TEXT,          -- extracted text sent to Claude
  processing_status upload_status NOT NULL DEFAULT 'pending',
  error_message     TEXT,
  processing_time_ms INT,
  profile_id        UUID          REFERENCES skill_profiles(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  processed_at      TIMESTAMPTZ
);

-- =============================================================
-- CERTIFICATIONS
-- =============================================================
CREATE TABLE certifications (
  id             UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id     UUID        NOT NULL REFERENCES skill_profiles(id) ON DELETE CASCADE,
  name           TEXT        NOT NULL,    -- "AWS Solutions Architect – Associate"
  issuer         TEXT,                    -- "Amazon Web Services"
  issue_date     DATE,
  expiry_date    DATE,
  credential_id  TEXT,
  credential_url TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================
-- EDUCATION
-- =============================================================
CREATE TABLE education (
  id             UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id     UUID        NOT NULL REFERENCES skill_profiles(id) ON DELETE CASCADE,
  degree         TEXT        NOT NULL,    -- "B.S. Computer Science"
  field_of_study TEXT,
  institution    TEXT        NOT NULL,
  start_year     INT,
  end_year       INT,
  gpa            DECIMAL(3,2),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================
-- SEARCH QUERIES  (HR search history)
-- =============================================================
CREATE TABLE search_queries (
  id                UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  hr_user_id        UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  query_text        TEXT        NOT NULL,
  query_embedding   vector(1536),          -- embedded query; allows "find similar queries"
  filters           JSONB       NOT NULL DEFAULT '{}',
  result_count      INT         NOT NULL DEFAULT 0,
  execution_time_ms INT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================
-- SEARCH RESULTS  (ranked results per query, persisted for analytics)
-- =============================================================
CREATE TABLE search_results (
  id             UUID                  PRIMARY KEY DEFAULT uuid_generate_v4(),
  query_id       UUID                  NOT NULL REFERENCES search_queries(id) ON DELETE CASCADE,
  profile_id     UUID                  NOT NULL REFERENCES skill_profiles(id) ON DELETE CASCADE,
  rank_position  INT                   NOT NULL,
  vector_score   DECIMAL(6,5),          -- cosine similarity 0–1
  claude_score   DECIMAL(5,2),          -- Claude 0–100 score
  final_score    DECIMAL(6,5),          -- weighted composite
  reasoning      TEXT,
  strengths      JSONB                 NOT NULL DEFAULT '[]',
  gaps           JSONB                 NOT NULL DEFAULT '[]',
  recommendation search_recommendation NOT NULL DEFAULT 'partial_match',
  created_at     TIMESTAMPTZ           NOT NULL DEFAULT NOW()
);

-- =============================================================
-- TEAM REQUESTS  (team builder sessions)
-- =============================================================
CREATE TABLE team_requests (
  id                  UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  hr_user_id          UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_name        TEXT        NOT NULL,
  project_description TEXT,
  status              team_status NOT NULL DEFAULT 'draft',
  ai_summary          TEXT,        -- Claude's overall team assessment
  coverage_gaps       JSONB       NOT NULL DEFAULT '[]',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================
-- TEAM ROLES  (roles needed + assignment result)
-- =============================================================
CREATE TABLE team_roles (
  id                     UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_request_id        UUID        NOT NULL REFERENCES team_requests(id) ON DELETE CASCADE,
  role_title             TEXT        NOT NULL,
  requirements           TEXT        NOT NULL,     -- free-text requirements
  requirements_embedding vector(1536),             -- embedded for semantic candidate search
  priority               INT         NOT NULL DEFAULT 1,  -- 1=critical 2=important 3=nice
  assigned_profile_id    UUID        REFERENCES skill_profiles(id) ON DELETE SET NULL,
  assignment_reasoning   TEXT,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================
-- UPDATED_AT TRIGGER
-- =============================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at          BEFORE UPDATE ON users          FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_skill_profiles_updated_at BEFORE UPDATE ON skill_profiles FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_employee_skills_updated_at BEFORE UPDATE ON employee_skills FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_team_requests_updated_at  BEFORE UPDATE ON team_requests  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =============================================================
-- INDEXES
-- =============================================================

-- Users
CREATE UNIQUE INDEX idx_users_email            ON users(email);
CREATE        INDEX idx_users_role             ON users(role) WHERE is_active = TRUE;

-- Profiles
CREATE        INDEX idx_profiles_user_id       ON skill_profiles(user_id);
CREATE        INDEX idx_profiles_status        ON skill_profiles(status);
CREATE        INDEX idx_profiles_status_updated ON skill_profiles(status, updated_at DESC);

-- HNSW vector indexes (fast approximate nearest-neighbour search)
CREATE INDEX idx_profiles_embedding            ON skill_profiles   USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);
CREATE INDEX idx_employee_skills_embedding     ON employee_skills  USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);
CREATE INDEX idx_search_queries_embedding      ON search_queries   USING hnsw (query_embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);
CREATE INDEX idx_team_roles_embedding          ON team_roles       USING hnsw (requirements_embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);
CREATE INDEX idx_taxonomy_embedding            ON skill_taxonomy   USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);

-- Skills
CREATE        INDEX idx_emp_skills_profile_id  ON employee_skills(profile_id);
CREATE        INDEX idx_emp_skills_name_lower  ON employee_skills(LOWER(name));
CREATE        INDEX idx_emp_skills_taxonomy_id ON employee_skills(taxonomy_id);
CREATE        INDEX idx_emp_skills_is_inferred ON employee_skills(is_inferred);
CREATE        INDEX idx_emp_skills_proficiency ON employee_skills(proficiency);

-- Taxonomy
CREATE UNIQUE INDEX idx_taxonomy_normalized    ON skill_taxonomy(normalized_name);
CREATE        INDEX idx_taxonomy_category      ON skill_taxonomy(category);

-- Projects
CREATE        INDEX idx_projects_profile_id    ON projects(profile_id);
CREATE        INDEX idx_project_skills_proj_id ON project_skills(project_id);

-- Uploads
CREATE        INDEX idx_uploads_user_id        ON resume_uploads(user_id);
CREATE        INDEX idx_uploads_status         ON resume_uploads(processing_status);
CREATE        INDEX idx_uploads_profile_id     ON resume_uploads(profile_id);

-- Search
CREATE        INDEX idx_search_queries_hr      ON search_queries(hr_user_id);
CREATE        INDEX idx_search_queries_created ON search_queries(created_at DESC);
CREATE        INDEX idx_search_results_query   ON search_results(query_id);
CREATE        INDEX idx_search_results_profile ON search_results(profile_id);
CREATE        INDEX idx_search_results_rank    ON search_results(query_id, rank_position);

-- Teams
CREATE        INDEX idx_team_requests_hr       ON team_requests(hr_user_id);
CREATE        INDEX idx_team_roles_request     ON team_roles(team_request_id);
CREATE        INDEX idx_team_roles_assigned    ON team_roles(assigned_profile_id) WHERE assigned_profile_id IS NOT NULL;
