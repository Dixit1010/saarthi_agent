import { Page } from 'playwright';
import { prisma } from '@saarthi/database';
import { getAgentConfig } from '../configLoader.js';
import { LiveJobResult } from './linkedinLiveRunner.js';
import { HumanEmulation } from './humanEmulation.js';
import { ManualAuthHelper } from './manualAuthHelper.js';
import { agentState } from '../state/agentStateManager.js';
import { telegramNotifier } from '../telegram/telegramNotifier.js';

export interface InstahyreRunOptions {
  page: Page;
  maxApplications?: number;
  dryRun?: boolean;
  manualAuthTimeoutSeconds?: number;
  interactive?: boolean;
  onProgress?: (message: string) => void;
}

export class InstahyreLiveRunner {
  static async run(options: InstahyreRunOptions): Promise<LiveJobResult[]> {
    const { page, onProgress, dryRun = false } = options;
    const config = getAgentConfig();
    const maxApplications = options.maxApplications || config.automation.dailyApplicationLimit || 15;
    const results: LiveJobResult[] = [];

    const log = (msg: string) => {
      console.log(`[InstahyreRunner] ${msg}`);
      if (onProgress) onProgress(msg);
    };

    const targetUrl = 'https://www.instahyre.com/candidate/opportunities/';
    log(`Navigating to Instahyre candidate opportunities...`);
    log(`URL: ${targetUrl}`);

    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch((e) => {
      log(`Navigation warning: ${e.message}`);
    });

    await page.waitForTimeout(3500);

    // 1. Verify Authentication & Handle Manual Login / Verification cleanly
    const authResult = await ManualAuthHelper.ensureAuthenticated({
      page,
      platform: 'INSTAHYRE',
      timeoutSeconds: options.manualAuthTimeoutSeconds,
      interactive: options.interactive,
      onLog: (m) => log(`[Auth] ${m}`),
    });

    if (!authResult.authenticated) {
      log(`Stopping Instahyre live runner: ${authResult.reason || 'Authentication required'}`);
      results.push({
        title: 'Instahyre Opportunities',
        company: 'Instahyre',
        platform: 'INSTAHYRE',
        jobUrl: page.url(),
        status: 'SKIPPED',
        reason: authResult.reason || 'Authentication required: User not logged in to Instahyre',
      });
      return results;
    }

    if (!page.url().includes('/candidate/opportunities')) {
      await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 25000 }).catch(() => {});
      await page.waitForTimeout(3500);
    }

    let appliedCount = 0;
    const seenJobKeys = new Set<string>();

    // Helper to process currently visible employer rows on the page
    const processVisibleOpportunities = async (phaseLabel: string) => {
      await page
        .waitForSelector('div.employer-row', { timeout: 6000 })
        .catch(() => {});

      const rowCount = await page.$$eval('div.employer-row', (els) => els.length).catch(() => 0);
      log(`[${phaseLabel}] Found ${rowCount} opportunity card(s) on Instahyre.`);

      for (let i = 0; i < rowCount; i++) {
        if (appliedCount >= maxApplications) {
          log(`Reached daily application limit (${maxApplications}). Stopping.`);
          break;
        }
        if (agentState.isPaused()) {
          log('Agent is currently PAUSED. Halting Instahyre scan at card checkpoint.');
          break;
        }

        // Re-query handles dynamically since AngularJS may re-render the list after modal actions
        const rows = await page.$$('div.employer-row');
        const card = rows[i];
        if (!card) continue;

        try {
          await card.scrollIntoViewIfNeeded().catch(() => {});

          const info = await card.evaluate((el) => {
            const jobNameEl = el.querySelector('.employer-job-name h2, .employer-job-name, .company-name');
            const rawHeader =
              jobNameEl?.getAttribute('title')?.trim() ||
              jobNameEl?.textContent?.replace(/\s+/g, ' ').trim() ||
              '';

            let company = 'Company';
            let title = 'Software Engineer';
            if (rawHeader.includes(' - ')) {
              const parts = rawHeader.split(' - ');
              company = (parts[0] || 'Company').trim();
              title = parts.slice(1).join(' - ').trim() || 'Software Engineer';
            } else if (rawHeader) {
              title = rawHeader;
            }

            const locEl = el.querySelector('.chip-location, .employer-locations, .location');
            const location = locEl?.textContent?.replace(/\s+/g, ' ').trim() || 'India';
            const text = (el as HTMLElement).innerText || el.textContent || '';

            const isAlreadyApplied =
              /\b(Application sent|Already applied|Under Review)\b/i.test(text) &&
              !text.includes('View job');

            // Extract real Instahyre job URL from DOM anchor or AngularJS scope
            let directJobUrl = '';
            const jobAnchor = el.querySelector('a[href*="/job-"], a[href*="instahyre.com/job-"]') as HTMLAnchorElement | null;
            if (jobAnchor?.href) {
              directJobUrl = jobAnchor.href;
            } else {
              try {
                const ng = (window as any).angular;
                if (ng) {
                  const scope = ng.element(el).scope();
                  const opp = scope?.opp || scope?.opportunity || scope?.employer;
                  const pubUrl = opp?.public_url || opp?.job?.public_url || opp?.share_url || opp?.url;
                  if (pubUrl) {
                    directJobUrl = pubUrl.startsWith('http') ? pubUrl : `https://www.instahyre.com${pubUrl}`;
                  } else if (opp?.id || opp?.opportunity_id) {
                    directJobUrl = `https://www.instahyre.com/candidate/opportunities/?opportunity_id=${opp.id || opp.opportunity_id}`;
                  }
                }
              } catch {
                // Fallback handled below
              }
            }

            return {
              company,
              title,
              location,
              directJobUrl,
              fullText: text.toLowerCase(),
              isAlreadyApplied,
            };
          });

          const jobKey = `${info.company.toLowerCase()}::${info.title.toLowerCase()}`;
          if (seenJobKeys.has(jobKey)) continue;
          seenJobKeys.add(jobKey);

          const currentUrl = info.directJobUrl || page.url();
          log(`Inspecting [${i + 1}/${rowCount}]: ${info.title} at ${info.company} (${info.location})`);

          if (info.isAlreadyApplied) {
            log(`Skipping: Already applied to ${info.company}.`);
            results.push({
              title: info.title,
              company: info.company,
              location: info.location,
              jobUrl: currentUrl,
              platform: 'INSTAHYRE',
              status: 'ALREADY_APPLIED',
              reason: 'Already applied on Instahyre',
            });
            continue;
          }

          // Exclude Senior / Lead / Staff / Principal / Manager / Director / SDE-2+ roles
          if (
            /\b(senior|sr\.?|staff|principal|lead|manager|director|architect|vp|head|founding|sde\s*[234]|sde-[234]|sde\s*(ii|iii|iv)|engineer\s*(ii|iii|iv|[234]))\b/i.test(
              info.title
            )
          ) {
            log(`Skipping senior/leadership role: ${info.title}`);
            results.push({
              title: info.title,
              company: info.company,
              location: info.location,
              jobUrl: currentUrl,
              platform: 'INSTAHYRE',
              status: 'SKIPPED',
              reason: 'Excluded seniority level',
            });
            continue;
          }

          // Find "View job »" button or card trigger link
          const viewBtn = await card.$(
            'button.btn-interested, button#interested-btn, a#employer-profile-opportunity, button:has-text("View"), button:has-text("Apply")'
          );

          if (!viewBtn || !(await viewBtn.isVisible().catch(() => false))) {
            log(`No active View/Apply button on card. Skipping.`);
            continue;
          }

          if (dryRun) {
            log(`[DRY RUN] Would open and click Apply for ${info.company} (${info.title}).`);
            void telegramNotifier.notifyApplicationSubmitted({
              title: info.title,
              company: info.company,
              platform: 'INSTAHYRE',
              jobUrl: currentUrl,
              dryRun: true,
            });
            results.push({
              title: info.title,
              company: info.company,
              location: info.location,
              jobUrl: currentUrl,
              platform: 'INSTAHYRE',
              status: 'APPLIED',
              reason: 'Dry run completed successfully',
            });
            appliedCount++;
            continue;
          }

          log(`Opening job modal for ${info.company} (${info.title})...`);
          await HumanEmulation.naturalClick(page, viewBtn);
          await HumanEmulation.sleep(1800, 2800);

          // Wait for the modal's primary "Apply" button (`button.btn-lg.btn-primary.new-btn`)
          const modalApplyBtn = await page
            .waitForSelector(
              'button.btn-primary.new-btn:has-text("Apply"), .application-modal button:has-text("Apply"), .modal-dialog button:has-text("Apply"), button.btn-lg.btn-primary:has-text("Apply")',
              { timeout: 6000 }
            )
            .catch(() => null);

          if (!modalApplyBtn || !(await modalApplyBtn.isVisible().catch(() => false))) {
            log(`Apply button not visible inside modal (may already be applied). Closing modal.`);
            await page.keyboard.press('Escape').catch(() => {});
            await page.waitForTimeout(800);
            continue;
          }

          // Extract direct job URL from the open modal if not already found on card
          const modalJobUrl = await page
            .evaluate(() => {
              const a = document.querySelector(
                '.application-modal a[href*="/job-"], .modal-dialog a[href*="/job-"], a[href*="instahyre.com/job-"]'
              ) as HTMLAnchorElement | null;
              if (a?.href) return a.href;
              try {
                const ng = (window as any).angular;
                const modalEl = document.querySelector('.application-modal, .employer-profile-modal, .modal-dialog');
                if (ng && modalEl) {
                  const s = ng.element(modalEl).scope();
                  const opp = s?.opp || s?.opportunity || s?.employer || s?.currentOpportunity;
                  const pub = opp?.public_url || opp?.job?.public_url || opp?.share_url;
                  if (pub) return pub.startsWith('http') ? pub : `https://www.instahyre.com${pub}`;
                  if (opp?.id || opp?.opportunity_id) {
                    return `https://www.instahyre.com/candidate/opportunities/?opportunity_id=${opp.id || opp.opportunity_id}`;
                  }
                }
              } catch {
                // Ignore
              }
              return window.location.href;
            })
            .catch(() => '');

          const resolvedJobUrl = info.directJobUrl || modalJobUrl || targetUrl;

          // Simulate brief human reading pause before clicking Apply inside the modal
          await HumanEmulation.sleep(1500, 2800);
          log(`Clicking "Apply" inside modal for ${info.company}...`);
          await HumanEmulation.naturalClick(page, modalApplyBtn);
          await HumanEmulation.sleep(1800, 2800);

          // Check if a secondary confirmation/note popup appeared
          const confirmBtn = await page.$(
            '.modal-dialog button:has-text("Confirm"), .modal-dialog button:has-text("Yes"), .sweet-alert button.confirm'
          ).catch(() => null);
          if (confirmBtn && (await confirmBtn.isVisible().catch(() => false))) {
            await HumanEmulation.naturalClick(page, confirmBtn);
            await HumanEmulation.sleep(1500, 2200);
          }

          // Close the opportunity modal if still open so we return cleanly to the list
          const closeModalBtn = await page.$(
            '.application-modal .close, .modal-header .close, button.close, .back-to-results'
          ).catch(() => null);
          if (closeModalBtn && (await closeModalBtn.isVisible().catch(() => false))) {
            await closeModalBtn.click({ timeout: 2000 }).catch(() => {});
          } else {
            await page.keyboard.press('Escape').catch(() => {});
          }
          await page.waitForTimeout(1000);

          appliedCount++;
          agentState.recordSubmission();

          const realPostingUrl =
            resolvedJobUrl !== targetUrl
              ? resolvedJobUrl
              : `${targetUrl}#${encodeURIComponent(info.company + '-' + info.title)}`;

          await this.recordApplicationInDb({
            title: info.title,
            company: info.company,
            location: info.location,
            jobUrl: realPostingUrl,
            platform: 'INSTAHYRE',
          });

          void telegramNotifier.notifyApplicationSubmitted({
            title: info.title,
            company: info.company,
            platform: 'INSTAHYRE',
            jobUrl: resolvedJobUrl,
            dryRun: false,
          });

          results.push({
            title: info.title,
            company: info.company,
            location: info.location,
            jobUrl: currentUrl,
            platform: 'INSTAHYRE',
            status: 'APPLIED',
          });

          log(`✅ Applied to ${info.company} (${info.title})! Total applied on Instahyre: ${appliedCount}`);

          // Polite human cadence between applications (8 to 14 seconds)
          const delaySeconds = HumanEmulation.randomBetween(8, 14);
          log(`Waiting ${delaySeconds}s before next Instahyre opportunity...`);
          await HumanEmulation.sleep(delaySeconds * 1000, (delaySeconds + 1) * 1000);
        } catch (err: any) {
          log(`Error processing Instahyre card: ${err.message}`);
          await page.keyboard.press('Escape').catch(() => {});
        }
      }
    };

    // 2. First check default Recommended Opportunities tab
    log('Checking Recommended Opportunities tab...');
    await processVisibleOpportunities('Recommended');

    // 3. If we haven't reached maxApplications (e.g. Recommended jobs = 0), actively search by skill clusters
    const searchSkills = ['C++', 'Node.js', 'Embedded C', 'Python', 'React'];

    for (const skill of searchSkills) {
      if (appliedCount >= maxApplications || agentState.isPaused()) break;

      log(`Searching Instahyre opportunities for skill: "${skill}"...`);
      try {
        // Ensure any lingering employer profile modal or overlay is dismissed before interacting with search box
        const lingeringModalClose = await page.$(
          '[ng-click="closeModal()"], button.close, .employer-profile-modal .modal-close, .modal-header .close'
        ).catch(() => null);
        if (lingeringModalClose && (await lingeringModalClose.isVisible().catch(() => false))) {
          await lingeringModalClose.click({ force: true }).catch(() => {});
          await page.waitForTimeout(500);
        }
        await page.keyboard.press('Escape').catch(() => {});
        await page.waitForTimeout(300);

        // Clear any existing selected skill pills in selectize input
        const removeBtns = await page.$$('.skills-drop-select-job-search .selectize-input a.remove');
        for (const rb of removeBtns) {
          await rb.click({ force: true }).catch(() => {});
          await page.waitForTimeout(200);
        }

        const skillInput = await page.$('#skills-drop-select-job-search-selectized');
        if (!skillInput) {
          log('Skill search input not found on Instahyre page; skipping search phase.');
          break;
        }

        await skillInput.click({ timeout: 3000, force: true });
        await page.keyboard.press('Control+A').catch(() => {});
        await page.keyboard.press('Backspace').catch(() => {});
        await page.keyboard.type(skill, { delay: 75 });
        await page.waitForTimeout(1800);

        // Click matching option from selectize dropdown if visible, otherwise press Enter
        const dropdownOpt = await page.$(
          '.skills-drop-select-job-search .selectize-dropdown-content .option.active, .skills-drop-select-job-search .selectize-dropdown-content .option'
        ).catch(() => null);
        if (dropdownOpt && (await dropdownOpt.isVisible().catch(() => false))) {
          await dropdownOpt.click({ timeout: 2000 }).catch(() => {});
        } else {
          await page.keyboard.press('Enter');
        }
        await page.waitForTimeout(700);

        const searchBtn = await page.$('button.skills-search-btn, button:has-text("Search")');
        if (searchBtn && (await searchBtn.isVisible().catch(() => false))) {
          await searchBtn.click({ timeout: 4000 });
          await page.waitForTimeout(3500);
        }

        await processVisibleOpportunities(`Search: ${skill}`);
      } catch (err: any) {
        log(`Skill search warning for "${skill}": ${err.message}`);
      }
    }

    log(`Instahyre Runner complete! Successfully submitted ${appliedCount} application(s).`);
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
              externalId: `instahyre_${Date.now()}`,
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
      console.warn('[InstahyreRunner] DB recording warning:', e.message);
    }
  }
}
