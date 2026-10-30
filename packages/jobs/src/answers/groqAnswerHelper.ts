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
- Email: dixitkumar300@gmail.com | Phone: +91 7060137673 | Location: Noida, Uttar Pradesh, India (Open to relocation across India: Bengaluru, Hyderabad, Pune, Gurgaon, Noida, Chennai, Mumbai, or Remote)
- Total Professional Experience: 1.8 years (strictly state 1.8 years or ~2 years; never claim 3+ years)

- Embedded Firmware / Embedded C / C++ Experience (Use this whenever the job or question relates to Embedded Developer, Firmware Engineer, Microcontroller, C, or C++):
  - Summary: Embedded Firmware Engineer with 1.8 years of experience developing bare-metal firmware for Renesas RL78/I1C-based single-phase smart energy meters. Skilled in Embedded C (C99), C++, peripheral integration, DLMS/COSEM communication, EEPROM and flash storage, energy metrology, AES security, tamper detection, RTC, datalogging, relay control, and production firmware releases. Experienced with Renesas CS+, CC-RL compiler, Git, SonarQube, and hardware-oriented debugging.
  - Languages: Embedded C, C99-style C, C++, preprocessor/configuration macros, low-level memory handling, Python, C#
  - MCU: Renesas RL78/I1C (16-bit microcontroller), bare-metal firmware architecture
  - Compiler/IDE: Renesas CC-RL compiler, Renesas CS+ IDE, Applilet-generated peripheral drivers
  - Peripherals: ADC, Delta-Sigma ADC, UART/SAU, I2C/IIC, SPI, RTC, timers, watchdog (WDT), LCD, GPIO, CRC, low-voltage detection (LVD)
  - Communication Protocols: DLMS/COSEM, IEC 1107, UART, RF communication, I2C, single-wire communication
  - Memory/Storage: EEPROM, internal data flash, ROM flash, flash erase/write operations, memory mapping, event datalogging, billing data, configuration storage
  - Security & Metrology: AES encryption, AES key wrapping/unwrapping, authentication, secure meter commands, single-phase smart energy meters, energy metrology (voltage/current/power measurement), billing data, load control
  - Firmware Features: Tamper detection, magnetic sensor integration, relay/load control, RTC synchronization, activity calendar, LCD/button interface, refactored 10,000+ lines of middleware reducing memory usage by 25% and improving packet reliability from 60% to 95%
  - Tools & Practices: Git, SonarQube, static analysis, code review through CODEOWNERS, production release builds, firmware versioning, hardware diagnostics, logic analyzers

- Backend / Full-Stack / AI Experience (Use when the role is Backend, Full-Stack, Software Engineer, or AI):
  - Built production-grade full-stack and backend systems using Node.js, TypeScript, Express, FastAPI, Python, React, Next.js, MongoDB, PostgreSQL, Redis, Docker (Hirexx job portal with JWT/RBAC, TravPlan AI planner with Gemini API, Distributed Task Orchestrator).
  - Amazon ML Summer School Mentee (Selected in top 0.5% of 80,000+ applicants) — Applied ML, Python, Scikit-learn, AWS SageMaker.
  - Research Intern at DRDO — Optical pulse decoding & real-time signal processing (2x throughput improvement).

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
- When the target role is Embedded, Firmware, or C/C++, emphasize bare-metal Embedded C/C++, Renesas RL78/I1C, peripherals (ADC, Delta-Sigma ADC, UART, I2C, RTC, watchdog, GPIO, LCD, CRC), DLMS/COSEM, EEPROM/flash memory mapping, AES security, and CS+/CC-RL/SonarQube.
- Output ONLY the final answer text with no preamble, quotes, or markdown.`;

export async function generateGroqApplicationAnswer(ctx: GroqQuestionContext): Promise<string | null> {
  const apiKey = process.env.GROQ_API_KEY?.trim();
  if (!apiKey) return null;

  try {
    const isShortInput = ctx.elementType === 'input';
    const userPrompt = [
      `Job Title: ${ctx.jobTitle || 'Embedded / Software Engineer'}`,
      `Company: ${ctx.company || 'the company'}`,
      ctx.jobDescription ? `Job Context: ${ctx.jobDescription.slice(0, 700)}` : '',
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
