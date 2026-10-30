import { AtsReport, AtsKeywordMatch, TailoredResume } from './types.js';

export interface AtsAnalysisInput {
  resume: TailoredResume;
  jobTitle: string;
  jobDescription: string;
  requiredSkills?: string[];
  preferredSkills?: string[];
}

export function analyzeAts(input: AtsAnalysisInput): AtsReport {
  const { resume, jobDescription, requiredSkills = [], preferredSkills = [] } = input;

  // 1. Build a searchable text representation of the resume
  const resumeTextParts: string[] = [
    resume.summary,
    ...resume.highlightedSkills.flatMap((g) => g.skills),
    ...resume.experiences.flatMap((e) => [
      e.company,
      e.role,
      ...e.bullets.map((b) => b.text),
    ]),
    ...resume.projects.flatMap((p) => [
      p.name,
      p.description,
      ...p.technologies,
      ...p.bullets.map((b) => b.text),
    ]),
    ...resume.education.map((ed) => `${ed.degree} ${ed.field} ${ed.institution}`),
  ];
  const fullResumeText = resumeTextParts.join(' ').toLowerCase();

  // Helper to test if a keyword exists in resume text with word boundary awareness
  const containsKeyword = (text: string, kw: string): { found: boolean; count: number } => {
    const escaped = kw.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(?:^|[^a-zA-Z0-9#+])${escaped}(?:$|[^a-zA-Z0-9#+])`, 'gi');
    const matches = text.match(regex);
    return {
      found: !!matches && matches.length > 0,
      count: matches ? matches.length : 0,
    };
  };

  // 2. Extract or use required keywords
  let reqList = [...requiredSkills];
  let prefList = [...preferredSkills];

  // If none supplied, extract common tech keywords from JD
  if (reqList.length === 0 && prefList.length === 0) {
    const techPatterns = [
      'Embedded C', 'C++', 'C99', 'Firmware', 'Microcontroller', 'Renesas', 'RL78',
      'UART', 'I2C', 'SPI', 'ADC', 'Delta-Sigma ADC', 'DLMS', 'COSEM', 'IEC 1107',
      'EEPROM', 'Flash', 'RTC', 'Watchdog', 'GPIO', 'LCD', 'CRC', 'AES', 'SonarQube',
      'JavaScript', 'TypeScript', 'Node.js', 'Python', 'React', 'Next.js', 'PostgreSQL',
      'SQL', 'MongoDB', 'Docker', 'Kubernetes', 'AWS', 'GCP', 'Azure', 'Git', 'CI/CD',
      'GraphQL', 'REST', 'Microservices', 'FastAPI', 'Redis', 'Kafka', 'Linux'
    ];
    for (const pat of techPatterns) {
      if (containsKeyword(jobDescription, pat).found) {
        reqList.push(pat);
      }
    }
    if (reqList.length === 0) {
      reqList = ['Software Engineering', 'System Design', 'Git', 'APIs'];
    }
  }

  // 3. Match required keywords
  const requiredMatches: AtsKeywordMatch[] = reqList.map((kw) => {
    const check = containsKeyword(fullResumeText, kw);
    return {
      keyword: kw,
      covered: check.found,
      frequency: check.count,
    };
  });

  // 4. Match preferred keywords
  const preferredMatches: AtsKeywordMatch[] = prefList.map((kw) => {
    const check = containsKeyword(fullResumeText, kw);
    return {
      keyword: kw,
      covered: check.found,
      frequency: check.count,
    };
  });

  const totalKeywords = requiredMatches.length + preferredMatches.length;
  const coveredRequired = requiredMatches.filter((m) => m.covered).length;
  const coveredPreferred = preferredMatches.filter((m) => m.covered).length;
  const totalCovered = coveredRequired + coveredPreferred;

  const reqRatio = requiredMatches.length > 0 ? coveredRequired / requiredMatches.length : 1;
  const prefRatio = preferredMatches.length > 0 ? coveredPreferred / preferredMatches.length : 1;

  // 5. Readability & Metrics Analysis
  let totalBullets = 0;
  let metricBullets = 0;
  const metricRegex = /\b\d+([.,]\d+)?(%|k|m|x|hrs|days|ms|users|requests|qps)?\b/i;

  for (const exp of resume.experiences) {
    for (const b of exp.bullets) {
      totalBullets++;
      if (metricRegex.test(b.text)) {
        metricBullets++;
      }
    }
  }
  for (const proj of resume.projects) {
    for (const b of proj.bullets) {
      totalBullets++;
      if (metricRegex.test(b.text)) {
        metricBullets++;
      }
    }
  }

  const readabilityScore = Math.min(100, Math.round(
    (totalBullets > 0 ? (metricBullets / totalBullets) * 40 : 20) + 60
  ));

  // 6. Section & Formatting Check
  let formattingScore = 100;
  if (!resume.summary || resume.summary.length < 30) formattingScore -= 15;
  if (resume.experiences.length === 0) formattingScore -= 35;
  if (resume.education.length === 0) formattingScore -= 15;
  if (resume.highlightedSkills.length === 0) formattingScore -= 15;
  if (totalBullets < 3) formattingScore -= 20;

  // 7. Overall Weighted ATS Score (Section 14: keywords 60%, readability 20%, formatting 20%)
  const keywordScore = Math.round(reqRatio * 70 + prefRatio * 30);
  const finalScore = Math.min(100, Math.max(0, Math.round(
    keywordScore * 0.60 +
    readabilityScore * 0.20 +
    formattingScore * 0.20
  )));

  // 8. Missing Critical Skills & Warnings
  const missingCriticalSkills = requiredMatches
    .filter((m) => !m.covered)
    .map((m) => m.keyword);

  const warnings: string[] = [];
  if (missingCriticalSkills.length > 0) {
    warnings.push(
      `Job description requires ${missingCriticalSkills.join(', ')}, which is not present in verified profile.`
    );
  }

  // Check for keyword stuffing
  for (const m of [...requiredMatches, ...preferredMatches]) {
    if (m.frequency > 8) {
      warnings.push(
        `High repetition of "${m.keyword}" (${m.frequency} times). Avoid keyword stuffing for modern ATS compliance.`
      );
    }
  }

  // Recommendations
  const recommendations: string[] = [];
  if (metricBullets < 3 && totalBullets > 0) {
    recommendations.push(
      'Consider adding measurable metrics (e.g. latency reduced by X%, throughput increased by Y) from verified achievements.'
    );
  }
  if (missingCriticalSkills.length > 0) {
    recommendations.push(
      `If you have unlisted experience with ${missingCriticalSkills.slice(0, 3).join(', ')}, add them to your Verified Profile before applying.`
    );
  }
  if (resume.summary.length > 300) {
    recommendations.push('Keep the executive summary concise (under 3 sentences) for faster recruiter scanning.');
  }

  return {
    score: finalScore,
    requiredKeywords: requiredMatches,
    preferredKeywords: preferredMatches,
    coveredCount: totalCovered,
    totalKeywords: Math.max(1, totalKeywords),
    coveragePercentage: Math.round((totalCovered / Math.max(1, totalKeywords)) * 100),
    missingCriticalSkills,
    warnings,
    formattingScore,
    readabilityScore,
    recommendations,
  };
}
