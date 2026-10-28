import { TelegramClient, TelegramUpdate, escapeHtml } from './telegramClient.js';
import { approvalManager } from './approvalManager.js';
import { agentState } from '../state/agentStateManager.js';
import { telegramNotifier } from './telegramNotifier.js';

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

    // Run long-polling loop in the background
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

        backoffMs = 2000; // Reset backoff on success

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
        backoffMs = Math.min(backoffMs * 1.5, 30000); // Max 30s backoff
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

    // 1. Handle incoming text message
    if (update.message) {
      const fromId = update.message.from?.id ? String(update.message.from.id) : null;
      const text = update.message.text?.trim() || '';

      // Strict user authorization check
      if (!fromId || fromId !== this.allowedUserId) {
        console.warn(
          `[TelegramBot] Unauthorized message attempt from user ID: ${fromId || 'unknown'}. Expected: ${this.allowedUserId}`
        );
        // Only reply if it was a direct interaction to explain rejection, but reply to configured chat
        return;
      }

      await this.handleCommand(text);
      return;
    }

    // 2. Handle inline button callback query
    if (update.callback_query) {
      const fromId = update.callback_query.from?.id ? String(update.callback_query.from.id) : null;
      const callbackId = update.callback_query.id;
      const data = update.callback_query.data || '';

      // Strict authorization check for callbacks
      if (!fromId || fromId !== this.allowedUserId) {
        console.warn(
          `[TelegramBot] Unauthorized callback_query attempt from user ID: ${fromId || 'unknown'}`
        );
        await this.client.answerCallbackQuery(callbackId, 'Unauthorized');
        return;
      }

      await this.client.answerCallbackQuery(callbackId, 'Processing request...');
      await this.handleCallback(data);
    }
  }

  private async handleCommand(rawText: string): Promise<void> {
    if (!this.client || !this.chatId) return;

    const parts = rawText.split(/\s+/);
    const command = parts[0]?.toLowerCase();
    const arg = parts.slice(1).join(' ').trim();

    switch (command) {
      case '/start':
      case '/help': {
        const helpMessage = [
          `🤖 <b>Saarthi AI Assistant Bot</b>`,
          `Welcome! Use the following commands to monitor and control your agent:`,
          ``,
          `📊 <b>/status</b> — View agent state, daily caps, active scans & queue.`,
          `⏸️ <b>/pause</b> — Pause new scans and upcoming applications.`,
          `▶️ <b>/resume</b> — Resume autonomous scans and processing.`,
          `✅ <b>/approve &lt;job_id&gt;</b> — Approve a specific pending job.`,
          `❌ <b>/reject &lt;job_id&gt;</b> — Reject/skip a specific pending job.`,
          `ℹ️ <b>/help</b> — Show this command reference.`,
          ``,
          `<i>Note: Dry-run safety is strictly enforced by default.</i>`,
        ].join('\n');
        await this.client.sendMessage(this.chatId, helpMessage);
        break;
      }

      case '/status': {
        const snap = agentState.getStatusSnapshot();
        const pauseStatus = snap.isPaused
          ? '⏸️ <b>PAUSED</b> (No new tasks will start)'
          : '▶️ <b>ACTIVE</b> (Ready & running)';
        const scanStatus = snap.activeScan
          ? `🔍 In Progress (${snap.currentPlatform || 'Multi-platform'})`
          : '💤 Idle';
        const modeBadge = snap.dryRun ? '🧪 Dry-Run Mode (Safe)' : '⚡ Live Auto-Apply';

        const statusMessage = [
          `📊 <b>Saarthi Agent Status</b>`,
          `• <b>State:</b> ${pauseStatus}`,
          `• <b>Scan:</b> ${scanStatus}`,
          `• <b>Mode:</b> ${modeBadge}`,
          `• <b>Today Applied:</b> ${snap.applicationsSubmittedToday} / ${snap.dailyApplicationLimit}`,
          `• <b>Task Queue:</b> ${snap.queueSize} pending`,
          `• <b>Pending Approvals:</b> ${snap.pendingApprovalsCount} waiting`,
        ].join('\n');

        await this.client.sendMessage(this.chatId, statusMessage);
        break;
      }

      case '/pause': {
        agentState.pause();
        const msg = [
          `⏸️ <b>Saarthi Agent Paused</b>`,
          `New job scans, queue processing, and applications are suspended.`,
          `<i>Note: Any browser action currently mid-flight will complete its step safely.</i>`,
        ].join('\n');
        await this.client.sendMessage(this.chatId, msg);
        break;
      }

      case '/resume': {
        agentState.resume();
        const msg = [
          `▶️ <b>Saarthi Agent Resumed</b>`,
          `Autonomous job scans and application queue processing are now active.`,
        ].join('\n');
        await this.client.sendMessage(this.chatId, msg);
        break;
      }

      case '/approve': {
        if (!arg) {
          await this.client.sendMessage(
            this.chatId,
            `⚠️ Please specify a job ID or approval token: <code>/approve &lt;job_id&gt;</code>`
          );
          return;
        }

        const res = await approvalManager.approve(arg);
        if (res.success) {
          await this.client.sendMessage(this.chatId, `✅ <b>Approval Processed</b>\n${escapeHtml(res.message)}`);
        } else {
          await this.client.sendMessage(this.chatId, `❌ <b>Approval Failed</b>\n${escapeHtml(res.message)}`);
        }
        break;
      }

      case '/reject': {
        if (!arg) {
          await this.client.sendMessage(
            this.chatId,
            `⚠️ Please specify a job ID or approval token: <code>/reject &lt;job_id&gt;</code>`
          );
          return;
        }

        const res = approvalManager.reject(arg);
        if (res.success) {
          await this.client.sendMessage(this.chatId, `❌ <b>Job Rejected</b>\n${escapeHtml(res.message)}`);
        } else {
          await this.client.sendMessage(this.chatId, `⚠️ <b>Rejection Failed</b>\n${escapeHtml(res.message)}`);
        }
        break;
      }

      default: {
        await this.client.sendMessage(
          this.chatId,
          `❓ Unknown command: <code>${escapeHtml(command || '')}</code>. Send /help to view available commands.`
        );
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

    if (action === 'approve') {
      const res = await approvalManager.approve(identifier);
      if (res.success) {
        await this.client.sendMessage(this.chatId, `✅ <b>Approved via Button</b>\n${escapeHtml(res.message)}`);
      } else {
        await this.client.sendMessage(this.chatId, `❌ <b>Approval Failed</b>\n${escapeHtml(res.message)}`);
      }
    } else if (action === 'reject') {
      const res = approvalManager.reject(identifier);
      if (res.success) {
        await this.client.sendMessage(this.chatId, `❌ <b>Rejected via Button</b>\n${escapeHtml(res.message)}`);
      } else {
        await this.client.sendMessage(this.chatId, `⚠️ <b>Rejection Failed</b>\n${escapeHtml(res.message)}`);
      }
    }
  }
}

export const telegramBot = TelegramBot.getInstance();
