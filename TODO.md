# Saarthi AI — Master Engineering Task List

This task list tracks all implementation deliverables across the 8 development phases of Saarthi AI.

---

## Phase 1 — Foundation (Current Milestone)
- [x] Audit workspace, inspect environment tooling, and establish architectural blueprints.
- [x] Author specifications: `docs/ARCHITECTURE.md`, `docs/ROADMAP.md`, `docs/DATABASE.md`, `docs/AGENT.md`, `docs/AUTOMATION.md`.
- [x] Initialize monorepo structure: `pnpm-workspace.yaml`, `turbo.json`, `package.json`, root TypeScript config.
- [x] Build `@saarthi/shared`: Zod schemas, data contracts, and status enums.
- [x] Build `@saarthi/database`: Complete Prisma schema for 21 entities, SQLite client configuration for zero-config local run, seed data script.
- [x] Build `@saarthi/ai`: Unified `AIProvider` interface with Google Gemini (default), OpenAI-compatible, and Groq adapters.
- [x] Build `@saarthi/api`: Fastify server, authentication (secure password hashing, session tokens), profile, jobs, applications, agent, and analytics endpoints.
- [x] Build `@saarthi/web`: Next.js 15 App Router frontend with Linear/Raycast dark/light theme, dashboard metrics cards, job match listings, agent run logs, and application tracker.
- [x] Run test suite, type checking, and verify end-to-end local operation.

---

## Phase 2 — Profile & Resume (Completed)
- [x] Build master profile management UI & API (contact, education, bio, location).
- [x] Implement Experience Bank CRUD with verified achievements and metrics tags.
- [x] Implement Project Bank CRUD with architecture descriptions, GitHub/live links, and tech stacks.
- [x] Implement Skill Bank management with verification flags and experience ratings.
- [x] Implement Resume Uploader & Parser for PDF/DOCX into structured profile components.
- [x] Implement Master Resume templates and resume version management.

---

## Phase 3 — Job Engine
- [ ] Implement standardized Job schema and database ingestion pipeline.
- [ ] Build Job Normalization layer (experience spans, salary currencies, location types).
- [ ] Build Job Deduplication engine (canonical URL, company, title hashing, description similarity).
- [ ] Implement AI Job Description (JD) parser separating Required vs. Preferred qualifications.
- [ ] Implement Explainable Matching Engine with configurable category weights (Skills 30%, Experience 20%, etc.).
- [ ] Build Job Search & Filtering UI with live match breakdowns (✓ Matched, △ Partial, ✗ Missing).

---

## Phase 4 — AI Resume Tailoring
- [ ] Implement JD Relevance Matcher to pick target-specific experiences and projects.
- [ ] Build Provenance-Gated Resume Rewriter (rephrase bullets to align with JD without fabricating any facts).
- [ ] Implement bullet-level source tracking (`ResumeSource` linking every bullet to verified achievements).
- [ ] Build ATS Optimization analyzer (keyword coverage score, missing skill callouts).
- [ ] Implement Resume Export to PDF and DOCX formats.
- [ ] Build role-specific, factual Cover Letter generator (150–250 words, non-generic).

---

## Phase 5 — Application Agent (Browser Automation)
- [ ] Set up Playwright automation runner in isolated worker context.
- [ ] Build internal Mock Job Site (`/mock-job-site/...`) for deterministic, safe browser testing.
- [ ] Implement Form Detector & Semantic Field Mapper with heuristic scoring.
- [ ] Build Form Filler for inputs, selects, radio buttons, and resume upload.
- [ ] Implement CAPTCHA & anti-bot challenge detection with immediate agent pause and user alert.
- [ ] Build pre-submission Application Review modal with human approval gate (`[Approve & Submit]`).

---

## Phase 6 — Agent & Scheduler
- [ ] Build in-memory background worker engine with BullMQ compatibility.
- [ ] Implement scheduled job discovery runners (configurable cron triggers).
- [ ] Implement Agent Run tracking (`AgentRun`, `AgentTask`, `AgentLog`).
- [ ] Build in-app Notification system (high-match alerts, review requests, submission confirmations).
- [ ] Implement batch application preparation pipeline.

---

## Phase 7 — Analytics
- [ ] Build Application Funnel dashboard (Discovered -> Applied -> Interview -> Offer).
- [ ] Implement response rate and velocity analytics.
- [ ] Track resume version performance metrics (which templates yield interview invitations).
- [ ] Build comprehensive audit timeline viewer for all agent actions.

---

## Phase 8 — Production Hardening
- [ ] Security audit: secret encryption, rate limiting, and CSRF protection.
- [ ] Implement complete data export (GDPR JSON archive) and account deletion.
- [ ] Add circuit breaker and exponential backoff policies for external network requests.
- [ ] Configure production build pipelines and performance monitoring.
