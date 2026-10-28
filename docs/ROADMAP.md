# Saarthi AI — Product & Engineering Roadmap

This roadmap defines the multi-phase engineering trajectory for Saarthi AI, guiding progression from foundational scaffolding to an autonomous, production-hardened job application agent.

---

## Phase Overview Matrix

| Phase | Milestone | Primary Deliverables | Definition of Done |
|---|---|---|---|
| **Phase 1** | Foundation | Monorepo, DB Schema, API, Auth, AI Abstraction, Dashboard | Monorepo builds, DB migrations apply, Auth works, Dashboard displays |
| **Phase 2** | Profile & Resume Bank | Master Profile, Experience & Project Banks, Resume Parser & Versions | Structured profile editable, PDF/DOCX parsed into verifiable entities |
| **Phase 3** | Job Engine | Adapters, Normalizer, Deduplication, JD Parser, Matching Engine | Jobs ingested, normalized, parsed, explainable match breakdown calculated |
| **Phase 4** | AI Resume Tailoring | JD Relevance Match, Bullet Rewriting, Provenance Tracking, ATS Score | Tailored resume generated with 100% traceable source links and ATS report |
| **Phase 5** | Browser Automation | Playwright sandbox, Mock Job Site, Field Mapper, Human Approval | Mock site filled automatically, CAPTCHA halts automation, Human approves |
| **Phase 6** | Agent & Scheduler | Queue Engine, Scheduled Discovery, Agent Runs, Notification Engine | Timed discovery scans, batch application prep, agent audit run logs |
| **Phase 7** | Analytics & Insights | Conversion Funnel, Interview Tracker, Resume A/B Metrics | Application stats, response rates, and actionable pipeline analytics |
| **Phase 8** | Production Hardening | Rate limiting, Data Export/Deletion, Secret Encryption, Backups | Security audit passed, GDPR data compliance, comprehensive test suite |

---

## Phase 1 — Foundation (Current Milestone)
- [x] Monorepo setup with pnpm workspaces and Turborepo.
- [x] Complete Prisma schema supporting all 21 system entities.
- [x] Fastify API with strict Zod request/response validation.
- [x] Authentication subsystem (secure password hashing, session tokens).
- [x] Pluggable AI provider abstraction interface with Gemini, OpenAI, and Groq adapters.
- [x] Shared validation schemas, constants, and TypeScript types.
- [x] Modern Next.js 15 frontend with dark/light mode and Linear/Raycast UI aesthetic.
- [x] Foundation documentation suite (`ARCHITECTURE.md`, `ROADMAP.md`, `DATABASE.md`, `AGENT.md`, `AUTOMATION.md`, `TODO.md`).

---

## Phase 2 — Profile & Resume Bank
- **Profile Management**: Master candidate profile editor (contact, education, skills, location, preferences).
- **Experience Bank**: Granular work experience catalog with verified achievements, metrics, and technology tags.
- **Project Bank**: Portfolio project directory with problem-solution breakdowns, GitHub/live links, and technology stacks.
- **Master Resume Management**: Multi-format resume upload (PDF/DOCX), structured section extractor, and template selector.
- **Resume Versioning**: Immutable version history for master and tailored resume templates.

---

## Phase 3 — Job Discovery & Matching Engine
- **Modular Job Adapters**: Pluggable `JobSource` interface (`CompanyCareerSource`, `PublicJobAPI`, `SearchSource`).
- **Normalization Layer**: Text cleaning, standardized experience spans (`1-3 yrs` -> `min: 1, max: 3`), salary normalization, and location categorization (Remote / Hybrid / Onsite).
- **Deduplication Engine**: Multi-factor job matching (canonical URL, company name, normalized title, description similarity hashing).
- **JD AI Parser**: Deep extraction separating *Required* vs. *Preferred* skills, qualifications, responsibilities, and application questions.
- **Explainable Matching Engine**: Weighted multi-factor scoring (Skills 30%, Experience 20%, Role 15%, Location 10%, Projects 10%, Education 5%, Salary 5%, Preferences 5%) with transparent match/partial/missing breakdown.

---

## Phase 4 — AI Resume Tailoring & Provenance
- **Contextual Selector**: Extracts high-relevance experience bullets and projects based on the targeted JD.
- **Provenance-Gated Rewriting**: Rewrites bullet points to reflect target JD vocabulary *strictly without fabricating facts*. Each bullet links back to source experience/achievement IDs.
- **ATS Optimizer**: Keyword density check, missing requirement callouts, formatting readability audit.
- **Document Exporter**: High-fidelity PDF and DOCX generation preserving ATS-compliant formatting.
- **Role-Specific Cover Letter Generator**: Concise (150-250 words), factual, tailored cover letters without generic AI fluff.

---

## Phase 5 — Application Automation Agent
- **Browser Automation Core**: Playwright-powered engine configured with anti-fingerprinting and safety controls.
- **Mock Job Site Sandbox**: Internal test harness (`/mock-job-site/*`) replicating various ATS form patterns for automated verification.
- **Semantic Field Mapper**: Maps input labels, placeholders, and ARIA attributes to candidate profile fields with confidence scoring.
- **Safety Gating & Review**:
  - Ambiguous fields flagged for human review.
  - CAPTCHA / bot challenges trigger immediate agent halt and human handover.
  - Mandatory "Approve & Submit" confirmation modal before final payload dispatch.

---

## Phase 6 — Agent Scheduler & Batch Operations
- **Task & Queue Engine**: In-memory async worker with BullMQ compatibility for scheduled background processing.
- **Autonomous Discovery Sweeps**: Configurable cron jobs (e.g. daily 9 AM sweeps across targeted roles/locations).
- **Batch Application Preparation**: Select $N$ qualified jobs -> batch tailor resumes and answers -> present aggregated review queue.
- **Notification Service**: In-app notifications for new high-match positions, review requests, and status changes.

---

## Phase 7 — Analytics & Career Insights
- **Application Funnel Tracking**: Stage transitions (`DISCOVERED` -> `SHORTLISTED` -> `READY` -> `APPLIED` -> `OA` -> `INTERVIEW` -> `OFFER`).
- **Response Metrics**: Stage conversion rates, response velocity, role-based performance metrics.
- **Audit Viewer**: Chronological agent activity timeline with detailed event logs per application.

---

## Phase 8 — Production Hardening & Compliance
- **Security & Privacy**: Encrypted secret storage, secure credential handling, CSRF protections.
- **Compliance & Rights**: GDPR data export (full JSON archive) and permanent account deletion.
- **Resilience**: Exponential backoff retries, dead-letter task queues, and circuit breakers for external source scraping.
