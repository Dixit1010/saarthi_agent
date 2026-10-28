export interface RawJobPosting {
  title: string;
  company: string;
  location?: string;
  description: string;
  url: string;
  source: string;
  employmentType?: string;
  salaryText?: string;
  experienceText?: string;
  postedAt?: string | Date;
}

export interface NormalizedJobData {
  canonicalUrl: string;
  title: string;
  company: string;
  location: string;
  locationType: 'REMOTE' | 'HYBRID' | 'ONSITE';
  employmentType: 'FULL_TIME' | 'PART_TIME' | 'CONTRACT' | 'INTERNSHIP';
  description: string;
  salaryMin?: number | null;
  salaryMax?: number | null;
  salaryCurrency: string;
  experienceMin?: number | null;
  experienceMax?: number | null;
  skills: string[];
  source: string;
  postedAt?: Date | null;
  discoveredAt: Date;
}

export interface ParsedJD {
  title: string;
  company: string;
  requiredSkills: string[];
  preferredSkills: string[];
  yearsExperience: {
    min: number | null;
    max: number | null;
  };
  educationRequirements: string[];
  responsibilities: string[];
  locationType: 'REMOTE' | 'HYBRID' | 'ONSITE';
  employmentType: 'FULL_TIME' | 'PART_TIME' | 'CONTRACT' | 'INTERNSHIP';
  salary: {
    min: number | null;
    max: number | null;
    currency: string;
  };
  niceToHave: string[];
  keywords: string[];
  applicationQuestions: string[];
}

export interface MatchScoreResult {
  score: number;
  breakdown: {
    skills: number;
    experience: number;
    role: number;
    location: number;
    projects: number;
    education: number;
    salary: number;
    preferences: number;
  };
  matchedSkills: string[];
  missingSkills: string[];
  partialSkills: string[];
  reasons: string[];
}
