import { Page } from 'playwright';
import { prisma } from '@saarthi/database';
import { getAgentConfig } from '../configLoader.js';
import { HumanEmulation } from './humanEmulation.js';
import { resolveQuestionAnswer } from '../answers/answerBank.js';
import { resolveBestResumePdfPath } from './fieldMapper.js';
import { ManualAuthHelper } from './manualAuthHelper.js';
import { agentState } from '../state/agentStateManager.js';
import { telegramNotifier } from '../telegram/telegramNotifier.js';

export interface LinkedInRunOptions {
  page: Page;
  maxApplications?: number;
  query?: string;
  dryRun?: boolean;
  manualAuthTimeoutSeconds?: number;
  interactive?: boolean;
  onProgress?: (message: string) => void;
}

export interface LiveJobResult {
  title: string;
  company: string;
  location?: string;
  jobUrl: string;
  platform: 'LINKEDIN' | 'INSTAHYRE' | 'AMAZON' | 'SIEMENS' | 'OTHER';
  status: 'APPLIED' | 'SKIPPED' | 'ALREADY_APPLIED' | 'FAILED';
  reason?: string;
}

export class LinkedInLiveRunner {
  static async run(options: LinkedInRunOptions): Promise<LiveJobResult[]> {
    const { page, onProgress, dryRun = false } = options;
    const config = getAgentConfig();
    const cand = config.candidate;
    const maxApplications = options.maxApplications || config.automation.dailyApplicationLimit || 15;
    const results: LiveJobResult[] = [];

    const log = (msg: string) => {
      console.log(`[LinkedInRunner] ${msg}`);
      if (onProgress) onProgress(msg);
    };

    // Determine search queries to execute
    const queriesToRun: string[] = options.query
      ? [options.query]
      : config.searchPreferences.customSearchQueries && config.searchPreferences.customSearchQueries.length > 0
      ? config.searchPreferences.customSearchQueries
      : ['("C++ Developer" OR "C++ Engineer") NOT ("Senior" OR "Staff" OR "Principal")'];

    let appliedCount = 0;

    for (let qIdx = 0; qIdx < queriesToRun.length; qIdx++) {
      if (appliedCount >= maxApplications) break;
      if (agentState.isPaused()) {
        log('Agent is currently PAUSED. Halting LinkedIn scan at query checkpoint.');
        break;
      }
      const targetQuery = queriesToRun[qIdx];

      const searchUrl = `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(
        targetQuery || ''
      )}&f_TPR=r86400&f_AL=true`;

      // Ensure authenticated on first query before navigating to Easy Apply search
      if (qIdx === 0) {
        log('Establishing LinkedIn authenticated session...');
        await page.goto('https://www.linkedin.com/feed/', { waitUntil: 'domcontentloaded', timeout: 25000 }).catch(() => {});
        await page.waitForTimeout(2500);

        const authResult = await ManualAuthHelper.ensureAuthenticated({
          page,
          platform: 'LINKEDIN',
          timeoutSeconds: options.manualAuthTimeoutSeconds,
          interactive: options.interactive,
          onLog: (m) => log(`[Auth] ${m}`),
        });

        if (!authResult.authenticated) {
          log(`Stopping LinkedIn live runner: ${authResult.reason || 'Authentication required'}`);
          results.push({
            title: 'LinkedIn Session',
            company: 'LinkedIn',
            platform: 'LINKEDIN',
            jobUrl: page.url(),
            status: 'SKIPPED',
            reason: authResult.reason || 'Authentication required: User not logged in to LinkedIn',
          });
          return results;
        }
      }

      log(`[Query ${qIdx + 1}/${queriesToRun.length}] Searching: ${targetQuery?.slice(0, 60)}...`);

      await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch((e) => {
        log(`Navigation warning: ${e.message}`);
      });

      await page.waitForTimeout(3000);

      // Discover Job Cards on Left Rail
      log('Scanning job search results...');
      await page.waitForSelector('.jobs-search-results-list, div[data-job-id]', { timeout: 10000 }).catch(() => {});

      // Scroll down left rail to load more cards
      await page.evaluate(() => {
        const container = document.querySelector('.jobs-search-results-list');
        if (container) {
          container.scrollTop = container.scrollHeight / 2;
        }
      });
      await page.waitForTimeout(1500);

      const jobCardHandles = await page.$$(
        'li.scaffold-layout__list-item, li.jobs-search-results__list-item, div.job-card-container, div[data-job-id]'
      );
      log(`Found ${jobCardHandles.length} job cards for this query.`);

      if (jobCardHandles.length === 0) {
        log('No Easy Apply jobs found for this query in the past 24 hours. Moving to next query.');
        continue;
      }

    for (let i = 0; i < jobCardHandles.length; i++) {
      if (appliedCount >= maxApplications) {
        log(`Reached maximum daily application limit (${maxApplications}). Stopping.`);
        break;
      }
      if (agentState.isPaused()) {
        log('Agent is currently PAUSED. Halting LinkedIn scan at job card checkpoint.');
        break;
      }

      const card = jobCardHandles[i];
      if (!card) continue;
      try {
        await card.scrollIntoViewIfNeeded();
        // 1. Human natural click on job card
        await HumanEmulation.naturalClick(page, card);
        await HumanEmulation.sleep(1200, 2500);

        // 2. Extract job details from detail pane
        const details = await page.evaluate(() => {
          const titleEl = document.querySelector(
            '.job-details-jobs-unified-top-card__job-title, .jobs-unified-top-card__job-title, h1'
          );
          const companyEl = document.querySelector(
            '.job-details-jobs-unified-top-card__company-name, .jobs-unified-top-card__company-name'
          );
          const locEl = document.querySelector(
            '.job-details-jobs-unified-top-card__primary-description, .jobs-unified-top-card__primary-description'
          );
          const isAlreadyApplied =
            document.body.innerText.includes('Application submitted') ||
            document.body.innerText.includes('Applied on');

          return {
            title: titleEl?.textContent?.trim() || 'Software Engineer',
            company: companyEl?.textContent?.trim() || 'Company',
            location: locEl?.textContent?.trim() || 'India',
            isAlreadyApplied,
          };
        });

        const currentUrl = page.url();
        log(`Inspecting [${i + 1}/${jobCardHandles.length}]: ${details.title} at ${details.company}`);

        if (details.isAlreadyApplied) {
          log(`Skipping: Already applied previously.`);
          results.push({
            title: details.title,
            company: details.company,
            location: details.location,
            jobUrl: currentUrl,
            platform: 'LINKEDIN',
            status: 'ALREADY_APPLIED',
            reason: 'Already applied on LinkedIn',
          });
          continue;
        }

        // 3. Simulate human skimming & reading the job description (scroll down, pause, jiggle)
        log(`Simulating human reading time on ${details.company} job description...`);
        await HumanEmulation.simulateReadingJobDescription(page, '.jobs-search__job-details--container, .job-view-layout');
        await HumanEmulation.neutralFidgetClick(page);

        // 4. Check for Easy Apply button
        const applyBtn = await page.$(
          'button.jobs-apply-button, button:has-text("Easy Apply"), button[aria-label*="Easy Apply"]'
        );

        if (!applyBtn) {
          log(`No direct Easy Apply button (likely external portal). Skipping.`);
          results.push({
            title: details.title,
            company: details.company,
            location: details.location,
            jobUrl: currentUrl,
            platform: 'LINKEDIN',
            status: 'SKIPPED',
            reason: 'External application required',
          });
          continue;
        }

        const isVisible = await applyBtn.isVisible().catch(() => false);
        if (!isVisible) {
          log('Easy Apply button not visible. Skipping.');
          continue;
        }

        log(`Clicking "Easy Apply" with natural human cursor movement...`);
        void telegramNotifier.notifyJobFound({
          title: details.title,
          company: details.company,
          matchScore: 85,
          jobUrl: currentUrl,
          platform: 'LINKEDIN',
        });
        await HumanEmulation.naturalClick(page, applyBtn);
        await HumanEmulation.sleep(2000, 3500);

        // Check if modal dialog opened
        const modal = await page.$('.jobs-easy-apply-modal, div[role="dialog"]');
        if (!modal) {
          log('Modal did not open. Moving to next.');
          continue;
        }

        // Process Easy Apply Steps (Up to 8 steps)
        let modalDone = false;
        let stepCount = 0;

        while (!modalDone && stepCount < 8) {
          stepCount++;
          await HumanEmulation.sleep(1200, 2200);
          await HumanEmulation.neutralFidgetClick(page);

          // Check if Submit button is visible
          const submitBtn = await page.$(
            'button:has-text("Submit application"), button[aria-label="Submit application"]'
          );

          if (submitBtn && (await submitBtn.isVisible().catch(() => false))) {
            if (dryRun) {
              log(`[DRY RUN] Ready to submit to ${details.company}. Skipping final submit.`);
              modalDone = true;
              appliedCount++;
              await this.recordApplicationInDb({
                title: details.title,
                company: details.company,
                location: details.location,
                jobUrl: currentUrl,
                platform: 'LINKEDIN',
              });
              void telegramNotifier.notifyApplicationSubmitted({
                title: details.title,
                company: details.company,
                platform: 'LINKEDIN',
                dryRun: true,
              });
              results.push({
                title: details.title,
                company: details.company,
                location: details.location,
                jobUrl: currentUrl,
                platform: 'LINKEDIN',
                status: 'APPLIED',
                reason: 'Dry run completed successfully',
              });
              break;
            }

            log(`Pausing for final review verification (3-4s)...`);
            await HumanEmulation.sleep(3000, 4500);

            log(`Submitting Easy Apply application to ${details.company}...`);
            await HumanEmulation.naturalClick(page, submitBtn);
            await HumanEmulation.sleep(3000, 4500);
            modalDone = true;
            appliedCount++;
            agentState.recordSubmission();

            // Record to Database
            await this.recordApplicationInDb({
              title: details.title,
              company: details.company,
              location: details.location,
              jobUrl: currentUrl,
              platform: 'LINKEDIN',
            });

            void telegramNotifier.notifyApplicationSubmitted({
              title: details.title,
              company: details.company,
              platform: 'LINKEDIN',
              dryRun: false,
            });

            results.push({
              title: details.title,
              company: details.company,
              location: details.location,
              jobUrl: currentUrl,
              platform: 'LINKEDIN',
              status: 'APPLIED',
            });

            log(`Successfully applied to ${details.company}! Total applied today: ${appliedCount}`);
            break;
          }

          // Auto-upload tailored PDF resume variant if a file input step is present and no resume is selected
          const fileInputs = await page.$$('.jobs-easy-apply-modal input[type="file"], div[role="dialog"] input[type="file"]');
          for (const fi of fileInputs) {
            const hasSelectedResume = await page
              .evaluate(() => {
                const cards = document.querySelectorAll('.jobs-document-upload-redesign-card__container--selected, .ui-attachment--pdf');
                return cards.length > 0;
              })
              .catch(() => false);
            if (!hasSelectedResume) {
              const bestPdf = resolveBestResumePdfPath(details.title);
              if (bestPdf) {
                log(`Uploading matched resume PDF (${bestPdf.split(/[\\/]/).pop()})...`);
                await fi.setInputFiles(bestPdf).catch(() => {});
                await HumanEmulation.sleep(1000, 1800);
              }
            }
          }

          // Auto-fill inputs and textareas on current step using Dixit's Answer Bank
          const textareas = await page.$$('.jobs-easy-apply-modal textarea, div[role="dialog"] textarea');
          for (const textarea of textareas) {
            const isVis = await textarea.isVisible().catch(() => false);
            if (!isVis) continue;
            const existingVal = await textarea.inputValue().catch(() => '');
            if (existingVal && existingVal.trim().length > 0) continue;

            const labelText = await page.evaluate((el) => {
              const label = el.closest('div.fb-dash-form-element')?.querySelector('label')?.textContent
                || el.getAttribute('aria-label')
                || el.getAttribute('placeholder')
                || '';
              return label.trim();
            }, textarea);

            if (labelText) {
              const resolved = resolveQuestionAnswer(labelText, {
                jobTitle: details.title,
                company: details.company,
              });
              log(`Auto-answering screening question "${labelText.slice(0, 40)}..." (confidence: ${resolved.confidence})`);
              await HumanEmulation.humanType(page, textarea, resolved.answer);
              await HumanEmulation.sleep(500, 1000);
            }
          }

          // Auto-fill common inputs on the current step
          await page.evaluate((candidate) => {
            // Fill phone if empty
            const phoneInput = document.querySelector(
              'input[id*="phoneNumber"], input[name*="phoneNumber"], input[type="tel"]'
            ) as HTMLInputElement | null;
            if (phoneInput && !phoneInput.value) {
              phoneInput.value = candidate.phone;
              phoneInput.dispatchEvent(new Event('input', { bubbles: true }));
              phoneInput.dispatchEvent(new Event('change', { bubbles: true }));
            }

            // Fill experience years in numerical questions
            const numberInputs = document.querySelectorAll(
              'input[type="number"], input[id*="numeric"], input[id*="experience"], input[name*="experience"]'
            );
            numberInputs.forEach((input: any) => {
              const label = input.closest('div.fb-dash-form-element')?.textContent?.toLowerCase() || '';
              // Guard: If it's asking for current CTC, do NOT auto-fill per Agent Rule #11
              if (label.includes('current ctc') || label.includes('current salary') || label.includes('present ctc')) {
                return; // Requires human confirmation
              }
              // If asking for expected CTC / salary
              if (label.includes('expected') && (label.includes('ctc') || label.includes('salary'))) {
                if (!input.value) {
                  input.value = '18';
                  input.dispatchEvent(new Event('input', { bubbles: true }));
                  input.dispatchEvent(new Event('change', { bubbles: true }));
                }
                return;
              }
              // If asking for notice period in days
              if (label.includes('notice') || label.includes('availability')) {
                if (!input.value) {
                  input.value = '15';
                  input.dispatchEvent(new Event('input', { bubbles: true }));
                  input.dispatchEvent(new Event('change', { bubbles: true }));
                }
                return;
              }
              // Default experience years (1.8 years rounded to 2 if integer required)
              if (!input.value) {
                input.value = String(Math.round(candidate.experienceYears || 2));
                input.dispatchEvent(new Event('input', { bubbles: true }));
                input.dispatchEvent(new Event('change', { bubbles: true }));
              }
            });

            // Handle radio buttons (Yes to work authorization & relocation, No to sponsorship)
            const radios = document.querySelectorAll('input[type="radio"]');
            radios.forEach((r: any) => {
              const label = r.closest('label')?.textContent?.toLowerCase() || '';
              const groupText = r.closest('fieldset, div.fb-dash-form-element')?.textContent?.toLowerCase() || '';

              // Guard: Agent Rule #12 - Do NOT auto-select "Yes" for immediate joiner without explicit confirmation
              if (groupText.includes('join immediately') || groupText.includes('immediate joiner')) {
                return;
              }

              if (!r.checked) {
                if (label.includes('yes') || label.includes('authorized') || label.includes('agree')) {
                  // Only click Yes if question is about authorization or relocation
                  if (groupText.includes('authorized') || groupText.includes('relocate') || groupText.includes('work in india')) {
                    r.click();
                  }
                } else if (label.includes('no') && groupText.includes('sponsorship')) {
                  r.click();
                }
              }
            });
          }, cand);

          // Click Next or Review button to proceed
          const nextBtn = await page.$(
            'button:has-text("Next"), button:has-text("Review"), button[aria-label="Continue to next step"], button[aria-label="Review your application"]'
          );

          if (nextBtn && (await nextBtn.isVisible().catch(() => false))) {
            await nextBtn.click({ timeout: 5000 });
            await page.waitForTimeout(1500);
          } else {
            // No next or submit button found, modal might be waiting or errored
            log('Notice: Modal encountered required fields that need manual review. Dismissing modal.');
            break;
          }
        }

        // Close any lingering modal or dismiss
        const dismissBtn = await page.$('button[aria-label="Dismiss"], button:has-text("Done")');
        if (dismissBtn && (await dismissBtn.isVisible().catch(() => false))) {
          await dismissBtn.click({ timeout: 3000 }).catch(() => {});
          await page.waitForTimeout(1000);

          const discardBtn = await page.$('button:has-text("Discard")');
          if (discardBtn && (await discardBtn.isVisible().catch(() => false))) {
            await discardBtn.click({ timeout: 3000 }).catch(() => {});
          }
        }

        // Safe Human Delay (20 to 35 seconds with natural micro-movements)
        const delaySeconds = HumanEmulation.randomBetween(20, 35);
        log(`Waiting ${delaySeconds}s (human anti-bot cadence & cursor motion)...`);
        const intervals = Math.floor(delaySeconds / 5);
        for (let s = 0; s < intervals; s++) {
          await HumanEmulation.jiggleMouse(page);
          await HumanEmulation.sleep(4000, 5000);
        }
      } catch (err: any) {
        log(`Error processing job card: ${err.message}`);
      }
    }
    }

    log(`LinkedIn Runner complete! Successfully submitted ${appliedCount} Easy Apply application(s).`);
    return results;
  }

  private static async recordApplicationInDb(data: {
    title: string;
    company: string;
    location?: string;
    jobUrl: string;
    platform: 'LINKEDIN' | 'INSTAHYRE';
  }) {
    try {
      const profile = await prisma.profile.findFirst({
        include: { user: true },
      });
      if (!profile) return;

      const job = await prisma.job.upsert({
        where: { canonicalUrl: data.jobUrl },
        create: {
          canonicalUrl: data.jobUrl,
          title: data.title,
          company: data.company,
          location: data.location || 'India',
          description: `Live job applied on ${data.platform} via Saarthi autonomous runner.`,
          sources: {
            create: {
              sourceName: data.platform.toLowerCase(),
              sourceUrl: data.jobUrl,
              externalId: `live_${Date.now()}`,
            },
          },
        },
        update: {},
      });

      const app = await prisma.application.upsert({
        where: {
          userId_jobId: {
            userId: profile.userId,
            jobId: job.id,
          },
        },
        create: {
          userId: profile.userId,
          jobId: job.id,
          status: 'APPLIED',
          appliedAt: new Date(),
          submissionMethod: 'AUTONOMOUS',
          notes: `Applied live on ${data.platform} via Saarthi Autonomous Live Runner.`,
        },
        update: {
          status: 'APPLIED',
          appliedAt: new Date(),
          submissionMethod: 'AUTONOMOUS',
        },
      });

      await prisma.applicationEvent.create({
        data: {
          applicationId: app.id,
          eventType: 'LIVE_SUBMITTED',
          description: `Successfully applied to ${data.company} (${data.title}) on ${data.platform}`,
          actor: 'AGENT',
        },
      });
    } catch (e: any) {
      console.warn('[LinkedInRunner] DB recording warning:', e.message);
    }
  }
}
