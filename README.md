# Saarthi AI — Autonomous Job Search & Application Agent

Saarthi AI is an autonomous, production-grade job search and application platform engineered as a personal AI job-search employee.

## Key Product Invariants
- **Accuracy Over Automation**: Zero fabrication of facts, experiences, companies, titles, or metrics. Every bullet and answer maintains verified provenance.
- **Human Control by Default**: `DISCOVER → ANALYZE → TAILOR → PREPARE → HUMAN REVIEW → SUBMIT`.
- **Zero-Config Local First**: Operates directly on Node.js without requiring Docker or external daemons.

---

## Architecture & Monorepo Structure

```
saarthi/
├── apps/
│   ├── web/          # Next.js 15 App Router Frontend (Linear/Raycast UI, Tailwind)
│   ├── api/          # Fastify REST API with strict Zod validation
│   └── worker/       # Background task processor
├── packages/
│   ├── database/     # Prisma ORM covering 21 entities (SQLite dev, PostgreSQL compatible)
│   ├── ai/           # Pluggable AIProvider abstraction (Gemini, OpenAI, Groq)
│   └── shared/       # Shared TypeScript types, Zod schemas, and status enums
└── docs/             # Comprehensive system design documentation
```

---

## Getting Started

### 1. Install Dependencies
```bash
pnpm install
```

### 2. Configure Environment
```bash
cp .env.example .env
```
*(Optional: Add your `GEMINI_API_KEY` for live AI generation)*

### 3. Initialize Database & Seed
```bash
pnpm db:push
pnpm db:seed
```

### 4. Run Development Servers
```bash
pnpm dev
```
- **Web Dashboard**: [http://localhost:3000](http://localhost:3000)
- **API Server**: [http://localhost:4000](http://localhost:4000)
- **API Health**: [http://localhost:4000/health](http://localhost:4000/health)

---

## Specifications & Documentation
- [System Architecture](file:///docs/ARCHITECTURE.md)
- [Database Schema & 21 Entities](file:///docs/DATABASE.md)
- [Agent & Provenance Engine](file:///docs/AGENT.md)
- [Browser Automation & Sandbox](file:///docs/AUTOMATION.md)
- [Product & Engineering Roadmap](file:///docs/ROADMAP.md)
- [Task Tracking](file:///TODO.md)
