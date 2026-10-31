import { Page } from 'playwright';
import { HumanEmulation } from './humanEmulation.js';
import { FieldMapper, CandidateFormContext } from './fieldMapper.js';
import { FormFiller } from './formFiller.js';
import { generateGroqApplicationAnswer } from '../answers/groqAnswerHelper.js';
import { resolveQuestionAnswer } from '../answers/answerBank.js';
import { agentState } from '../state/agentStateManager.js';
import { telegramNotifier } from '../telegram/telegramNotifier.js';
import { LiveJobResult } from './linkedinLiveRunner.js';
import { prisma } from '@saarthi/database';

export interface NaukriLiveRunnerOptions {
  page: Page;
  maxApplications?: number;
  dryRun?: boolean;
  manualAuthTimeoutSeconds?: number;
  onProgress?: (msg: string) => void;
}

export class NaukriLiveRunner {
  static async run(options: NaukriLiveRunnerOptions): Promise<LiveJobResult[]> {
    const {
      page,
      maxApplications = 12,
      dryRun = false,
      manualAuthTimeoutSeconds = 180,
      onProgress,
    } = options;
    const results: LiveJobResult[] = [];

    const log = (msg: string) => {
      if (onProgress) onProgress(msg);
      console.log(`[NaukriRunner] ${msg}`);
    };

    const candidateContext: CandidateFormContext = {
      fullName: 'Dixit Kumar',
      firstName: 'Dixit',
      lastName: 'Kumar',
      email: 'dixitkumar300@gmail.com',
      phone: '+91 7060137673',
      location: 'Noida, India',
      experienceYears: 1.8,
      noticePeriodText: '15 days',
      expectedSalaryText: '18 LPA',
      workAuthorizationText: 'Yes',
    };

    await page.bringToFront().catch(() => {});
    log('Checking Naukri.com session status in visible Chrome window...');
    await page
      .goto('https://www.naukri.com/mnjuser/recommendedjobs', {
        waitUntil: 'domcontentloaded',
        timeout: 25000,
      })
      .catch(() => {});
    await HumanEmulation.sleep(3200, 4500);

    // Accurate check for whether the browser session is logged into Naukri
    const checkIsLoggedOut = async (targetPage: Page): Promise<boolean> => {
      return targetPage
        .evaluate(() => {
          const url = window.location.href.toLowerCase();
          const hasLoginInputs =
            document.querySelector(
              '#login_Layer, a[title="Jobseeker Login"], #usernameField, input[placeholder*="Email ID" i], input[placeholder*="Username" i], #login-apply-button, .login-layer'
            ) !== null;
          const isLoginUrl =
            url === 'https://www.naukri.com/' ||
            url.includes('/nlogin') ||
            (!url.includes('/mnjuser') && hasLoginInputs);
          return isLoginUrl || hasLoginInputs;
        })
        .catch(() => true);
    };

    let isLoggedOut = await checkIsLoggedOut(page);

    if (isLoggedOut) {
      log('Opening Naukri login page (https://www.naukri.com/nlogin/login) in your taskbar Chrome window...');
      if (!page.url().toLowerCase().includes('/nlogin')) {
        await page
          .goto('https://www.naukri.com/nlogin/login', {
            waitUntil: 'domcontentloaded',
            timeout: 20000,
          })
          .catch(() => {});
      }
      await page.bringToFront().catch(() => {});
      await HumanEmulation.sleep(1800, 2600);

      // Pre-fill candidate email on Naukri login form and focus password field
      const defaultEmail = process.env.NAUKRI_EMAIL || candidateContext.email || 'dixitkumar300@gmail.com';
      await page
        .evaluate((email) => {
          const emailInput = document.querySelector(
            '#usernameField, input[placeholder*="Email ID" i], input[placeholder*="Username" i], input[type="text"]'
          ) as HTMLInputElement | null;
          if (emailInput && !emailInput.value) {
            emailInput.value = email;
            emailInput.dispatchEvent(new Event('input', { bubbles: true }));
            emailInput.dispatchEvent(new Event('change', { bubbles: true }));
          }
          const passInput = document.querySelector(
            '#passwordField, input[type="password"]'
          ) as HTMLInputElement | null;
          if (passInput) {
            passInput.focus();
          }
        }, defaultEmail)
        .catch(() => {});

      log(
        `🔐 Naukri login required — opened Naukri login in your taskbar Chrome window (email pre-filled: ${defaultEmail}). Waiting up to ${manualAuthTimeoutSeconds}s for you to sign in...`
      );
      void telegramNotifier.notifySecurityChallenge(
        'NAUKRI',
        'Please log into Naukri.com in the open Chrome window on your taskbar (email pre-filled — cookies will be saved).',
        manualAuthTimeoutSeconds
      );

      const startWait = Date.now();
      let pollTick = 0;
      while (Date.now() - startWait < manualAuthTimeoutSeconds * 1000) {
        if (agentState.isPaused()) {
          log('⏸️ Agent paused by user while waiting for Naukri login.');
          return results;
        }
        await page.waitForTimeout(3000);
        pollTick++;

        const loggedInNow = await page
          .evaluate(() => {
            const url = window.location.href.toLowerCase();
            const hasLoginField =
              document.querySelector('#usernameField, input[placeholder*="Email ID" i], #login_Layer') !== null;
            const hasUserNav =
              document.querySelector('.nI-gNb-drawer, .nI-gNb-icon-img, a[href*="mnjuser/profile"]') !== null;
            return (url.includes('/mnjuser') || hasUserNav) && !url.includes('/nlogin') && !hasLoginField;
          })
          .catch(() => false);

        if (loggedInNow) {
          isLoggedOut = false;
          log('✅ Naukri login verified! Session saved to persistent Chrome profile. Starting job search & apply...');
          await HumanEmulation.sleep(2000, 3000);
          break;
        }

        if (pollTick % 8 === 0) {
          const remaining = Math.max(
            0,
            Math.round((manualAuthTimeoutSeconds * 1000 - (Date.now() - startWait)) / 1000)
          );
          log(`⏳ Waiting for Naukri sign-in in taskbar Chrome window... (${remaining}s remaining)`);
        }
      }
    }

    if (isLoggedOut) {
      log(
        '❌ Naukri session is not signed in. Naukri auto-apply requires an authenticated Naukri account so applications appear in your Naukri Applied Jobs history. Please sign in to Naukri in the taskbar Chrome window and try again.'
      );
      return results;
    }

    let appliedCount = 0;
    const seenJobUrls = new Set<string>();

    // High-signal Naukri feeds tailored to Dixit's Embedded / Firmware / C++ / Backend profile
    const searchUrls = [
      'https://www.naukri.com/mnjuser/recommendedjobs',
      'https://www.naukri.com/embedded-firmware-engineer-jobs?experience=2',
      'https://www.naukri.com/embedded-c-jobs?experience=2',
      'https://www.naukri.com/embedded-software-engineer-jobs?experience=2',
      'https://www.naukri.com/c-plus-plus-developer-jobs?experience=2',
      'https://www.naukri.com/backend-developer-jobs?experience=2',
    ];

    for (let sIdx = 0; sIdx < searchUrls.length; sIdx++) {
      const searchUrl = searchUrls[sIdx]!;
      if (appliedCount >= maxApplications) break;
      if (agentState.isPaused()) {
        log('Agent is currently PAUSED. Halting Naukri scan at feed checkpoint.');
        break;
      }
      if (await this.detectBotOrSecurityChallenge(page, log)) {
        break;
      }

      log(`[Naukri Feed ${sIdx + 1}/${searchUrls.length}] Opening: ${searchUrl}`);
      await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 25000 }).catch(() => {});
      await HumanEmulation.sleep(3800, 5200);

      // Wait for Naukri SRP or Recommended job tuples to render
      await page
        .waitForSelector(
          '.srp-jobtuple-wrapper, article.jobTuple, div.cust-job-tuple, div.tuple, div[class*="jobTuple" i], a.title',
          { timeout: 10000 }
        )
        .catch(() => {});

      // Natural human scroll to trigger lazy-rendered job cards
      await HumanEmulation.humanScroll(page, undefined, HumanEmulation.randomBetween(320, 550));
      await HumanEmulation.sleep(1200, 2000);

      // Extract job links from Naukri SRP / Recommended cards
      const jobCards = await page
        .evaluate(() => {
          const cards = Array.from(
            document.querySelectorAll(
              '.srp-jobtuple-wrapper, article.jobTuple, div.cust-job-tuple, div.tuple, div[class*="jobTuple" i]'
            )
          );
          const list: Array<{ title: string; company: string; location: string; href: string }> = [];

          for (const c of cards) {
            const titleEl = c.querySelector(
              'a.title, .title a, h2 a, p.title, a[href*="job-listings"]'
            ) as HTMLAnchorElement | null;
            const compEl = c.querySelector('a.comp-name, .comp-name, .subTitle, .companyInfo');
            const locEl = c.querySelector('.locWdth, .loc, .location, .loc-wrap');

            const title = (titleEl?.textContent || '').replace(/\s+/g, ' ').trim();
            const href = titleEl?.href || '';
            const company = (compEl?.textContent || 'Company').replace(/\s+/g, ' ').trim();
            const location = (locEl?.textContent || 'India').replace(/\s+/g, ' ').trim();

            if (title && href && href.includes('naukri.com')) {
              list.push({ title, company, location, href });
            }
          }

          // Fallback if Recommended Jobs uses direct anchor links
          if (list.length === 0) {
            const directLinks = Array.from(
              document.querySelectorAll('a[href*="job-listings-"]')
            ) as HTMLAnchorElement[];
            for (const a of directLinks) {
              const title = (a.textContent || '').replace(/\s+/g, ' ').trim();
              if (title && a.href) {
                list.push({
                  title,
                  company: 'Naukri Employer',
                  location: 'India',
                  href: a.href,
                });
              }
            }
          }

          return list.slice(0, 20);
        })
        .catch(() => []);

      log(`Found ${jobCards.length} Naukri job listing(s) on current feed.`);

      for (let cIdx = 0; cIdx < jobCards.length; cIdx++) {
        const card = jobCards[cIdx]!;
        if (appliedCount >= maxApplications) {
          log(`Reached maximum Naukri application limit (${maxApplications}). Stopping.`);
          break;
        }
        if (agentState.isPaused()) {
          log('Agent is currently PAUSED. Halting Naukri scan immediately.');
          break;
        }
        if (seenJobUrls.has(card.href)) continue;
        seenJobUrls.add(card.href);

        if (
          /\b(senior|sr\.?|lead|manager|architect|principal|director|vp|head|chief|sde\s*3|sde-3)\b/i.test(
            card.title
          )
        ) {
          log(`Skipping senior/leadership role on Naukri: ${card.company} — ${card.title}`);
          results.push({
            title: card.title,
            company: card.company,
            location: card.location,
            jobUrl: card.href,
            platform: 'OTHER',
            status: 'SKIPPED',
            reason: 'Seniority mismatch (>3 YOE / Leadership)',
          });
          continue;
        }

        const jobPage = await page.context().newPage().catch(() => null);
        if (!jobPage) continue;

        try {
          await jobPage.bringToFront().catch(() => {});
          log(`Inspecting [${cIdx + 1}/${jobCards.length}]: ${card.title} at ${card.company}`);
          await jobPage.goto(card.href, { waitUntil: 'domcontentloaded', timeout: 25000 }).catch(() => {});

          if (await this.detectBotOrSecurityChallenge(jobPage, log)) {
            break;
          }

          // Wait up to 8s for Naukri's React SPA job header buttons to render
          await jobPage
            .waitForSelector(
              '#apply-button, button#apply-button, button.apply-button, #login-apply-button, #company-site-button, .apply-button-container button, span.already-applied, #already-applied',
              { timeout: 8000 }
            )
            .catch(() => {});
          await HumanEmulation.sleep(1500, 2500);

          const pageButtonState = await jobPage
            .evaluate(() => {
              if (document.querySelector('#login-apply-button')) return 'LOGIN_REQUIRED';
              if (
                document.querySelector('#company-site-button') ||
                Array.from(document.querySelectorAll('button')).some((b) =>
                  /company site/i.test(b.textContent || '')
                )
              ) {
                return 'EXTERNAL_COMPANY_SITE';
              }
              if (
                document.querySelector('#already-applied, .already-applied') ||
                Array.from(document.querySelectorAll('span, button, div')).some((el) =>
                  /^(already\s+)?applied$/i.test((el.textContent || '').trim())
                )
              ) {
                return 'ALREADY_APPLIED';
              }
              const directBtn = document.querySelector(
                '#apply-button, button#apply-button, button.apply-button, .apply-button-container button'
              );
              if (directBtn) return 'DIRECT_APPLY';
              return 'UNKNOWN';
            })
            .catch(() => 'UNKNOWN');

          if (pageButtonState === 'LOGIN_REQUIRED') {
            log(`⚠️ Naukri session logged out ("Login to apply" detected). Stopping guest scan.`);
            break;
          }

          if (pageButtonState === 'EXTERNAL_COMPANY_SITE') {
            log(`Skipping ${card.company}: Redirects to external company site ("Apply on company site").`);
            results.push({
              title: card.title,
              company: card.company,
              location: card.location,
              jobUrl: card.href,
              platform: 'OTHER',
              status: 'SKIPPED',
              reason: 'Redirects to external company site',
            });
            continue;
          }

          if (pageButtonState === 'ALREADY_APPLIED') {
            log(`Skipping ${card.company}: Already applied on Naukri.`);
            results.push({
              title: card.title,
              company: card.company,
              location: card.location,
              jobUrl: card.href,
              platform: 'OTHER',
              status: 'ALREADY_APPLIED',
              reason: 'Already applied on Naukri',
            });
            continue;
          }

          const applyBtn = await jobPage
            .$(
              '#apply-button, button#apply-button, button.apply-button, .apply-button-container button:has-text("Apply"):not(:has-text("company site")):not(:has-text("Login"))'
            )
            .catch(() => null);

          if (!applyBtn || !(await applyBtn.isVisible().catch(() => false))) {
            log(`No direct Naukri Apply button for ${card.company} (state: ${pageButtonState}). Skipping.`);
            continue;
          }

          // Simulate a human reading the job description (4–7s with smooth scroll & mouse jiggle) before clicking Apply
          await HumanEmulation.simulateReadingJobDescription(jobPage);
          if (agentState.isPaused()) {
            log('Agent is currently PAUSED. Halting before clicking Apply on Naukri.');
            break;
          }

          if (dryRun) {
            log(`[DRY RUN] Ready to click Apply on ${card.company} (${card.title}). Skipping click.`);
            continue;
          }

          log(`Clicking "Apply" on ${card.company} (${card.title})...`);
          await HumanEmulation.naturalClick(jobPage, applyBtn);
          await HumanEmulation.sleep(2800, 4200);

          // Handle Naukri right-hand Chatbot screening drawer if it opens (up to 10 questions)
          await this.completeNaukriChatbotIfPresent(jobPage, card, candidateContext, log);

          // Strictly verify whether Naukri confirmed the application submission
          const isConfirmedApplied = await jobPage
            .evaluate(() => {
              const url = window.location.href.toLowerCase();
              const bodyText = (document.body?.innerText || '').toLowerCase();
              const hasAlreadyAppliedBadge =
                document.querySelector('#already-applied, .already-applied, .apply-status-header, .apply-message') !==
                null;
              const hasSuccessText =
                bodyText.includes('successfully applied') ||
                bodyText.includes('you have applied') ||
                bodyText.includes('application sent') ||
                url.includes('saveapply') ||
                url.includes('myapply');
              const applyBtnStillVisible =
                document.querySelector('#apply-button, button#apply-button, button.apply-button') !== null;
              const chatbotStillOpen =
                document.querySelector('.chatbot_Drawer, .chatBot, ._chatBotContainer, .ssrc__question') !== null;

              return (hasAlreadyAppliedBadge || hasSuccessText || !applyBtnStillVisible) && !chatbotStillOpen;
            })
            .catch(() => false);

          if (!isConfirmedApplied) {
            log(
              `⚠️ Naukri application to ${card.company} (${card.title}) was not confirmed (unanswered screening widget or external redirect). Not marking as Applied.`
            );
            results.push({
              title: card.title,
              company: card.company,
              location: card.location,
              jobUrl: card.href,
              platform: 'OTHER',
              status: 'SKIPPED',
              reason: 'Application confirmation not reached',
            });
            continue;
          }

          appliedCount++;
          agentState.recordSubmission();

          await this.recordApplicationInDb({
            title: card.title,
            company: card.company,
            location: card.location,
            jobUrl: card.href,
          });

          void telegramNotifier.notifyApplicationSubmitted({
            title: card.title,
            company: card.company,
            platform: 'NAUKRI' as any,
            jobUrl: card.href,
            dryRun,
          });

          results.push({
            title: card.title,
            company: card.company,
            location: card.location,
            jobUrl: card.href,
            platform: 'OTHER',
            status: 'APPLIED',
            reason: 'Applied live on Naukri.com',
          });

          log(
            `✅ Submitted Naukri application to ${card.company} (${card.title})! Now visible in Naukri -> Application Status. Total applied: ${appliedCount}/${maxApplications}`
          );

          // Close the job detail tab before starting the 2-minute anti-bot cooldown on the main feed tab
          await jobPage.close().catch(() => {});

          if (appliedCount < maxApplications && !agentState.isPaused()) {
            await this.waitTwoMinutesBetweenApplications(page, log);
          }
        } catch (err: any) {
          log(`Error processing Naukri card ${card.company}: ${err.message}`);
        } finally {
          if (!jobPage.isClosed()) {
            await jobPage.close().catch(() => {});
          }
        }
      }
    }

    log(`Naukri Runner complete! Genuinely submitted ${appliedCount} application(s) on Naukri.com.`);
    return results;
  }

  /**
   * Completes Naukri's right-hand Chatbot screening drawer (`.chatbot_Drawer` / `.chatBot`)
   * using Answer Bank + Groq AI with human typing and Bézier mouse clicks.
   */
  private static async completeNaukriChatbotIfPresent(
    jobPage: Page,
    card: { title: string; company: string },
    candidateContext: CandidateFormContext,
    log: (msg: string) => void
  ): Promise<void> {
    let lastQuestion = '';
    let repeatCount = 0;

    for (let qStep = 0; qStep < 10; qStep++) {
      if (agentState.isPaused()) break;

      const chatbotQuestion = await jobPage
        .evaluate(() => {
          const drawer = document.querySelector(
            '.chatbot_Drawer, .chatBot, ._chatBotContainer, .chatbot_MessageContainer'
          );
          if (!drawer) return '';
          const botMsgs = Array.from(
            drawer.querySelectorAll('.botItem, .botMsg, .ssrc__question, .chatbot_MessageContainer div, span')
          )
            .map((el) => (el.textContent || '').replace(/\s+/g, ' ').trim())
            .filter((t) => t.length > 4);
          return botMsgs[botMsgs.length - 1] || '';
        })
        .catch(() => '');

      if (!chatbotQuestion) break;

      if (chatbotQuestion === lastQuestion) {
        repeatCount++;
        if (repeatCount >= 2) break;
      } else {
        lastQuestion = chatbotQuestion;
        repeatCount = 0;
      }

      log(`Answering Naukri Chatbot question: "${chatbotQuestion.slice(0, 65)}..."`);
      await HumanEmulation.sleep(1000, 1800);

      // 1. Check for radio buttons or single-select chips inside Naukri chatbot
      const clickedOption = await jobPage
        .evaluate((qText) => {
          const lowerQ = qText.toLowerCase();
          const labels = Array.from(
            document.querySelectorAll(
              '.ssrc__radio-btn-container label, .chatbot_Drawer label, .chatBot label, .MultiSelectCheckbox label'
            )
          ) as HTMLElement[];
          if (labels.length === 0) return false;

          const wantNo =
            lowerQ.includes('sponsorship') ||
            lowerQ.includes('visa') ||
            lowerQ.includes('serving notice') && lowerQ.includes('more than 60');

          const preferredKeywords = wantNo
            ? ['no']
            : ['yes', 'immediate', '15 days', 'less than 15', '0 - 15', 'noida', 'delhi', 'bangalore', 'b.tech', 'b.e'];

          for (const kw of preferredKeywords) {
            const match = labels.find((l) => (l.textContent || '').toLowerCase().includes(kw));
            if (match) {
              match.click();
              return true;
            }
          }

          labels[0]?.click();
          return true;
        }, chatbotQuestion)
        .catch(() => false);

      if (!clickedOption) {
        // 2. Check for text / number / contenteditable input inside Naukri chatbot
        const chatInput = await jobPage
          .$(
            '.chatbot_Drawer input[type="text"], .chatbot_Drawer input[type="number"], .chatbot_Drawer textarea, .chatBot input[type="text"], .chatBot textarea, div[contenteditable="true"], .textArea'
          )
          .catch(() => null);

        if (chatInput && (await chatInput.isVisible().catch(() => false))) {
          let answer = resolveQuestionAnswer(chatbotQuestion, {
            jobTitle: card.title,
            company: card.company,
          }).answer;

          if (process.env.GROQ_API_KEY) {
            const groqAns = await generateGroqApplicationAnswer({
              question: chatbotQuestion,
              jobTitle: card.title,
              company: card.company,
              elementType: 'input',
            }).catch(() => null);
            if (groqAns && groqAns.trim().length > 0) {
              answer = groqAns.trim();
            }
          }

          await HumanEmulation.humanType(jobPage, chatInput, answer);
        } else {
          // 3. Fallback to generic FieldMapper
          const fields = await FieldMapper.detectFields(jobPage, candidateContext);
          if (fields.length > 0) {
            await FormFiller.fillDetectedFields(jobPage, fields);
          } else {
            break;
          }
        }
      }

      await HumanEmulation.sleep(900, 1600);

      // Click Save / Next / Submit inside the Naukri chatbot drawer
      const saveNextBtn = await jobPage
        .$(
          '.sendMsg, div.sendMsgbtn, .chatbot_Drawer button:has-text("Save"), .chatbot_Drawer button:has-text("Next"), .chatbot_Drawer button:has-text("Submit"), button:has-text("Save"), button:has-text("Submit")'
        )
        .catch(() => null);

      if (saveNextBtn && (await saveNextBtn.isVisible().catch(() => false))) {
        await HumanEmulation.naturalClick(jobPage, saveNextBtn);
        await HumanEmulation.sleep(2000, 3200);
      } else {
        await jobPage.keyboard.press('Enter').catch(() => {});
        await HumanEmulation.sleep(1800, 2600);
      }
    }
  }

  /**
   * Enforces a mandatory ~2-minute (120s to 138s with organic random jitter) cooldown gap
   * between every Naukri application submission to prevent velocity/bot activity detection.
   */
  private static async waitTwoMinutesBetweenApplications(
    page: Page,
    log: (msg: string) => void
  ): Promise<void> {
    const totalSeconds = HumanEmulation.randomBetween(120, 138);
    log(
      `⏳ Anti-Bot Cooldown: Waiting ${Math.floor(totalSeconds / 60)}m ${totalSeconds % 60}s (${totalSeconds}s) before next Naukri application to prevent bot activity detection...`
    );

    for (let elapsed = 0; elapsed < totalSeconds; elapsed++) {
      if (agentState.isPaused()) {
        log('⏸️ Cooldown interrupted because agent was paused/stopped by user.');
        return;
      }

      if (elapsed === 60) {
        log(`⏳ Anti-Bot Cooldown: ${totalSeconds - elapsed}s remaining before next Naukri application...`);
      }

      if (elapsed > 0 && elapsed % 30 === 0) {
        await HumanEmulation.jiggleMouse(page);
      }

      await new Promise((r) => setTimeout(r, 1000));
    }

    log('✅ 2-minute anti-bot cooldown complete. Proceeding to next Naukri job...');
  }

  /**
   * Circuit breaker that checks if Naukri is showing any security verification, CAPTCHA,
   * or access-denied screen. If detected, pauses the agent immediately to protect the account.
   */
  private static async detectBotOrSecurityChallenge(
    page: Page,
    log: (msg: string) => void
  ): Promise<boolean> {
    try {
      const hasChallenge = await page
        .evaluate(() => {
          const text = (document.body?.innerText || '').toLowerCase();
          const hasCaptchaFrame =
            document.querySelector('iframe[src*="recaptcha"], iframe[src*="turnstile"], iframe[src*="hcaptcha"]') !==
            null;
          return (
            hasCaptchaFrame ||
            text.includes('verify you are human') ||
            text.includes('access denied') ||
            text.includes('unusual traffic from your computer') ||
            text.includes('security check')
          );
        })
        .catch(() => false);

      if (hasChallenge) {
        log('⚠️ Naukri security verification / CAPTCHA detected! Immediately pausing agent to protect your account.');
        agentState.pause();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  private static async recordApplicationInDb(data: {
    title: string;
    company: string;
    location?: string;
    jobUrl: string;
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
          description: `Live job applied on Naukri.com via Saarthi autonomous runner.`,
          sources: {
            create: {
              sourceName: 'Naukri.com',
              sourceUrl: data.jobUrl,
              externalId: `naukri_${Date.now()}`,
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
          notes: `Applied live on Naukri.com via Saarthi Autonomous Runner + Groq AI Q&A.`,
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
          description: `Successfully applied to ${data.company} (${data.title}) on Naukri.com`,
          actor: 'AGENT',
        },
      });
    } catch (err) {
      console.error('[NaukriRunner] Failed to record application in DB:', err);
    }
  }
}
