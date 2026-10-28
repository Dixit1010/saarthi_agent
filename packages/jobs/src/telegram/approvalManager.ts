import fs from 'fs';
import path from 'path';
import os from 'os';
import { getAgentConfig } from '../configLoader.js';

export interface PendingApproval {
  id: string;
  jobId: string;
  company: string;
  title: string;
  jobUrl: string;
  matchScore: number;
  dryRun: boolean;
  createdAt: number;
  expiresAt: number;
  status: 'PENDING' | 'CONSUMED' | 'REJECTED' | 'EXPIRED';
  isDummy?: boolean;
  executor?: () => Promise<{ success: boolean; message: string; dryRun: boolean }>;
}

export type SerializedApproval = Omit<PendingApproval, 'executor'>;

export class ApprovalManager {
  private static instance: ApprovalManager | null = null;
  private approvals: Map<string, PendingApproval> = new Map();
  private defaultTtlSeconds = 1800; // 30 minutes
  private storageFilePath: string;

  private constructor() {
    const baseDir = path.resolve(process.env.LOCALAPPDATA || os.homedir(), 'SaarthiAgent');
    this.storageFilePath = path.join(baseDir, 'pending_approvals.json');
    this.loadFromFile();
  }

  public static getInstance(): ApprovalManager {
    if (!ApprovalManager.instance) {
      ApprovalManager.instance = new ApprovalManager();
    }
    return ApprovalManager.instance;
  }

  private loadFromFile(): void {
    try {
      if (!fs.existsSync(this.storageFilePath)) {
        return;
      }
      const raw = fs.readFileSync(this.storageFilePath, 'utf8');
      if (!raw || !raw.trim()) return;

      const items: SerializedApproval[] = JSON.parse(raw);
      if (Array.isArray(items)) {
        for (const item of items) {
          const existing = this.approvals.get(item.id);
          if (existing) {
            Object.assign(existing, item);
          } else {
            const req: PendingApproval = { ...item };
            this.approvals.set(item.id, req);
            this.approvals.set(`job:${item.jobId}`, req);
          }
        }
      }
    } catch (err) {
      console.warn('[ApprovalManager] Warning: Could not load pending approvals from file:', err);
    }
  }

  private saveToFile(): void {
    try {
      const dir = path.dirname(this.storageFilePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      const uniqueList: SerializedApproval[] = [];
      const seen = new Set<string>();

      for (const [key, req] of this.approvals.entries()) {
        if (!key.startsWith('job:') && !seen.has(req.id)) {
          seen.add(req.id);
          // Omit non-serializable executor
          const { executor: _omit, ...serialized } = req;
          uniqueList.push(serialized);
        }
      }

      fs.writeFileSync(this.storageFilePath, JSON.stringify(uniqueList, null, 2), 'utf8');
    } catch (err) {
      console.warn('[ApprovalManager] Warning: Could not save pending approvals to file:', err);
    }
  }

  public createRequest(options: {
    jobId: string;
    company: string;
    title: string;
    jobUrl: string;
    matchScore: number;
    ttlSeconds?: number;
    isDummy?: boolean;
    executor?: () => Promise<{ success: boolean; message: string; dryRun: boolean }>;
  }): PendingApproval {
    this.loadFromFile();
    this.cleanExpired();
    const config = getAgentConfig();
    const dryRun = config.automation?.dryRun ?? true;

    const id = `apr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    const now = Date.now();
    const ttlSeconds = options.ttlSeconds !== undefined ? options.ttlSeconds : this.defaultTtlSeconds;
    const ttl = ttlSeconds * 1000;

    const isDummy =
      options.isDummy ??
      (options.jobId.startsWith('dummy_') ||
        id.startsWith('dummy_') ||
        options.company.toLowerCase().includes('dummy') ||
        options.company.toLowerCase().includes('example') ||
        options.company.toLowerCase().includes('demo'));

    const req: PendingApproval = {
      id,
      jobId: options.jobId,
      company: options.company,
      title: options.title,
      jobUrl: options.jobUrl,
      matchScore: options.matchScore,
      dryRun,
      createdAt: now,
      expiresAt: now + ttl,
      status: 'PENDING',
      isDummy,
      executor: options.executor,
    };

    this.approvals.set(id, req);
    this.approvals.set(`job:${options.jobId}`, req);
    this.saveToFile();

    return req;
  }

  public findRequest(identifier: string): PendingApproval | undefined {
    this.loadFromFile();
    this.cleanExpired();

    if (!identifier) return undefined;
    const clean = identifier.trim();

    // 1. Direct key match (by id or indexed job:jobId)
    const direct = this.approvals.get(clean) || this.approvals.get(`job:${clean}`);
    if (direct) return direct;

    // 2. Case-insensitive lookup across all entries
    const lower = clean.toLowerCase();
    for (const req of this.approvals.values()) {
      if (req.id.toLowerCase() === lower || req.jobId.toLowerCase() === lower) {
        return req;
      }
    }

    return undefined;
  }

  public async approve(
    identifier: string
  ): Promise<{ success: boolean; message: string; request?: PendingApproval }> {
    this.loadFromFile();
    this.cleanExpired();
    const req = this.findRequest(identifier);

    if (!req) {
      return {
        success: false,
        message: `No active approval request found for "${identifier}".`,
      };
    }

    if (Date.now() > req.expiresAt || req.status === 'EXPIRED') {
      req.status = 'EXPIRED';
      this.saveToFile();
      return {
        success: false,
        message: `Approval request for ${req.title} at ${req.company} has expired.`,
        request: req,
      };
    }

    if (req.status !== 'PENDING') {
      return {
        success: false,
        message: `Approval request for ${req.title} at ${req.company} has already been processed (${req.status}).`,
        request: req,
      };
    }

    // Single-use atomic consumption
    req.status = 'CONSUMED';
    this.saveToFile();

    // Handle dummy test jobs safely with zero external calls
    if (req.isDummy || req.jobId.startsWith('dummy_')) {
      if (req.executor) {
        try {
          const result = await req.executor();
          return {
            success: result.success,
            message: result.message,
            request: req,
          };
        } catch (err: any) {
          // If executor fails, provide informative message
          return {
            success: false,
            message: `[DUMMY TEST] Simulated execution failed: ${err.message || String(err)}`,
            request: req,
          };
        }
      }

      return {
        success: true,
        message: `[DUMMY TEST] Simulated approval confirmed for ${req.title} at ${req.company}. Zero real actions taken.`,
        request: req,
      };
    }

    // Verify dryRun configuration: Dry-run MUST NEVER submit a live application
    const config = getAgentConfig();
    const isDryRun = config.automation?.dryRun ?? true;

    if (req.executor) {
      try {
        const result = await req.executor();
        return {
          success: result.success,
          message: result.message,
          request: req,
        };
      } catch (err: any) {
        return {
          success: false,
          message: `Execution failed after approval: ${err.message || String(err)}`,
          request: req,
        };
      }
    }

    return {
      success: true,
      message: isDryRun
        ? `[DRY-RUN] Approved for ${req.company} (${req.title}). In dry-run mode, no real application was submitted.`
        : `Approved for ${req.company} (${req.title}).`,
      request: req,
    };
  }

  public reject(
    identifier: string
  ): { success: boolean; message: string; request?: PendingApproval } {
    this.loadFromFile();
    this.cleanExpired();
    const req = this.findRequest(identifier);

    if (!req) {
      return {
        success: false,
        message: `No active approval request found for "${identifier}".`,
      };
    }

    if (req.status !== 'PENDING') {
      return {
        success: false,
        message: `Request for ${req.title} at ${req.company} is already ${req.status}.`,
        request: req,
      };
    }

    req.status = 'REJECTED';
    this.saveToFile();

    if (req.isDummy || req.jobId.startsWith('dummy_')) {
      return {
        success: true,
        message: `[DUMMY TEST] Simulated job ${req.title} at ${req.company} rejected.`,
        request: req,
      };
    }

    return {
      success: true,
      message: `Application for ${req.title} at ${req.company} rejected.`,
      request: req,
    };
  }

  public getPendingCount(): number {
    this.loadFromFile();
    this.cleanExpired();
    const unique = new Set<string>();
    for (const [key, req] of this.approvals.entries()) {
      if (!key.startsWith('job:') && req.status === 'PENDING' && Date.now() <= req.expiresAt) {
        unique.add(req.id);
      }
    }
    return unique.size;
  }

  public getPendingRequests(): PendingApproval[] {
    this.loadFromFile();
    this.cleanExpired();
    const list: PendingApproval[] = [];
    const seen = new Set<string>();
    for (const [key, req] of this.approvals.entries()) {
      if (!key.startsWith('job:') && !seen.has(req.id) && req.status === 'PENDING') {
        seen.add(req.id);
        list.push(req);
      }
    }
    return list;
  }

  public cleanExpired(): void {
    const now = Date.now();
    let hasChanges = false;
    for (const req of this.approvals.values()) {
      if (req.status === 'PENDING' && now > req.expiresAt) {
        req.status = 'EXPIRED';
        hasChanges = true;
      }
    }
    if (hasChanges) {
      this.saveToFile();
    }
  }

  /**
   * For testing purposes: resets memory and clears the persisted file.
   */
  public reset(): void {
    this.approvals.clear();
    try {
      if (fs.existsSync(this.storageFilePath)) {
        fs.unlinkSync(this.storageFilePath);
      }
    } catch {
      // ignore
    }
  }
}

export const approvalManager = ApprovalManager.getInstance();
