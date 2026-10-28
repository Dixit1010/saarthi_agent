import { Page } from 'playwright';
import path from 'path';
import fs from 'fs';
import { resolveQuestionAnswer } from '../answers/answerBank.js';
import { generateGroqApplicationAnswer } from '../answers/groqAnswerHelper.js';

export function resolveBestResumePdfPath(jobTitle?: string, jobDescription?: string): string | undefined {
  const combined = `${jobTitle || ''} ${jobDescription || ''}`.toLowerCase();
  const isEmbeddedOrSystems =
    /\b(embedded|firmware|c\+\+|rtos|microcontroller|driver|bsp|eda|asic|soc|linux|kernel|siemens|nvidia|qualcomm|amd|nxp|hardware|iot|smart meter)\b/i.test(
      combined
    );

  const fileName = isEmbeddedOrSystems
    ? 'Dixit_Kumar_Embedded_Systems_Resume.pdf'
    : 'Dixit_Kumar_FullStack_SDE_Resume.pdf';

  const candidates = [
    path.resolve(process.cwd(), 'resumes', fileName),
    path.resolve(process.cwd(), '../../resumes', fileName),
  ];

  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return undefined;
}

export type SemanticFieldType =
  | 'FIRST_NAME'
  | 'LAST_NAME'
  | 'FULL_NAME'
  | 'EMAIL'
  | 'PHONE'
  | 'RESUME_UPLOAD'
  | 'EXPERIENCE_YEARS'
  | 'EXPECTED_SALARY'
  | 'CURRENT_SALARY'
  | 'NOTICE_PERIOD'
  | 'LOCATION'
  | 'WORK_AUTHORIZATION'
  | 'LINKEDIN_URL'
  | 'GITHUB_URL'
  | 'PORTFOLIO_URL'
  | 'LEETCODE_URL'
  | 'HACKERRANK_URL'
  | 'CODEFORCES_URL'
  | 'CODECHEF_URL'
  | 'GEEKSFORGEEKS_URL'
  | 'CODING_PROFILE_URL'
  | 'CUSTOM_QUESTION'
  | 'UNKNOWN';

export interface DetectedFormField {
  selector: string;
  type: SemanticFieldType;
  elementType: 'input' | 'textarea' | 'select' | 'file';
  labelText: string;
  nameAttr?: string;
  confidence: number;
  requiresReview: boolean;
  suggestedValue?: string;
}

export interface CandidateFormContext {
  fullName: string;
  firstName?: string;
  lastName?: string;
  email: string;
  phone?: string;
  location?: string;
  experienceYears?: number;
  noticePeriodText?: string;
  currentSalaryText?: string;
  expectedSalaryText?: string;
  workAuthorizationText?: string;
  linkedinUrl?: string;
  githubUrl?: string;
  portfolioUrl?: string;
  leetcodeUrl?: string;
  codeforcesUrl?: string;
  hackerrankUrl?: string;
  codechefUrl?: string;
  geeksforgeeksUrl?: string;
  otherCodingUrl?: string;
  resumePdfPath?: string;
  answers?: Array<{ question: string; answer: string }>;
}

export class FieldMapper {
  static async detectFields(page: Page, candidate: CandidateFormContext): Promise<DetectedFormField[]> {
    const fields: DetectedFormField[] = [];

    // Evaluate all interactable form inputs in page context
    const elements = await page.$$('input, textarea, select');

    for (const el of elements) {
      const isVisible = await el.isVisible().catch(() => false);
      if (!isVisible) continue;

      const tag = await el.evaluate((e) => e.tagName.toLowerCase());
      const inputType = await el.getAttribute('type').catch(() => null);

      // Skip hidden, submit, button, reset
      if (['hidden', 'submit', 'button', 'reset'].includes(inputType || '')) continue;

      // Skip global navigation, header search bars, footer sign-up
      const isNavOrSearch = await el.evaluate((e) => {
        const inNav = e.closest('nav, header, footer, [role="navigation"], [role="search"], .search-box, .global-nav');
        const isSearch = /search|keywords/i.test(e.id || '') || /search|keywords/i.test(e.getAttribute('name') || '');
        return !!(inNav || isSearch);
      }).catch(() => false);
      if (isNavOrSearch) continue;

      const name = (await el.getAttribute('name').catch(() => '')) || '';
      const id = (await el.getAttribute('id').catch(() => '')) || '';
      const placeholder = (await el.getAttribute('placeholder').catch(() => '')) || '';
      const ariaLabel = (await el.getAttribute('aria-label').catch(() => '')) || '';

      // Find associated label text
      const labelText = await el.evaluate((e) => {
        // Label by 'for'
        if (e.id) {
          const l = document.querySelector(`label[for="${e.id}"]`);
          if (l) return l.textContent?.trim() || '';
        }
        // Parent label
        const parentLabel = e.closest('label');
        if (parentLabel) return parentLabel.textContent?.trim() || '';
        // Previous sibling or parent text
        const prev = e.previousElementSibling;
        if (prev && prev.tagName.toLowerCase().includes('label')) return prev.textContent?.trim() || '';
        return '';
      }).catch(() => '');

      const textContext = `${name} ${id} ${placeholder} ${ariaLabel} ${labelText}`.toLowerCase();

      let detectedType: SemanticFieldType = 'UNKNOWN';
      let elementType: 'input' | 'textarea' | 'select' | 'file' = 'input';
      let suggestedValue: string | undefined;
      let confidence = 0.5;
      let requiresReview = false;

      // 1. File Upload (Resume / CV)
      if (inputType === 'file' || textContext.includes('resume') || textContext.includes('cv')) {
        detectedType = 'RESUME_UPLOAD';
        elementType = 'file';
        suggestedValue = candidate.resumePdfPath || resolveBestResumePdfPath(await page.title().catch(() => ''));
        confidence = 0.98;
      }
      // 2. Email
      else if (inputType === 'email' || textContext.includes('email') || textContext.includes('e-mail')) {
        detectedType = 'EMAIL';
        suggestedValue = candidate.email;
        confidence = 0.99;
      }
      // 3. Phone / Mobile
      else if (inputType === 'tel' || textContext.includes('phone') || textContext.includes('mobile') || textContext.includes('contact')) {
        detectedType = 'PHONE';
        suggestedValue = candidate.phone || '+91 7060137673';
        confidence = 0.95;
      }
      // 4. First Name
      else if (textContext.includes('first name') || textContext.includes('firstname') || name === 'fname') {
        detectedType = 'FIRST_NAME';
        suggestedValue = candidate.firstName || candidate.fullName.split(' ')[0] || 'Dixit';
        confidence = 0.96;
      }
      // 5. Last Name
      else if (textContext.includes('last name') || textContext.includes('lastname') || name === 'lname') {
        detectedType = 'LAST_NAME';
        suggestedValue = candidate.lastName || candidate.fullName.split(' ').slice(1).join(' ') || 'Kumar';
        confidence = 0.96;
      }
      // 6. Full Name
      else if (textContext.includes('name') && !textContext.includes('company') && !textContext.includes('user')) {
        detectedType = 'FULL_NAME';
        suggestedValue = candidate.fullName;
        confidence = 0.92;
      }
      // 7. Experience (YOE)
      else if (textContext.includes('experience') || textContext.includes('yoe') || textContext.includes('years')) {
        detectedType = 'EXPERIENCE_YEARS';
        suggestedValue = candidate.experienceYears ? candidate.experienceYears.toString() : '1.8';
        confidence = 0.95;
      }
      // 8. Current Salary vs Expected Salary
      else if (textContext.includes('current ctc') || textContext.includes('current salary') || textContext.includes('present ctc')) {
        detectedType = 'CURRENT_SALARY';
        suggestedValue = candidate.currentSalaryText || '';
        confidence = candidate.currentSalaryText ? 0.95 : 0.70;
        requiresReview = true; // Agent rule: current CTC requires payslip verification
      }
      else if (textContext.includes('salary') || textContext.includes('ctc') || textContext.includes('compensation') || textContext.includes('expected')) {
        detectedType = 'EXPECTED_SALARY';
        suggestedValue = candidate.expectedSalaryText || '₹18 LPA';
        confidence = 0.95;
      }
      // 9. Notice Period
      else if (textContext.includes('notice') || textContext.includes('availability') || textContext.includes('start date')) {
        detectedType = 'NOTICE_PERIOD';
        suggestedValue = candidate.noticePeriodText || '15 days / Immediate';
        confidence = 0.92;
        if (textContext.includes('immediate') || textContext.includes('join immediately')) {
          requiresReview = true; // Agent rule: confirm before selecting immediate
        }
      }
      // 10. Work Authorization
      else if (textContext.includes('authorized') || textContext.includes('sponsorship') || textContext.includes('visa') || textContext.includes('citizen')) {
        detectedType = 'WORK_AUTHORIZATION';
        suggestedValue = candidate.workAuthorizationText || 'Authorized to work in India without sponsorship';
        confidence = 0.95;
      }
      // 11. Links (LinkedIn, GitHub, Portfolio, Coding profiles)
      else if (textContext.includes('linkedin')) {
        detectedType = 'LINKEDIN_URL';
        suggestedValue = candidate.linkedinUrl || 'https://www.linkedin.com/in/dixitkum/';
        confidence = 0.98;
      } else if (textContext.includes('github')) {
        detectedType = 'GITHUB_URL';
        suggestedValue = candidate.githubUrl || 'https://github.com/Dixit1010';
        confidence = 0.98;
      } else if (textContext.includes('portfolio') || textContext.includes('website') || textContext.includes('personal site')) {
        detectedType = 'PORTFOLIO_URL';
        suggestedValue = candidate.portfolioUrl || 'https://portfoliodixitt.netlify.app/';
        confidence = 0.95;
      } else if (textContext.includes('leetcode')) {
        detectedType = 'LEETCODE_URL';
        suggestedValue = candidate.leetcodeUrl || 'https://leetcode.com/u/dixitkumar300';
        confidence = 0.95;
      } else if (textContext.includes('geeksforgeeks')) {
        detectedType = 'GEEKSFORGEEKS_URL';
        suggestedValue = candidate.geeksforgeeksUrl || '';
        confidence = 0.95;
      } else if (textContext.includes('hackerrank')) {
        detectedType = 'HACKERRANK_URL';
        suggestedValue = candidate.hackerrankUrl || '';
        confidence = 0.95;
      } else if (textContext.includes('codeforces')) {
        detectedType = 'CODEFORCES_URL';
        suggestedValue = candidate.codeforcesUrl || 'https://codeforces.com/profile/dixitkumar300';
        confidence = 0.95;
      } else if (textContext.includes('codechef')) {
        detectedType = 'CODECHEF_URL';
        suggestedValue = candidate.codechefUrl || '';
        confidence = 0.95;
      } else if (textContext.includes('coding profile') || textContext.includes('competitive programming')) {
        detectedType = 'CODING_PROFILE_URL';
        suggestedValue = candidate.leetcodeUrl || candidate.githubUrl || candidate.portfolioUrl;
        confidence = 0.90;
      }
      // 12. Textarea / Open Screening questions (Resolved via Dixit's Answer Bank)
      else if (tag === 'textarea' || textContext.length > 25) {
        detectedType = 'CUSTOM_QUESTION';
        elementType = tag === 'textarea' ? 'textarea' : 'input';

        // First check explicit pre-generated answers
        const matchedAnswer = candidate.answers?.find((a) =>
          textContext.includes(a.question.slice(0, 15).toLowerCase())
        );

        if (matchedAnswer) {
          suggestedValue = matchedAnswer.answer;
          confidence = 0.92;
          requiresReview = false;
        } else {
          // Dynamically resolve against Dixit's 20 Q&A Answer Bank
          const resolved = resolveQuestionAnswer(labelText || textContext);
          suggestedValue = resolved.answer;
          confidence = resolved.confidence;
          requiresReview = resolved.requiresReview;

          // If Groq API Key is configured and question is open-ended or lower confidence, refine with Groq LLM
          if (process.env.GROQ_API_KEY && (confidence < 0.90 || tag === 'textarea')) {
            const pageTitle = await page.title().catch(() => '');
            const groqAnswer = await generateGroqApplicationAnswer({
              question: labelText || placeholder || textContext,
              jobTitle: pageTitle,
              elementType: tag === 'textarea' ? 'textarea' : 'input',
            });
            if (groqAnswer) {
              suggestedValue = groqAnswer;
              confidence = 0.94;
              requiresReview = false;
            }
          }
        }
      }

      if (tag === 'select') elementType = 'select';

      const selector = id ? `#${id}` : name ? `[name="${name}"]` : inputType ? `input[type="${inputType}"]` : tag;

      fields.push({
        selector,
        type: detectedType,
        elementType,
        labelText: labelText || placeholder || name || id || 'Input Field',
        nameAttr: name || undefined,
        confidence,
        requiresReview,
        suggestedValue,
      });
    }

    return fields;
  }
}
