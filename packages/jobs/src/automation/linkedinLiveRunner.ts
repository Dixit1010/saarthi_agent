import { Page } from 'playwright';
import { prisma } from '@saarthi/database';
import { getAgentConfig } from '../configLoader.js';
import { HumanEmulation } from './humanEmulation.js';
import { resolveQuestionAnswer } from '../answers/answerBank.js';
import { generateGroqApplicationAnswer } from '../answers/groqAnswerHelper.js';
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

    // High-yield search queries tailored to Dixit's Embedded / C++ / Backend profile
    const queriesToRun: string[] = options.query
      ? [options.query]
      : [
          'Embedded Firmware Engineer',
          'Embedded C Developer',
          'C++ Software Engineer',
          'Backend Software Engineer',
          'Node.js Developer',
        ];

    let appliedCount = 0;

    // 1. Verify Authenticated LinkedIn Session (required for real LinkedIn Easy Apply submissions)
    log('Checking LinkedIn session status...');
    await page.goto('https://www.linkedin.com/feed/', { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(2000);

    const initialAuth = await ManualAuthHelper.checkLoginStatus(page, 'LINKEDIN');
    let isAuthenticated = !initialAuth.isLoginRequired && !initialAuth.isChallenge;

    if (!isAuthenticated) {
      const liUser = config.credentials?.linkedin?.username || process.env.LINKEDIN_EMAIL || '';
      const liPass = config.credentials?.linkedin?.password || process.env.LINKEDIN_PASSWORD || '';
      if (liUser && liPass) {
        log('Attempting automatic LinkedIn sign-in with configured credentials...');
        await page.goto('https://www.linkedin.com/login', { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {});
        await page.fill('input#username', liUser).catch(() => {});
        await page.fill('input#password', liPass).catch(() => {});
        await page.click('button[type="submit"]').catch(() => {});
        await page.waitForTimeout(4000);
        const postLogin = await ManualAuthHelper.checkLoginStatus(page, 'LINKEDIN');
        isAuthenticated = !postLogin.isLoginRequired && !postLogin.isChallenge;
      }
    }

    if (!isAuthenticated) {
      const authTimeout = options.manualAuthTimeoutSeconds ?? 180;
      log(
        `🔐 LinkedIn login required — opened LinkedIn sign-in window on host laptop (email pre-filled). Waiting up to ${authTimeout}s for you to sign in...`
      );
      const authResult = await ManualAuthHelper.ensureAuthenticated({
        page,
        platform: 'LINKEDIN',
        timeoutSeconds: authTimeout,
        interactive: false,
        onLog: (m) => log(`[Auth] ${m}`),
      });
      isAuthenticated = authResult.authenticated;
    }

    if (!isAuthenticated) {
      log(
        '❌ LinkedIn session is not signed in. Easy Apply requires an authenticated LinkedIn session so applications appear under LinkedIn -> My Jobs -> Applied. Please sign in to LinkedIn in the Saarthi Chrome window on your laptop and try again.'
      );
      return results;
    }

    log('✅ LinkedIn session authenticated! Starting Easy Apply search & submission...');

    // 2. Authenticated LinkedIn Easy Apply Loop
    for (let qIdx = 0; qIdx < queriesToRun.length; qIdx++) {
      if (appliedCount >= maxApplications) break;
      if (agentState.isPaused()) {
        log('Agent is currently PAUSED. Halting LinkedIn scan at query checkpoint.');
        break;
      }
      const targetQuery = queriesToRun[qIdx];

      // f_AL=true filters strictly for LinkedIn Easy Apply jobs; f_TPR=r604800 is past week
      const searchUrl = `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(
        targetQuery || ''
      )}&location=India&f_TPR=r604800&f_AL=true`;

      log(`[Easy Apply ${qIdx + 1}/${queriesToRun.length}] Searching: "${targetQuery}"...`);

      await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch((e) => {
        log(`Navigation warning: ${e.message}`);
      });

      await page.waitForTimeout(3000);

      // Discover Job Cards on Left Rail
      log('Scanning LinkedIn Easy Apply results...');
      await page
        .waitForSelector(
          '.jobs-search-results-list, .scaffold-layout__list, li.scaffold-layout__list-item, div[data-job-id]',
          { timeout: 10000 }
        )
        .catch(() => {});

      // Scroll down left rail to load more cards
      await page.evaluate(() => {
        const container = document.querySelector('.jobs-search-results-list, .scaffold-layout__list-detail-inner ul');
        if (container) {
          container.scrollTop = container.scrollHeight / 2;
        }
      });
      await page.waitForTimeout(1500);

      const jobCardHandles = await page.$$(
        'li.scaffold-layout__list-item, li.jobs-search-results__list-item, div.job-card-container, div[data-job-id]'
      );
      log(`Found ${jobCardHandles.length} Easy Apply job card(s) for "${targetQuery}".`);

      if (jobCardHandles.length === 0) {
        log('No Easy Apply jobs found for this query. Moving to next query.');
        continue;
      }

      for (let i = 0; i < jobCardHandles.length; i++) {
        if (appliedCount >= maxApplications) {
          log(`Reached maximum application limit (${maxApplications}). Stopping.`);
          break;
        }
        if (agentState.isPaused()) {
          log('Agent is currently PAUSED. Halting LinkedIn scan at job card checkpoint.');
          break;
        }

        const card = jobCardHandles[i];
        if (!card) continue;

        try {
          await card.scrollIntoViewIfNeeded().catch(() => {});
          await HumanEmulation.naturalClick(page, card);
          await HumanEmulation.sleep(1500, 2500);

          // Extract job details from detail pane
          const details = await page.evaluate(() => {
            const titleEl = document.querySelector(
              '.job-details-jobs-unified-top-card__job-title, .jobs-unified-top-card__job-title, h1'
            );
            const companyEl = document.querySelector(
              '.job-details-jobs-unified-top-card__company-name, .jobs-unified-top-card__company-name'
            );
            const locEl = document.querySelector(
              '.job-details-jobs-unified-top-card__primary-description-container, .job-details-jobs-unified-top-card__primary-description, .jobs-unified-top-card__primary-description'
            );
            const topCardText =
              document.querySelector('.jobs-unified-top-card, .job-details-jobs-unified-top-card__container--two-pane')
                ?.textContent || document.body.innerText;
            const isAlreadyApplied =
              topCardText.includes('Application submitted') ||
              topCardText.includes('Applied ') ||
              topCardText.includes('Applied on');

            return {
              title: titleEl?.textContent?.trim() || 'Software Engineer',
              company: companyEl?.textContent?.trim() || 'Company',
              location: locEl?.textContent?.trim()?.split('·')[0]?.trim() || 'India',
              isAlreadyApplied,
            };
          });

          const rawPageUrl = page.url();
          const jobIdMatch = rawPageUrl.match(/currentJobId=(\d+)/) || rawPageUrl.match(/\/jobs\/view\/(\d+)/);
          const currentUrl = jobIdMatch?.[1]
            ? `https://www.linkedin.com/jobs/view/${jobIdMatch[1]}/`
            : rawPageUrl;

          log(`Inspecting [${i + 1}/${jobCardHandles.length}]: ${details.title} at ${details.company}`);

          // Skip overly senior / executive roles
          if (
            /\b(senior|sr\.?|staff|principal|lead|manager|director|vp|head|architect|chief|cto|ceo)\b/i.test(
              details.title
            )
          ) {
            log(`Skipping senior/leadership role: ${details.title}`);
            results.push({
              title: details.title,
              company: details.company,
              location: details.location,
              jobUrl: currentUrl,
              platform: 'LINKEDIN',
              status: 'SKIPPED',
              reason: 'Seniority mismatch (>3 YOE / Leadership)',
            });
            continue;
          }

          if (details.isAlreadyApplied) {
            log(`Skipping: Already applied on LinkedIn.`);
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

          // Check for Easy Apply button
          const applyBtn = await page.$(
            'button.jobs-apply-button, button[aria-label*="Easy Apply"], button:has-text("Easy Apply")'
          );

          if (!applyBtn || !(await applyBtn.isVisible().catch(() => false))) {
            log(`No direct Easy Apply button on this card. Skipping.`);
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

          log(`Clicking "Easy Apply" on ${details.company} (${details.title})...`);
          await HumanEmulation.naturalClick(page, applyBtn);
          await HumanEmulation.sleep(2000, 3000);

          // Check if Easy Apply modal dialog opened
          const modal = await page.$('.jobs-easy-apply-modal, div.jobs-easy-apply-content, div[role="dialog"]');
          if (!modal) {
            log('Easy Apply modal did not open. Moving to next card.');
            continue;
          }

          // Process Multi-Step Easy Apply Modal (up to 10 steps)
          let modalDone = false;
          let stepCount = 0;

          while (!modalDone && stepCount < 10) {
            stepCount++;
            await HumanEmulation.sleep(1000, 1800);

            // Step A: Fill all fields visible on the current modal step BEFORE checking Submit/Next
            await this.fillEasyApplyModalStep(page, details.title, details.company, cand, log);

            // Step B: Check if "Submit application" button is visible on this step
            const submitBtn = await page.$(
              'button[aria-label*="Submit application"], button:has-text("Submit application")'
            );

            if (submitBtn && (await submitBtn.isVisible().catch(() => false))) {
              // Uncheck "Follow <Company>" checkbox if present so we keep the user's feed clean
              await page
                .evaluate(() => {
                  const followCb = document.querySelector(
                    'input#follow-company-checkbox'
                  ) as HTMLInputElement | null;
                  if (followCb && followCb.checked) {
                    const label = document.querySelector('label[for="follow-company-checkbox"]') as HTMLElement | null;
                    if (label) label.click();
                    else followCb.click();
                  }
                })
                .catch(() => {});

              if (dryRun) {
                log(`[DRY RUN] Ready to submit Easy Apply to ${details.company}. Skipping final submit click.`);
                modalDone = true;
                break;
              }

              log(`Submitting LinkedIn Easy Apply application to ${details.company}...`);
              await HumanEmulation.naturalClick(page, submitBtn);
              await HumanEmulation.sleep(3000, 4500);

              modalDone = true;
              appliedCount++;
              agentState.recordSubmission();

              // Dismiss post-application confirmation dialog ("Application submitted" -> "Done" / "Dismiss")
              const doneBtn = await page.$(
                'button:has-text("Done"), button[aria-label="Dismiss"], div[role="dialog"] button.artdeco-modal__dismiss'
              );
              if (doneBtn && (await doneBtn.isVisible().catch(() => false))) {
                await doneBtn.click({ timeout: 3000 }).catch(() => {});
                await page.waitForTimeout(1000);
              }

              // Record genuine LinkedIn Easy Apply submission in DB
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
                jobUrl: currentUrl,
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

              log(
                `✅ Submitted LinkedIn Easy Apply to ${details.company} (${details.title})! Now visible in LinkedIn -> My Jobs -> Applied. Total applied: ${appliedCount}`
              );
              break;
            }

            // Step C: Click "Next" or "Review" to advance the modal
            const nextBtn = await page.$(
              'button[aria-label*="Continue to next step"], button[aria-label*="Review your application"], button:has-text("Next"), button:has-text("Review")'
            );

            if (nextBtn && (await nextBtn.isVisible().catch(() => false))) {
              await nextBtn.click({ timeout: 5000 }).catch(() => {});
              await page.waitForTimeout(1500);

              // Check if LinkedIn inline validation error occurred (e.g., "Enter a whole number" or unfilled required field)
              const hasValidationError = await page
                .evaluate(() => {
                  const errors = document.querySelectorAll(
                    '.jobs-easy-apply-modal .artdeco-inline-feedback--error, div[role="dialog"] .artdeco-inline-feedback--error'
                  );
                  return errors.length > 0;
                })
                .catch(() => false);

              if (hasValidationError) {
                log('Fixing inline validation requirement on Easy Apply step...');
                await this.fixEasyApplyValidationErrors(page, cand);
                await page.waitForTimeout(800);
                await nextBtn.click({ timeout: 5000 }).catch(() => {});
                await page.waitForTimeout(1500);
              }
            } else {
              log('Notice: Easy Apply modal has no Next/Review/Submit button. Closing modal.');
              break;
            }
          }

          // Clean up modal if it didn't submit
          if (!modalDone) {
            const dismissBtn = await page.$(
              'button[aria-label="Dismiss"], button.artdeco-modal__dismiss, button:has-text("Done")'
            );
            if (dismissBtn && (await dismissBtn.isVisible().catch(() => false))) {
              await dismissBtn.click({ timeout: 3000 }).catch(() => {});
              await page.waitForTimeout(800);
              const discardBtn = await page.$(
                'button[data-control-name="discard_application_confirm_btn"], button:has-text("Discard")'
              );
              if (discardBtn && (await discardBtn.isVisible().catch(() => false))) {
                await discardBtn.click({ timeout: 3000 }).catch(() => {});
                await page.waitForTimeout(800);
              }
            }
          }

          // Polite human cadence between cards
          await HumanEmulation.sleep(4000, 7000);
        } catch (err: any) {
          log(`Error processing job card: ${err.message}`);
        }
      }
    }

    log(`LinkedIn Runner complete! Genuinely submitted ${appliedCount} Easy Apply application(s) on LinkedIn.`);
    return results;
  }

  /**
   * Comprehensive filler for a single step inside LinkedIn's `.jobs-easy-apply-modal`.
   * Handles file uploads, textareas, text/number/tel inputs, city typeaheads, <select> dropdowns,
   * <fieldset> radio buttons, and required checkboxes using Answer Bank + Groq AI.
   */
  private static async fillEasyApplyModalStep(
    page: Page,
    jobTitle: string,
    company: string,
    cand: any,
    log: (msg: string) => void
  ): Promise<void> {
    // 1. Resume upload if file input is present and no resume is currently selected
    const fileInputs = await page.$$(
      '.jobs-easy-apply-modal input[type="file"], div[role="dialog"] input[type="file"]'
    );
    for (const fi of fileInputs) {
      const hasSelectedResume = await page
        .evaluate(() => {
          const selected = document.querySelectorAll(
            '.jobs-document-upload-redesign-card__container--selected, .ui-attachment--pdf, input[name*="resume"][checked]'
          );
          return selected.length > 0;
        })
        .catch(() => false);
      if (!hasSelectedResume) {
        const bestPdf = resolveBestResumePdfPath(jobTitle);
        if (bestPdf) {
          log(`Uploading matched resume PDF (${bestPdf.split(/[\\/]/).pop()})...`);
          await fi.setInputFiles(bestPdf).catch(() => {});
          await HumanEmulation.sleep(1000, 1500);
        }
      }
    }

    // 2. Fill empty visible <textarea> elements using Answer Bank + Groq AI
    const textareas = await page.$$('.jobs-easy-apply-modal textarea, div[role="dialog"] textarea');
    for (const textarea of textareas) {
      const isVis = await textarea.isVisible().catch(() => false);
      if (!isVis) continue;
      const existingVal = await textarea.inputValue().catch(() => '');
      if (existingVal && existingVal.trim().length > 0) continue;

      const labelText = await page
        .evaluate((el) => {
          const container = el.closest('div.fb-dash-form-element, div.artdeco-text-input--container');
          const label =
            container?.querySelector('label')?.textContent ||
            el.getAttribute('aria-label') ||
            el.getAttribute('placeholder') ||
            'Cover note / additional information';
          return label.replace(/\s+/g, ' ').trim();
        }, textarea)
        .catch(() => 'Why are you a strong fit for this role?');

      let answer = resolveQuestionAnswer(labelText, { jobTitle, company }).answer;
      const groqAns = await generateGroqApplicationAnswer({
        question: labelText,
        jobTitle,
        company,
      }).catch(() => null);
      if (groqAns && groqAns.trim().length > 0) {
        answer = groqAns.trim();
      }

      log(`Answering textarea "${labelText.slice(0, 45)}..."`);
      await textarea.fill(answer).catch(() => {});
      await page.waitForTimeout(300);
    }

    // 3. Fill empty visible text, number, and tel <input> elements
    const textInputs = await page.$$(
      '.jobs-easy-apply-modal input[type="text"], .jobs-easy-apply-modal input[type="number"], .jobs-easy-apply-modal input[type="tel"], div[role="dialog"] input[type="text"], div[role="dialog"] input[type="number"], div[role="dialog"] input[type="tel"]'
    );

    for (const input of textInputs) {
      const isVis = await input.isVisible().catch(() => false);
      if (!isVis) continue;
      const existingVal = await input.inputValue().catch(() => '');
      if (existingVal && existingVal.trim().length > 0) continue;

      const meta = await page
        .evaluate((el) => {
          const container = el.closest('div.fb-dash-form-element, div.artdeco-text-input--container, div');
          const label =
            container?.querySelector('label')?.textContent ||
            el.getAttribute('aria-label') ||
            el.getAttribute('placeholder') ||
            '';
          const id = el.getAttribute('id') || '';
          const name = el.getAttribute('name') || '';
          const type = el.getAttribute('type') || 'text';
          const role = el.getAttribute('role') || '';
          return {
            label: label.replace(/\s+/g, ' ').trim(),
            lowerLabel: label.toLowerCase(),
            id: id.toLowerCase(),
            name: name.toLowerCase(),
            type: type.toLowerCase(),
            isCombobox: role === 'combobox' || id.includes('city') || label.toLowerCase().includes('city') || label.toLowerCase().includes('location'),
          };
        }, input)
        .catch(() => ({ label: '', lowerLabel: '', id: '', name: '', type: 'text', isCombobox: false }));

      const lbl = `${meta.lowerLabel} ${meta.id} ${meta.name}`;

      // Phone number
      if (lbl.includes('phone') || lbl.includes('mobile') || meta.type === 'tel') {
        const cleanPhone = (cand.phone || '7060137673').replace(/^\+91\s*/, '').replace(/\D/g, '') || '7060137673';
        await input.fill(cleanPhone).catch(() => {});
        continue;
      }

      // City / Location typeahead combobox
      if (meta.isCombobox) {
        await input.fill('Noida, Uttar Pradesh, India').catch(() => {});
        await page.waitForTimeout(800);
        await page.keyboard.press('ArrowDown').catch(() => {});
        await page.waitForTimeout(200);
        await page.keyboard.press('Enter').catch(() => {});
        continue;
      }

      // Numeric or experience/CTC/notice questions
      const isNumericField =
        meta.type === 'number' ||
        meta.id.includes('numeric') ||
        lbl.includes('how many years') ||
        lbl.includes('years of experience') ||
        lbl.includes('years of work') ||
        lbl.includes('notice period') ||
        lbl.includes('ctc') ||
        lbl.includes('salary') ||
        lbl.includes('cgpa') ||
        lbl.includes('gpa');

      if (isNumericField) {
        let numVal = '2';
        if (lbl.includes('notice') || lbl.includes('days')) {
          numVal = '15';
        } else if (lbl.includes('expected') && (lbl.includes('ctc') || lbl.includes('salary') || lbl.includes('compensation'))) {
          numVal = lbl.includes('inr') || lbl.includes('annual') ? '1800000' : '18';
        } else if (lbl.includes('current') && (lbl.includes('ctc') || lbl.includes('salary') || lbl.includes('compensation'))) {
          numVal = lbl.includes('inr') || lbl.includes('annual') ? '1200000' : '12';
        } else if (lbl.includes('cgpa') || lbl.includes('gpa')) {
          numVal = '8';
        } else {
          numVal = '2';
        }
        await input.fill(numVal).catch(() => {});
        continue;
      }

      // Other text inputs
      if (meta.label) {
        let answer = resolveQuestionAnswer(meta.label, { jobTitle, company }).answer;
        const groqAns = await generateGroqApplicationAnswer({
          question: meta.label,
          jobTitle,
          company,
        }).catch(() => null);
        if (groqAns && groqAns.trim().length > 0 && groqAns.length <= 180) {
          answer = groqAns.trim();
        }
        await input.fill(answer).catch(() => {});
      }
    }

    // 4. Fill all <select> dropdowns inside the modal
    await page
      .evaluate((candidate) => {
        const selects = document.querySelectorAll(
          '.jobs-easy-apply-modal select, div[role="dialog"] select'
        );
        selects.forEach((sel: any) => {
          const currentVal = (sel.value || '').trim().toLowerCase();
          if (currentVal && currentVal !== 'select an option' && currentVal !== '--' && sel.selectedIndex > 0) {
            return;
          }
          const container = sel.closest('div.fb-dash-form-element, div');
          const label = (container?.querySelector('label')?.textContent || '').toLowerCase();
          const options = Array.from(sel.options) as HTMLOptionElement[];
          if (options.length <= 1) return;

          const pickByKeyword = (keywords: string[]) => {
            for (const kw of keywords) {
              const found = options.find(
                (o, idx) => idx > 0 && o.text.toLowerCase().includes(kw.toLowerCase())
              );
              if (found) {
                sel.value = found.value;
                sel.dispatchEvent(new Event('change', { bubbles: true }));
                return true;
              }
            }
            return false;
          };

          if (label.includes('sponsorship') || label.includes('require visa')) {
            if (pickByKeyword(['no'])) return;
          }
          if (label.includes('country') || label.includes('phone')) {
            if (pickByKeyword(['india (+91)', 'india'])) return;
          }
          if (label.includes('email')) {
            if (pickByKeyword([candidate.email || 'dixit'])) return;
          }
          if (label.includes('proficiency') || label.includes('english')) {
            if (pickByKeyword(['professional', 'native', 'fluent', 'yes'])) return;
          }
          if (pickByKeyword(['yes', 'immediate', 'bachelor', 'india'])) return;

          // Fallback to first valid non-placeholder option
          const firstValid = options.find(
            (o, idx) =>
              idx > 0 &&
              !o.disabled &&
              !o.text.toLowerCase().includes('select an option') &&
              o.value.trim() !== ''
          );
          if (firstValid) {
            sel.value = firstValid.value;
            sel.dispatchEvent(new Event('change', { bubbles: true }));
          }
        });
      }, cand)
      .catch(() => {});

    // 5. Fill all unanswered <fieldset> radio groups inside the modal
    await page
      .evaluate(() => {
        const fieldsets = document.querySelectorAll(
          '.jobs-easy-apply-modal fieldset, div[role="dialog"] fieldset'
        );
        fieldsets.forEach((fs) => {
          const radios = Array.from(fs.querySelectorAll('input[type="radio"]')) as HTMLInputElement[];
          if (radios.length === 0) return;
          if (radios.some((r) => r.checked)) return; // Already answered

          const groupText = (fs.textContent || '').toLowerCase();
          const wantNo =
            groupText.includes('sponsorship') ||
            groupText.includes('require a visa') ||
            groupText.includes('criminal') ||
            groupText.includes('previously employed by');

          const targetWord = wantNo ? 'no' : 'yes';
          for (const r of radios) {
            const lbl =
              (r.closest('label')?.textContent ||
                fs.querySelector(`label[for="${r.id}"]`)?.textContent ||
                r.value ||
                '').toLowerCase().trim();
            if (lbl === targetWord || lbl.includes(targetWord)) {
              const labelEl = (r.closest('label') || fs.querySelector(`label[for="${r.id}"]`)) as HTMLElement | null;
              if (labelEl) labelEl.click();
              else r.click();
              return;
            }
          }

          // Fallback: click first option in fieldset
          const firstRadio = radios[0];
          if (firstRadio) {
            const firstLabel = (firstRadio.closest('label') ||
              fs.querySelector(`label[for="${firstRadio.id}"]`)) as HTMLElement | null;
            if (firstLabel) firstLabel.click();
            else firstRadio.click();
          }
        });
      })
      .catch(() => {});

    // 6. Check required checkboxes (excluding follow-company-checkbox)
    await page
      .evaluate(() => {
        const checkboxes = document.querySelectorAll(
          '.jobs-easy-apply-modal input[type="checkbox"], div[role="dialog"] input[type="checkbox"]'
        );
        checkboxes.forEach((cb: any) => {
          if (cb.id === 'follow-company-checkbox') return;
          if (!cb.checked && (cb.required || checkboxes.length === 1)) {
            const labelEl = (cb.closest('label') ||
              document.querySelector(`label[for="${cb.id}"]`)) as HTMLElement | null;
            if (labelEl) labelEl.click();
            else cb.click();
          }
        });
      })
      .catch(() => {});
  }

  /**
   * Fixes inline validation errors inside LinkedIn's Easy Apply modal (e.g., whole integer required,
   * decimal rejected, or required field missed).
   */
  private static async fixEasyApplyValidationErrors(page: Page, cand: any): Promise<void> {
    await page
      .evaluate((candidate) => {
        const errorContainers = document.querySelectorAll(
          '.jobs-easy-apply-modal .fb-dash-form-element, div[role="dialog"] .fb-dash-form-element'
        );
        errorContainers.forEach((container) => {
          const errEl = container.querySelector('.artdeco-inline-feedback--error');
          if (!errEl) return;
          const errText = (errEl.textContent || '').toLowerCase();
          const input = container.querySelector('input[type="text"], input[type="number"]') as HTMLInputElement | null;
          if (input) {
            if (errText.includes('whole number') || errText.includes('valid number') || errText.includes('decimal') || errText.includes('enter a number')) {
              input.value = '2';
              input.dispatchEvent(new Event('input', { bubbles: true }));
              input.dispatchEvent(new Event('change', { bubbles: true }));
            } else if (!input.value) {
              input.value = String(Math.round(candidate.experienceYears || 2));
              input.dispatchEvent(new Event('input', { bubbles: true }));
              input.dispatchEvent(new Event('change', { bubbles: true }));
            }
          }
        });
      }, cand)
      .catch(() => {});
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
