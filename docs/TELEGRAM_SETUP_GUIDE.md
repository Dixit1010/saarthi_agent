# Saarthi AI — Telegram Notification & Remote Control Bot Setup Guide

> **100% Free & Local**: Saarthi uses official Telegram Bot API **Long Polling**. It runs entirely on your local Windows laptop without requiring public webhooks, open router ports, or paid hosting.

---

## 🚀 3-Minute Quick Setup

### Step 1: Create Your Telegram Bot with @BotFather
1. Open Telegram on your phone or desktop and search for **`@BotFather`** (verified checkmark).
2. Tap **Start** and send the command:
   ```text
   /newbot
   ```
3. Follow the prompts:
   - **Bot name**: e.g., `Dixit Saarthi Agent`
   - **Bot username**: Must end with `bot`, e.g., `dixit_saarthi_bot`
4. BotFather will reply with your **Bot Token**, which looks like:
   ```text
   7123456789:ABCdefGHIjklMNOpqrSTUvwxYZ12345
   ```
   *(Keep this token private!)*

---

### Step 2: Get Your Numeric Telegram User ID & Chat ID
To ensure that **only you** can send commands to your agent and view confidential job details:
1. In Telegram, search for **`@userinfobot`**.
2. Press **Start**.
3. It will immediately reply with your profile info, for example:
   ```text
   Id: 987654321
   First: Dixit
   Last: Kumar
   ```
4. Copy that number (`987654321`):
   - **`TELEGRAM_ALLOWED_USER_ID`**: Your numeric User ID (`987654321`). This prevents anyone else from sending commands to your agent.
   - **`TELEGRAM_CHAT_ID`**: In private 1-on-1 chats with your bot, your Chat ID is identical to your numeric User ID (`987654321`).

---

### Step 3: Start a Conversation with Your New Bot
1. Search for your bot's username (e.g. `@dixit_saarthi_bot`) in Telegram.
2. Click **Start** or send `/start`.
   *(This opens the chat channel so the bot has permission to message you).*

---

### Step 4: Configure Your Local `.env`
Open your local `.env` file in the project root (`c:\Users\DixitKumar\OneDrive - Sinhal Udyog pvt ltd\Desktop\tracker-agent\.env`) and add:

```env
# ==========================================
# Telegram Bot Configuration
# ==========================================
TELEGRAM_BOT_TOKEN="7123456789:ABCdefGHIjklMNOpqrSTUvwxYZ12345"
TELEGRAM_ALLOWED_USER_ID="987654321"
TELEGRAM_CHAT_ID="987654321"
```

---

### Step 5: Start Saarthi
Start the API and Web server as usual:
```powershell
pnpm dev
```
In your terminal, you will see:
```text
🚀 Saarthi API server listening on http://localhost:4000
[TelegramBot] Starting single Telegram polling worker (Long-polling mode)...
```

---

## 📱 Remote Commands Reference

Send these commands directly to your bot in Telegram:

| Command | Action |
| :--- | :--- |
| **`/status`** | Displays agent state (Running/Paused), active scans, today's applied count vs limit, in-memory queue, and pending approvals. |
| **`/pause`** | Suspends new job scans and upcoming applications. *(Current in-flight browser step finishes safely).* |
| **`/resume`** | Resumes autonomous scanning and application queue processing. |
| **`/approve <job_id>`** | Approves a specific job for submission. *(If dryRun is enabled, performs dry-run inspection safely without submitting).* |
| **`/reject <job_id>`** | Skips / rejects a specific job application. |
| **`/help`** | Displays the command menu and safety guidelines. |

---

## 🔔 Notifications You Will Receive

1. **Job Scan Started & Completed**:
   - Platform list, dry-run indicator, duration, scanned count, and applied count.
2. **Qualified Job Match Found**:
   - Role title, company name, match score percentage, and link to the live job posting.
3. **Application Review & Approval Request**:
   - Interactive `[✅ Approve]` and `[❌ Reject]` inline buttons right inside Telegram, with a 30-minute expiration countdown.
4. **Live Submission vs Dry-Run Completion**:
   - Clearly distinguishes `[DRY-RUN COMPLETED]` (inspection only, button not clicked) from `[LIVE SUBMISSION CONFIRMED]`.
5. **Security Challenges & Login Alerts**:
   - Alerts your phone immediately when LinkedIn or Instahyre requires OTP / CAPTCHA / 2FA in the visible browser window on your laptop.

---

## 🛡️ Security & Privacy Features

- **Strict User Authorization**: Every message and button press is checked against `TELEGRAM_ALLOWED_USER_ID`. Commands from any other Telegram account are immediately rejected.
- **Bot Token Protection**: Tokens are never committed to Git (`.env` is in `.gitignore`) and are sanitized from application logs and error traces.
- **Atomic Single-Job Approvals**: Each approval is bound to a single job ID, expires after 30 minutes, and can only be consumed once.
- **Dry-Run Enforcement**: Approving a job never bypasses your configured `dryRun: true` safety setting. Live submission requires explicit configuration.
- **Zero Public Surface**: Because it uses outbound HTTPS long-polling (`api.telegram.org`), your machine needs no open ports or Ngrok tunnels.

---

## ❓ Frequently Asked Questions

#### What happens if I don't configure Telegram?
If `TELEGRAM_BOT_TOKEN`, `TELEGRAM_ALLOWED_USER_ID`, or `TELEGRAM_CHAT_ID` are left blank, the bot is automatically disabled. All web dashboard, CLI, and browser automation features continue to run completely as normal.

#### Can I use Telegram in a group chat?
Yes! Set `TELEGRAM_CHAT_ID` to the group's chat ID (usually a negative number like `-100123456789`). The bot will post alerts to the group, but will still ONLY accept commands from your specific `TELEGRAM_ALLOWED_USER_ID`.
