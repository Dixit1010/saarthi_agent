export const APPLICATION_STATUS = {
  DISCOVERED: 'DISCOVERED',
  SHORTLISTED: 'SHORTLISTED',
  READY: 'READY',
  APPLIED: 'APPLIED',
  OA: 'OA',
  INTERVIEW: 'INTERVIEW',
  TECHNICAL: 'TECHNICAL',
  HR: 'HR',
  OFFER: 'OFFER',
  REJECTED: 'REJECTED',
  WITHDRAWN: 'WITHDRAWN',
} as const;

export type ApplicationStatusType = (typeof APPLICATION_STATUS)[keyof typeof APPLICATION_STATUS];

export const AUTOMATION_MODE = {
  MANUAL: 'MANUAL',
  ASSISTED: 'ASSISTED',
  AUTONOMOUS: 'AUTONOMOUS',
} as const;

export type AutomationModeType = (typeof AUTOMATION_MODE)[keyof typeof AUTOMATION_MODE];

export const LOCATION_TYPE = {
  REMOTE: 'REMOTE',
  HYBRID: 'HYBRID',
  ONSITE: 'ONSITE',
} as const;

export type LocationType = (typeof LOCATION_TYPE)[keyof typeof LOCATION_TYPE];

export const EMPLOYMENT_TYPE = {
  FULL_TIME: 'FULL_TIME',
  PART_TIME: 'PART_TIME',
  CONTRACT: 'CONTRACT',
  INTERNSHIP: 'INTERNSHIP',
} as const;

export type EmploymentType = (typeof EMPLOYMENT_TYPE)[keyof typeof EMPLOYMENT_TYPE];

export const DEFAULT_MATCH_WEIGHTS = {
  skills: 0.30,
  experience: 0.20,
  role: 0.15,
  location: 0.10,
  projects: 0.10,
  education: 0.05,
  salary: 0.05,
  preferences: 0.05,
} as const;
