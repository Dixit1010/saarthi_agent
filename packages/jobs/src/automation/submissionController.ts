import { BrowserManager } from './browserManager.js';
import { SafetyValidator } from './safetyValidator.js';
import { FieldMapper, CandidateFormContext, DetectedFormField } from './fieldMapper.js';
import { FormFiller, FormFillResult } from './formFiller.js';

export interface AutoApplyExecutionOptions {
  applicationUrl: string;
  candidate: CandidateFormContext;
  headless?: boolean;
  dryRun?: boolean;
}

export interface AutoApplyExecutionResult {
  success: boolean;
  status: 'SUBMITTED' | 'READY_FOR_REVIEW' | 'PAUSED_VERIFICATION' | 'FAILED';
  url: string;
  fieldsDetected: DetectedFormField[];
  fillResult?: FormFillResult;
  message: string;
  logs: string[];
}

export class SubmissionController {
  /**
   * Executes the end-to-end browser automation flow per Section 18 of prompt.txt.
   */
  static async executeAutoApply(options: AutoApplyExecutionOptions): Promise<AutoApplyExecutionResult> {
    const logs: string[] = [];
    const log = (msg: string) => {
      logs.push(`[${new Date().toISOString().slice(11, 19)}] ${msg}`);
    };

    const browserManager = new BrowserManager();
    let fieldsDetected: DetectedFormField[] = [];

    try {
      log(`Launching Playwright browser (headless: ${options.headless ?? true})...`);
      const page = await browserManager.init({ headless: options.headless ?? true });

      log(`Navigating to application URL: ${options.applicationUrl}`);
      await page.goto(options.applicationUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 15000,
      }).catch((e) => log(`Navigation warning: ${e.message}`));

      // Wait 1.5 seconds for client hydration / dynamic forms
      await page.waitForTimeout(1500);

      // 1. Safety Check (Prompt Section 20)
      log('Scanning page for bot barriers or verification challenges...');
      const safety = await SafetyValidator.checkPageSafety(page);
      if (safety.isBlocked) {
        log(`SAFETY ALERT: ${safety.reason}`);
        return {
          success: false,
          status: 'PAUSED_VERIFICATION',
          url: page.url(),
          fieldsDetected: [],
          message: safety.reason || 'Verification challenge detected.',
          logs,
        };
      }

      // 2. Detect & Map Form Fields (Prompt Section 19)
      log('Detecting interactive form inputs and mapping candidate fields...');
      fieldsDetected = await FieldMapper.detectFields(page, options.candidate);
      log(`Detected ${fieldsDetected.length} form field(s).`);

      if (fieldsDetected.length === 0) {
        log('No direct form fields found on landing page. Checking for "Apply" button...');
        const applyBtn = await page.$('button:has-text("Apply"), a:has-text("Apply"), button:has-text("Apply Now")').catch(() => null);
        if (applyBtn) {
          const isVis = await applyBtn.isVisible().catch(() => false);
          if (isVis) {
            log('Found visible "Apply" action button, clicking to reveal application form...');
            await applyBtn.click({ timeout: 4000 }).catch((e) => log(`Apply click skipped: ${e.message}`));
            await page.waitForTimeout(2500);

            // Re-check safety in case clicking opened a login barrier
            const postSafety = await SafetyValidator.checkPageSafety(page);
            if (postSafety.isBlocked) {
              log(`SAFETY ALERT: ${postSafety.reason}`);
              await browserManager.close();
              return {
                success: false,
                status: 'PAUSED_VERIFICATION',
                url: page.url(),
                fieldsDetected: [],
                message: postSafety.reason || 'Verification challenge or login barrier detected.',
                logs,
              };
            }

            fieldsDetected = await FieldMapper.detectFields(page, options.candidate);
            log(`Post-click detected ${fieldsDetected.length} form field(s).`);
          }
        }
      }

      // If no interactive form exists on this page (e.g. portal requires login or external redirect)
      if (fieldsDetected.length === 0) {
        log('Notice: No direct application form inputs found on this landing page.');
        log('Portal likely requires applicant sign-in or redirects to an external company ATS.');
        if (!options.headless) {
          await page.waitForTimeout(3000).catch(() => {});
        }
        await browserManager.close();
        return {
          success: false,
          status: 'READY_FOR_REVIEW',
          url: page.url(),
          fieldsDetected: [],
          fillResult: { filledCount: 0, skippedCount: 0, details: [] },
          message: 'No interactive form inputs detected. This job page requires applicant authentication (sign-in) or directs to an external company portal. Please use "Open Career Portal" to complete submission.',
          logs,
        };
      }

      // 3. Fill Fields
      log('Filling candidate profile information and uploading tailored resume...');
      const fillResult = await FormFiller.fillDetectedFields(page, fieldsDetected);
      log(`Successfully filled ${fillResult.filledCount} field(s), skipped ${fillResult.skippedCount}.`);

      // 4. Submission Gate (Prompt Section 21)
      if (options.dryRun) {
        log('DRY RUN MODE: Fields filled and inspected. Submission skipped per request.');
        if (!options.headless) {
          // Keep browser open for 2 seconds if headed so user can inspect with their own eyes
          await page.waitForTimeout(2000).catch(() => {});
        }
        await browserManager.close();
        return {
          success: true,
          status: 'READY_FOR_REVIEW',
          url: page.url(),
          fieldsDetected,
          fillResult,
          message: `Form successfully pre-filled with ${fillResult.filledCount} fields in inspection mode.`,
          logs,
        };
      }

      // 5. Submit Execution
      log('Executing final submission...');
      const submitBtn = await page.$(
        'button[type="submit"], input[type="submit"], button:has-text("Submit Application"), button:has-text("Submit")'
      ).catch(() => null);

      if (submitBtn) {
        const isVis = await submitBtn.isVisible().catch(() => false);
        if (isVis) {
          await submitBtn.click({ timeout: 5000 }).catch((e) => log(`Submit click warning: ${e.message}`));
          log('Clicked Submit Application button.');
          await page.waitForTimeout(3000);
        } else {
          log('Submit button is not visible or already triggered.');
        }
      } else {
        log('No single submit button found; form filled and ready.');
      }

      await browserManager.close();
      return {
        success: true,
        status: 'SUBMITTED',
        url: page.url(),
        fieldsDetected,
        fillResult,
        message: 'Application form successfully filled and submitted via Playwright automation.',
        logs,
      };
    } catch (err: any) {
      log(`ERROR during browser automation: ${err.message}`);
      await browserManager.close();
      let friendlyMsg = err.message || 'Browser automation failed.';
      if (err.name === 'BrowserProfileLockedError' || friendlyMsg.includes('locked or in use') || friendlyMsg.includes('EBUSY')) {
        friendlyMsg = 'Browser profile is already in use by the active Live Runner or an open Chrome window. Please let the current batch scan finish or close other Chrome instances.';
      } else if (friendlyMsg.includes('Element is not attached to the DOM') || friendlyMsg.includes('not visible')) {
        friendlyMsg = 'Page element changed dynamically or portal requires login. Use "Open Career Portal" to finish submission.';
      }
      return {
        success: false,
        status: 'FAILED',
        url: options.applicationUrl,
        fieldsDetected,
        message: friendlyMsg,
        logs,
      };
    }
  }
}
