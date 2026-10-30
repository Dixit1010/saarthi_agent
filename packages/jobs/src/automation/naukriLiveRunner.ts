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

    log('Navigating to Naukri.com Recommended Jobs...');
    await page
      .goto('https://www.naukri.com/mnjuser/recommendedjobs', {
        waitUntil: 'domcontentloaded',
        timeout: 25000,
      })
      .catch(() => {});
    await page.waitForTimeout(4000);

    // Accurate check for whether the browser session is logged into Naukri
    const checkIsLoggedOut = async (targetPage: Page): Promise<boolean> => {
      return targetPage
        .evaluate(() => {
          const url = window.location.href;
          const hasLoginBtn =
            document.querySelector(
              '#login_Layer, a[title="Jobseeker Login"], #usernameField, input[placeholder*="Email ID" i], #login-apply-button, .login-layer'
            ) !== null;
          const isLoggedOutHome =
            url === 'https://www.naukri.com/' ||
            url.includes('/nlogin') ||
            (!url.includes('/mnjuser') && hasLoginBtn);
          return isLoggedOutHome || hasLoginBtn;
        })
        .catch(() => false);
    };

    if (await checkIsLoggedOut(page)) {
      log('Opening Naukri login page (https://www.naukri.com/nlogin/login)...');
      await page
        .goto('https://www.naukri.com/nlogin/login', {
          waitUntil: 'domcontentloaded',
          timeout: 20000,
        })
        .catch(() => {});
      await page.waitForTimeout(2000);

      log(
        `🔐 Naukri login required! Please log into Naukri.com in the open Chrome window on your laptop (waiting up to ${manualAuthTimeoutSeconds}s)...`
      );
      void telegramNotifier.notifySecurityChallenge(
        'NAUKRI',
        'Please log into Naukri.com in the open Chrome window on your laptop (1-time setup — cookies will be saved).',
        manualAuthTimeoutSeconds
      );

      const startWait = Date.now();
      while (Date.now() - startWait < manualAuthTimeoutSeconds * 1000) {
        await page.waitForTimeout(3000);
        const loggedIn = await page
          .evaluate(() => {
            const url = window.location.href;
            return (
              url.includes('/mnjuser') &&
              !url.includes('/nlogin') &&
              document.querySelector('#usernameField') === null
            );
          })
          .catch(() => false);

        if (loggedIn) {
          log('✅ Naukri login verified! Session saved to persistent profile. Proceeding...');
          await page.waitForTimeout(2500);
          break;
        }
      }
    }

    let appliedCount = 0;
    const seenJobUrls = new Set<string>();

    // Target Embedded, C++, Firmware, and Backend engineering feeds on Naukri
    const searchUrls = [
      'https://www.naukri.com/mnjuser/recommendedjobs',
      'https://www.naukri.com/embedded-c-jobs?experience=2',
      'https://www.naukri.com/embedded-firmware-engineer-jobs?experience=2',
      'https://www.naukri.com/c-plus-plus-developer-jobs?experience=2',
      'https://www.naukri.com/embedded-software-engineer-jobs?experience=2',
      'https://www.naukri.com/backend-developer-jobs?experience=2',
    ];

    for (const searchUrl of searchUrls) {
      if (appliedCount >= maxApplications || agentState.isPaused()) break;

      if (page.url() !== searchUrl) {
        log(`Opening Naukri feed: ${searchUrl}`);
        await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 25000 }).catch(() => {});
        await page.waitForTimeout(4500);
      }

      // Scroll slightly so lazy-rendered job tuples appear
      await page.mouse.wheel(0, 500).catch(() => {});
      await page.waitForTimeout(1200);

      // Extract job links from Naukri SRP / Recommended cards
      const jobCards = await page
        .evaluate(() => {
          const cards = Array.from(
            document.querySelectorAll(
              '.srp-jobtuple-wrapper, article.jobTuple, div.cust-job-tuple, div.tuple, div[class*="jobTuple" i], a.title'
            )
          );
          const list: Array<{ title: string; company: string; location: string; href: string }> = [];

          for (const c of cards) {
            const titleEl =
              c.tagName.toLowerCase() === 'a'
                ? (c as HTMLAnchorElement)
                : (c.querySelector('a.title, .title a, h2 a, p.title, a[href*="job-listings"]') as HTMLAnchorElement | null);
            const compEl = c.querySelector('a.comp-name, .comp-name, .subTitle, .companyInfo');
            const locEl = c.querySelector('.locWdth, .loc, .location');

            const title = (titleEl?.textContent || '').trim();
            const href = titleEl?.href || '';
            const company = (compEl?.textContent || 'Company').trim();
            const location = (locEl?.textContent || 'India').trim();

            if (title && href && href.includes('naukri.com')) {
              list.push({ title, company, location, href });
            }
          }
          return list.slice(0, 15);
        })
        .catch(() => []);

      log(`Found ${jobCards.length} Naukri job listing(s) on current page.`);

      for (const card of jobCards) {
        if (appliedCount >= maxApplications || agentState.isPaused()) break;
        if (seenJobUrls.has(card.href)) continue;
        seenJobUrls.add(card.href);

        if (
          /\b(senior|sr\.?|lead|manager|architect|principal|director|sde\s*3|sde-3)\b/i.test(
            card.title
          )
        ) {
          log(`Skipping senior role on Naukri: ${card.company} — ${card.title}`);
          continue;
        }

        const jobPage = await page.context().newPage().catch(() => null);
        if (!jobPage) continue;

        try {
          log(`Inspecting Naukri job: ${card.company} — ${card.title}`);
          await jobPage.goto(card.href, { waitUntil: 'domcontentloaded', timeout: 22000 }).catch(() => {});

          // Wait up to 6s for Naukri's React SPA job header buttons to render
          await jobPage
            .waitForSelector(
              '#apply-button, button#apply-button, button.apply-button, #login-apply-button, #company-site-button, .apply-button-container button, span.already-applied',
              { timeout: 6000 }
            )
            .catch(() => {});
          await jobPage.waitForTimeout(1000);

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
                  /^applied$/i.test((el.textContent || '').trim())
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
            log(
              `⚠️ Naukri session is not logged in yet ("Login to apply" button shown). Clicking Login to apply — please sign in once in the browser window!`
            );
            const loginApplyBtn = await jobPage.$('#login-apply-button').catch(() => null);
            if (loginApplyBtn) {
              await loginApplyBtn.click().catch(() => {});
              await jobPage.waitForTimeout(15000);
            }
          } else if (pageButtonState === 'EXTERNAL_COMPANY_SITE') {
            log(`Skipping ${card.company}: Redirects to external company portal ("Apply on company site").`);
            continue;
          } else if (pageButtonState === 'ALREADY_APPLIED') {
            log(`Skipping ${card.company}: Already applied on Naukri.`);
            continue;
          }

          const applyBtn = await jobPage
            .$(
              '#apply-button, button#apply-button, button.apply-button, .apply-button-container button:has-text("Apply"):not(:has-text("company site")):not(:has-text("Login"))'
            )
            .catch(() => null);

          if (!applyBtn || !(await applyBtn.isVisible().catch(() => false))) {
            log(`No direct 1-click Naukri Apply button for ${card.company} (state: ${pageButtonState}).`);
            continue;
          }

          if (!dryRun) {
            await applyBtn.click({ timeout: 4000 }).catch(() => {});
            await jobPage.waitForTimeout(2500);

            // Handle Naukri right-hand Chatbot screening drawer if it appears (up to 6 questions)
            for (let qStep = 0; qStep < 6; qStep++) {
              const chatbotQuestion = await jobPage
                .evaluate(() => {
                  const botMsgs = Array.from(
                    document.querySelectorAll(
                      '.chatbot_Drawer .botItem, .chatBot .botMsg, .ssrc__question, .chatbot_MessageContainer div'
                    )
                  );
                  const last = botMsgs[botMsgs.length - 1];
                  return last?.textContent?.trim() || '';
                })
                .catch(() => '');

              if (!chatbotQuestion) break;

              log(`Answering Naukri Chatbot question: "${chatbotQuestion.slice(0, 80)}..."`);

              // Check if radio buttons are present in Naukri chatbot
              const radioLabels = await jobPage
                .$$('.ssrc__radio-btn-container label, .chatbot_Drawer label')
                .catch(() => []);
              if (radioLabels.length > 0) {
                await radioLabels[0]?.click().catch(() => {});
              } else {
                // Check for text input in Naukri chatbot
                const chatInput = await jobPage
                  .$(
                    '.chatbot_Drawer input[type="text"], .chatbot_Drawer textarea, div[contenteditable="true"], .textArea'
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
                    });
                    if (groqAns) answer = groqAns;
                  }
                  await chatInput.fill(answer).catch(() => {});
                } else {
                  const fields = await FieldMapper.detectFields(jobPage, candidateContext);
                  if (fields.length > 0) {
                    await FormFiller.fillDetectedFields(jobPage, fields);
                  } else {
                    break;
                  }
                }
              }

              const saveNextBtn = await jobPage
                .$(
                  '.sendMsg, button:has-text("Save"), button:has-text("Next"), button:has-text("Submit"), div.sendMsgbtn'
                )
                .catch(() => null);
              if (saveNextBtn && (await saveNextBtn.isVisible().catch(() => false))) {
                await saveNextBtn.click().catch(() => {});
                await jobPage.waitForTimeout(1800);
              } else {
                break;
              }
            }
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
            platform: 'INSTAHYRE',
            status: 'APPLIED',
            reason: 'Applied live on Naukri.com',
          });

          log(`✅ [Naukri] Applied to ${card.company} (${card.title})! (${appliedCount}/${maxApplications})`);
          await HumanEmulation.sleep(5000, 9000);
        } catch (err: any) {
          log(`Error on Naukri card ${card.company}: ${err.message}`);
        } finally {
          await jobPage.close().catch(() => {});
        }
      }
    }

    log(`Naukri Runner complete! Submitted ${appliedCount} application(s).`);
    return results;
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
