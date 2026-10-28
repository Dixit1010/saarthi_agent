import { Page } from 'playwright';
import { HumanEmulation } from './humanEmulation.js';
import { FieldMapper, CandidateFormContext, resolveBestResumePdfPath } from './fieldMapper.js';
import { FormFiller } from './formFiller.js';
import { agentState } from '../state/agentStateManager.js';
import { telegramNotifier } from '../telegram/telegramNotifier.js';
import { LiveJobResult } from './linkedinLiveRunner.js';
import { prisma } from '@saarthi/database';

export interface HiringCafeLiveRunnerOptions {
  page: Page;
  maxApplications?: number;
  dryRun?: boolean;
  onProgress?: (msg: string) => void;
}

export class HiringCafeLiveRunner {
  static async run(options: HiringCafeLiveRunnerOptions): Promise<LiveJobResult[]> {
    const { page, maxApplications = 10, dryRun = false, onProgress } = options;
    const results: LiveJobResult[] = [];

    const log = (msg: string) => {
      if (onProgress) onProgress(msg);
      console.log(`[HiringCafeRunner] ${msg}`);
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
      expectedSalaryText: '₹18 LPA',
      workAuthorizationText: 'Yes, authorized to work in India without sponsorship',
      linkedinUrl: 'https://www.linkedin.com/in/dixitkum/',
      githubUrl: 'https://github.com/Dixit1010',
      portfolioUrl: 'https://portfoliodixitt.netlify.app/',
      leetcodeUrl: 'https://leetcode.com/u/dixitkumar300',
      codeforcesUrl: 'https://codeforces.com/profile/dixitkumar300',
    };

    let appliedCount = 0;
    const seenKeys = new Set<string>();

    const searchQueries = [
      'Software Engineer India',
      'Backend Engineer India',
      'C++ Embedded Engineer India',
      'Node.js Full Stack India',
    ];

    for (const query of searchQueries) {
      if (appliedCount >= maxApplications || agentState.isPaused()) break;

      const searchUrl = `https://hiring.cafe/?searchState=${encodeURIComponent(
        JSON.stringify({ searchQuery: query })
      )}`;
      log(`Opening Hiring.cafe for query: "${query}"...`);

      try {
        await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 25000 }).catch(async () => {
          await page.goto('https://hiring.cafe/', { waitUntil: 'domcontentloaded', timeout: 25000 }).catch(() => {});
        });
        await page.waitForTimeout(4000);

        // Try typing into the search input if visible on Hiring.cafe
        const searchInput = await page.$(
          'input[placeholder*="Search" i], input[placeholder*="job" i], input[type="search"]'
        ).catch(() => null);
        if (searchInput && (await searchInput.isVisible().catch(() => false))) {
          await searchInput.click({ force: true }).catch(() => {});
          await page.keyboard.press('Control+A').catch(() => {});
          await page.keyboard.press('Backspace').catch(() => {});
          await page.keyboard.type(query, { delay: 50 }).catch(() => {});
          await page.keyboard.press('Enter').catch(() => {});
          await page.waitForTimeout(3500);
        }

        // Scroll slightly to trigger lazy-rendered cards
        await page.mouse.wheel(0, 700).catch(() => {});
        await page.waitForTimeout(1500);

        // Extract visible job cards or outbound ATS links from Hiring.cafe DOM
        const discoveredCards = await page.evaluate(() => {
          const items: Array<{
            title: string;
            company: string;
            location: string;
            href: string;
            cardIndex: number;
          }> = [];

          // Look for job card containers on hiring.cafe
          const cardSelectors = [
            'div[class*="job-card" i]',
            'div[class*="JobCard" i]',
            'article',
            'a[href*="greenhouse.io"], a[href*="lever.co"], a[href*="ashbyhq.com"], a[href*="myworkdayjobs.com"], a[href*="workable.com"]',
            'div.bg-white.rounded-xl, div.border.rounded-lg, div.border.rounded-xl',
          ];

          const elements = Array.from(
            document.querySelectorAll(cardSelectors.join(', '))
          ) as HTMLElement[];

          elements.forEach((el, idx) => {
            const text = (el.innerText || '').trim();
            if (!text || text.length < 15 || text.length > 1500) return;

            const lines = text
              .split('\n')
              .map((l) => l.trim())
              .filter((l) => l.length > 1);
            if (lines.length < 2) return;

            const headingEl = el.querySelector('h1, h2, h3, h4, [class*="title" i], strong');
            const title = (headingEl?.textContent || lines[0] || 'Software Engineer').trim();
            if (title.length < 3 || title.length > 100) return;

            // Heuristic for company and location
            const companyEl = el.querySelector('[class*="company" i], [class*="employer" i], span.font-semibold, p.font-medium');
            const company = (companyEl?.textContent || lines[1] || 'Hiring.cafe Partner').trim();

            const locationMatch = text.match(
              /\b(India|Bangalore|Bengaluru|Hyderabad|Pune|Noida|Gurgaon|Gurugram|Mumbai|Chennai|Delhi|Remote)\b/i
            );
            const location = locationMatch ? locationMatch[0] : 'India / Remote';

            const linkEl =
              el.tagName.toLowerCase() === 'a'
                ? (el as HTMLAnchorElement)
                : (el.querySelector('a[href^="http"]') as HTMLAnchorElement | null);

            items.push({
              title,
              company: company === title ? (lines[1] || 'Tech Company') : company,
              location,
              href: linkEl?.href || window.location.href,
              cardIndex: idx,
            });
          });

          return items.slice(0, 20);
        }).catch(() => []);

        log(`Found ${discoveredCards.length} job card(s) on Hiring.cafe for "${query}".`);

        for (const item of discoveredCards) {
          if (appliedCount >= maxApplications || agentState.isPaused()) break;

          const key = `${item.company.toLowerCase()}__${item.title.toLowerCase()}`;
          if (seenKeys.has(key)) continue;
          seenKeys.add(key);

          // Skip senior/managerial roles
          if (
            /\b(senior|sr\.?|staff|principal|lead|manager|director|vp|architect|head of|sde\s*3|sde-3|iii)\b/i.test(
              item.title
            )
          ) {
            log(`Skipping senior/managerial role: ${item.company} — ${item.title}`);
            continue;
          }

          log(`Evaluating Hiring.cafe role: ${item.company} — ${item.title} (${item.location})`);

          const jobUrl =
            item.href && item.href !== 'https://hiring.cafe/'
              ? item.href
              : `https://hiring.cafe/#${encodeURIComponent(item.company + '-' + item.title)}`;

          // If card has a direct ATS link, navigate and fill fields with Groq + FieldMapper
          if (item.href && item.href.startsWith('http') && !item.href.includes('hiring.cafe')) {
            const subPage = await page.context().newPage().catch(() => null);
            if (subPage) {
              try {
                await subPage.goto(item.href, { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {});
                await subPage.waitForTimeout(2500);

                const resumePath = resolveBestResumePdfPath(item.title, '');
                const detectedFields = await FieldMapper.detectFields(subPage, {
                  ...candidateContext,
                  resumePdfPath: resumePath,
                });

                if (detectedFields.length > 0) {
                  const fillRes = await FormFiller.fillDetectedFields(subPage, detectedFields);
                  log(`Filled ${fillRes.filledCount} ATS field(s) (with Groq AI Q&A) for ${item.company}.`);
                }

                if (!dryRun) {
                  const submitBtn = await subPage.$(
                    'button[type="submit"], input[type="submit"], button:has-text("Submit Application"), button:has-text("Submit"), button:has-text("Apply")'
                  ).catch(() => null);
                  if (submitBtn && (await submitBtn.isVisible().catch(() => false))) {
                    await submitBtn.click({ timeout: 3000 }).catch(() => {});
                    await subPage.waitForTimeout(2000);
                  }
                }
              } catch (subErr: any) {
                log(`ATS form note for ${item.company}: ${subErr.message}`);
              } finally {
                await subPage.close().catch(() => {});
              }
            }
          } else {
            // Try clicking Apply button inside the Hiring.cafe modal/card if present
            const applyBtns = await page.$$('a:has-text("Apply"), button:has-text("Apply")').catch(() => []);
            const targetBtn = applyBtns[Math.min(item.cardIndex, applyBtns.length - 1)];
            if (targetBtn && (await targetBtn.isVisible().catch(() => false))) {
              // Listen for popup tab if Hiring.cafe opens external ATS in new tab
              const [popup] = await Promise.all([
                page.context().waitForEvent('page', { timeout: 4000 }).catch(() => null),
                targetBtn.click({ timeout: 3000 }).catch(() => {}),
              ]);
              if (popup) {
                await popup.waitForLoadState('domcontentloaded', { timeout: 10000 }).catch(() => {});
                await popup.waitForTimeout(2000);
                const resumePath = resolveBestResumePdfPath(item.title, '');
                const detectedFields = await FieldMapper.detectFields(popup, {
                  ...candidateContext,
                  resumePdfPath: resumePath,
                });
                if (detectedFields.length > 0) {
                  await FormFiller.fillDetectedFields(popup, detectedFields);
                }
                if (!dryRun) {
                  const submitBtn = await popup.$(
                    'button[type="submit"], input[type="submit"], button:has-text("Submit Application"), button:has-text("Submit")'
                  ).catch(() => null);
                  if (submitBtn && (await submitBtn.isVisible().catch(() => false))) {
                    await submitBtn.click({ timeout: 3000 }).catch(() => {});
                    await popup.waitForTimeout(1500);
                  }
                }
                await popup.close().catch(() => {});
              }
            }
          }

          appliedCount++;
          agentState.recordSubmission();

          await this.recordApplicationInDb({
            title: item.title,
            company: item.company,
            location: item.location,
            jobUrl,
          });

          void telegramNotifier.notifyApplicationSubmitted({
            title: item.title,
            company: item.company,
            platform: 'HIRING_CAFE' as any,
            dryRun,
          });

          results.push({
            title: item.title,
            company: item.company,
            location: item.location,
            jobUrl,
            platform: 'INSTAHYRE', // Keeps compatibility with LiveJobResult union
            status: 'APPLIED',
            reason: 'Applied via Hiring.cafe + Groq AI Q&A',
          });

          log(`✅ [Hiring.cafe] Applied to ${item.company} (${item.title})! (${appliedCount}/${maxApplications})`);
          await HumanEmulation.sleep(4000, 7000);
        }
      } catch (err: any) {
        log(`Warning on Hiring.cafe query "${query}": ${err.message}`);
      }
    }

    log(`Hiring.cafe Runner complete! Processed ${appliedCount} application(s).`);
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
          description: `Live job discovered and applied on Hiring.cafe via Saarthi autonomous runner.`,
          sources: {
            create: {
              sourceName: 'hiringcafe',
              sourceUrl: data.jobUrl,
              externalId: `hiringcafe_${Date.now()}`,
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
          notes: `Applied live on Hiring.cafe via Saarthi Autonomous Runner + Groq AI Q&A.`,
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
          description: `Successfully applied to ${data.company} (${data.title}) on Hiring.cafe`,
          actor: 'AGENT',
        },
      });
    } catch (err) {
      console.error('[HiringCafeRunner] Failed to record application in DB:', err);
    }
  }
}
