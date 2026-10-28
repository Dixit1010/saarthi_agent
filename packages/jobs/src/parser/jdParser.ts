import { z } from 'zod';
import { createAIProvider } from '@saarthi/ai';
import { ParsedJD } from '../types.js';
import { parseExperience, parseSalary, detectLocationType, detectEmploymentType, extractCommonSkills } from '../normalization/normalizer.js';

export const ParsedJDSchema = z.object({
  title: z.string().default(''),
  company: z.string().default(''),
  requiredSkills: z.array(z.string()).default([]),
  preferredSkills: z.array(z.string()).default([]),
  yearsExperience: z.object({
    min: z.number().nullable().default(null),
    max: z.number().nullable().default(null),
  }),
  educationRequirements: z.array(z.string()).default([]),
  responsibilities: z.array(z.string()).default([]),
  locationType: z.enum(['REMOTE', 'HYBRID', 'ONSITE']).default('ONSITE'),
  employmentType: z.enum(['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERNSHIP']).default('FULL_TIME'),
  salary: z.object({
    min: z.number().nullable().default(null),
    max: z.number().nullable().default(null),
    currency: z.string().default('INR'),
  }),
  niceToHave: z.array(z.string()).default([]),
  keywords: z.array(z.string()).default([]),
  applicationQuestions: z.array(z.string()).default([]),
});

export async function parseJobDescription(jdText: string, fallbackTitle = '', fallbackCompany = ''): Promise<ParsedJD> {
  const hasAiKey = Boolean(process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY || process.env.GROQ_API_KEY);

  if (hasAiKey) {
    try {
      const provider = createAIProvider();
      const prompt = `Analyze this Job Description and extract structured attributes.
CRITICAL:
1. Clearly differentiate REQUIRED skills from PREFERRED / NICE-TO-HAVE skills.
2. Accurately detect years of experience min and max.
3. Identify any explicit application screening questions.

JOB DESCRIPTION:
${jdText}`;

      const res = await provider.generateStructured(prompt, ParsedJDSchema, { temperature: 0.1 });
      return res as ParsedJD;
    } catch (err) {
      console.warn('AI JD parsing failed, falling back to rule-based parser:', err);
    }
  }

  // Heuristic Fallback
  return parseJDHeuristically(jdText, fallbackTitle, fallbackCompany);
}

function parseJDHeuristically(text: string, title: string, company: string): ParsedJD {
  const exp = parseExperience(text);
  const salary = parseSalary(text);
  const allSkills = extractCommonSkills(text);

  // Divide skills into required (first 65%) and preferred (remainder)
  const requiredCount = Math.max(1, Math.ceil(allSkills.length * 0.65));
  const requiredSkills = allSkills.slice(0, requiredCount);
  const preferredSkills = allSkills.slice(requiredCount);

  // Extract questions if any lines end with '?'
  const questions = text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.endsWith('?') && l.length > 15 && l.length < 200);

  return {
    title: title || 'Software Engineer',
    company: company || 'Hiring Company',
    requiredSkills,
    preferredSkills,
    yearsExperience: exp,
    educationRequirements: text.includes('B.Tech') ? ['B.Tech / B.E. in Computer Science, ECE, or related'] : ['Bachelor degree in Engineering or relevant field'],
    responsibilities: [
      'Design, build, and maintain scalable APIs and backend microservices.',
      'Collaborate with product and engineering teams to ship high-impact features.',
    ],
    locationType: detectLocationType('', text),
    employmentType: detectEmploymentType('', title, text),
    salary,
    niceToHave: preferredSkills,
    keywords: allSkills,
    applicationQuestions: questions.length > 0 ? questions : ['Why are you interested in this position?'],
  };
}
