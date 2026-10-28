import { z } from 'zod';
import { APPLICATION_STATUS, AUTOMATION_MODE, EMPLOYMENT_TYPE, LOCATION_TYPE } from '../constants/index.js';

export const RegisterSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export const LoginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const UpdateProfileSchema = z.object({
  name: z.string().min(2).optional(),
  phone: z.string().optional(),
  location: z.string().min(2).optional(),
  bio: z.string().optional(),
  education: z.array(z.object({
    degree: z.string(),
    field: z.string(),
    institution: z.string(),
    start: z.string(),
    end: z.string(),
  })).optional(),
});

export const CreateExperienceSchema = z.object({
  company: z.string().min(1),
  role: z.string().min(1),
  employmentType: z.enum([
    EMPLOYMENT_TYPE.FULL_TIME,
    EMPLOYMENT_TYPE.PART_TIME,
    EMPLOYMENT_TYPE.CONTRACT,
    EMPLOYMENT_TYPE.INTERNSHIP,
  ]),
  location: z.string().optional(),
  startDate: z.string(),
  endDate: z.string().optional(),
  isCurrent: z.boolean().default(false),
  technologies: z.array(z.string()),
  achievements: z.array(z.object({
    text: z.string().min(5),
    metrics: z.array(z.string()).default([]),
    verified: z.boolean().default(true),
  })).default([]),
});

export const CreateProjectSchema = z.object({
  name: z.string().min(2),
  description: z.string().min(10),
  problem: z.string().optional(),
  solution: z.string().optional(),
  technologies: z.array(z.string()),
  githubUrl: z.string().url().optional().or(z.literal('')),
  liveUrl: z.string().url().optional().or(z.literal('')),
  measurableResults: z.array(z.string()).default([]),
  verified: z.boolean().default(true),
});

export const JobFilterSchema = z.object({
  search: z.string().optional(),
  locationType: z.enum([LOCATION_TYPE.REMOTE, LOCATION_TYPE.HYBRID, LOCATION_TYPE.ONSITE]).optional(),
  minMatchScore: z.coerce.number().min(0).max(100).optional(),
  status: z.string().optional(),
  limit: z.coerce.number().min(1).max(300).default(100),
  offset: z.coerce.number().min(0).default(0),
});

export const UpdateApplicationStatusSchema = z.object({
  status: z.enum([
    APPLICATION_STATUS.DISCOVERED,
    APPLICATION_STATUS.SHORTLISTED,
    APPLICATION_STATUS.READY,
    APPLICATION_STATUS.APPLIED,
    APPLICATION_STATUS.OA,
    APPLICATION_STATUS.INTERVIEW,
    APPLICATION_STATUS.TECHNICAL,
    APPLICATION_STATUS.HR,
    APPLICATION_STATUS.OFFER,
    APPLICATION_STATUS.REJECTED,
    APPLICATION_STATUS.WITHDRAWN,
  ]),
  notes: z.string().optional(),
});

export const TriggerAgentRunSchema = z.object({
  trigger: z.enum(['MANUAL', 'SCHEDULED', 'BATCH']).default('MANUAL'),
  targetRoles: z.array(z.string()).optional(),
  targetLocations: z.array(z.string()).optional(),
  minimumMatchScore: z.number().min(0).max(100).default(75),
});

export const UpdatePreferencesSchema = z.object({
  targetRoles: z.array(z.string()).optional(),
  targetLocations: z.array(z.string()).optional(),
  remotePreference: z.enum(['ANY', 'REMOTE_ONLY', 'HYBRID', 'ONSITE']).optional(),
  experienceMin: z.number().min(0).optional(),
  experienceMax: z.number().min(0).optional(),
  salaryMin: z.number().nullable().optional(),
  noticePeriod: z.string().optional(),
  excludedCompanies: z.array(z.string()).optional(),
  excludedKeywords: z.array(z.string()).optional(),
  automationMode: z.enum([
    AUTOMATION_MODE.MANUAL,
    AUTOMATION_MODE.ASSISTED,
    AUTOMATION_MODE.AUTONOMOUS,
  ]).optional(),
  requireApprovalForSubmit: z.boolean().optional(),
});
