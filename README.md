# Saarthi AI — Autonomous Job Search & Application Agent

Saarthi AI is an autonomous, production-grade job search and application platform engineered as a personal AI job-search employee. It combines deterministic candidate provenance, LLM-powered context understanding, and human-emulated browser automation to discover, match, and genuinely submit job applications across LinkedIn, Naukri, Instahyre, and direct career portals.

---

## Key Invariants & Principles

- **Accuracy Over Automation**: Zero fabrication of facts, experiences, companies, titles, or metrics. Every bullet and answer maintains verified provenance from the candidate's master profile.
- **Genuine Submissions Only**: Applications are submitted directly inside authenticated user sessions so they appear natively in your job board portals (e.g. **LinkedIn -> My Jobs -> Applied**, **Naukri -> Application Status**).
- **Anti-Bot & Human Emulation**: Operates with human behavioral physics—curved Bézier mouse trajectories, variable keystroke cadence, organic reading delays, and platform-specific cooldown gaps (120s for LinkedIn, 60s for Naukri).
- **Human Control & Safety**: Immediate circuit breakers pause the agent if security checks, CAPTCHAs, or rate limits are encountered, and Telegram notifications keep you updated in real-time.
- **Zero-Config Local First**: Operates directly on Node.js with local SQLite and persistent Chrome profiles, requiring zero external infrastructure.

---

## Architecture & Monorepo Structure

```text
saarthi/
├── apps/
│   ├── web/          # Next.js 15 App Router Frontend (Linear/Raycast UI, Tailwind CSS)
│   ├── api/          # Fastify REST API with strict Zod validation & agent controls
│   └── worker/       # Background task processor and discovery queue
├── packages/
│   ├── database/     # Prisma ORM covering 21 entities (SQLite dev, PostgreSQL compatible)
│   ├── ai/           # Pluggable AIProvider abstraction (Gemini, OpenAI, Groq)
│   ├── jobs/         # Autonomous Live Job Runner engine & human emulation layer
│   └── shared/       # Shared TypeScript types, Zod schemas, and status enums
└── docs/             # Comprehensive system architecture & domain specifications
```

---

## Live Autonomous Job Runner

The `@saarthi/jobs` package powers autonomous multi-platform job applications:

### 1. LinkedIn Live Easy Apply
- **Authentic Submissions**: Runs inside your authenticated taskbar Chrome session; every application is registered directly under `LinkedIn -> My Jobs -> Applied`.
- **Modern DOM Support**: Fully compatible with LinkedIn's 2026 SDUI search layouts and HTML5 `<dialog open>` multi-step application modals.
- **Smart Form Resolution**: Automatically matches questions against your Answer Bank or generates concise, factual answers using Groq AI (`openai/gpt-oss-120b`).
- **2-Minute Anti-Bot Cooldown**: Waits `120s–138s` with organic jitter between applications to prevent velocity and bot detection.

### 2. Naukri 1-Click Apply
- **Persistent Taskbar Chrome Session**: Authenticated once in your browser; never runs as an unauthenticated guest.
- **Chatbot Screening Automation**: Handles Naukri's interactive screening drawer (`.chatbot_Drawer`), answering experience, notice period, CTC, and technical questions.
- **Strict Submission Verification**: Verifies application confirmation before recording status in the database.
- **60-Second Cooldown**: Enforces a `60s–66s` cooldown between successive applications with human cursor jiggle.

### 3. Human Emulation Engine (`HumanEmulation`)
- **Curved Bézier Cursor Movement**: Mouse moves along quadratic Bézier curves from the last cursor position with subtle `±1px` physiological tremor.
- **Organic Inner-Offset Clicks**: Clicks within the safe inner `30%–70%` area of buttons rather than robotic exact center points.
- **Variable Typing Cadence**: Types characters with randomized `45–130ms` delays and extended pauses after punctuation and spaces.
- **Pre-Application Reading Simulation**: Smoothly scrolls and pauses on job descriptions for `4–8s` before clicking apply.

---

## Multi-Device Remote Control

Saarthi AI can be monitored and controlled from any phone or second laptop:

- **Local Wi-Fi Network**: Access the dashboard directly via `http://<YOUR_LAN_IP>:3000` (e.g. `http://192.168.29.178:3000`).
- **Cloudflare Secure Tunnel**: Access via your live tunnel URL (e.g. `https://<tunnel-id>.trycloudflare.com`) from anywhere without port forwarding.
- **Telegram Bot Integration**: Real-time notifications for every submitted application, CAPTCHA alerts, and remote `/pause` and `/resume` controls.

---

## Getting Started

### 1. Prerequisites
- **Node.js**: `>= 20.0.0`
- **pnpm**: `>= 10.0.0`
- **Google Chrome**: Installed on the host machine

### 2. Install Dependencies
```bash
pnpm install
```

### 3. Configure Environment
```bash
cp .env.example .env
```
Key variables in `.env`:
```env
# AI Provider (Groq, Gemini, or OpenAI)
AI_PROVIDER="groq"
GROQ_API_KEY="gsk_..."

# Telegram Notifications & Remote Control
TELEGRAM_BOT_TOKEN="..."
TELEGRAM_CHAT_ID="..."
```

### 4. Initialize Database
```bash
pnpm db:push
pnpm db:seed
```

### 5. Start Development Servers
```bash
pnpm dev
```
- **Web Dashboard**: [http://localhost:3000](http://localhost:3000)
- **Fastify API Server**: [http://localhost:4000](http://localhost:4000)
- **API Health**: [http://localhost:4000/health](http://localhost:4000/health)

### 6. Run Live Autonomous Apply via CLI (Alternative)
```bash
# Live application run
pnpm apply:live

# Dry-run mode (fills forms without clicking final submit)
pnpm apply:live:dry
```

---

## Specifications & Documentation

- [System Architecture](file:///docs/ARCHITECTURE.md)
- [Database Schema & 21 Entities](file:///docs/DATABASE.md)
- [Agent & Provenance Engine](file:///docs/AGENT.md)
- [Browser Automation Specification](file:///docs/AUTOMATION.md)
- [Telegram Bot Setup Guide](file:///docs/TELEGRAM_SETUP_GUIDE.md)
- [Master Task Tracking](file:///TODO.md)

---

## License

Private repository — All rights reserved.
