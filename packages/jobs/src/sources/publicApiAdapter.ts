import { JobSourceAdapter } from './adapter.js';
import { RawJobPosting } from '../types.js';
import { getAgentConfig } from '../configLoader.js';

export class PublicJobApiAdapter implements JobSourceAdapter {
  readonly name = 'PUBLIC_JOB_API';

  async fetchJobs(enabledPlatforms?: string[]): Promise<RawJobPosting[]> {
    const jobs: RawJobPosting[] = [];
    const config = getAgentConfig();

    const isPlatformEnabled = (platformKey: string) => {
      if (!enabledPlatforms || enabledPlatforms.length === 0) return true;
      return enabledPlatforms.some((p) => p.toUpperCase() === platformKey.toUpperCase());
    };

    // Target tech keywords dynamically loaded from user config
    const customKeywords = config.searchPreferences.keywords;
    const baseKeywords = [
      'software', 'developer', 'engineer', 'backend', 'fullstack', 'full-stack', 'frontend',
      'node', 'typescript', 'c\\+\\+', 'c/c\\+\\+', 'embedded', 'firmware', 'mts', 'systems',
      'cadence', 'synopsys', 'siemens', 'nxp', 'qualcomm', 'nvidia', 'amd', 'intel', 'cisco'
    ];
    const techRegex = new RegExp(
      `(${[
        ...(customKeywords || []),
        ...baseKeywords
      ].map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`,
      'i'
    );

    // -------------------------------------------------------------
    // 1. STREAM 1: LinkedIn Live Public Job Scraper
    // -------------------------------------------------------------
    if (isPlatformEnabled('LINKEDIN')) try {
      const customQueries = config.searchPreferences.customSearchQueries || [];
      const past24HoursParam = config.searchPreferences.past24HoursOnly ? '&f_TPR=r86400' : '';

      const targetRoles = config.searchPreferences.targetRoles.length > 0
        ? config.searchPreferences.targetRoles
        : ['Software Developer', 'Backend Engineer'];
      const targetLocations = config.searchPreferences.targetLocations.length > 0
        ? config.searchPreferences.targetLocations
        : ['India', 'Bengaluru'];

      // Dynamically combine candidate's target roles and preferred locations, or use custom boolean queries
      const linkedInQueries: Array<{ keywords: string; location: string }> = [];

      if (customQueries.length > 0) {
        for (const cq of customQueries) {
          linkedInQueries.push({
            keywords: cq,
            location: 'India',
          });
        }
      } else {
        for (let idx = 0; idx < Math.min(targetRoles.length, 3); idx++) {
          linkedInQueries.push({
            keywords: targetRoles[idx] || 'Software Developer',
            location: targetLocations[idx % targetLocations.length] || 'India',
          });
        }
      }

      for (const q of linkedInQueries) {
        try {
          const hasNotSenior = /not\s*\([^)]*(senior|sr|lead|staff|principal|manager)/i.test(q.keywords);
          const isCustomQuery = customQueries.includes(q.keywords);
          const isTargetedEda = /siemens|eda|cadence|synopsys/i.test(q.keywords);
          const timeParam = isTargetedEda ? '' : past24HoursParam;

          const candidatesToEnrich: Array<{
            title: string;
            company: string;
            location: string;
            url: string;
            jobId?: string;
          }> = [];

          // Multi-page fetch: Page 0 (start=0) and Page 1 (start=25) for high yield
          for (const startOffset of [0, 25]) {
            try {
              const searchUrl = `https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?keywords=${encodeURIComponent(q.keywords)}&location=${encodeURIComponent(q.location)}${timeParam}&start=${startOffset}`;
              const res = await fetch(searchUrl, {
                headers: {
                  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                  'Accept': 'text/html,application/xhtml+xml',
                },
                signal: AbortSignal.timeout(6000),
              });

              if (res.ok) {
                const html = await res.text();
                const items = html.split('</li>');

                for (const item of items) {
                  const titleMatch = item.match(/base-search-card__title[^>]*>([\s\S]*?)<\/h3>/);
                  const compMatch = item.match(/base-search-card__subtitle[^>]*>([\s\S]*?)<\/h4>/);
                  const locMatch = item.match(/job-search-card__location[^>]*>([\s\S]*?)<\/span>/);
                  const linkMatch = item.match(/href="([^"]*)"/);
                  const urnMatch = item.match(/data-entity-urn="urn:li:jobPosting:(\d+)"/);

                  if (titleMatch?.[1] && linkMatch?.[1]) {
                    const title = cleanHtml(titleMatch[1]);

                    // Respect negative NOT Senior/Lead/Staff filters
                    if (hasNotSenior && /\b(senior|sr\.?|lead|staff|principal|manager|head|director)\b/i.test(title)) {
                      continue;
                    }

                    // For custom queries, trust user's boolean search; for generic roles, check tech regex
                    if (!isCustomQuery && !techRegex.test(title)) {
                      continue;
                    }

                    const company = compMatch?.[1] ? cleanHtml(compMatch[1]) : 'Tech Employer';
                    const location = locMatch?.[1] ? cleanHtml(locMatch[1]) : q.location;
                    const url = linkMatch[1].split('?')[0] || linkMatch[1];
                    const jobId = urnMatch?.[1] ? urnMatch[1] : undefined;

                    // Avoid duplicate cards within the same query run
                    if (!candidatesToEnrich.some((c) => c.url === url || (jobId && c.jobId === jobId))) {
                      candidatesToEnrich.push({ title, company, location, url, jobId });
                    }

                    if (candidatesToEnrich.length >= 25) break;
                  }
                }
              }
            } catch {
              // Ignore single page error
            }

            if (candidatesToEnrich.length >= 25) break;
            await new Promise((resolve) => setTimeout(resolve, 400));
          }

          // Concurrently enrich descriptions
          await Promise.allSettled(
            candidatesToEnrich.map(async (cand) => {
              let description = `${cand.title} opportunity at ${cand.company} in ${cand.location}. Key requirements: Solid engineering foundation, software design, and problem solving.`;
              if (cand.jobId) {
                try {
                  const detailRes = await fetch(`https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/${cand.jobId}`, {
                    headers: {
                      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    },
                    signal: AbortSignal.timeout(2000),
                  });
                  if (detailRes.ok) {
                    const detailHtml = await detailRes.text();
                    const descMatch = detailHtml.match(/show-more-less-html__markup[^>]*>([\s\S]*?)<\/div>/);
                    if (descMatch?.[1]) {
                      description = cleanHtml(descMatch[1]);
                    }
                  }
                } catch {
                  // Fall back to generated summary
                }
              }

              jobs.push({
                title: cand.title,
                company: cand.company,
                location: cand.location,
                description,
                url: cand.url,
                source: 'LinkedIn',
                employmentType: 'Full-time',
                salaryText: 'Competitive (Market Standard)',
                postedAt: new Date(),
              });
            })
          );
        } catch {
          // Graceful query fallback
        }
        // Polite delay to prevent rate limiting
        await new Promise((resolve) => setTimeout(resolve, 600));
      }
    } catch {
      // Graceful LinkedIn scraper fallback
    }

    // -------------------------------------------------------------
    // 2. STREAM 2: Siemens Official Direct Careers Portal (jobs.siemens.com)
    // -------------------------------------------------------------
    if (isPlatformEnabled('SIEMENS')) try {
      const siemensQueries = [
        'https://jobs.siemens.com/en_US/externaljobs/SearchJobs/Siemens%20EDA',
        'https://jobs.siemens.com/en_US/externaljobs/SearchJobs/EDA',
        'https://jobs.siemens.com/en_US/externaljobs/SearchJobs/Noida',
        'https://jobs.siemens.com/en_US/externaljobs/SearchJobs/C%2B%2B/India',
        'https://jobs.siemens.com/en_US/externaljobs/SearchJobs/Software/India',
      ];

      const seenSiemensIds = new Set<string>();

      for (const qUrl of siemensQueries) {
        try {
          const res = await fetch(qUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            },
            signal: AbortSignal.timeout(6000),
          });
          if (!res.ok) continue;
          const html = await res.text();

          const re = /<a[^>]*class="link"[^>]*href="([^"]*JobDetail\/(\d+))"[^>]*>([\s\S]*?)<\/a>/gi;
          let match: RegExpExecArray | null;
          while ((match = re.exec(html)) !== null) {
            const fullUrl = match[1];
            const jobId = match[2];
            const rawTitle = match[3];

            if (!fullUrl || !jobId || !rawTitle || seenSiemensIds.has(jobId)) continue;
            const title = rawTitle.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
            if (!title) continue;

            // Filter for engineering, software, EDA, C++, AI, or technical titles
            if (!techRegex.test(title) && !/eda|analog|chip|embedded|firmware|c\+\+|validation|software|engineer/i.test(title)) {
              continue;
            }

            // Exclude senior or non-technical business roles
            if (/\b(senior|sr\.?|lead|staff|principal|manager|head|director|sales|fire|commodity|account)\b/i.test(title)) {
              continue;
            }

            seenSiemensIds.add(jobId);

            jobs.push({
              title,
              company: 'Siemens EDA',
              location: qUrl.includes('Noida') ? 'Noida, India' : 'India (Noida / Bengaluru / Pune)',
              description: `${title} opportunity at Siemens EDA / Siemens Digital Industries Software. Official listing ID: ${jobId}. Verified opening on jobs.siemens.com.`,
              url: fullUrl,
              source: 'Siemens Careers Portal',
              employmentType: 'Full-time',
              salaryText: 'Competitive (Siemens EDA Standard)',
              postedAt: new Date(),
            });
          }
        } catch {
          // Graceful query fallback
        }
        await new Promise((r) => setTimeout(r, 400));
      }
    } catch {
      // Graceful Siemens scraper fallback
    }

    // -------------------------------------------------------------
    // 3. STREAM 3: Amazon Official Careers Portal (amazon.jobs)
    // -------------------------------------------------------------
    if (isPlatformEnabled('AMAZON')) try {
      const amazonQueries = [
        'Software Development Engineer I',
        'Software Development Engineer',
        'Embedded Software Engineer',
        'Device Software Engineer',
        'C++ Software Engineer',
      ];

      const seenAmazonIds = new Set<string>();

      for (const aq of amazonQueries) {
        try {
          const searchUrl = `https://www.amazon.jobs/en/search.json?base_query=${encodeURIComponent(aq)}&country=IND&offset=0&result_limit=15&sort=recent`;
          const res = await fetch(searchUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
              'Accept': 'application/json',
            },
            signal: AbortSignal.timeout(6000),
          });

          if (!res.ok) continue;
          const data = (await res.json()) as { jobs?: any[] };
          if (!Array.isArray(data.jobs)) continue;

          for (const item of data.jobs) {
            const jobId = String(item.id_icims || item.id || '');
            const title = String(item.title || '').trim();
            const jobPath = String(item.job_path || '').trim();

            if (!jobId || !title || !jobPath || seenAmazonIds.has(jobId)) continue;

            // Exclude managerial, intern, or senior/SDE-3 roles
            if (
              item.is_manager === 1 ||
              /\b(senior|sr\.?|lead|staff|principal|manager|head|director|sde\s*iii|sde-3|engineer\s*iii)\b/i.test(title)
            ) {
              continue;
            }

            seenAmazonIds.add(jobId);

            const fullDesc = [
              item.description_short || '',
              item.basic_qualifications ? `Basic Qualifications: ${item.basic_qualifications}` : '',
              item.preferred_qualifications ? `Preferred Qualifications: ${item.preferred_qualifications}` : '',
              item.description || '',
            ]
              .filter(Boolean)
              .join(' ');

            const city = item.city ? `${item.city}, India` : item.normalized_location || 'India';

            jobs.push({
              title,
              company: 'Amazon',
              location: city,
              description: cleanHtml(fullDesc || `${title} at Amazon (${city})`),
              url: jobPath.startsWith('http') ? jobPath : `https://www.amazon.jobs${jobPath}`,
              source: 'Amazon Careers',
              employmentType: item.job_schedule_type || 'Full-time',
              salaryText: 'Competitive (Amazon SDE Compensation)',
              postedAt: item.posted_date ? new Date(item.posted_date) : new Date(),
            });
          }
        } catch {
          // Graceful query fallback
        }
        await new Promise((r) => setTimeout(r, 350));
      }
    } catch {
      // Graceful Amazon scraper fallback
    }

    // -------------------------------------------------------------
    // 4. STREAM 4: RemoteOK Live Tech Stream
    // -------------------------------------------------------------
    if (isPlatformEnabled('OTHER') || isPlatformEnabled('REMOTEOK')) try {
      const res = await fetch('https://remoteok.com/api', {
        headers: { 'User-Agent': 'SaarthiJobAgent/1.0 (Mozilla/5.0)' },
        signal: AbortSignal.timeout(5000),
      });

      if (res.ok) {
        const raw = (await res.json()) as any[];
        if (Array.isArray(raw)) {
          const techPostings = raw
            .filter((j) => j && j.id && j.position && techRegex.test(j.position))
            .slice(0, 10);

          for (const item of techPostings) {
            jobs.push({
              title: item.position,
              company: item.company || 'Tech Company',
              location: item.location || 'Remote',
              description: cleanHtml(item.description || `${item.position} at ${item.company}`),
              url: item.url || `https://remoteok.com/remote-jobs/${item.id}`,
              source: 'RemoteOK',
              employmentType: 'Full-time',
              salaryText: item.salary || undefined,
              postedAt: item.date ? new Date(item.date) : new Date(),
            });
          }
        }
      }
    } catch {
      // Graceful feed timeout
    }

    return jobs;
  }
}

function cleanHtml(html: string): string {
  return html.replace(/<[^>]*>?/gm, ' ').replace(/\s+/g, ' ').trim();
}
