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
  private dedupWindowMs = 15000; // 15s window to ignore identical rapid-fire alerts

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
      console.log(`[TelegramNotifier] Deduplicated alert for "${key}". Suppressing duplicate.`);
      return false;
    }
    this.recentNotificationKeys.set(key, now);
    return true;
  }

  public resetDeduplication(): void {
    this.recentNotificationKeys.clear();
  }

  private formatTestHeader(isTest?: boolean): string {
    return isTest ? '🧪 <b>[DUMMY TEST]</b>\n' : '';
  }

  private formatTestFooter(isTest?: boolean): string {
    return isTest ? '\n<i>(Simulated synthetic test data — zero live actions taken)</i>' : '';
  }

  public async notifyScanStarted(platforms: string[], dryRun: boolean, isTest?: boolean): Promise<boolean> {
    if (!this.client || !this.chatId) return false;
    const dedupKey = `scan_start:${platforms.join(',')}:${dryRun}:${Boolean(isTest)}`;
    if (!this.checkAndRecordDedup(dedupKey)) return false;

    const modeBadge = dryRun ? '🧪 <i>[DRY-RUN MODE]</i>' : '⚡ <i>[LIVE AUTO-APPLY]</i>';
    const text = [
      `${this.formatTestHeader(isTest)}🔍 <b>Job Scan Started</b>`,
      `<b>Platforms:</b> ${escapeHtml(platforms.join(', '))}`,
      `<b>Mode:</b> ${modeBadge}`,
      `<b>Time:</b> ${new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })} IST`,
      this.formatTestFooter(isTest),
    ]
      .filter(Boolean)
      .join('\n');

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
    const actionLabel = summary.dryRun ? 'Verified (Dry-Run)' : 'Submitted (Live)';

    const text = [
      `${this.formatTestHeader(summary.isTest)}🏁 <b>Job Scan Completed</b>`,
      `• <b>Scanned:</b> ${summary.totalScanned}`,
      `• <b>${actionLabel}:</b> ${summary.totalApplied}`,
      `• <b>Skipped / Filtered:</b> ${summary.totalSkipped}`,
      `• <b>Duration:</b> ${durationSec}s`,
      this.formatTestFooter(summary.isTest),
    ]
      .filter(Boolean)
      .join('\n');

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

    const scoreEmoji = job.matchScore >= 80 ? '🟢' : job.matchScore >= 65 ? '🟡' : '⚪';

    const text = [
      `${this.formatTestHeader(job.isTest)}🎯 <b>New Qualified Job Match</b>`,
      `<b>Role:</b> ${escapeHtml(job.title)}`,
      `<b>Company:</b> ${escapeHtml(job.company)}`,
      `<b>Match Score:</b> ${scoreEmoji} ${job.matchScore}%`,
      job.platform ? `<b>Platform:</b> ${escapeHtml(job.platform)}` : '',
      `<b>Link:</b> <a href="${escapeHtml(job.jobUrl)}">Open Posting</a>`,
      this.formatTestFooter(job.isTest),
    ]
      .filter(Boolean)
      .join('\n');

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

    const text = [
      `${this.formatTestHeader(job.isTest)}⏳ <b>Application Queued for Processing</b>`,
      `<b>Role:</b> ${escapeHtml(job.title)}`,
      `<b>Company:</b> ${escapeHtml(job.company)}`,
      job.matchScore ? `<b>Match Score:</b> ${job.matchScore}%` : '',
      job.queuePosition ? `<b>Queue Position:</b> #${job.queuePosition}` : '',
      `Agent worker will initiate profile tailoring and field inspection.`,
      this.formatTestFooter(job.isTest),
    ]
      .filter(Boolean)
      .join('\n');

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

    const text = [
      `${this.formatTestHeader(job.isTest)}📝 <b>Application Prepared</b>`,
      `<b>Role:</b> ${escapeHtml(job.title)}`,
      `<b>Company:</b> ${escapeHtml(job.company)}`,
      `<b>Match Score:</b> ${job.matchScore}%`,
      `Answers mapped and tailored. Ready for review or manual submission.`,
      this.formatTestFooter(job.isTest),
    ]
      .filter(Boolean)
      .join('\n');

    return this.client.sendMessage(this.chatId, text);
  }

  public async notifyApprovalRequired(request: PendingApproval, isTest?: boolean): Promise<boolean> {
    if (!this.client || !this.chatId) return false;
    const remainingMins = Math.max(1, Math.round((request.expiresAt - Date.now()) / 60000));
    const modeNote = request.dryRun
      ? `<i>Note: Dry-run is enabled. Approval will perform inspection without submitting.</i>`
      : `<i>Warning: Live apply is enabled. Approval will proceed with submission!</i>`;

    const text = [
      `${this.formatTestHeader(isTest)}⚠️ <b>Approval Required</b>`,
      `<b>Role:</b> ${escapeHtml(request.title)}`,
      `<b>Company:</b> ${escapeHtml(request.company)}`,
      `<b>Match Score:</b> ${request.matchScore}%`,
      `<b>Expires in:</b> ${remainingMins} minutes`,
      modeNote,
      ``,
      `Click an option below or reply:`,
      `<code>/approve ${request.jobId}</code>`,
      `<code>/reject ${request.jobId}</code>`,
      this.formatTestFooter(isTest),
    ]
      .filter(Boolean)
      .join('\n');

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
    dryRun: boolean;
    isTest?: boolean;
  }): Promise<boolean> {
    if (!this.client || !this.chatId) return false;

    // Strictly distinguish dry run vs live submission
    if (job.dryRun) {
      const text = [
        `${this.formatTestHeader(job.isTest)}🧪 <b>Dry-Run Completed (Not Submitted)</b>`,
        `<b>Role:</b> ${escapeHtml(job.title)}`,
        `<b>Company:</b> ${escapeHtml(job.company)}`,
        `<b>Platform:</b> ${escapeHtml(job.platform)}`,
        `All form fields and answers verified. Submission button was not pressed.`,
        this.formatTestFooter(job.isTest),
      ]
        .filter(Boolean)
        .join('\n');
      return this.client.sendMessage(this.chatId, text);
    }

    const text = [
      `${this.formatTestHeader(job.isTest)}🚀 <b>Live Application Submitted!</b>`,
      `<b>Role:</b> ${escapeHtml(job.title)}`,
      `<b>Company:</b> ${escapeHtml(job.company)}`,
      `<b>Platform:</b> ${escapeHtml(job.platform)}`,
      `Submission confirmed by site.`,
      this.formatTestFooter(job.isTest),
    ]
      .filter(Boolean)
      .join('\n');
    return this.client.sendMessage(this.chatId, text);
  }

  public async notifyApplicationSkipped(job: {
    title: string;
    company: string;
    platform?: string;
    reason: string;
    isTest?: boolean;
  }): Promise<boolean> {
    if (!this.client || !this.chatId) return false;
    const text = [
      `${this.formatTestHeader(job.isTest)}⏭️ <b>Application Skipped / Filtered</b>`,
      `<b>Role:</b> ${escapeHtml(job.title)}`,
      `<b>Company:</b> ${escapeHtml(job.company)}`,
      job.platform ? `<b>Platform:</b> ${escapeHtml(job.platform)}` : '',
      `<b>Reason:</b> ${escapeHtml(job.reason)}`,
      this.formatTestFooter(job.isTest),
    ]
      .filter(Boolean)
      .join('\n');

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
    const text = [
      `${this.formatTestHeader(job.isTest)}❌ <b>Application Submission Failed</b>`,
      `<b>Role:</b> ${escapeHtml(job.title)}`,
      `<b>Company:</b> ${escapeHtml(job.company)}`,
      job.platform ? `<b>Platform:</b> ${escapeHtml(job.platform)}` : '',
      `<b>Error:</b> ${escapeHtml(job.reason)}`,
      this.formatTestFooter(job.isTest),
    ]
      .filter(Boolean)
      .join('\n');

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
    const text = [
      `${this.formatTestHeader(job.isTest)}❓ <b>Submission Outcome Unknown</b>`,
      `<b>Role:</b> ${escapeHtml(job.title)}`,
      `<b>Company:</b> ${escapeHtml(job.company)}`,
      job.platform ? `<b>Platform:</b> ${escapeHtml(job.platform)}` : '',
      `<b>Status:</b> ${escapeHtml(job.reason || 'Portal session closed without definitive confirmation')}`,
      `Please check your email or portal dashboard directly.`,
      this.formatTestFooter(job.isTest),
    ]
      .filter(Boolean)
      .join('\n');

    return this.client.sendMessage(this.chatId, text);
  }

  public async notifySecurityChallenge(
    platform: string,
    reason: string,
    timeoutSeconds: number,
    isTest?: boolean
  ): Promise<boolean> {
    if (!this.client || !this.chatId) return false;
    const text = [
      `${this.formatTestHeader(isTest)}🔐 <b>Manual Action Required on Laptop</b>`,
      `<b>Platform:</b> ${escapeHtml(platform)}`,
      `<b>Alert:</b> ${escapeHtml(reason)}`,
      `Please switch to the visible browser window on your computer to complete verification / 2FA.`,
      `<b>Window open for:</b> ${timeoutSeconds}s`,
      this.formatTestFooter(isTest),
    ]
      .filter(Boolean)
      .join('\n');

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
      `${this.formatTestHeader(summary.isTest)}📊 <b>Saarthi Daily Agent Summary</b>`,
      `<b>Date:</b> ${escapeHtml(dateStr)}`,
      ``,
      `• <b>Jobs Scanned:</b> ${summary.scanned}`,
      `• <b>Applications Prepared:</b> ${summary.prepared}`,
      `• <b>Successfully Submitted:</b> ${summary.submitted}`,
      `• <b>Failed / Skipped:</b> ${summary.failed}`,
      `• <b>Pending Review:</b> ${summary.pendingReview}`,
      this.formatTestFooter(summary.isTest),
    ]
      .filter(Boolean)
      .join('\n');

    return this.client.sendMessage(this.chatId, text);
  }
}

export const telegramNotifier = TelegramNotifier.getInstance();
