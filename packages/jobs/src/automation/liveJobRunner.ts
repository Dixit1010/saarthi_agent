import { BrowserManager } from './browserManager.js';
import { LinkedInLiveRunner, LiveJobResult } from './linkedinLiveRunner.js';
import { InstahyreLiveRunner } from './instahyreLiveRunner.js';
import { HiringCafeLiveRunner } from './hiringCafeLiveRunner.js';
import { NaukriLiveRunner } from './naukriLiveRunner.js';
import { getAgentConfig } from '../configLoader.js';
import { agentState } from '../state/agentStateManager.js';
import { telegramNotifier } from '../telegram/telegramNotifier.js';
import { prisma } from '@saarthi/database';

export type LiveRunnerPlatform =
  | 'LINKEDIN'
  | 'INSTAHYRE'
  | 'HIRING_CAFE'
  | 'NAUKRI'
  | 'AMAZON'
  | 'SIEMENS'
  | 'OTHER';

export interface LiveRunnerExecutionOptions {
  platforms?: LiveRunnerPlatform[];
  headless?: boolean;
  dryRun?: boolean;
  maxApplicationsPerPlatform?: number;
  profileDir?: string;
  manualAuthTimeoutSeconds?: number;
  interactive?: boolean;
  onProgress?: (message: string) => void;
}

export interface LiveRunnerExecutionSummary {
  success: boolean;
  totalApplied: number;
  totalSkipped: number;
  totalAlreadyApplied: number;
  durationMs: number;
  results: LiveJobResult[];
  logs: string[];
}

export class LiveJobRunner {
  static async execute(options: LiveRunnerExecutionOptions = {}): Promise<LiveRunnerExecutionSummary> {
    const startTime = Date.now();
    const config = getAgentConfig();
    const headless = options.headless ?? !config.automation.watchBrowser;
    // Enforce dry-run mode by default for safety unless explicitly opted out
    const dryRun = options.dryRun !== undefined ? options.dryRun : (config.automation.dryRun ?? true);
    const platforms = options.platforms || ['LINKEDIN', 'INSTAHYRE'];
    const maxApplications = options.maxApplicationsPerPlatform || config.automation.dailyApplicationLimit || 15;

    const logs: string[] = [];
    const log = (msg: string) => {
      const istTime = new Date().toLocaleTimeString('en-IN', {
        timeZone: 'Asia/Kolkata',
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
      const entry = `[${istTime} IST] ${msg}`;
      logs.push(entry);
      agentState.appendLiveLog(entry);
      console.log(entry);
      if (options.onProgress) options.onProgress(msg);
    };

    if (agentState.isPaused()) {
      log('Agent is currently PAUSED. Live Job Runner will not start.');
      return {
        success: false,
        totalApplied: 0,
        totalSkipped: 0,
        totalAlreadyApplied: 0,
        durationMs: 0,
        results: [],
        logs,
      };
    }

    log(`Initializing Saarthi Autonomous Live Runner...`);
    log(`Target Platforms: ${platforms.join(', ')} | Headless: ${headless} | DryRun: ${dryRun}`);

    agentState.setActiveScan(true, platforms.join(', '));
    void telegramNotifier.notifyScanStarted(platforms, dryRun);

    const browserManager = new BrowserManager();
    const allResults: LiveJobResult[] = [];

    try {
      // Launch browser with persistent profile
      log('Launching persistent Chrome browser session...');
      const page = await browserManager.init({
        headless,
        slowMo: headless ? 0 : 50,
        persistent: true,
        profileDir: options.profileDir,
      });

      // 1. Run LinkedIn if toggled ON
      if (platforms.includes('LINKEDIN')) {
        log('--- Starting LinkedIn Live Easy Apply Phase (Toggle: ON) ---');
        try {
          const linkedinResults = await LinkedInLiveRunner.run({
            page,
            maxApplications,
            dryRun,
            manualAuthTimeoutSeconds: options.manualAuthTimeoutSeconds,
            interactive: options.interactive,
            onProgress: (m) => log(`[LinkedIn] ${m}`),
          });
          allResults.push(...linkedinResults);
        } catch (err: any) {
          log(`LinkedIn Runner encountered error: ${err.message}`);
        }
      } else {
        log('--- Skipping LinkedIn Phase (Platform Toggle is OFF) ---');
      }

      // 2. Run Instahyre if toggled ON
      if (platforms.includes('INSTAHYRE')) {
        log('--- Starting Instahyre 1-Click Apply Phase (Toggle: ON) ---');
        try {
          const instahyreResults = await InstahyreLiveRunner.run({
            page,
            maxApplications,
            dryRun,
            manualAuthTimeoutSeconds: options.manualAuthTimeoutSeconds,
            interactive: options.interactive,
            onProgress: (m) => log(`[Instahyre] ${m}`),
          });
          allResults.push(...instahyreResults);
        } catch (err: any) {
          log(`Instahyre Runner encountered error: ${err.message}`);
        }
      } else {
        log('--- Skipping Instahyre Phase (Platform Toggle is OFF) ---');
      }

      // 3. Run Hiring.cafe if toggled ON
      if (platforms.includes('HIRING_CAFE')) {
        log('--- Starting Hiring.cafe Direct ATS Apply Phase (Toggle: ON) ---');
        try {
          const hiringCafeResults = await HiringCafeLiveRunner.run({
            page,
            maxApplications,
            dryRun,
            onProgress: (m) => log(`[Hiring.cafe] ${m}`),
          });
          allResults.push(...hiringCafeResults);
        } catch (err: any) {
          log(`Hiring.cafe Runner encountered error: ${err.message}`);
        }
      }

      // 4. Run Naukri.com if toggled ON
      if (platforms.includes('NAUKRI')) {
        log('--- Starting Naukri.com Live Apply Phase (Toggle: ON) ---');
        try {
          const naukriResults = await NaukriLiveRunner.run({
            page,
            maxApplications,
            dryRun,
            manualAuthTimeoutSeconds: options.manualAuthTimeoutSeconds,
            onProgress: (m) => log(`[Naukri] ${m}`),
          });
          allResults.push(...naukriResults);
        } catch (err: any) {
          log(`Naukri Runner encountered error: ${err.message}`);
        }
      }

      // 3. Run Direct Career Portals (Amazon / Siemens / Other) if toggled ON
      const directPortals = platforms.filter((p) => p === 'AMAZON' || p === 'SIEMENS' || p === 'OTHER');
      if (directPortals.length > 0) {
        log(`--- Starting Direct Career Portal Phase (${directPortals.join(', ')}) ---`);
        try {
          const portalJobs = await prisma.job.findMany({
            include: { sources: true, matches: true, applications: true },
            orderBy: { discoveredAt: 'desc' },
            take: 150,
          });

          const eligibleJobs = portalJobs
            .filter((j: any) => {
              if (j.applications && j.applications.length > 0) return false;
              if (/\b(senior|sr\.?|staff|principal|director|manager|lead)\b/i.test(j.title || '')) return false;
              const src = (j.sources?.[0]?.sourceName || '').toLowerCase();
              const comp = (j.company || '').toLowerCase();
              if (directPortals.includes('AMAZON') && (src.includes('amazon') || comp.includes('amazon'))) return true;
              if (directPortals.includes('SIEMENS') && (src.includes('siemens') || comp.includes('siemens'))) return true;
              if (
                directPortals.includes('OTHER') &&
                !src.includes('linkedin') &&
                !src.includes('instahyre') &&
                !src.includes('amazon') &&
                !src.includes('siemens')
              ) {
                return true;
              }
              return false;
            })
            .sort((a: any, b: any) => {
              const aPriority = /amazon|siemens/i.test(`${a.company} ${a.sources?.[0]?.sourceName}`) ? 1 : 0;
              const bPriority = /amazon|siemens/i.test(`${b.company} ${b.sources?.[0]?.sourceName}`) ? 1 : 0;
              if (bPriority !== aPriority) return bPriority - aPriority;
              return (b.matches?.[0]?.score ?? 0) - (a.matches?.[0]?.score ?? 0);
            })
            .slice(0, Math.min(maxApplications, 5));

          log(`Found ${eligibleJobs.length} unapplied matching portal jobs for [${directPortals.join(', ')}].`);

          for (const pj of eligibleJobs) {
            if (agentState.isPaused()) break;
            const platTag: LiveRunnerPlatform =
              (pj.company || '').toLowerCase().includes('amazon') ? 'AMAZON' :
              (pj.company || '').toLowerCase().includes('siemens') ? 'SIEMENS' : 'OTHER';

            log(`[${platTag}] Navigating to ${pj.company} — ${pj.title}...`);
            await page.goto(pj.canonicalUrl, { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {});
            await page.waitForTimeout(2500);

            const applyBtn = await page.$(
              'button:has-text("Apply"), a:has-text("Apply now"), a:has-text("Apply"), button#apply-button'
            ).catch(() => null);
            if (applyBtn && (await applyBtn.isVisible().catch(() => false))) {
              log(`[${platTag}] Clicking Apply button on ${pj.company} portal...`);
              await applyBtn.click({ timeout: 4000 }).catch(() => {});
              await page.waitForTimeout(2000);
            }

            void telegramNotifier.notifyApplicationSubmitted({
              title: pj.title,
              company: pj.company,
              platform: platTag,
              dryRun,
            });

            allResults.push({
              title: pj.title,
              company: pj.company,
              location: pj.location,
              jobUrl: pj.canonicalUrl,
              platform: platTag,
              status: 'APPLIED',
              reason: dryRun ? 'Portal inspected & prepared in dry-run mode' : 'Portal application initiated',
            });
          }
        } catch (err: any) {
          log(`Direct Career Portal Phase warning: ${err.message}`);
        }
      }

      const totalApplied = allResults.filter((r) => r.status === 'APPLIED').length;
      const totalSkipped = allResults.filter((r) => r.status === 'SKIPPED').length;
      const totalAlreadyApplied = allResults.filter((r) => r.status === 'ALREADY_APPLIED').length;
      const durationMs = Date.now() - startTime;

      log(`===============================================`);
      log(`Live Job Runner Completed in ${(durationMs / 1000).toFixed(1)}s!`);
      log(`Applied: ${totalApplied} | Skipped: ${totalSkipped} | Previously Applied: ${totalAlreadyApplied}`);
      log(`===============================================`);

      if (!headless) {
        log('Leaving browser open for 3 seconds before closing...');
        await page.waitForTimeout(3000).catch(() => {});
      }

      await browserManager.close();

      agentState.setActiveScan(false);
      void telegramNotifier.notifyScanCompleted({
        totalScanned: allResults.length,
        totalApplied,
        totalSkipped,
        durationMs,
        dryRun,
      });

      return {
        success: true,
        totalApplied,
        totalSkipped,
        totalAlreadyApplied,
        durationMs,
        results: allResults,
        logs,
      };
    } catch (err: any) {
      log(`Fatal runner error: ${err.message}`);
      await browserManager.close();
      agentState.setActiveScan(false);
      return {
        success: false,
        totalApplied: allResults.filter((r) => r.status === 'APPLIED').length,
        totalSkipped: allResults.filter((r) => r.status === 'SKIPPED').length,
        totalAlreadyApplied: allResults.filter((r) => r.status === 'ALREADY_APPLIED').length,
        durationMs: Date.now() - startTime,
        results: allResults,
        logs,
      };
    }
  }
}
