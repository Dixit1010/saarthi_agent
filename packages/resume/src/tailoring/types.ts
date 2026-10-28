export type BulletSourceType = 'EXPERIENCE' | 'ACHIEVEMENT' | 'PROJECT';

export interface TailoredBullet {
  text: string;
  sourceId: string;
  sourceType: BulletSourceType;
  originalText: string;
  matchedKeywords: string[];
}

export interface TailoredExperience {
  id: string;
  company: string;
  role: string;
  startDate: string;
  endDate: string | null;
  isCurrent: boolean;
  location: string | null;
  bullets: TailoredBullet[];
}

export interface TailoredProject {
  id: string;
  name: string;
  description: string;
  technologies: string[];
  bullets: TailoredBullet[];
  githubUrl?: string | null;
  liveUrl?: string | null;
}

export interface TailoredResume {
  fullName: string;
  email: string;
  phone: string;
  location: string;
  targetRole: string;
  summary: string;
  highlightedSkills: {
    category: string;
    skills: string[];
  }[];
  experiences: TailoredExperience[];
  projects: TailoredProject[];
  education: Array<{
    degree: string;
    field: string;
    institution: string;
    start: string;
    end: string;
  }>;
  bulletCount: number;
}

export interface AtsKeywordMatch {
  keyword: string;
  covered: boolean;
  frequency: number;
}

export interface AtsReport {
  score: number; // 0-100
  requiredKeywords: AtsKeywordMatch[];
  preferredKeywords: AtsKeywordMatch[];
  coveredCount: number;
  totalKeywords: number;
  coveragePercentage: number;
  missingCriticalSkills: string[];
  warnings: string[];
  formattingScore: number;
  readabilityScore: number;
  recommendations: string[];
}

export interface CoverLetter {
  jobTitle: string;
  company: string;
  salutation: string;
  paragraphs: string[];
  fullText: string;
  wordCount: number;
  highlightedExperiences: string[];
}

export interface ResumeTailoringInput {
  job: {
    id: string;
    title: string;
    company: string;
    description: string;
    requiredSkills?: string[];
    preferredSkills?: string[];
  };
  profile: {
    fullName: string;
    email: string;
    phone?: string;
    location?: string;
    bio?: string;
    education?: any[];
  };
  experiences: Array<{
    id: string;
    company: string;
    role: string;
    startDate: Date | string;
    endDate?: Date | string | null;
    isCurrent: boolean;
    location?: string | null;
    technologies: string[];
    achievements: Array<{
      id: string;
      text: string;
      metrics?: string[];
      verified: boolean;
    }>;
  }>;
  projects: Array<{
    id: string;
    name: string;
    description: string;
    technologies: string[];
    measurableResults?: string[];
    githubUrl?: string | null;
    liveUrl?: string | null;
  }>;
  verifiedSkills: Array<{
    name: string;
    category?: string;
    yearsExperience?: number;
  }>;
}
