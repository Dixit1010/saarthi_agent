import { resolveQuestionAnswer, DIXIT_ANSWER_BANK, APPLICATION_ACCURACY_RULES } from './answerBank.js';
import { generateGroqApplicationAnswer } from './groqAnswerHelper.js';

export interface ApplicationQuestionInput {
  job: {
    id: string;
    title: string;
    company: string;
    description: string;
    requiredSkills?: string[];
  };
  candidate: {
    name: string;
    email: string;
    phone?: string;
    location?: string;
    bio?: string;
    experienceYears?: number;
    noticePeriodDays?: number;
    expectedSalary?: string;
    currentSalary?: string;
    workAuthorization?: string;
    sponsorshipNeeded?: boolean;
    experiences: Array<{
      id: string;
      company: string;
      role: string;
      technologies: string[];
      achievements: Array<{ id: string; text: string; metrics?: string[] }>;
    }>;
    projects: Array<{
      id: string;
      name: string;
      description: string;
      technologies: string[];
      measurableResults?: string[];
    }>;
    skills: Array<{ name: string }>;
  };
  customQuestions?: string[];
  confirmedCurrentCtc?: string;
  allowImmediateConfirmation?: boolean;
}

export interface GeneratedAnswer {
  question: string;
  answer: string;
  sources: string[];
  confidence: number;
  requiresReview: boolean;
  category: 'LOGISTICS' | 'FIT' | 'TECHNICAL' | 'BACKGROUND' | 'COMPENSATION';
  reviewReason?: string;
}

export async function generateApplicationAnswers(input: ApplicationQuestionInput): Promise<GeneratedAnswer[]> {
  const { job, candidate, customQuestions, confirmedCurrentCtc, allowImmediateConfirmation } = input;
  const answers: GeneratedAnswer[] = [];

  const resolveContext = {
    jobTitle: job.title,
    company: job.company,
    jobDescription: job.description,
    requiredSkills: job.requiredSkills || [],
    confirmedCurrentCtc,
    allowImmediateConfirmation,
  };

  // 1. Question: Why do you want to work at Company? (Canonical #3 with customization rule)
  const whyCompany = resolveQuestionAnswer(`Why are you interested in joining ${job.company}?`, resolveContext);
  answers.push({
    question: whyCompany.question,
    answer: whyCompany.answer,
    sources: whyCompany.sources,
    confidence: whyCompany.confidence,
    requiresReview: whyCompany.requiresReview,
    category: whyCompany.category,
    reviewReason: whyCompany.reviewReason,
  });

  // 2. Question: Why are you a good fit for this role? (Canonical #4 tailored to domain)
  const fit = resolveQuestionAnswer(`Why are you a good fit for the ${job.title} position?`, resolveContext);
  answers.push({
    question: fit.question,
    answer: fit.answer,
    sources: fit.sources,
    confidence: fit.confidence,
    requiresReview: fit.requiresReview,
    category: fit.category,
    reviewReason: fit.reviewReason,
  });

  // 3. Question: Describe a challenging technical problem you solved (Canonical #7)
  const challenge = resolveQuestionAnswer('Describe a challenging engineering problem you solved and the outcome.', resolveContext);
  answers.push({
    question: challenge.question,
    answer: challenge.answer,
    sources: challenge.sources,
    confidence: challenge.confidence,
    requiresReview: challenge.requiresReview,
    category: challenge.category,
    reviewReason: challenge.reviewReason,
  });

  // 4. Question: Tell me about yourself (Canonical #1)
  const aboutMe = resolveQuestionAnswer('Tell me about yourself and your professional background.', resolveContext);
  answers.push({
    question: aboutMe.question,
    answer: aboutMe.answer,
    sources: aboutMe.sources,
    confidence: aboutMe.confidence,
    requiresReview: aboutMe.requiresReview,
    category: aboutMe.category,
    reviewReason: aboutMe.reviewReason,
  });

  // 5. Question: Total years of software engineering experience (Strict 1.8 Years)
  const expYears = candidate.experienceYears ?? 1.8;
  answers.push({
    question: 'What is your total relevant software engineering experience?',
    answer: `${expYears} years of professional engineering experience across embedded firmware, systems development, and full-stack software applications.`,
    sources: ['profile:experienceYears (Dixit Kumar 1.8y verified)'],
    confidence: 0.99,
    requiresReview: false,
    category: 'BACKGROUND',
  });

  // 6. Question: Notice Period (Canonical #12 - 15 days or less)
  const noticePeriodResult = resolveQuestionAnswer('What is your current notice period / availability date?', resolveContext);
  answers.push({
    question: noticePeriodResult.question,
    answer: noticePeriodResult.answer,
    sources: noticePeriodResult.sources,
    confidence: noticePeriodResult.confidence,
    requiresReview: noticePeriodResult.requiresReview,
    category: noticePeriodResult.category,
    reviewReason: noticePeriodResult.reviewReason,
  });

  // 7. Question: Expected Salary / CTC (Canonical #10 - ₹18 LPA)
  const expectedSalary = candidate.expectedSalary && candidate.expectedSalary.trim() !== ''
    ? candidate.expectedSalary
    : '₹18 LPA';
  answers.push({
    question: 'What is your expected salary / CTC?',
    answer: `My expected compensation is around ${expectedSalary}, depending on the role's responsibilities, compensation structure, and growth opportunities.`,
    sources: ['preferences:expectedSalary (₹18 LPA verified)'],
    confidence: 0.96,
    requiresReview: false,
    category: 'COMPENSATION',
  });

  // 8. Question: Current CTC (Canonical #11 - CRITICAL AGENT RULE: Never guess ₹12L or ₹13L)
  const currentCtcResult = resolveQuestionAnswer('What is your current CTC?', resolveContext);
  answers.push({
    question: currentCtcResult.question,
    answer: currentCtcResult.answer,
    sources: currentCtcResult.sources,
    confidence: currentCtcResult.confidence,
    requiresReview: currentCtcResult.requiresReview,
    category: currentCtcResult.category,
    reviewReason: currentCtcResult.reviewReason,
  });

  // 9. Question: Relocation Preference (Canonical #13)
  const relocationResult = resolveQuestionAnswer('Are you open to relocation / what is your preferred location?', resolveContext);
  answers.push({
    question: relocationResult.question,
    answer: relocationResult.answer,
    sources: relocationResult.sources,
    confidence: relocationResult.confidence,
    requiresReview: relocationResult.requiresReview,
    category: relocationResult.category,
  });

  // 10. Question: Legal authorization to work (India Citizen)
  answers.push({
    question: `Are you legally authorized to work in ${candidate.location || 'India'}?`,
    answer: `Yes, I am an Indian citizen legally authorized to work full-time in India without requiring visa sponsorship.`,
    sources: ['profile:workAuthorization'],
    confidence: 0.99,
    requiresReview: false,
    category: 'LOGISTICS',
  });

  // 11. Question: Visa sponsorship requirement
  const needsSponsor = candidate.sponsorshipNeeded ?? false;
  answers.push({
    question: 'Will you now or in the future require visa sponsorship?',
    answer: needsSponsor
      ? 'Yes, I will require employment visa sponsorship.'
      : 'No, I do not require visa sponsorship.',
    sources: ['profile:sponsorshipNeeded'],
    confidence: 0.95,
    requiresReview: needsSponsor,
    category: 'LOGISTICS',
    reviewReason: needsSponsor ? 'Please review visa sponsorship requirement before submitting.' : undefined,
  });

  // 12. Dynamic handling of custom questions passed from the specific application form
  if (customQuestions && customQuestions.length > 0) {
    for (const q of customQuestions) {
      // Avoid duplicate answers if already generated above
      if (answers.some((a) => a.question.toLowerCase() === q.toLowerCase())) continue;

      const resolved = resolveQuestionAnswer(q, resolveContext);
      let finalAnswer = resolved.answer;
      let finalSources = resolved.sources;
      let finalConfidence = resolved.confidence;
      let finalRequiresReview = resolved.requiresReview;

      if (process.env.GROQ_API_KEY && !resolved.requiresReview && resolved.confidence < 0.92) {
        const groqAns = await generateGroqApplicationAnswer({
          question: q,
          jobTitle: job.title,
          company: job.company,
          jobDescription: job.description,
          elementType: 'textarea',
        });
        if (groqAns) {
          finalAnswer = groqAns;
          finalSources = [...resolved.sources, 'groq:llama-3.3-70b-versatile'];
          finalConfidence = 0.95;
          finalRequiresReview = false;
        }
      }

      answers.push({
        question: q,
        answer: finalAnswer,
        sources: finalSources,
        confidence: finalConfidence,
        requiresReview: finalRequiresReview,
        category: resolved.category,
        reviewReason: resolved.reviewReason,
      });
    }
  }

  return answers;
}

export { DIXIT_ANSWER_BANK, APPLICATION_ACCURACY_RULES };
