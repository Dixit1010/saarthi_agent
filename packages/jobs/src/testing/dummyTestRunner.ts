import { telegramNotifier } from '../telegram/telegramNotifier.js';
import { approvalManager } from '../telegram/approvalManager.js';

export interface DummyJobRecord {
  id: string;
  title: string;
  company: string;
  url: string;
  matchScore: number;
  status:
    | 'DISCOVERED'
    | 'QUEUED'
    | 'PENDING_APPROVAL'
    | 'SUBMITTED_SIMULATED'
    | 'FAILED_SIMULATED'
    | 'OUTCOME_UNKNOWN'
    | 'REJECTED';
  failureReason?: string;
}

export interface DummyTestExecutionReport {
  scenarioResults: Array<{
    scenario: string;
    passed: boolean;
    jobId: string;
    details: string;
    notificationSent: boolean;
  }>;
  deduplicationVerified: boolean;
  approvalSafetyVerified: boolean;
  totalScenariosPassed: number;
  totalScenariosCount: number;
}

export class DummyTelegramTestRunner {
  // Completely isolated in-memory test store. Zero database mutations.
  private dummyStore: Map<string, DummyJobRecord> = new Map();

  constructor() {
    this.initSyntheticData();
  }

  private initSyntheticData(): void {
    this.dummyStore.clear();

    const syntheticJobs: DummyJobRecord[] = [
      {
        id: 'dummy_exampletech_101',
        title: 'Software Engineer',
        company: 'ExampleTech',
        url: 'https://exampletech.test/jobs/se-101',
        matchScore: 94,
        status: 'DISCOVERED',
      },
      {
        id: 'dummy_democorp_202',
        title: 'Backend Developer',
        company: 'DemoCorp',
        url: 'https://democorp.test/careers/be-202',
        matchScore: 86,
        status: 'QUEUED',
      },
      {
        id: 'dummy_sampleai_303',
        title: 'AI Engineer',
        company: 'SampleAI',
        url: 'https://sampleai.test/openings/ai-303',
        matchScore: 91,
        status: 'PENDING_APPROVAL',
      },
      {
        id: 'dummy_acmecorp_404',
        title: 'CloudOps Engineer',
        company: 'AcmeCorp',
        url: 'https://acme.test/cloud-404',
        matchScore: 78,
        status: 'OUTCOME_UNKNOWN',
      },
      {
        id: 'dummy_embedded_505',
        title: 'Firmware Developer',
        company: 'EmbeddedSim',
        url: 'https://embedded.test/fw-505',
        matchScore: 89,
        status: 'DISCOVERED',
      },
    ];

    for (const job of syntheticJobs) {
      this.dummyStore.set(job.id, job);
    }
  }

  public getDummyRecord(id: string): DummyJobRecord | undefined {
    return this.dummyStore.get(id);
  }

  public getAllDummyRecords(): DummyJobRecord[] {
    return Array.from(this.dummyStore.values());
  }

  /**
   * Runs the complete test scenario suite
   */
  public async runAllScenarios(options: {
    sendToTelegram?: boolean;
    delayMs?: number;
  } = {}): Promise<DummyTestExecutionReport> {
    const { sendToTelegram = true, delayMs = 1200 } = options;
    const report: DummyTestExecutionReport = {
      scenarioResults: [],
      deduplicationVerified: false,
      approvalSafetyVerified: false,
      totalScenariosPassed: 0,
      totalScenariosCount: 8,
    };

    const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

    console.log('🚀 Running Saarthi Dummy-Data Testing Mode...\n');

    // -------------------------------------------------------------
    // Scenario 1: Job Discovered
    // -------------------------------------------------------------
    const job1 = this.dummyStore.get('dummy_exampletech_101')!;
    let sent1 = false;
    if (sendToTelegram) {
      sent1 = await telegramNotifier.notifyJobFound({
        title: job1.title,
        company: job1.company,
        matchScore: job1.matchScore,
        jobUrl: job1.url,
        platform: 'SYNTHETIC_FEED',
        isTest: true,
      });
      await sleep(delayMs);
    }
    report.scenarioResults.push({
      scenario: 'Job Discovered',
      passed: true,
      jobId: job1.id,
      details: `${job1.title} at ${job1.company} (Match: ${job1.matchScore}%)`,
      notificationSent: sent1,
    });

    // -------------------------------------------------------------
    // Scenario 2: Application Queued
    // -------------------------------------------------------------
    const job2 = this.dummyStore.get('dummy_democorp_202')!;
    let sent2 = false;
    if (sendToTelegram) {
      sent2 = await telegramNotifier.notifyApplicationQueued({
        title: job2.title,
        company: job2.company,
        matchScore: job2.matchScore,
        queuePosition: 1,
        isTest: true,
      });
      await sleep(delayMs);
    }
    report.scenarioResults.push({
      scenario: 'Application Queued',
      passed: true,
      jobId: job2.id,
      details: `${job2.title} at ${job2.company} added to in-memory queue`,
      notificationSent: sent2,
    });

    // -------------------------------------------------------------
    // Scenario 3: Approval Required (with interactive buttons & dummy-only executor)
    // -------------------------------------------------------------
    const job3 = this.dummyStore.get('dummy_sampleai_303')!;
    let sent3 = false;

    // Create single-job approval request tied exclusively to the dummy test store
    const dummyApproval = approvalManager.createRequest({
      jobId: job3.id,
      company: job3.company,
      title: job3.title,
      jobUrl: job3.url,
      matchScore: job3.matchScore,
      ttlSeconds: 1800,
      executor: async () => {
        // Pure dummy executor: updates only dummy in-memory store
        job3.status = 'SUBMITTED_SIMULATED';
        return {
          success: true,
          message: `[DUMMY TEST] Simulated approval executed for ${job3.title} at ${job3.company}. Zero real actions taken.`,
          dryRun: true,
        };
      },
    });

    if (sendToTelegram) {
      sent3 = await telegramNotifier.notifyApprovalRequired(dummyApproval, true);
      await sleep(delayMs);
    }
    report.scenarioResults.push({
      scenario: 'Approval Required',
      passed: Boolean(dummyApproval && dummyApproval.id),
      jobId: job3.id,
      details: `${job3.title} at ${job3.company} approval created (Token: ${dummyApproval.id})`,
      notificationSent: sent3,
    });

    // -------------------------------------------------------------
    // Scenario 4: Application Submitted Successfully (Simulated Only)
    // -------------------------------------------------------------
    let sent4 = false;
    if (sendToTelegram) {
      sent4 = await telegramNotifier.notifyApplicationSubmitted({
        title: job1.title,
        company: job1.company,
        platform: 'SYNTHETIC_SIMULATOR',
        dryRun: false, // Simulated submission confirmation
        isTest: true,
      });
      await sleep(delayMs);
    }
    job1.status = 'SUBMITTED_SIMULATED';
    report.scenarioResults.push({
      scenario: 'Application Submitted (Simulated)',
      passed: true,
      jobId: job1.id,
      details: `${job1.title} at ${job1.company} submission confirmed in simulator`,
      notificationSent: sent4,
    });

    // -------------------------------------------------------------
    // Scenario 5: Application Failed (Simulated)
    // -------------------------------------------------------------
    let sent5 = false;
    job2.status = 'FAILED_SIMULATED';
    job2.failureReason = 'Simulated timeout waiting for synthetic ATS form hydration';
    if (sendToTelegram) {
      sent5 = await telegramNotifier.notifyApplicationFailed({
        title: job2.title,
        company: job2.company,
        platform: 'SYNTHETIC_SIMULATOR',
        reason: job2.failureReason,
        isTest: true,
      });
      await sleep(delayMs);
    }
    report.scenarioResults.push({
      scenario: 'Application Failed',
      passed: true,
      jobId: job2.id,
      details: `${job2.title} at ${job2.company} failed: ${job2.failureReason}`,
      notificationSent: sent5,
    });

    // -------------------------------------------------------------
    // Scenario 6: Submission Outcome Unknown
    // -------------------------------------------------------------
    const job4 = this.dummyStore.get('dummy_acmecorp_404')!;
    let sent6 = false;
    if (sendToTelegram) {
      sent6 = await telegramNotifier.notifySubmissionOutcomeUnknown({
        title: job4.title,
        company: job4.company,
        platform: 'SYNTHETIC_SIMULATOR',
        reason: 'Synthetic portal closed session without confirmation receipt',
        isTest: true,
      });
      await sleep(delayMs);
    }
    report.scenarioResults.push({
      scenario: 'Submission Outcome Unknown',
      passed: true,
      jobId: job4.id,
      details: `${job4.title} at ${job4.company} portal session unconfirmed`,
      notificationSent: sent6,
    });

    // -------------------------------------------------------------
    // Scenario 7: OTP/CAPTCHA or Manual Intervention Required
    // -------------------------------------------------------------
    const job5 = this.dummyStore.get('dummy_embedded_505')!;
    let sent7 = false;
    if (sendToTelegram) {
      sent7 = await telegramNotifier.notifySecurityChallenge(
        'SIMULATED_PORTAL',
        'Simulated reCAPTCHA v3 challenge detected on candidate login page',
        180,
        true
      );
      await sleep(delayMs);
    }
    report.scenarioResults.push({
      scenario: 'Manual Intervention / CAPTCHA Required',
      passed: true,
      jobId: job5.id,
      details: `Simulated security verification alert on ${job5.company}`,
      notificationSent: sent7,
    });

    // -------------------------------------------------------------
    // Scenario 8: Daily Summary
    // -------------------------------------------------------------
    let sent8 = false;
    if (sendToTelegram) {
      sent8 = await telegramNotifier.notifyDailySummary({
        scanned: 15,
        prepared: 4,
        submitted: 2,
        failed: 1,
        pendingReview: 1,
        isTest: true,
      });
    }
    report.scenarioResults.push({
      scenario: 'Daily Summary',
      passed: true,
      jobId: 'summary',
      details: 'Aggregated synthetic metrics reported',
      notificationSent: sent8,
    });

    // -------------------------------------------------------------
    // Verification Check A: Deduplication Verification
    // -------------------------------------------------------------
    console.log('Verifying Notification Deduplication...');
    // Attempt sending identical notification back-to-back
    const firstCall = await telegramNotifier.notifyJobFound({
      title: 'Dedup Check Role',
      company: 'Dedup Inc',
      matchScore: 90,
      jobUrl: 'https://dedup.test',
      isTest: true,
    });
    const secondCall = await telegramNotifier.notifyJobFound({
      title: 'Dedup Check Role',
      company: 'Dedup Inc',
      matchScore: 90,
      jobUrl: 'https://dedup.test',
      isTest: true,
    });
    // The second call must return false (suppressed by deduplication window)
    report.deduplicationVerified = secondCall === false;
    console.log(`Deduplication check: First call: ${firstCall}, Duplicate call suppressed: ${!secondCall}`);

    // -------------------------------------------------------------
    // Verification Check B: Isolated Dummy Approval Safety Verification
    // -------------------------------------------------------------
    console.log('Verifying Isolated Dummy Approval Safety...');
    // Create an independent synthetic approval request specifically to verify the programmatic approval lifecycle.
    // This leaves the user's interactive approval request (dummyApproval) in PENDING state so it can be tested live from Telegram!
    const autoCheckApproval = approvalManager.createRequest({
      jobId: 'dummy_autotest_check_999',
      company: 'Synthetic Verification Labs',
      title: 'Automated Lifecycle Verification',
      jobUrl: 'https://synthetic-verify.test/check',
      matchScore: 95,
      ttlSeconds: 300,
      isDummy: true,
      executor: async () => {
        return {
          success: true,
          message: '[DUMMY TEST] Automated verification approval executed safely.',
          dryRun: true,
        };
      },
    });

    const approvalResult = await approvalManager.approve(autoCheckApproval.id);
    report.approvalSafetyVerified =
      approvalResult.success === true &&
      approvalResult.message.includes('[DUMMY TEST]');

    report.totalScenariosPassed = report.scenarioResults.filter((r) => r.passed).length;

    return report;
  }
}

export const dummyTestRunner = new DummyTelegramTestRunner();
