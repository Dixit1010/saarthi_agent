import { AgentStatusSnapshot } from '@saarthi/shared';
import { getAgentConfig } from '../configLoader.js';

export class AgentStateManager {
  private static instance: AgentStateManager | null = null;

  private paused: boolean = false;
  private activeScan: boolean = false;
  private currentPlatform?: string;
  private queueSizeGetter: () => number = () => 0;
  private pendingApprovalsGetter: () => number = () => 0;
  private appliedToday: number = 0;
  private lastResetDay: string = new Date().toISOString().slice(0, 10);
  private liveLogs: string[] = [];

  private constructor() {}

  public static getInstance(): AgentStateManager {
    if (!AgentStateManager.instance) {
      AgentStateManager.instance = new AgentStateManager();
    }
    return AgentStateManager.instance;
  }

  public isPaused(): boolean {
    return this.paused;
  }

  public pause(): void {
    this.paused = true;
  }

  public resume(): void {
    this.paused = false;
  }

  public setActiveScan(active: boolean, platform?: string): void {
    this.activeScan = active;
    this.currentPlatform = active ? platform : undefined;
    if (active) {
      this.liveLogs = [];
    }
  }

  public appendLiveLog(entry: string): void {
    this.liveLogs.push(entry);
    if (this.liveLogs.length > 100) {
      this.liveLogs.shift();
    }
  }

  public getLiveLogs(): string[] {
    return [...this.liveLogs];
  }

  public isScanActive(): boolean {
    return this.activeScan;
  }

  public registerQueueSizeGetter(fn: () => number): void {
    this.queueSizeGetter = fn;
  }

  public registerPendingApprovalsGetter(fn: () => number): void {
    this.pendingApprovalsGetter = fn;
  }

  public recordSubmission(): void {
    this.checkDayRollover();
    this.appliedToday++;
  }

  public getAppliedToday(): number {
    this.checkDayRollover();
    return this.appliedToday;
  }

  private checkDayRollover(): void {
    const today = new Date().toISOString().slice(0, 10);
    if (today !== this.lastResetDay) {
      this.appliedToday = 0;
      this.lastResetDay = today;
    }
  }

  public getStatusSnapshot(): AgentStatusSnapshot {
    this.checkDayRollover();
    const config = getAgentConfig();
    const dryRun = config.automation?.dryRun ?? true;
    const dailyLimit = config.automation?.dailyApplicationLimit ?? 15;

    return {
      isPaused: this.paused,
      activeScan: this.activeScan,
      currentPlatform: this.currentPlatform,
      applicationsSubmittedToday: this.appliedToday,
      dailyApplicationLimit: dailyLimit,
      dryRun,
      queueSize: this.queueSizeGetter(),
      pendingApprovalsCount: this.pendingApprovalsGetter(),
    };
  }
}

export const agentState = AgentStateManager.getInstance();
