import { TelegramClient, TelegramUpdate, escapeHtml } from './telegramClient.js';
import { approvalManager } from './approvalManager.js';
import { agentState } from '../state/agentStateManager.js';
import { telegramNotifier } from './telegramNotifier.js';
import { LiveJobRunner } from '../automation/liveJobRunner.js';
import { prisma } from '@saarthi/database';

type PlatformKey = 'LINKEDIN' | 'INSTAHYRE' | 'HIRING_CAFE' | 'NAUKRI' | 'AMAZON' | 'SIEMENS';

export class TelegramBot {
  private static instance: TelegramBot | null = null;
  private client: TelegramClient | null = null;
  private allowedUserId: string | null = null;
  private chatId: string | null = null;

  private isPolling: boolean = false;
  private abortController: AbortController | null = null;
  private lastUpdateId: number = 0;

  private constructor() {
    this.reloadConfig();
  }

  public static getInstance(): TelegramBot {
    if (!TelegramBot.instance) {
      TelegramBot.instance = new TelegramBot();
    }
    return TelegramBot.instance;
  }

  public reloadConfig(): void {
    const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
    const allowedUser = process.env.TELEGRAM_ALLOWED_USER_ID?.trim();
    const chat = process.env.TELEGRAM_CHAT_ID?.trim();

    if (token && allowedUser && chat) {
      this.client = new TelegramClient(token);
      this.allowedUserId = allowedUser;
      this.chatId = chat;
      telegramNotifier.refreshCredentials();
    } else {
      this.client = null;
      this.allowedUserId = null;
      this.chatId = null;
    }
  }

  public isConfigured(): boolean {
    return Boolean(this.client && this.allowedUserId && this.chatId);
  }

  public isRunning(): boolean {
    return this.isPolling;
  }

  private getControlKeyboard() {
    return {
      inline_keyboard: [
        [
          { text: '⚡ Run Instahyre', callback_data: 'run:INSTAHYRE' },
          { text: '💼 Run LinkedIn', callback_data: 'run:LINKEDIN' },
        ],
        [
          { text: '🇮🇳 Run Naukri', callback_data: 'run:NAUKRI' },
          { text: '☕ Run Hiring.cafe', callback_data: 'run:HIRING_CAFE' },
        ],
        [
          { text: '📋 Applied Jobs', callback_data: 'cmd:applied' },
          { text: '🎯 Top Matches', callback_data: 'cmd:jobs' },
          { text: '📜 Logs', callback_data: 'cmd:logs' },
        ],
        [
          { text: '📊 Status', callback_data: 'cmd:status' },
          { text: '⏸️ Pause', callback_data: 'cmd:pause' },
          { text: '▶️ Resume', callback_data: 'cmd:resume' },
        ],
      ],
    };
  }

  /**
   * Starts Telegram long-polling worker if configured.
   * Ensures strictly only ONE polling loop runs per process.
   */
  public async start(): Promise<void> {
    this.reloadConfig();

    if (!this.isConfigured()) {
      console.log(
        '[TelegramBot] TELEGRAM_BOT_TOKEN, TELEGRAM_ALLOWED_USER_ID, or TELEGRAM_CHAT_ID not fully configured. Telegram bot disabled.'
      );
      return;
    }

    if (this.isPolling) {
      console.warn('[TelegramBot] Polling worker is already running. Ignoring duplicate start request.');
      return;
    }

    this.isPolling = true;
    this.abortController = new AbortController();
    console.log('[TelegramBot] Starting single Telegram polling worker (Long-polling mode)...');

    // Register native Telegram slash command menu
    void this.client?.setMyCommands([
      { command: 'panel', description: 'Open 1-tap control panel' },
      { command: 'status', description: 'Agent status & daily count' },
      { command: 'run', description: 'Launch auto-apply (e.g. /run instahyre)' },
      { command: 'applied', description: 'View recent applied jobs' },
      { command: 'jobs', description: 'View top unapplied matches' },
      { command: 'logs', description: 'View latest live browser logs' },
      { command: 'pause', description: 'Pause autonomous agent' },
      { command: 'resume', description: 'Resume autonomous agent' },
    ]);

    void this.pollLoop();
  }

  /**
   * Graceful shutdown of the polling worker
   */
  public stop(): void {
    if (!this.isPolling) return;
    console.log('[TelegramBot] Stopping Telegram polling worker...');
    this.isPolling = false;
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  private async pollLoop(): Promise<void> {
    let backoffMs = 2000;

    while (this.isPolling) {
      try {
        if (!this.client || !this.abortController) break;

        const updates = await this.client.getUpdates(
          this.lastUpdateId + 1,
          25,
          this.abortController.signal
        );

        backoffMs = 2000;

        for (const update of updates) {
          if (update.update_id >= this.lastUpdateId) {
            this.lastUpdateId = update.update_id;
          }
          await this.processUpdate(update);
        }
      } catch (err: any) {
        if (!this.isPolling || err.name === 'AbortError') {
          break;
        }

        const msg = this.client ? this.client.sanitize(err.message || String(err)) : String(err);
        console.warn(`[TelegramBot] Network/API error during long-polling (${msg}). Retrying in ${backoffMs / 1000}s...`);

        await new Promise((r) => setTimeout(r, backoffMs));
        backoffMs = Math.min(backoffMs * 1.5, 30000);
      }
    }

    this.isPolling = false;
    console.log('[TelegramBot] Polling loop stopped.');
  }

  /**
   * Processes a single update with strict authorization checks
   */
  public async processUpdate(update: TelegramUpdate): Promise<void> {
    if (!this.client || !this.chatId || !this.allowedUserId) return;

    if (update.message) {
      const fromId = update.message.from?.id ? String(update.message.from.id) : null;
      const text = update.message.text?.trim() || '';

      if (!fromId || fromId !== this.allowedUserId) {
        console.warn(
          `[TelegramBot] Unauthorized message attempt from user ID: ${fromId || 'unknown'}. Expected: ${this.allowedUserId}`
        );
        return;
      }

      await this.handleCommand(text);
      return;
    }

    if (update.callback_query) {
      const fromId = update.callback_query.from?.id ? String(update.callback_query.from.id) : null;
      const callbackId = update.callback_query.id;
      const data = update.callback_query.data || '';

      if (!fromId || fromId !== this.allowedUserId) {
        await this.client.answerCallbackQuery(callbackId, 'Unauthorized');
        return;
      }

      await this.client.answerCallbackQuery(callbackId, 'Done');
      await this.handleCallback(data);
    }
  }

  private async launchPlatformRun(platforms: PlatformKey[], maxApps: number = 12): Promise<void> {
    if (!this.client || !this.chatId) return;

    if (agentState.isPaused()) {
      await this.client.sendMessage(
        this.chatId,
        `⏸️ Agent is paused. Tap <b>▶️ Resume</b> or send <code>/resume</code> first.`
      );
      return;
    }

    const snap = agentState.getStatusSnapshot();
    if (snap.activeScan) {
      await this.client.sendMessage(
        this.chatId,
        `⚙️ A scan is already running (${escapeHtml(snap.currentPlatform || 'Active')}). Send <code>/logs</code> to check progress.`
      );
      return;
    }

    await this.client.sendMessage(
      this.chatId,
      `🚀 <b>Launching Live Auto-Apply:</b> ${escapeHtml(platforms.join(', '))} (up to ${maxApps} jobs)`
    );

    void LiveJobRunner.execute({
      platforms,
      headless: false,
      dryRun: false,
      maxApplicationsPerPlatform: maxApps,
      interactive: false,
    }).catch((err) => {
      console.error('[TelegramBot] LiveJobRunner error:', err);
    });
  }

  private async sendAppliedSummary(): Promise<void> {
    if (!this.client || !this.chatId) return;

    const totalApplied = await prisma.application.count({ where: { status: 'APPLIED' } });
    const recent = await prisma.application.findMany({
      where: { status: 'APPLIED' },
      include: {
        job: {
          include: { sources: true },
        },
      },
      orderBy: { appliedAt: 'desc' },
      take: 10,
    });

    if (recent.length === 0) {
      await this.client.sendMessage(this.chatId, `📋 <b>Applied Jobs: 0</b>\nNo applications recorded yet.`);
      return;
    }

    const lines = recent.map((app, i) => {
      const title = escapeHtml(app.job?.title || 'Software Engineer');
      const company = escapeHtml(app.job?.company || 'Company');
      const src = escapeHtml(app.job?.sources?.[0]?.sourceName || 'Direct');
      const rawUrl = app.job?.sources?.[0]?.sourceUrl || app.job?.canonicalUrl || '';
      const cleanUrl = rawUrl.split('#')[0];
      const linkHtml = cleanUrl ? ` — <a href="${escapeHtml(cleanUrl)}">🔗 Open Job</a>` : '';
      return `${i + 1}. <b>${title}</b> @ ${company} <i>(${src})</i>${linkHtml}`;
    });

    const msg = [
      `📋 <b>Applied Jobs (${totalApplied} Total)</b> — Latest ${recent.length}:`,
      ...lines,
    ].join('\n');

    await this.client.sendMessage(this.chatId, msg, { disable_web_page_preview: true });
  }

  private async sendTopMatches(): Promise<void> {
    if (!this.client || !this.chatId) return;

    const jobs = await prisma.job.findMany({
      where: {
        applications: { none: {} },
      },
      include: {
        matches: true,
        sources: true,
      },
      orderBy: { discoveredAt: 'desc' },
      take: 40,
    });

    const sorted = jobs
      .map((j) => ({
        title: j.title,
        company: j.company,
        url: j.canonicalUrl,
        source: j.sources?.[0]?.sourceName || 'Direct',
        score: j.matches?.[0]?.score || 82,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 8);

    if (sorted.length === 0) {
      await this.client.sendMessage(this.chatId, `🎯 No unapplied jobs in queue. Tap a platform button to run!`);
      return;
    }

    const lines = sorted.map(
      (j, i) =>
        `${i + 1}. <b>${escapeHtml(j.title)}</b> @ ${escapeHtml(j.company)} (<b>${j.score}%</b> • <i>${escapeHtml(j.source)}</i>) — <a href="${escapeHtml(j.url.split('#')[0] || j.url)}">🔗 Open Job</a>`
    );

    const msg = [`🎯 <b>Top Unapplied Matches</b>`, ...lines].join('\n');
    await this.client.sendMessage(this.chatId, msg, {
      disable_web_page_preview: true,
      reply_markup: this.getControlKeyboard(),
    });
  }

  private async sendLiveLogs(): Promise<void> {
    if (!this.client || !this.chatId) return;

    const logs = agentState.getLiveLogs().slice(-12);
    if (logs.length === 0) {
      await this.client.sendMessage(this.chatId, `📜 <b>Live Logs:</b> No active run logs yet.`);
      return;
    }

    const cleanLines = logs.map((l) => escapeHtml(l)).join('\n');
    await this.client.sendMessage(this.chatId, `📜 <b>Latest Live Logs</b>\n<pre>${cleanLines}</pre>`);
  }

  private async sendStatus(): Promise<void> {
    if (!this.client || !this.chatId) return;

    const snap = agentState.getStatusSnapshot();
    const totalDbApplied = await prisma.application.count({ where: { status: 'APPLIED' } }).catch(() => 0);
    const stateLabel = snap.isPaused ? '⏸️ PAUSED' : '▶️ ACTIVE';
    const scanLabel = snap.activeScan ? `🔍 Running (${snap.currentPlatform || 'Live'})` : '💤 Idle';

    const text = [
      `📊 <b>Saarthi Status</b> • ${stateLabel}`,
      `• <b>Runner:</b> ${scanLabel}`,
      `• <b>Total Applied (DB):</b> ${totalDbApplied}  |  <b>Today:</b> ${snap.applicationsSubmittedToday}/${snap.dailyApplicationLimit}`,
    ].join('\n');

    await this.client.sendMessage(this.chatId, text, {
      reply_markup: this.getControlKeyboard(),
    });
  }

  private async handleNaturalLanguage(rawText: string): Promise<void> {
    if (!this.client || !this.chatId) return;
    const lower = rawText.toLowerCase();

    // Fast intent routing for common phrases
    if (/\b(run|apply|start)\b/.test(lower)) {
      if (lower.includes('instahyre')) return this.launchPlatformRun(['INSTAHYRE']);
      if (lower.includes('linkedin')) return this.launchPlatformRun(['LINKEDIN']);
      if (lower.includes('naukri')) return this.launchPlatformRun(['NAUKRI']);
      if (lower.includes('hiring') || lower.includes('cafe')) return this.launchPlatformRun(['HIRING_CAFE']);
      if (lower.includes('all')) return this.launchPlatformRun(['INSTAHYRE', 'LINKEDIN', 'NAUKRI', 'HIRING_CAFE']);
    }
    if (/\b(applied|applications|history)\b/.test(lower)) return this.sendAppliedSummary();
    if (/\b(log|logs|progress)\b/.test(lower)) return this.sendLiveLogs();
    if (/\b(status|state)\b/.test(lower)) return this.sendStatus();
    if (/\b(pause|stop)\b/.test(lower)) {
      agentState.pause();
      await this.client.sendMessage(this.chatId, `⏸️ <b>Paused.</b> Send /resume to continue.`);
      return;
    }

    // Use Groq AI if configured for general questions
    const apiKey = process.env.GROQ_API_KEY?.trim();
    if (apiKey) {
      try {
        const totalApplied = await prisma.application.count({ where: { status: 'APPLIED' } }).catch(() => 0);
        const totalJobs = await prisma.job.count().catch(() => 0);
        const snap = agentState.getStatusSnapshot();

        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: 'openai/gpt-oss-120b',
            temperature: 0.2,
            max_tokens: 120,
            messages: [
              {
                role: 'system',
                content: `You are Saarthi AI on Telegram for Dixit Kumar. Keep replies under 2 short lines. Live stats: Total Applied=${totalApplied}, Total Discovered Jobs=${totalJobs}, Today Applied=${snap.applicationsSubmittedToday}, Runner Active=${snap.activeScan}, Paused=${snap.isPaused}. Mention commands (/run instahyre, /applied, /logs, /status) if helpful.`,
              },
              { role: 'user', content: rawText },
            ],
          }),
          signal: AbortSignal.timeout(6000),
        });

        if (res.ok) {
          const data = (await res.json()) as any;
          const reply = data?.choices?.[0]?.message?.content?.trim();
          if (reply) {
            await this.client.sendMessage(this.chatId, `🤖 ${escapeHtml(reply)}`, {
              reply_markup: this.getControlKeyboard(),
            });
            return;
          }
        }
      } catch {
        // Fall through to concise help
      }
    }

    await this.client.sendMessage(
      this.chatId,
      `❓ Unknown command. Tap a button below or send <code>/help</code>:`,
      { reply_markup: this.getControlKeyboard() }
    );
  }

  private async handleCommand(rawText: string): Promise<void> {
    if (!this.client || !this.chatId) return;

    if (!rawText.startsWith('/')) {
      await this.handleNaturalLanguage(rawText);
      return;
    }

    const parts = rawText.split(/\s+/);
    const command = parts[0]?.toLowerCase().split('@')[0];
    const arg = parts.slice(1).join(' ').trim();

    switch (command) {
      case '/start':
      case '/help':
      case '/menu':
      case '/panel': {
        const helpMessage = [
          `🤖 <b>Saarthi Control Panel</b>`,
          `• <code>/run instahyre</code> | <code>linkedin</code> | <code>naukri</code> | <code>hiringcafe</code>`,
          `• <code>/applied</code> — Recent applied jobs`,
          `• <code>/jobs</code> — Top unapplied matches`,
          `• <code>/logs</code> — Live browser logs`,
          `• <code>/status</code> | <code>/pause</code> | <code>/resume</code>`,
        ].join('\n');
        await this.client.sendMessage(this.chatId, helpMessage, {
          reply_markup: this.getControlKeyboard(),
        });
        break;
      }

      case '/status': {
        await this.sendStatus();
        break;
      }

      case '/applied': {
        await this.sendAppliedSummary();
        break;
      }

      case '/jobs': {
        await this.sendTopMatches();
        break;
      }

      case '/logs': {
        await this.sendLiveLogs();
        break;
      }

      case '/run': {
        const target = arg.toLowerCase();
        if (!target || target === 'instahyre') {
          await this.launchPlatformRun(['INSTAHYRE']);
        } else if (target.includes('linkedin')) {
          await this.launchPlatformRun(['LINKEDIN']);
        } else if (target.includes('naukri')) {
          await this.launchPlatformRun(['NAUKRI']);
        } else if (target.includes('hiring') || target.includes('cafe')) {
          await this.launchPlatformRun(['HIRING_CAFE']);
        } else if (target.includes('all')) {
          await this.launchPlatformRun(['INSTAHYRE', 'LINKEDIN', 'NAUKRI', 'HIRING_CAFE']);
        } else {
          await this.client.sendMessage(
            this.chatId,
            `⚡ Usage: <code>/run instahyre</code>, <code>/run linkedin</code>, <code>/run naukri</code>, <code>/run hiringcafe</code>, or <code>/run all</code>`
          );
        }
        break;
      }

      case '/pause': {
        agentState.pause();
        await this.client.sendMessage(this.chatId, `⏸️ <b>Paused.</b> Send <code>/resume</code> to continue.`);
        break;
      }

      case '/resume': {
        agentState.resume();
        await this.client.sendMessage(this.chatId, `▶️ <b>Resumed.</b> Autonomous runs active.`);
        break;
      }

      case '/approve': {
        if (!arg) {
          await this.client.sendMessage(this.chatId, `⚠️ Usage: <code>/approve &lt;job_id&gt;</code>`);
          return;
        }
        const res = await approvalManager.approve(arg);
        await this.client.sendMessage(
          this.chatId,
          `${res.success ? '✅' : '❌'} ${escapeHtml(res.message)}`
        );
        break;
      }

      case '/reject': {
        if (!arg) {
          await this.client.sendMessage(this.chatId, `⚠️ Usage: <code>/reject &lt;job_id&gt;</code>`);
          return;
        }
        const res = approvalManager.reject(arg);
        await this.client.sendMessage(
          this.chatId,
          `${res.success ? '❌' : '⚠️'} ${escapeHtml(res.message)}`
        );
        break;
      }

      default: {
        await this.handleNaturalLanguage(rawText);
        break;
      }
    }
  }

  private async handleCallback(data: string): Promise<void> {
    if (!this.client || !this.chatId) return;

    const colonIdx = data.indexOf(':');
    if (colonIdx === -1) return;
    const action = data.slice(0, colonIdx);
    const identifier = data.slice(colonIdx + 1);
    if (!action || !identifier) return;

    if (action === 'run') {
      await this.launchPlatformRun([identifier as PlatformKey]);
      return;
    }

    if (action === 'cmd') {
      if (identifier === 'applied') await this.sendAppliedSummary();
      else if (identifier === 'jobs') await this.sendTopMatches();
      else if (identifier === 'logs') await this.sendLiveLogs();
      else if (identifier === 'status') await this.sendStatus();
      else if (identifier === 'pause') {
        agentState.pause();
        await this.client.sendMessage(this.chatId, `⏸️ <b>Paused.</b>`);
      } else if (identifier === 'resume') {
        agentState.resume();
        await this.client.sendMessage(this.chatId, `▶️ <b>Resumed.</b>`);
      }
      return;
    }

    if (action === 'approve') {
      const res = await approvalManager.approve(identifier);
      await this.client.sendMessage(
        this.chatId,
        `${res.success ? '✅' : '❌'} ${escapeHtml(res.message)}`
      );
    } else if (action === 'reject') {
      const res = approvalManager.reject(identifier);
      await this.client.sendMessage(
        this.chatId,
        `${res.success ? '❌' : '⚠️'} ${escapeHtml(res.message)}`
      );
    }
  }
}

export const telegramBot = TelegramBot.getInstance();
