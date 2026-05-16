# SkillsHub — AI-Powered Skills Intelligence Platform

SkillsHub helps HR teams manage employee skills intelligently. It ingests resumes and LinkedIn profiles using AI, builds structured skill profiles, and lets HR search for the right people using plain English — with ranked results and human-readable reasoning.

---

## Features

- **AI Profile Ingestion** — Upload PDF resumes or paste LinkedIn/resume text; AI extracts skills, proficiency, years of experience, and project history automatically
- **Skill Inference** — Automatically infers related skills (e.g. Next.js → React, TypeScript → JavaScript) with confidence scores
- **Review & Approval Workflow** — Extracted profiles land in an HR review queue before being accepted into the database
- **Natural Language Search** — HR types full sentences; returns ranked candidates with match scores and plain-English reasoning
- **Team Builder** — Describe a project and headcount; AI proposes a full team with per-role rationale
- **Bulk Import** — Upload a CSV to onboard multiple employees at once with auto account creation
- **Role-Based Access** — Separate dashboards and permissions for HR and Employee roles
- **Employee Directory** — Browse all profiles, view skills taxonomy, experience, and certifications

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16, React 19, Tailwind CSS v4, TanStack Query |
| Backend | NestJS 10, TypeORM, PostgreSQL + pgvector |
| AI | Anthropic Claude (profile extraction), OpenAI text-embedding-3-small (semantic search) |
| Queue | BullMQ + Redis |
| Auth | JWT (access + refresh tokens) |

---

## Prerequisites

Make sure the following are installed on your machine:

- **Node.js** v20+
- **PostgreSQL** v15+ with the `pgvector` extension
- **Redis** v7+
- **npm** v9+

---

## 1. Clone the Repository

```bash
git clone https://github.com/swapnilshinde30/skillshub-ai-platform.git
cd skillshub-ai-platform
```

---

## 2. PostgreSQL Setup

```sql
-- Connect to PostgreSQL and run:
CREATE DATABASE skillshub;
\c skillshub
CREATE EXTENSION IF NOT EXISTS vector;
```

---

## 3. Backend Setup

```bash
cd backend
npm install
```

### Environment Variables

Copy the example file and fill in your values:

```bash
cp .env.example .env
```

Edit `.env`:

```env
# Database
DATABASE_URL=postgresql://postgres:yourpassword@localhost:5432/skillshub

# Auth — generate a secret with:
# node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
JWT_SECRET=your_jwt_secret_here
JWT_EXPIRES_IN=7d

# AI APIs
ANTHROPIC_API_KEY=sk-ant-...       # https://console.anthropic.com
OPENAI_API_KEY=sk-...              # https://platform.openai.com (used for embeddings)

# Server
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
```

### Run Migrations & Seed

```bash
# Run database migrations
npm run migration:run

# Seed initial data (admin user + skill taxonomy)
npm run seed
```

### Start Backend

```bash
# Development (with hot reload)
npm run start:dev

# Production
npm run build
npm run start:prod
```

Backend runs on **http://localhost:3001**

---

## 4. Frontend Setup

```bash
cd frontend
npm install
```

### Environment Variables

Create a `.env.local` file:

```bash
cp .env.local.example .env.local   # if example exists, otherwise create manually
```

Add the following to `frontend/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:3001/api
```

### Start Frontend

```bash
# Development
npm run dev

# Production
npm run build
npm run start
```

Frontend runs on **http://localhost:3000**

---

## 5. Redis

Make sure Redis is running before starting the backend:

```bash
# Linux / macOS
redis-server

# Or with Docker
docker run -d -p 6379:6379 redis:7
```

---

## Default Credentials

After running the seed, you can log in with:

| Role | Email | Password |
|---|---|---|
| HR Admin | hr@skillshub.com | demo1234 |
| Employee | employee@skillshub.com | demo1234 |

> All new employee accounts created via bulk import also use the default password `demo1234`.

---

## Project Structure

```
apps/
├── backend/                  # NestJS API
│   ├── src/
│   │   ├── modules/
│   │   │   ├── auth/         # JWT authentication
│   │   │   ├── users/        # User management
│   │   │   ├── profiles/     # Resume ingestion & skill extraction
│   │   │   ├── search/       # Natural language search (pgvector)
│   │   │   ├── teams/        # Team builder
│   │   │   ├── taxonomy/     # Skills taxonomy
│   │   │   └── ai/           # AI service (Claude + OpenAI)
│   │   └── database/         # TypeORM config, migrations, seeds
│   └── .env.example
│
└── frontend/                 # Next.js app
    └── src/
        └── app/
            ├── (auth)/       # Login / Register pages
            └── (dashboard)/
                ├── hr/       # HR dashboard, upload, search, teams
                └── employee/ # Employee dashboard, profile, upload
```

---

## API Overview

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/login` | Login |
| POST | `/api/auth/register` | Register |
| POST | `/api/profiles/ingest/pdf` | Upload PDF resume |
| POST | `/api/profiles/ingest/text` | Paste resume text |
| POST | `/api/profiles/ingest/linkedin` | Paste LinkedIn profile |
| POST | `/api/profiles/hr/bulk-import` | Bulk CSV import |
| GET | `/api/profiles` | List all profiles |
| GET | `/api/search` | Natural language search |
| POST | `/api/teams` | Create team request |
| POST | `/api/teams/:id/build` | AI team builder |

---

## Running with Docker (Optional)

If you prefer Docker for PostgreSQL and Redis:

```bash
docker run -d --name skillshub-postgres \
  -e POSTGRES_DB=skillshub \
  -e POSTGRES_PASSWORD=postgres \
  -p 5432:5432 \
  ankane/pgvector

docker run -d --name skillshub-redis \
  -p 6379:6379 \
  redis:7
```

---

## Built With

- [NestJS](https://nestjs.com/)
- [Next.js](https://nextjs.org/)
- [Anthropic Claude](https://www.anthropic.com/)
- [OpenAI Embeddings](https://platform.openai.com/)
- [pgvector](https://github.com/pgvector/pgvector)
- [BullMQ](https://bullmq.io/)
- [TanStack Query](https://tanstack.com/query)
- [Tailwind CSS](https://tailwindcss.com/)

---

## Author

**Swapnil Shinde** — [github.com/swapnilshinde30](https://github.com/swapnilshinde30)
