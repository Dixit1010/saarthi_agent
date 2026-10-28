# Saarthi AI — Database Schema Specification

This document details the relational data model for Saarthi AI, implemented via **Prisma ORM**. The schema is designed for zero-config local development using SQLite (`file:./dev.db`), and is structured to be 100% portable to PostgreSQL.

---

## Entity Relationship Overview

The schema is partitioned into 6 cohesive domains:

```
[Candidate Identity & Profile]
  User ──< Profile ──< (Skill, Experience ──< Achievement, Project)

[Resumes & Provenance]
  Profile ──< Resume ──< ResumeVersion ──< ResumeSource

[Job Discovery & Intelligence]
  Job ──< (JobSource, JobSkill, JobMatch)
  JobMatch >── Profile

[Applications & Audit Trail]
  Application >── (User, Job, ResumeVersion)
  Application ──< (ApplicationAnswer, ApplicationEvent)

[Agent Orchestration & Automation]
  AgentRun ──< (AgentTask, AgentLog)
  User ──< AutomationRule

[System & Notifications]
  User ──< (Notification, UserPreference)
```

---

## Detailed Entity Definitions

### 1. Identity & Profile Domain

#### `User`
Primary account record for authentication and workspace scoping.
- `id` (String, PK, cuid/uuid)
- `email` (String, Unique)
- `passwordHash` (String)
- `name` (String)
- `role` (String, default: "USER")
- `createdAt` (DateTime), `updatedAt` (DateTime)

#### `Profile`
Master candidate profile holding high-level metadata.
- `id` (String, PK)
- `userId` (String, FK -> User, Unique)
- `phone` (String, Optional)
- `location` (String, e.g. "Noida, India")
- `bio` (String, Optional)
- `education` (JSON string / text: degree, field, institution, start, end)
- `createdAt` (DateTime), `updatedAt` (DateTime)

#### `Skill`
Verified technical and domain skills.
- `id` (String, PK)
- `profileId` (String, FK -> Profile)
- `name` (String, e.g. "Node.js", "PostgreSQL")
- `category` (String, e.g. "Backend", "Database", "Language")
- `yearsExperience` (Float, Optional)
- `verified` (Boolean, default: true)

#### `Experience`
Structured work history records.
- `id` (String, PK)
- `profileId` (String, FK -> Profile)
- `company` (String)
- `role` (String)
- `employmentType` (String: FULL_TIME, CONTRACT, INTERNSHIP)
- `location` (String, Optional)
- `startDate` (DateTime), `endDate` (DateTime, Optional if current)
- `isCurrent` (Boolean, default: false)
- `technologies` (JSON array of strings)
- `createdAt` (DateTime), `updatedAt` (DateTime)

#### `Achievement`
Granular bullet achievements linked to experiences with measurable metrics.
- `id` (String, PK)
- `experienceId` (String, FK -> Experience)
- `text` (String)
- `metrics` (JSON array of strings)
- `verified` (Boolean, default: true)

#### `Project`
Portfolio projects used selectively during resume tailoring.
- `id` (String, PK)
- `profileId` (String, FK -> Profile)
- `name` (String)
- `description` (String)
- `problem` (String, Optional)
- `solution` (String, Optional)
- `technologies` (JSON array of strings)
- `githubUrl` (String, Optional)
- `liveUrl` (String, Optional)
- `measurableResults` (JSON array of strings)
- `verified` (Boolean, default: true)

---

### 2. Resume & Provenance Domain

#### `Resume`
Root resume template container (e.g. "Master Resume", "Backend Resume", "AI Engineer Resume").
- `id` (String, PK)
- `profileId` (String, FK -> Profile)
- `title` (String)
- `targetRole` (String, Optional)
- `isMaster` (Boolean, default: false)
- `createdAt` (DateTime), `updatedAt` (DateTime)

#### `ResumeVersion`
Immutable snapshot of a resume generated for a target job or updated by user.
- `id` (String, PK)
- `resumeId` (String, FK -> Resume)
- `versionNumber` (Int)
- `jobId` (String, FK -> Job, Optional)
- `content` (JSON structure: contact, summary, education, experience, projects, skills)
- `fileUrlPdf` (String, Optional)
- `fileUrlDocx` (String, Optional)
- `atsScore` (Int, Optional)
- `atsReport` (JSON, Optional)
- `createdAt` (DateTime)

#### `ResumeSource`
Provenance link connecting a generated resume bullet back to verified experience or achievement.
- `id` (String, PK)
- `resumeVersionId` (String, FK -> ResumeVersion)
- `bulletText` (String)
- `sourceType` (String: "EXPERIENCE", "ACHIEVEMENT", "PROJECT")
- `sourceId` (String)

---

### 3. Job Engine Domain

#### `Job`
Canonical job posting entity.
- `id` (String, PK)
- `canonicalUrl` (String, Unique)
- `title` (String)
- `company` (String)
- `location` (String)
- `locationType` (String: REMOTE, HYBRID, ONSITE)
- `employmentType` (String: FULL_TIME, CONTRACT, INTERNSHIP)
- `description` (String)
- `salaryMin` (Float, Optional)
- `salaryMax` (Float, Optional)
- `salaryCurrency` (String, default: "INR")
- `experienceMin` (Int, Optional)
- `experienceMax` (Int, Optional)
- `status` (String: ACTIVE, EXPIRED, ARCHIVED)
- `postedAt` (DateTime, Optional)
- `discoveredAt` (DateTime, default: now)

#### `JobSource`
Tracks which source(s) a canonical job was discovered through.
- `id` (String, PK)
- `jobId` (String, FK -> Job)
- `sourceName` (String: "CAREER_PAGE", "API", "SEARCH", "MANUAL")
- `sourceUrl` (String)
- `externalId` (String, Optional)
- `discoveredAt` (DateTime, default: now)

#### `JobSkill`
Skills extracted by the JD parser.
- `id` (String, PK)
- `jobId` (String, FK -> Job)
- `name` (String)
- `isRequired` (Boolean, default: true)

#### `JobMatch`
Explainable evaluation of candidate fit for a job.
- `id` (String, PK)
- `jobId` (String, FK -> Job)
- `profileId` (String, FK -> Profile)
- `score` (Int: 0 - 100)
- `breakdown` (JSON: skills, experience, role, location, projects, education, salary, preferences)
- `matchedSkills` (JSON array)
- `missingSkills` (JSON array)
- `partialSkills` (JSON array)
- `reasons` (JSON array of strings)
- `createdAt` (DateTime, default: now)

---

### 4. Applications & Audit Domain

#### `Application`
Tracks an application submitted or prepared for a job.
- `id` (String, PK)
- `userId` (String, FK -> User)
- `jobId` (String, FK -> Job)
- `resumeVersionId` (String, FK -> ResumeVersion, Optional)
- `status` (String: DISCOVERED, SHORTLISTED, READY, APPLIED, OA, INTERVIEW, TECHNICAL, HR, OFFER, REJECTED, WITHDRAWN)
- `appliedAt` (DateTime, Optional)
- `submissionMethod` (String: MANUAL, ASSISTED, AUTONOMOUS)
- `coverLetterText` (String, Optional)
- `notes` (String, Optional)
- `createdAt` (DateTime), `updatedAt` (DateTime)

#### `ApplicationAnswer`
Pre-filled or AI-generated application answers with provenance and confidence.
- `id` (String, PK)
- `applicationId` (String, FK -> Application)
- `question` (String)
- `answer` (String)
- `confidence` (Float)
- `requiresReview` (Boolean, default: false)
- `sources` (JSON array)
- `isApproved` (Boolean, default: false)

#### `ApplicationEvent`
Immutable chronological audit log of actions on an application.
- `id` (String, PK)
- `applicationId` (String, FK -> Application)
- `eventType` (String, e.g. "DISCOVERED", "RESUME_TAILORED", "FORM_FILLED", "HUMAN_APPROVED", "SUBMITTED")
- `description` (String)
- `actor` (String: "AGENT", "USER")
- `payload` (JSON, Optional)
- `createdAt` (DateTime, default: now)

---

### 5. Agent Orchestration Domain

#### `AgentRun`
Execution session of an autonomous or scheduled agent task.
- `id` (String, PK)
- `trigger` (String: "MANUAL", "SCHEDULED", "BATCH")
- `status` (String: "PENDING", "RUNNING", "COMPLETED", "FAILED", "PAUSED_FOR_HUMAN")
- `summary` (JSON: jobsScanned, qualified, prepared, submitted, needsReview)
- `startedAt` (DateTime)
- `finishedAt` (DateTime, Optional)

#### `AgentTask`
Individual task unit within an agent run.
- `id` (String, PK)
- `agentRunId` (String, FK -> AgentRun)
- `taskType` (String: "DISCOVER", "PARSE_JD", "SCORE_MATCH", "TAILOR_RESUME", "FILL_FORM", "SUBMIT")
- `status` (String: "PENDING", "IN_PROGRESS", "SUCCESS", "FAILED")
- `payload` (JSON)
- `error` (String, Optional)

#### `AgentLog`
Detailed diagnostic and operational logs for an agent run.
- `id` (String, PK)
- `agentRunId` (String, FK -> AgentRun)
- `level` (String: "INFO", "WARN", "ERROR")
- `message` (String)
- `metadata` (JSON, Optional)
- `timestamp` (DateTime, default: now)

---

### 6. System & Preferences Domain

#### `Notification`
In-app alerts for human actions, approvals, and matches.
- `id` (String, PK)
- `userId` (String, FK -> User)
- `title` (String)
- `message` (String)
- `type` (String: "HIGH_MATCH", "APPROVAL_REQUIRED", "SUBMITTED", "INTERVIEW", "FAILED")
- `isRead` (Boolean, default: false)
- `link` (String, Optional)
- `createdAt` (DateTime, default: now)

#### `UserPreference`
Target criteria configured by the user.
- `id` (String, PK)
- `userId` (String, FK -> User, Unique)
- `targetRoles` (JSON array)
- `targetLocations` (JSON array)
- `remotePreference` (String: ANY, REMOTE_ONLY, HYBRID, ONSITE)
- `experienceMin` (Int, default: 0)
- `experienceMax` (Int, default: 3)
- `salaryMin` (Float, Optional)
- `excludedCompanies` (JSON array)
- `excludedKeywords` (JSON array)

#### `AutomationRule`
Configures automation limits and gating.
- `id` (String, PK)
- `userId` (String, FK -> User, Unique)
- `mode` (String: "MANUAL", "ASSISTED", "AUTONOMOUS", default: "ASSISTED")
- `minimumMatchScore` (Int, default: 80)
- `dailyApplicationCap` (Int, default: 10)
- `requireApprovalForSubmit` (Boolean, default: true)
