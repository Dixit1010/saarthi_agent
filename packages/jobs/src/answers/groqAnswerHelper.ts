import { DIXIT_ANSWER_BANK, APPLICATION_ACCURACY_RULES } from './answerBank.js';

export interface GroqQuestionContext {
  question: string;
  jobTitle?: string;
  company?: string;
  jobDescription?: string;
  elementType?: 'input' | 'textarea' | 'select';
}

const DIXIT_SYSTEM_PROMPT = `You are Saarthi AI answering a job application form question on behalf of candidate Dixit Kumar.
Strictly follow these verified facts and NEVER invent skills, companies, degrees, or metrics:
- Name: Dixit Kumar
- Email: dixitkumar300@gmail.com | Phone: +91 7060137673 | Location: Noida, Uttar Pradesh, India (Open to relocation across India: Bengaluru, Hyderabad, Pune, Gurgaon, Noida, or Remote)
- Total Professional Experience: 1.8 years (strictly state 1.8 years or ~2 years; never claim 3+ years)
- Current Role: Associate Engineer at Landis+Gyr (July 2024 – Present, Noida) — Embedded C/C++, Linux, Smart Metering firmware, Wi-SUN, DLMS/COSEM, Python automation, CI/CD
- Prior Experience:
  1. Research Intern at DRDO (Defence Research and Development Organisation) — Optical pulse decoding & real-time signal processing (2x throughput improvement)
  2. Mentee at Amazon ML Summer School (Selected in top 0.5% of 80,000+ applicants) — Applied ML, Python, AWS SageMaker, Flask
- Key Full-Stack / AI Projects:
  1. Distributed Task Orchestrator (TypeScript, Node.js, Redis, Docker)
  2. TravPlan (React 18, Gemini 2.0 API, Tailwind CSS, Firebase)
  3. Hirexx (Full-Stack Job Portal with Node.js, Express, MongoDB, JWT, RBAC)
  4. Chatify (Real-time chat app with Socket.IO, Express.js, MongoDB)
- Education: B.Tech in Electronics & Communication Engineering (ECE), IET Lucknow (2020–2024), CGPA: 8.1
- Notice Period: 15 days (or negotiable / immediate after confirmation)
- Expected CTC: ₹18 LPA (negotiable based on role and total compensation)
- Work Authorization: Indian Citizen, authorized to work in India without visa sponsorship.
- Links:
  - LinkedIn: https://www.linkedin.com/in/dixitkum/
  - GitHub: https://github.com/Dixit1010
  - Portfolio: https://portfoliodixitt.netlify.app/
  - LeetCode: https://leetcode.com/u/dixitkumar300

Rules:
- If the field is a short input (e.g. years of experience, numeric, Yes/No), return ONLY the concise value (1 sentence or short phrase).
- If the field is a textarea / open-ended question, write a natural, confident 2–4 sentence first-person ("I...") answer tailored to the company and role.
- Output ONLY the final answer text with no preamble, quotes, or markdown.`;

export async function generateGroqApplicationAnswer(ctx: GroqQuestionContext): Promise<string | null> {
  const apiKey = process.env.GROQ_API_KEY?.trim();
  if (!apiKey) return null;

  try {
    const isShortInput = ctx.elementType === 'input';
    const userPrompt = [
      `Job Title: ${ctx.jobTitle || 'Software Engineer'}`,
      `Company: ${ctx.company || 'the company'}`,
      ctx.jobDescription ? `Job Context: ${ctx.jobDescription.slice(0, 600)}` : '',
      `Field Type: ${isShortInput ? 'Short single-line input (keep under 12 words)' : 'Paragraph textarea (2-4 sentences)'}`,
      `Application Question: "${ctx.question}"`,
    ]
      .filter(Boolean)
      .join('\n');

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.AI_MODEL || 'openai/gpt-oss-120b',
        messages: [
          { role: 'system', content: DIXIT_SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.25,
        max_tokens: isShortInput ? 150 : 400,
      }),
    });

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as any;
    const text = data.choices?.[0]?.message?.content?.trim();
    return text || null;
  } catch {
    return null;
  }
}

export { DIXIT_ANSWER_BANK, APPLICATION_ACCURACY_RULES };
