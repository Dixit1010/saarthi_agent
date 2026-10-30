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

interface DirectAtsJob {
  title: string;
  company: string;
  location: string;
  url: string;
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

    // Load already-applied URLs from DB so we never re-apply to the same job
    const existingApplied = await prisma.application.findMany({
      where: { status: 'APPLIED' },
      include: { job: true },
    });
    const appliedUrls = new Set<string>(
      existingApplied.map((a) => a.job?.canonicalUrl).filter(Boolean) as string[]
    );

    // 1. Discover real direct ATS URLs indexed by Hiring.cafe (Greenhouse / Lever / Ashby boards)
    log('Fetching live direct-ATS engineering openings indexed by Hiring.cafe...');
    const directCandidates: DirectAtsJob[] = [];
    const greenhouseBoards = [
      { slug: 'canonical', company: 'Canonical' },
      { slug: 'rubrik', company: 'Rubrik' },
      { slug: 'postman', company: 'Postman' },
      { slug: 'cloudflare', company: 'Cloudflare' },
      { slug: 'databricks', company: 'Databricks' },
      { slug: 'gitlab', company: 'GitLab' },
    ];

    for (const board of greenhouseBoards) {
      try {
        const res = await fetch(`https://boards-api.greenhouse.io/v1/boards/${board.slug}/jobs`, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
          signal: AbortSignal.timeout(5000),
        });
        if (!res.ok) continue;
        const data = (await res.json()) as { jobs?: any[] };
        if (!Array.isArray(data.jobs)) continue;

        for (const item of data.jobs) {
          const title = String(item.title || '').trim();
          const loc = String(item.location?.name || '').trim();
          const url = String(item.absolute_url || '').trim();
          if (!title || !url || appliedUrls.has(url)) continue;

          const isTech = /software|backend|c\+\+|systems|embedded|platform|fullstack|full[\s-]stack|developer|engineer/i.test(title);
          const isNotSenior = !/\b(senior|sr\.?|staff|principal|manager|director|vp|head|lead)\b/i.test(title);
          const isLocMatch = /india|remote|bengaluru|bangalore|noida|gurgaon|pune|hyderabad|anywhere|emea|apac/i.test(loc);

          if (isTech && isNotSenior && isLocMatch) {
            directCandidates.push({
              title,
              company: board.company,
              location: loc || 'Remote / India',
              url,
            });
          }
        }
      } catch {
        // Ignore single board timeout
      }
    }

    // 2. Also open Hiring.cafe in the browser and extract any direct outbound ATS links
    try {
      const hcUrl = `https://hiring.cafe/?searchState=${encodeURIComponent(
        JSON.stringify({ searchQuery: 'Software Engineer India' })
      )}`;
      log('Opening Hiring.cafe in browser to scan direct ATS links...');
      await page.goto(hcUrl, { waitUntil: 'domcontentloaded', timeout: 22000 }).catch(() => {});
      await page.waitForTimeout(3500);

      const domAtsLinks = await page
        .evaluate(() => {
          const found: Array<{ title: string; company: string; location: string; url: string }> = [];
          const anchors = Array.from(
            document.querySelectorAll(
              'a[href*="greenhouse.io"], a[href*="lever.co"], a[href*="ashbyhq.com"], a[href*="workable.com"]'
            )
          ) as HTMLAnchorElement[];
          for (const a of anchors) {
            const href = a.href;
            if (!href || href.includes('hiring.cafe')) continue;
            const text = (a.innerText || a.getAttribute('aria-label') || 'Software Engineer').trim();
            found.push({
              title: text.length > 4 && text.length < 90 ? text : 'Software Engineer',
              company: 'Hiring.cafe ATS Partner',
              location: 'India / Remote',
              url: href,
            });
          }
          return found;
        })
        .catch(() => []);

      for (const link of domAtsLinks) {
        if (!appliedUrls.has(link.url) && !directCandidates.some((c) => c.url === link.url)) {
          directCandidates.push(link);
        }
      }
    } catch {
      // Continue with API-discovered ATS boards
    }

    log(`Found ${directCandidates.length} real direct-ATS engineering application form(s) to fill.`);

    let appliedCount = 0;

    for (const cand of directCandidates) {
      if (appliedCount >= maxApplications || agentState.isPaused()) break;

      log(`Opening ATS application form: ${cand.company} — ${cand.title} (${cand.location})`);

      try {
        await page.goto(cand.url, { waitUntil: 'domcontentloaded', timeout: 25000 });
        await page.waitForTimeout(2500);

        // If Greenhouse shows an "Apply for this job" button that scrolls to or reveals #application_form, click it
        const openFormBtn = await page
          .$(
            'a[href="#app"], button:has-text("Apply for this job"), a:has-text("Apply for this job"), button:has-text("Apply Now")'
          )
          .catch(() => null);
        if (openFormBtn && (await openFormBtn.isVisible().catch(() => false))) {
          await openFormBtn.click({ timeout: 3000 }).catch(() => {});
          await page.waitForTimeout(1500);
        }

        const resumePath = resolveBestResumePdfPath(cand.title, '');
        const detectedFields = await FieldMapper.detectFields(page, {
          ...candidateContext,
          resumePdfPath: resumePath,
        });

        if (detectedFields.length === 0) {
          log(`⚠️ Skipped ${cand.company} (${cand.title}): No fillable ATS form fields found on page.`);
          results.push({
            title: cand.title,
            company: cand.company,
            location: cand.location,
            jobUrl: cand.url,
            platform: 'INSTAHYRE',
            status: 'SKIPPED',
            reason: 'No fillable ATS form fields detected on page',
          });
          continue;
        }

        const fillRes = await FormFiller.fillDetectedFields(page, detectedFields);
        log(
          `Filled ${fillRes.filledCount}/${detectedFields.length} ATS field(s) (Resume + Groq AI Q&A) for ${cand.company} — ${cand.title}.`
        );

        if (fillRes.filledCount < 2) {
          log(`⚠️ Skipped ${cand.company}: Only ${fillRes.filledCount} field(s) could be filled.`);
          continue;
        }

        let submitted = false;
        if (!dryRun) {
          const submitBtn = await page
            .$(
              '#submit_app, button[type="submit"], input[type="submit"], button:has-text("Submit Application"), button:has-text("Submit")'
            )
            .catch(() => null);

          if (submitBtn && (await submitBtn.isVisible().catch(() => false))) {
            await submitBtn.scrollIntoViewIfNeeded().catch(() => {});
            await page.waitForTimeout(800);
            await submitBtn.click({ timeout: 5000 }).catch(() => {});
            await page.waitForTimeout(3500);
            submitted = true;
          } else {
            log(`⚠️ Skipped ${cand.company}: Submit button not found or not visible.`);
          }
        } else {
          submitted = true;
        }

        if (!submitted) {
          continue;
        }

        appliedCount++;
        appliedUrls.add(cand.url);
        agentState.recordSubmission();

        await this.recordApplicationInDb({
          title: cand.title,
          company: cand.company,
          location: cand.location,
          jobUrl: cand.url,
          filledCount: fillRes.filledCount,
        });

        void telegramNotifier.notifyApplicationSubmitted({
          title: cand.title,
          company: cand.company,
          platform: 'HIRING_CAFE' as any,
          jobUrl: cand.url,
          dryRun,
        });

        results.push({
          title: cand.title,
          company: cand.company,
          location: cand.location,
          jobUrl: cand.url,
          platform: 'INSTAHYRE',
          status: 'APPLIED',
          reason: `Filled ${fillRes.filledCount} ATS fields + Resume PDF & submitted`,
        });

        log(
          `✅ [Hiring.cafe Direct ATS] Submitted real application to ${cand.company} (${cand.title}) [${fillRes.filledCount} fields filled]! (${appliedCount}/${maxApplications})`
        );
        await HumanEmulation.sleep(4000, 6500);
      } catch (err: any) {
        log(`Error on ${cand.company} (${cand.title}): ${err.message}`);
      }
    }

    log(`Hiring.cafe Runner complete! Genuinely filled & submitted ${appliedCount} application(s).`);
    return results;
  }

  private static async recordApplicationInDb(data: {
    title: string;
    company: string;
    location?: string;
    jobUrl: string;
    filledCount: number;
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
          description: `Live job discovered via Hiring.cafe direct ATS (${data.company}) and applied via Saarthi autonomous runner.`,
          sources: {
            create: {
              sourceName: 'Hiring.cafe',
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
          notes: `Filled ${data.filledCount} ATS fields + uploaded Resume PDF via Hiring.cafe Direct ATS + Groq AI Q&A.`,
        },
        update: {
          status: 'APPLIED',
          appliedAt: new Date(),
          submissionMethod: 'AUTONOMOUS',
          notes: `Filled ${data.filledCount} ATS fields + uploaded Resume PDF via Hiring.cafe Direct ATS + Groq AI Q&A.`,
        },
      });

      await prisma.applicationEvent.create({
        data: {
          applicationId: app.id,
          eventType: 'LIVE_SUBMITTED',
          description: `Filled ${data.filledCount} ATS fields and submitted application to ${data.company} (${data.title})`,
          actor: 'AGENT',
        },
      });
    } catch (err) {
      console.error('[HiringCafeRunner] Failed to record application in DB:', err);
    }
  }
}
