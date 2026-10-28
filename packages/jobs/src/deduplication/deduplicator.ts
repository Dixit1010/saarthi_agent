import { NormalizedJobData } from '../types.js';

/**
 * Checks if an incoming normalized job is a duplicate of any existing job in the database.
 * Uses canonical URL, company matching, normalized title similarity, and text similarity.
 */
export function isDuplicateJob(
  incoming: NormalizedJobData,
  existingJobs: { id: string; canonicalUrl: string; company: string; title: string; location: string }[]
): { isDuplicate: boolean; matchedJobId?: string; reason?: string } {
  const normIncTitle = normalizeTitle(incoming.title);
  const normIncCompany = normalizeCompany(incoming.company);

  for (const existing of existingJobs) {
    // 1. Direct canonical URL match
    if (existing.canonicalUrl.toLowerCase() === incoming.canonicalUrl.toLowerCase()) {
      return { isDuplicate: true, matchedJobId: existing.id, reason: 'Canonical URL match' };
    }

    // 2. Same company and same normalized title
    const normExtTitle = normalizeTitle(existing.title);
    const normExtCompany = normalizeCompany(existing.company);

    if (normIncCompany === normExtCompany && normIncCompany.length > 1) {
      if (normIncTitle === normExtTitle) {
        return { isDuplicate: true, matchedJobId: existing.id, reason: 'Company and Title match' };
      }

      // Title fuzzy/token overlap check (e.g. "Backend Engineer" vs "Backend Engineer (SDE-1)")
      const titleSimilarity = calculateTokenOverlap(normIncTitle, normExtTitle);
      if (titleSimilarity >= 0.8) {
        return {
          isDuplicate: true,
          matchedJobId: existing.id,
          reason: `High title similarity (${Math.round(titleSimilarity * 100)}%) at same company`,
        };
      }
    }
  }

  return { isDuplicate: false };
}

function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\b(junior|senior|staff|lead|sde|sde-1|sde-2|sde-i|sde-ii|developer|engineer)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeCompany(company: string): string {
  return company
    .toLowerCase()
    .replace(/\b(inc|ltd|pvt|llc|technologies|labs|corp|corporation)\b/g, '')
    .replace(/[^\w\s]/g, '')
    .trim();
}

function calculateTokenOverlap(s1: string, s2: string): number {
  const set1 = new Set(s1.split(' ').filter(Boolean));
  const set2 = new Set(s2.split(' ').filter(Boolean));
  if (set1.size === 0 || set2.size === 0) return 0;

  let intersection = 0;
  for (const token of set1) {
    if (set2.has(token)) intersection++;
  }

  return (2 * intersection) / (set1.size + set2.size);
}
