import fs from 'fs';
import path from 'path';
import { AgentConfigFile } from '@saarthi/shared';

let cachedConfig: AgentConfigFile | null = null;

export const DEFAULT_AGENT_CONFIG: AgentConfigFile = {
  candidate: {
    fullName: 'Dixit Kumar',
    email: 'dixitkumar300@gmail.com',
    phone: '+91 7060137673',
    location: 'Noida, India',
    experienceYears: 1.8,
    currentSalary: '₹12 LPA',
    expectedSalary: '₹18 LPA',
    noticePeriod: '15 days / Immediate',
    workAuthorization: 'Authorized to work in India without sponsorship',
    linkedinUrl: 'https://www.linkedin.com/in/dixitkum/',
    githubUrl: 'https://github.com/Dixit1010',
    portfolioUrl: 'https://portfoliodixitt.netlify.app/',
    leetcodeUrl: 'https://leetcode.com/u/dixitkumar300',
    codeforcesUrl: 'https://codeforces.com/profile/dixitkumar300',
    hackerrankUrl: '',
    codechefUrl: '',
    geeksforgeeksUrl: '',
    otherCodingUrl: '',
  },
  searchPreferences: {
    targetRoles: [
      'C++ Software Engineer',
      'Systems Software Engineer',
      'Software Engineer I',
      'Associate Software Engineer',
      'Graduate Engineer Trainee - Software',
      'Embedded C Developer',
      'Embedded Linux Engineer',
      'Firmware Developer',
      'BSP Engineer',
      'Device Driver Engineer',
      'RTOS Engineer',
      'Linux Kernel Engineer',
      'Networking Software Engineer',
      'Protocol Stack Engineer',
      'Platform Software Engineer',
      'Performance Engineer',
      'Low Latency Developer',
      'Developer Tools Engineer',
      'Backend Software Engineer',
      'API Developer',
      'Platform Engineer',
      'Python Backend Developer',
      'AI Application Engineer',
      'Applied AI Engineer',
      'Full Stack Software Engineer',
      'Backend Engineer',
      'Software Development Engineer',
      'Full Stack Developer',
      'Node.js Developer',
      'SDE-1',
    ],
    keywords: [
      'Modern C++',
      'C++',
      'STL',
      'Embedded C',
      'microcontrollers',
      'RTOS',
      'FreeRTOS',
      'bare-metal',
      'UART',
      'SPI',
      'I2C',
      'CAN',
      'bootloader',
      'device drivers',
      'BSP',
      'Linux',
      'POSIX',
      'debugging',
      'gdb',
      'CMake',
      'Node.js',
      'TypeScript',
      'REST APIs',
      'PostgreSQL',
      'Redis',
      'Docker',
      'BullMQ',
      'Python',
      'FastAPI',
    ],
    targetLocations: [
      'Noida',
      'Gurgaon',
      'Delhi NCR',
      'Bengaluru',
      'Hyderabad',
      'Pune',
      'Remote India',
    ],
    experienceLevel: '1-3 years',
    minimumMatchScore: 75,
    remoteOnly: false,
    past24HoursOnly: true,
  },
  automation: {
    mode: 'ASSISTED',
    autoApplyThresholdScore: 85,
    dryRun: true,
    dailyApplicationLimit: 15,
    watchBrowser: true,
  },
  credentials: {
    naukri: {
      profileUrl: 'https://www.naukri.com/mnjuser/profile',
      username: '',
      password: '',
    },
    linkedin: {
      username: '',
      password: '',
    },
    instahyre: {
      username: '',
      password: '',
    },
  },
};

export interface ConfigValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export function validateAgentConfig(cfg: AgentConfigFile): ConfigValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Required Candidate Details
  if (!cfg.candidate?.fullName?.trim()) {
    errors.push('Candidate "fullName" is required.');
  }
  if (!cfg.candidate?.email?.trim() || !cfg.candidate.email.includes('@')) {
    errors.push('A valid candidate "email" is required.');
  }
  if (!cfg.candidate?.phone?.trim()) {
    errors.push('Candidate "phone" is required.');
  }
  if (!cfg.candidate?.location?.trim()) {
    errors.push('Candidate "location" is required.');
  }
  if (typeof cfg.candidate?.experienceYears !== 'number' || cfg.candidate.experienceYears < 0) {
    errors.push('Candidate "experienceYears" must be a positive number.');
  }
  if (!cfg.candidate?.expectedSalary?.trim()) {
    errors.push('Candidate "expectedSalary" is required.');
  }
  if (!cfg.candidate?.noticePeriod?.trim()) {
    errors.push('Candidate "noticePeriod" is required.');
  }

  // Developer Profile Warnings
  if (!cfg.candidate?.linkedinUrl) {
    warnings.push('LinkedIn profile URL is missing.');
  }
  if (!cfg.candidate?.githubUrl) {
    warnings.push('GitHub profile URL is missing.');
  }
  if (!cfg.candidate?.portfolioUrl) {
    warnings.push('Portfolio website URL is missing.');
  }
  if (!cfg.candidate?.leetcodeUrl) {
    warnings.push('LeetCode profile URL is unconfigured.');
  }
  if (!cfg.candidate?.codeforcesUrl) {
    warnings.push('Codeforces profile URL is unconfigured.');
  }

  // Search Preferences
  if (!cfg.searchPreferences?.targetRoles || cfg.searchPreferences.targetRoles.length === 0) {
    errors.push('At least one target role is required in searchPreferences.');
  }
  if (!cfg.searchPreferences?.targetLocations || cfg.searchPreferences.targetLocations.length === 0) {
    errors.push('At least one target location is required in searchPreferences.');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

function findConfigFile(): string {
  const possiblePaths = [
    path.resolve(process.cwd(), 'agent.config.json'),
    path.resolve(process.cwd(), '..', 'agent.config.json'),
    path.resolve(process.cwd(), '..', '..', 'agent.config.json'),
  ];
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) return p;
  }
  return path.resolve(process.cwd(), 'agent.config.json');
}

export function getAgentConfig(): AgentConfigFile {
  if (cachedConfig) return cachedConfig;
  try {
    const configPath = findConfigFile();
    if (fs.existsSync(configPath)) {
      const raw = fs.readFileSync(configPath, 'utf-8');
      cachedConfig = JSON.parse(raw);
      const validation = validateAgentConfig(cachedConfig!);
      if (!validation.isValid) {
        console.error('⚠️ [AgentConfig] Validation errors found:', validation.errors);
      }
      return cachedConfig!;
    }
  } catch (err) {
    console.warn('Could not read agent.config.json, using defaults:', err);
  }
  cachedConfig = { ...DEFAULT_AGENT_CONFIG };
  return cachedConfig;
}

export function reloadAgentConfig(): AgentConfigFile {
  cachedConfig = null;
  return getAgentConfig();
}

export function saveAgentConfig(updated: Partial<AgentConfigFile>): AgentConfigFile {
  const current = getAgentConfig();
  const merged: AgentConfigFile = {
    ...current,
    ...updated,
    candidate: { ...current.candidate, ...(updated.candidate || {}) },
    searchPreferences: { ...current.searchPreferences, ...(updated.searchPreferences || {}) },
    automation: { ...current.automation, ...(updated.automation || {}) },
    credentials: { ...current.credentials, ...(updated.credentials || {}) },
  };

  try {
    const configPath = findConfigFile();
    fs.writeFileSync(configPath, JSON.stringify(merged, null, 2), 'utf-8');
    cachedConfig = merged;
  } catch (err) {
    console.error('Failed to write agent.config.json:', err);
  }

  return merged;
}
