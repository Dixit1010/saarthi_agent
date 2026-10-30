import { TelegramClient } from './telegramClient.js';
import { PendingApproval } from './approvalManager.js';

function escapeHtml(text: string): string {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export class TelegramNotifier {
  private static instance: TelegramNotifier | null = null;
  private client: TelegramClient | null = null;
  private chatId: string | null = null;

  // Notification deduplication store: key -> timestamp
  private recentNotificationKeys = new Map<string, number>();
  private dedupWindowMs = 15000;

  private constructor() {
    this.refreshCredentials();
  }

  public static getInstance(): TelegramNotifier {
    if (!TelegramNotifier.instance) {
      TelegramNotifier.instance = new TelegramNotifier();
    }
    return TelegramNotifier.instance;
  }

  public refreshCredentials(): void {
    const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
    const chat = process.env.TELEGRAM_CHAT_ID?.trim();

    if (token && chat) {
      this.client = new TelegramClient(token);
      this.chatId = chat;
    } else {
      this.client = null;
      this.chatId = null;
    }
  }

  public isConfigured(): boolean {
    return Boolean(this.client && this.chatId);
  }

  public checkAndRecordDedup(key: string): boolean {
    const now = Date.now();
    const lastSent = this.recentNotificationKeys.get(key);
    if (lastSent && now - lastSent < this.dedupWindowMs) {
      return false;
    }
    this.recentNotificationKeys.set(key, now);
    return true;
  }

  public resetDeduplication(): void {
    this.recentNotificationKeys.clear();
  }

  private formatTestPrefix(isTest?: boolean): string {
    return isTest ? '🧪 <b>[TEST]</b> ' : '';
  }

  public async notifyScanStarted(platforms: string[], dryRun: boolean, isTest?: boolean): Promise<boolean> {
    if (!this.client || !this.chatId) return false;
    const dedupKey = `scan_start:${platforms.join(',')}:${dryRun}:${Boolean(isTest)}`;
    if (!this.checkAndRecordDedup(dedupKey)) return false;

    const modeTag = dryRun ? '🧪 Dry-Run' : '⚡ Live';
    const text = `${this.formatTestPrefix(isTest)}🔍 <b>Scan Started</b> • ${escapeHtml(platforms.join(', '))} <i>(${modeTag})</i>`;

    return this.client.sendMessage(this.chatId, text);
  }

  public async notifyScanCompleted(summary: {
    totalScanned: number;
    totalApplied: number;
    totalSkipped: number;
    durationMs: number;
    dryRun: boolean;
    isTest?: boolean;
  }): Promise<boolean> {
    if (!this.client || !this.chatId) return false;
    const durationSec = Math.round(summary.durationMs / 1000);
    const label = summary.dryRun ? 'Verified' : 'Applied';

    const text = [
      `${this.formatTestPrefix(summary.isTest)}🏁 <b>Run Complete (${durationSec}s)</b>`,
      `✅ <b>${label}: ${summary.totalApplied}</b>  •  ⏭️ Skipped: ${summary.totalSkipped}  •  🔎 Scanned: ${summary.totalScanned}`,
    ].join('\n');

    return this.client.sendMessage(this.chatId, text);
  }

  public async notifyJobFound(job: {
    title: string;
    company: string;
    matchScore: number;
    jobUrl: string;
    platform?: string;
    isTest?: boolean;
  }): Promise<boolean> {
    if (!this.client || !this.chatId) return false;
    const dedupKey = `job_found:${job.company}:${job.title}:${Boolean(job.isTest)}`;
    if (!this.checkAndRecordDedup(dedupKey)) return false;

    const plat = job.platform ? ` <i>(${escapeHtml(job.platform)})</i>` : '';
    const text = `${this.formatTestPrefix(job.isTest)}🎯 <b>${escapeHtml(job.title)}</b> @ <b>${escapeHtml(job.company)}</b> (${job.matchScore}%)${plat} — <a href="${escapeHtml(job.jobUrl)}">View</a>`;

    return this.client.sendMessage(this.chatId, text, { disable_web_page_preview: true });
  }

  public async notifyApplicationQueued(job: {
    title: string;
    company: string;
    matchScore?: number;
    queuePosition?: number;
    isTest?: boolean;
  }): Promise<boolean> {
    if (!this.client || !this.chatId) return false;
    const dedupKey = `job_queued:${job.company}:${job.title}:${Boolean(job.isTest)}`;
    if (!this.checkAndRecordDedup(dedupKey)) return false;

    const score = job.matchScore ? ` (${job.matchScore}%)` : '';
    const text = `${this.formatTestPrefix(job.isTest)}⏳ <b>Queued:</b> ${escapeHtml(job.title)} @ <b>${escapeHtml(job.company)}</b>${score}`;

    return this.client.sendMessage(this.chatId, text);
  }

  public async notifyApplicationPrepared(job: {
    id: string;
    title: string;
    company: string;
    matchScore: number;
    jobUrl: string;
    isTest?: boolean;
  }): Promise<boolean> {
    if (!this.client || !this.chatId) return false;
    const dedupKey = `app_prep:${job.company}:${job.title}:${Boolean(job.isTest)}`;
    if (!this.checkAndRecordDedup(dedupKey)) return false;

    const text = `${this.formatTestPrefix(job.isTest)}📝 <b>Ready:</b> ${escapeHtml(job.title)} @ <b>${escapeHtml(job.company)}</b> (${job.matchScore}%)`;

    return this.client.sendMessage(this.chatId, text);
  }

  public async notifyApprovalRequired(request: PendingApproval, isTest?: boolean): Promise<boolean> {
    if (!this.client || !this.chatId) return false;
    const remainingMins = Math.max(1, Math.round((request.expiresAt - Date.now()) / 60000));

    const text = [
      `${this.formatTestPrefix(isTest)}⚠️ <b>Approve Application?</b> <i>(${remainingMins}m left)</i>`,
      `<b>${escapeHtml(request.title)}</b> @ <b>${escapeHtml(request.company)}</b> (${request.matchScore}%)`,
    ].join('\n');

    const inlineKeyboard = {
      inline_keyboard: [
        [
          { text: '✅ Approve', callback_data: `approve:${request.id}` },
          { text: '❌ Reject', callback_data: `reject:${request.id}` },
        ],
      ],
    };

    return this.client.sendMessage(this.chatId, text, {
      reply_markup: inlineKeyboard,
    });
  }

  public async notifyApplicationSubmitted(job: {
    title: string;
    company: string;
    platform: string;
    jobUrl?: string;
    dryRun: boolean;
    isTest?: boolean;
  }): Promise<boolean> {
    if (!this.client || !this.chatId) return false;

    const cleanUrl = job.jobUrl ? job.jobUrl.split('#')[0] : '';
    const linkPart = cleanUrl ? ` — <a href="${escapeHtml(cleanUrl)}">🔗 Job Link</a>` : '';

    if (job.dryRun) {
      const text = `${this.formatTestPrefix(job.isTest)}🧪 <b>Dry-Run Verified:</b> ${escapeHtml(job.title)} @ <b>${escapeHtml(job.company)}</b> <i>(${escapeHtml(job.platform)})</i>${linkPart}`;
      return this.client.sendMessage(this.chatId, text, { disable_web_page_preview: true });
    }

    const text = `${this.formatTestPrefix(job.isTest)}✅ <b>Applied:</b> ${escapeHtml(job.title)} @ <b>${escapeHtml(job.company)}</b> <i>(${escapeHtml(job.platform)})</i>${linkPart}`;
    return this.client.sendMessage(this.chatId, text, { disable_web_page_preview: true });
  }

  public async notifyApplicationSkipped(job: {
    title: string;
    company: string;
    platform?: string;
    reason: string;
    isTest?: boolean;
  }): Promise<boolean> {
    if (!this.client || !this.chatId) return false;
    const text = `${this.formatTestPrefix(job.isTest)}⏭️ <b>Skipped:</b> ${escapeHtml(job.title)} @ <b>${escapeHtml(job.company)}</b> — <i>${escapeHtml(job.reason)}</i>`;
    return this.client.sendMessage(this.chatId, text);
  }

  public async notifyApplicationFailed(job: {
    title: string;
    company: string;
    platform?: string;
    reason: string;
    isTest?: boolean;
  }): Promise<boolean> {
    if (!this.client || !this.chatId) return false;
    const text = `${this.formatTestPrefix(job.isTest)}❌ <b>Failed:</b> ${escapeHtml(job.title)} @ <b>${escapeHtml(job.company)}</b> — <i>${escapeHtml(job.reason)}</i>`;
    return this.client.sendMessage(this.chatId, text);
  }

  public async notifySubmissionOutcomeUnknown(job: {
    title: string;
    company: string;
    platform?: string;
    reason?: string;
    isTest?: boolean;
  }): Promise<boolean> {
    if (!this.client || !this.chatId) return false;
    const text = `${this.formatTestPrefix(job.isTest)}❓ <b>Unconfirmed:</b> ${escapeHtml(job.title)} @ <b>${escapeHtml(job.company)}</b> — <i>${escapeHtml(job.reason || 'Check portal directly')}</i>`;
    return this.client.sendMessage(this.chatId, text);
  }

  public async notifySecurityChallenge(
    platform: string,
    reason: string,
    timeoutSeconds: number,
    isTest?: boolean
  ): Promise<boolean> {
    if (!this.client || !this.chatId) return false;
    const text = `${this.formatTestPrefix(isTest)}🔐 <b>Action Required (${escapeHtml(platform)}):</b> ${escapeHtml(reason)} <i>(${timeoutSeconds}s window on laptop)</i>`;
    return this.client.sendMessage(this.chatId, text);
  }

  public async notifyDailySummary(summary: {
    scanned: number;
    prepared: number;
    submitted: number;
    failed: number;
    pendingReview: number;
    date?: string;
    isTest?: boolean;
  }): Promise<boolean> {
    if (!this.client || !this.chatId) return false;
    const dateStr = summary.date || new Date().toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' });

    const text = [
      `${this.formatTestPrefix(summary.isTest)}📊 <b>Daily Summary (${escapeHtml(dateStr)})</b>`,
      `✅ Applied: <b>${summary.submitted}</b>  •  📝 Ready: ${summary.prepared}  •  ⏭️ Skipped: ${summary.failed}  •  🔎 Scanned: ${summary.scanned}`,
    ].join('\n');

    return this.client.sendMessage(this.chatId, text);
  }
}

export const telegramNotifier = TelegramNotifier.getInstance();
