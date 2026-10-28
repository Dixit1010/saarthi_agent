import { RawJobPosting, NormalizedJobData } from '../types.js';

/**
 * Normalizes raw job posting records into a consistent schema per Prompt Section 8.
 */
export function normalizeJob(raw: RawJobPosting): NormalizedJobData {
  const title = cleanText(raw.title);
  const company = cleanText(raw.company);
  const location = cleanText(raw.location || 'India');
  const locationType = detectLocationType(raw.location, raw.description);
  const employmentType = detectEmploymentType(raw.employmentType, raw.title, raw.description);
  const { min: expMin, max: expMax } = parseExperience(raw.experienceText || raw.description);
  const { min: salMin, max: salMax, currency } = parseSalary(raw.salaryText || raw.description);
  const skills = extractCommonSkills(raw.description + ' ' + raw.title);

  // Normalize canonical URL (strip tracking query params like utm_*)
  let canonicalUrl = raw.url;
  try {
    const parsedUrl = new URL(raw.url);
    parsedUrl.searchParams.delete('utm_source');
    parsedUrl.searchParams.delete('utm_medium');
    parsedUrl.searchParams.delete('utm_campaign');
    canonicalUrl = parsedUrl.toString();
  } catch {
    canonicalUrl = raw.url.trim();
  }

  return {
    canonicalUrl,
    title,
    company,
    location,
    locationType,
    employmentType,
    description: raw.description.trim(),
    salaryMin: salMin,
    salaryMax: salMax,
    salaryCurrency: currency,
    experienceMin: expMin,
    experienceMax: expMax,
    skills,
    source: raw.source || 'CAREER_PAGE',
    postedAt: raw.postedAt ? new Date(raw.postedAt) : null,
    discoveredAt: new Date(),
  };
}

export function parseExperience(text: string): { min: number | null; max: number | null } {
  // Matches "1-3 yrs", "1 to 3 years", "1–3 years", "0 - 2 YOE"
  const rangeMatch = text.match(/(\d+)\s*(?:-|to|–)\s*(\d+)\s*(?:yrs|years|yoe|year)/i);
  if (rangeMatch && rangeMatch[1] && rangeMatch[2]) {
    return {
      min: parseInt(rangeMatch[1], 10),
      max: parseInt(rangeMatch[2], 10),
    };
  }

  // Matches "2+ years", "3+ yrs", "min 2 years"
  const plusMatch = text.match(/(\d+)\s*\+\s*(?:yrs|years|yoe|year)/i);
  if (plusMatch && plusMatch[1]) {
    const val = parseInt(plusMatch[1], 10);
    return { min: val, max: val + 2 };
  }

  // Fresher / 0 years
  if (/fresher|entry[\s-]level|0\s*(?:yrs|years)/i.test(text)) {
    return { min: 0, max: 1 };
  }

  return { min: null, max: null };
}

export function parseSalary(text: string): { min: number | null; max: number | null; currency: string } {
  // LPA detection (e.g. "14 - 18 LPA", "12-16 Lakhs", "15 LPA")
  const lpaRange = text.match(/(\d+(?:\.\d+)?)\s*(?:-|to|–)\s*(\d+(?:\.\d+)?)\s*(?:lpa|lakh|lac|lacs)/i);
  if (lpaRange && lpaRange[1] && lpaRange[2]) {
    return {
      min: Math.round(parseFloat(lpaRange[1]) * 100000),
      max: Math.round(parseFloat(lpaRange[2]) * 100000),
      currency: 'INR',
    };
  }

  const lpaSingle = text.match(/(\d+(?:\.\d+)?)\s*(?:lpa|lakh|lac|lacs)/i);
  if (lpaSingle && lpaSingle[1]) {
    const val = Math.round(parseFloat(lpaSingle[1]) * 100000);
    return { min: val, max: val, currency: 'INR' };
  }

  // USD range ($120k - $160k, $120,000 - $160,000)
  const usdRange = text.match(/\$\s*(\d+)(?:k|,000)?\s*(?:-|to|–)\s*\$?\s*(\d+)(?:k|,000)?/i);
  if (usdRange && usdRange[1] && usdRange[2]) {
    let min = parseInt(usdRange[1], 10);
    let max = parseInt(usdRange[2], 10);
    if (min < 1000) min *= 1000;
    if (max < 1000) max *= 1000;
    return { min, max, currency: 'USD' };
  }

  return { min: null, max: null, currency: 'INR' };
}

export function detectLocationType(location = '', description = ''): 'REMOTE' | 'HYBRID' | 'ONSITE' {
  const combined = (location + ' ' + description).toLowerCase();
  if (combined.includes('remote') || combined.includes('anywhere') || combined.includes('work from home')) {
    return 'REMOTE';
  }
  if (combined.includes('hybrid')) {
    return 'HYBRID';
  }
  return 'ONSITE';
}

export function detectEmploymentType(
  rawType = '',
  title = '',
  description = ''
): 'FULL_TIME' | 'PART_TIME' | 'CONTRACT' | 'INTERNSHIP' {
  const combined = (rawType + ' ' + title + ' ' + description).toLowerCase();
  if (combined.includes('intern') || combined.includes('internship')) {
    return 'INTERNSHIP';
  }
  if (combined.includes('contract') || combined.includes('freelance')) {
    return 'CONTRACT';
  }
  if (combined.includes('part-time') || combined.includes('part time')) {
    return 'PART_TIME';
  }
  return 'FULL_TIME';
}

export function extractCommonSkills(text: string): string[] {
  const skillList = [
    'Node.js', 'TypeScript', 'JavaScript', 'Python', 'Go', 'Rust', 'Java', 'C++',
    'PostgreSQL', 'MySQL', 'MongoDB', 'Redis', 'Kafka', 'RabbitMQ', 'Elasticsearch',
    'Docker', 'Kubernetes', 'AWS', 'GCP', 'Azure', 'Linux', 'CI/CD',
    'React', 'Next.js', 'Vue', 'Angular', 'Tailwind CSS', 'GraphQL', 'REST APIs',
    'Microservices', 'Distributed Systems', 'System Design', 'LLM', 'AI'
  ];

  const matched: string[] = [];
  for (const s of skillList) {
    const escaped = s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(?:^|[^a-zA-Z0-9#+])${escaped}(?:$|[^a-zA-Z0-9#+])`, 'i');
    if (regex.test(text)) {
      matched.push(s);
    }
  }
  return matched;
}

function cleanText(str: string): string {
  return str.replace(/\s+/g, ' ').trim();
}
