import { ApplicationStatusType, AutomationModeType, LocationType, EmploymentType } from '../constants/index.js';

export interface EducationEntry {
  degree: string;
  field: string;
  institution: string;
  start: string;
  end: string;
}

export interface UserProfile {
  id: string;
  userId: string;
  name: string;
  email: string;
  phone?: string;
  location: string;
  bio?: string;
  education: EducationEntry[];
  skills: SkillItem[];
  experiences: ExperienceItem[];
  projects: ProjectItem[];
  preferences: UserPreferences;
}

export interface SkillItem {
  id: string;
  name: string;
  category?: string;
  yearsExperience?: number;
  verified: boolean;
}

export interface AchievementItem {
  id: string;
  experienceId?: string;
  text: string;
  metrics: string[];
  verified: boolean;
}

export interface ExperienceItem {
  id: string;
  company: string;
  role: string;
  employmentType: EmploymentType;
  location?: string;
  startDate: string;
  endDate?: string;
  isCurrent: boolean;
  technologies: string[];
  achievements: AchievementItem[];
}

export interface ProjectItem {
  id: string;
  name: string;
  description: string;
  problem?: string;
  solution?: string;
  technologies: string[];
  githubUrl?: string;
  liveUrl?: string;
  measurableResults: string[];
  verified: boolean;
}

export interface UserPreferences {
  targetRoles: string[];
  targetLocations: string[];
  remotePreference: 'ANY' | 'REMOTE_ONLY' | 'HYBRID' | 'ONSITE';
  experienceMin: number;
  experienceMax: number;
  salaryMin?: number;
  noticePeriod?: string;
  excludedCompanies: string[];
  excludedKeywords: string[];
}

export interface NormalizedJob {
  id: string;
  canonicalUrl: string;
  title: string;
  company: string;
  location: string;
  locationType: LocationType;
  employmentType: EmploymentType;
  description: string;
  salaryMin?: number | null;
  salaryMax?: number | null;
  salaryCurrency: string;
  experienceMin?: number | null;
  experienceMax?: number | null;
  skills: string[];
  postedAt?: string | null;
  discoveredAt: string;
  source: string;
}

export interface JobMatchBreakdown {
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

export interface ApplicationAnswerData {
  id: string;
  question: string;
  answer: string;
  confidence: number;
  requiresReview: boolean;
  sources: {
    type: string;
    id: string;
    label: string;
  }[];
  isApproved: boolean;
}

export interface ApplicationItem {
  id: string;
  userId: string;
  jobId: string;
  job: NormalizedJob;
  resumeVersionId?: string;
  resumeVersionTitle?: string;
  status: ApplicationStatusType;
  submissionMethod: AutomationModeType;
  matchScore: number;
  appliedAt?: string | null;
  notes?: string;
  answers: ApplicationAnswerData[];
  events: ApplicationEventItem[];
  createdAt: string;
  updatedAt: string;
}

export interface ApplicationEventItem {
  id: string;
  applicationId: string;
  eventType: string;
  description: string;
  actor: 'AGENT' | 'USER';
  createdAt: string;
}

export interface AgentRunSummary {
  id: string;
  trigger: 'MANUAL' | 'SCHEDULED' | 'BATCH';
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'PAUSED_FOR_HUMAN';
  jobsScanned: number;
  newJobs: number;
  qualified: number;
  resumesGenerated: number;
  applicationsPrepared: number;
  submitted: number;
  needsReview: number;
  startedAt: string;
  finishedAt?: string;
  logs: {
    id: string;
    level: 'INFO' | 'WARN' | 'ERROR';
    message: string;
    timestamp: string;
  }[];
}

export interface AgentConfigFile {
  candidate: {
    fullName: string;
    email: string;
    phone: string;
    location: string;
    experienceYears: number;
    currentSalary?: string;
    expectedSalary: string;
    noticePeriod: string;
    workAuthorization: string;
    linkedinUrl?: string;
    githubUrl?: string;
    portfolioUrl?: string;
    leetcodeUrl?: string;
    codeforcesUrl?: string;
    hackerrankUrl?: string;
    codechefUrl?: string;
    geeksforgeeksUrl?: string;
    otherCodingUrl?: string;
  };
  searchPreferences: {
    targetRoles: string[];
    keywords: string[];
    targetLocations: string[];
    experienceLevel?: string;
    minimumMatchScore?: number;
    remoteOnly?: boolean;
    customSearchQueries?: string[];
    past24HoursOnly?: boolean;
    targetCompanies?: string[];
    queryGroups?: Record<string, string[]>;
    keywordFamilies?: Record<string, string[]>;
    excludeSeniority?: string[];
    freshnessHoursPrimary?: number;
    freshnessHoursCatchup?: number;
    easyApplyOnly?: boolean;
  };
  automation: {
    mode: 'MANUAL' | 'ASSISTED' | 'AUTONOMOUS';
    autoApplyThresholdScore: number;
    dryRun: boolean;
    dailyApplicationLimit: number;
    watchBrowser?: boolean;
  };
  credentials?: {
    naukri?: {
      profileUrl?: string;
      username?: string;
      password?: string;
    };
    linkedin?: {
      username?: string;
      password?: string;
    };
    instahyre?: {
      username?: string;
      password?: string;
    };
  };
}

export interface TelegramConfig {
  botToken?: string;
  allowedUserId?: string;
  chatId?: string;
}

export type TelegramNotificationType =
  | 'SCAN_STARTED'
  | 'SCAN_COMPLETED'
  | 'JOB_DISCOVERED'
  | 'APPLICATION_PREPARED'
  | 'APPROVAL_REQUESTED'
  | 'APPROVAL_RECEIVED'
  | 'DRY_RUN_VERIFIED'
  | 'LIVE_SUBMITTED'
  | 'SKIPPED'
  | 'SECURITY_CHALLENGE';

export interface TelegramApprovalRequest {
  id: string;
  jobId: string;
  company: string;
  title: string;
  jobUrl: string;
  matchScore: number;
  dryRun: boolean;
  createdAt: number;
  expiresAt: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED';
}

export interface AgentStatusSnapshot {
  isPaused: boolean;
  activeScan: boolean;
  currentPlatform?: string;
  applicationsSubmittedToday: number;
  dailyApplicationLimit: number;
  dryRun: boolean;
  queueSize: number;
  pendingApprovalsCount: number;
}
