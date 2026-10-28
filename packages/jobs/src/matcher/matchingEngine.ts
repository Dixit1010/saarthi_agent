import { MatchScoreResult, NormalizedJobData } from '../types.js';

export interface CandidateProfileData {
  skills: { name: string; yearsExperience?: number | null; verified?: boolean }[];
  experiences: { role: string; technologies: string[]; isCurrent?: boolean }[];
  projects: { name: string; technologies: string[] }[];
  targetRoles: string[];
  targetLocations: string[];
  remotePreference: 'ANY' | 'REMOTE_ONLY' | 'HYBRID' | 'ONSITE';
  experienceYears: number;
  salaryMin?: number | null;
}

export function calculateJobMatch(
  job: NormalizedJobData,
  candidate: CandidateProfileData
): MatchScoreResult {
  const candidateSkillsLower = new Set(candidate.skills.map((s) => s.name.toLowerCase()));
  const candidateTechLower = new Set([
    ...candidate.skills.map((s) => s.name.toLowerCase()),
    ...candidate.experiences.flatMap((e) => e.technologies.map((t) => t.toLowerCase())),
    ...candidate.projects.flatMap((p) => p.technologies.map((t) => t.toLowerCase())),
  ]);

  const matchedSkills: string[] = [];
  const partialSkills: string[] = [];
  const missingSkills: string[] = [];
  const reasons: string[] = [];

  // 1. Skill Match (30%)
  // No detected technical requirements is NOT a perfect match — it usually means a non-engineering role.
  let skillsScore = 0;
  if (job.skills.length > 0) {
    let matchedCount = 0;
    for (const skill of job.skills) {
      const lower = skill.toLowerCase();
      if (candidateSkillsLower.has(lower)) {
        matchedSkills.push(skill);
        matchedCount++;
      } else if (candidateTechLower.has(lower)) {
        partialSkills.push(skill);
        matchedCount += 0.5;
      } else {
        missingSkills.push(skill);
      }
    }
    skillsScore = Math.round((matchedCount / job.skills.length) * 100);
  } else {
    reasons.push('No technical skill requirements detected in the job description');
  }

  if (matchedSkills.length > 0) {
    reasons.push(`Matched ${matchedSkills.length} core skills: ${matchedSkills.slice(0, 3).join(', ')}`);
  }
  if (missingSkills.length > 0) {
    reasons.push(`Missing requirements: ${missingSkills.slice(0, 2).join(', ')}`);
  }

  // 2. Experience Match (20%)
  const jobTitleLower = job.title.toLowerCase();
  let requiredMin = job.experienceMin;
  if ((requiredMin === null || requiredMin === undefined) && /\b(senior|sr\.?|staff|principal|lead)\b/.test(jobTitleLower)) {
    requiredMin = 4; // Seniority in title implies experience even when the JD omits a number
  }
  let expScore = 80;
  if (requiredMin !== null && requiredMin !== undefined) {
    if (candidate.experienceYears >= requiredMin) {
      expScore = 100;
      reasons.push(`Experience criteria met (${candidate.experienceYears} yrs satisfies min ${requiredMin} yrs)`);
    } else {
      const diff = requiredMin - candidate.experienceYears;
      expScore = Math.max(10, Math.round(100 - diff * 30));
      reasons.push(`Requires ~${requiredMin} yrs experience (profile has ${candidate.experienceYears} yrs)`);
    }
  }

  // 3. Role Match (15%)
  const isEngineeringRole = /\b(engineer|developer|sde|programmer|architect|devops|sre|full[\s-]?stack|backend|back-end|frontend|front-end)\b/.test(jobTitleLower);
  let roleScore = isEngineeringRole ? 60 : 10;
  for (const role of candidate.targetRoles) {
    const roleTokens = role
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length > 1 && !['engineer', 'developer', 'senior', 'junior'].includes(t));
    if (roleTokens.some((t) => jobTitleLower.includes(t)) && isEngineeringRole) {
      roleScore = 100;
      reasons.push(`Role aligns with target role: ${role}`);
      break;
    }
  }
  if (!isEngineeringRole) {
    reasons.push('Job title does not look like a software engineering role');
  }

  // 4. Location Match (10%)
  let locScore = 60;
  if (job.locationType === 'REMOTE' && (candidate.remotePreference === 'ANY' || candidate.remotePreference === 'REMOTE_ONLY')) {
    locScore = 100;
    reasons.push('Remote location matches preference');
  } else {
    for (const loc of candidate.targetLocations) {
      if (job.location.toLowerCase().includes(loc.toLowerCase())) {
        locScore = 100;
        reasons.push(`Location ${job.location} matches target city ${loc}`);
        break;
      }
    }
  }

  // 5. Project Relevance (10%)
  let projScore = 60;
  let relevantProjectsCount = 0;
  for (const proj of candidate.projects) {
    const hasOverlap = proj.technologies.some((t) => job.skills.some((js) => js.toLowerCase() === t.toLowerCase()));
    if (hasOverlap) relevantProjectsCount++;
  }
  if (relevantProjectsCount > 0) {
    projScore = Math.min(100, 70 + relevantProjectsCount * 15);
    reasons.push(`Found ${relevantProjectsCount} relevant portfolio projects`);
  }

  // 6. Education Match (5%)
  const eduScore = 95;

  // 7. Salary Match (5%)
  let salScore = 90;
  if (job.salaryMin && candidate.salaryMin) {
    if (job.salaryMin >= candidate.salaryMin) {
      salScore = 100;
    } else {
      salScore = 65;
    }
  }

  // 8. Preference Match (5%)
  const prefScore = 90;

  // Weighted total: 30% + 20% + 15% + 10% + 10% + 5% + 5% + 5% = 100%
  const totalScore = Math.round(
    skillsScore * 0.3 +
    expScore * 0.2 +
    roleScore * 0.15 +
    locScore * 0.1 +
    projScore * 0.1 +
    eduScore * 0.05 +
    salScore * 0.05 +
    prefScore * 0.05
  );

  return {
    score: Math.min(99, Math.max(10, totalScore)),
    breakdown: {
      skills: skillsScore,
      experience: expScore,
      role: roleScore,
      location: locScore,
      projects: projScore,
      education: eduScore,
      salary: salScore,
      preferences: prefScore,
    },
    matchedSkills,
    missingSkills,
    partialSkills,
    reasons,
  };
}
