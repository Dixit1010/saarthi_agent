# Saarthi AI — Browser Automation Specification

## 1. Overview & Automation Philosophy

The browser automation subsystem is responsible for interacting with web application forms on behalf of the user. Because browser automation operates in unpredictable, real-world web environments, it is governed by three non-negotiable rules:

1. **Isolation & Safety First**: Automation always runs in controlled, ephemeral browser contexts.
2. **Never Bypass Defenses**: CAPTCHA, bot challenges, two-factor authentication, or login barriers trigger an immediate, graceful pause and notify the user to complete the step manually.
3. **No Brittle Selectors**: The system uses semantic heuristics (labels, ARIA tags, name attributes, proximity, placeholder texts) rather than rigid CSS paths that break on minor site redesigns.

---

## 2. Automation Component Architecture

```
packages/browser/ (Worker & Automation Layer)
├── BrowserManager.ts           # Ephemeral context lifecycle & resource containment
├── ApplicationNavigator.ts     # Navigation, redirect handling, and page-readiness checks
├── FormDetector.ts             # Semantic discovery of form elements and multistep steppers
├── FieldMapper.ts              # Intelligent heuristic mapping of inputs to candidate profile
├── FormFiller.ts               # Human-like input typing, dropdown selection, file upload
├── ApplicationValidator.ts     # Pre-submission verification & missing-required field check
└── SubmissionController.ts     # Human-approval gate & submission execution
```

---

## 3. Automation Execution Lifecycle

```
[Target Application URL]
        │
        ▼
1. BrowserManager launches ephemeral Playwright browser session
        │
        ▼
2. ApplicationNavigator loads URL, handles cookies/modals, awaits network idle
        │
        ▼
3. Challenge Detector scans for CAPTCHA / Cloudflare / MFA
        ├── [Challenge Found] ──> PAUSE AGENT ──> Notify User for Manual Handover
        └── [Clean Form]
                 │
                 ▼
4. FormDetector enumerates inputs, textareas, selects, and file dropzones
        │
        ▼
5. FieldMapper categorizes each field:
        ├── High Confidence (e.g. Email, Phone, Full Name, Resume Upload)
        ├── Low Confidence / Ambiguous (Flagged for Review)
        └── Text Question (Handed to Application Answer Engine)
        │
        ▼
6. FormFiller populates safe fields & uploads tailored resume PDF
        │
        ▼
7. ApplicationValidator checks form validity and detects errors
        │
        ▼
8. Application halts at final state
        │
        ▼
9. User reviews in Web UI: [Approve & Submit] or [Cancel/Edit]
        │
        ▼
10. Upon approval: SubmissionController clicks submit & captures confirmation screenshot
```

---

## 4. Semantic Field Mapping Heuristics

Input fields are matched against candidate data models using weighted semantic signals:

| Field Domain | Normalized Target | Matched Heuristics (Label / Name / ARIA / Placeholder) |
|---|---|---|
| Full Name | `profile.name` | `name`, `full_name`, `candidate_name`, `your_name`, `first_name + last_name` |
| Email Address | `user.email` | `email`, `e-mail`, `email_address`, `contact_email` |
| Phone Number | `profile.phone` | `phone`, `mobile`, `contact_number`, `telephone`, `cell` |
| Location | `profile.location` | `location`, `city`, `current_location`, `address` |
| Experience Years | `profile.experience` | `experience`, `years_of_experience`, `total_experience`, `yoe` |
| Target / Current Salary | `preferences.salary` | `ctc`, `expected_ctc`, `current_ctc`, `salary`, `compensation` |
| Notice Period | `preferences.notice` | `notice_period`, `notice`, `availability`, `how_soon` |
| LinkedIn Profile | `profile.socials.linkedin`| `linkedin`, `linkedin_profile`, `linkedin_url` |
| GitHub Profile | `profile.socials.github` | `github`, `portfolio_url`, `code_sample` |
| Resume Attachment | `resumeVersion.pdf` | `type="file"`, `resume`, `cv`, `upload_resume` |

If a field cannot be matched with confidence $\ge 0.85$, it is tagged `NEEDS_REVIEW` and highlighted to the user before submission.

---

## 5. Mock Application Testing Sandbox

To ensure complete reliability without testing against live commercial job boards, Saarthi includes a dedicated **Mock Application Harness**:

- Route: `/mock-job-site/[role]` (e.g. `/mock-job-site/backend-engineer`)
- Simulates:
  - Personal information fields (name, email, phone)
  - Work authorization dropdowns
  - Salary expectation number inputs
  - Experience sliders and radio groups
  - Multi-line open-ended questions ("Why do you want to join?")
  - File drag-and-drop for resume PDF upload
  - Step navigation (Page 1 of 3 -> Page 2 of 3 -> Final Review)
  - Submission confirmation screen

All end-to-end integration tests run against this internal mock site before any live platform connector is activated.
