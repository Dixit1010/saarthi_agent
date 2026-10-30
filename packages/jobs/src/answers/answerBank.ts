/**
 * Dixit Kumar — Personalized Job Application Answer Bank & Resolution Engine
 * Authoritative source of truth for screening and application questions.
 */

export type AnswerCategory = 'FIT' | 'TECHNICAL' | 'BACKGROUND' | 'LOGISTICS' | 'COMPENSATION';
export type EngineeringDomain = 'embedded' | 'cpp_systems' | 'backend' | 'full_stack' | 'ai' | 'general';

export interface AnswerBankEntry {
  id: number;
  canonicalQuestion: string;
  keywords: string[];
  defaultAnswer: string;
  tailoredAnswers?: Partial<Record<EngineeringDomain, string>>;
  category: AnswerCategory;
  customizationRule?: string;
  agentRule?: string;
  requiresReview: boolean;
  reviewReason?: string;
  confidence: number;
  sources: string[];
}

export const APPLICATION_ACCURACY_RULES = [
  'Use approximately 1.8 years as current stated professional experience; calculate date-based experience when a form specifically requests it.',
  'Keep professional experience distinct from internships, education, and personal projects.',
  'Use only verified resume metrics and project details.',
  'Tailor answers to the target role: embedded, C++/systems, backend, full-stack, or AI.',
  'Follow the application\'s word limit and requested answer format.',
  'Never invent competing offers, work authorization, sponsorship status, disability information, legal declarations, or reasons for leaving.',
  'Ask Dixit to confirm missing or conflicting facts before submitting.',
  'Keep all final application submissions subject to Dixit\'s approval.',
] as const;

export const DIXIT_ANSWER_BANK: AnswerBankEntry[] = [
  {
    id: 1,
    canonicalQuestion: 'Tell me about yourself',
    keywords: [
      'tell me about yourself',
      'introduce yourself',
      'brief introduction',
      'about you',
      'summary of experience',
      'walk me through your resume',
      'professional background',
    ],
    defaultAnswer:
      "I'm a Software Developer at Kimbal with around 1.8 years of professional experience, working across embedded firmware, system-level development, and software automation. At Kimbal, I've worked on smart meter firmware using C/C++, optimized middleware to reduce memory usage by 25%, and improved packet reliability from 60% to 95%. I've also built testing and automation tools using C#, .NET, Python, and REST APIs.\n\nAlongside my professional work, I've developed full-stack applications using React, Next.js, Node.js, TypeScript, and MongoDB, including a job portal and an AI-powered travel planner. I also participated in Amazon ML Summer School, where I worked on applied machine learning projects.\n\nI'm now looking to take on more challenging software engineering opportunities where I can contribute to backend systems, scalable applications, C++ development, or embedded software while continuing to grow as an engineer.",
    tailoredAnswers: {
      embedded:
        "I am an Embedded Firmware Engineer with 1.8 years of professional experience developing bare-metal firmware for Renesas RL78/I1C-based single-phase smart energy meters. I specialize in Embedded C (C99), peripheral integration (ADC, Delta-Sigma ADC, UART/SAU, I2C/IIC, RTC, watchdog, timers, LCD, GPIO, CRC, low-voltage detection), DLMS/COSEM and IEC 1107 communication, EEPROM/data flash/ROM flash storage, energy metrology, AES encryption/authentication, tamper detection, and relay control.\n\nI work extensively with the Renesas CS+ IDE, CC-RL compiler, Applilet drivers, Git, and SonarQube static analysis, and have refactored 10,000+ lines of middleware to cut memory usage by 25% and boost packet reliability from 60% to 95%.",
      cpp_systems:
        "I'm an Embedded & Systems Software Developer with 1.8 years of professional experience focused on low-level C/C++ development, bare-metal firmware, and memory optimization. I develop and maintain Embedded C (C99) and C++ firmware for Renesas RL78/I1C microcontrollers, integrating ADC, UART, I2C, RTC, watchdog, and CRC peripherals, implementing DLMS/COSEM protocols and AES security, and managing EEPROM/flash memory mapping. I also refactored 10,000+ lines of middleware to reduce memory consumption by 25% and boost communication reliability from 60% to 95%.",
      backend:
        "I'm a Software Developer with around 1.8 years of professional experience spanning low-level reliability and backend web engineering. Alongside my professional firmware and automation work at Kimbal, I have built production-grade backend applications using Node.js, Express, TypeScript, and MongoDB, including Hirexx—a job portal featuring role-based access control, JWT authentication, rate limiting, and RESTful APIs.\n\nI bring a strong focus on system reliability, clean code, and API performance, and I'm looking to take technical ownership in backend engineering teams.",
      ai:
        "I'm a Software Developer with 1.8 years of experience across systems software, backend development, and applied AI. I participated in Amazon ML Summer School, building end-to-end machine learning pipelines using Python, Scikit-learn, Pandas, and Flask APIs with AWS SageMaker workflows. I also developed TravPlan, an AI-powered travel planner integrating the Google Gemini API.\n\nI'm looking to apply my engineering fundamentals to AI application development and ML infrastructure.",
    },
    category: 'BACKGROUND',
    requiresReview: false,
    confidence: 0.98,
    sources: ['Kimbal Technologies', 'Hirexx', 'TravPlan', 'Amazon ML Summer School'],
  },
  {
    id: 2,
    canonicalQuestion: 'Why are you looking for a job change?',
    keywords: [
      'why are you looking for a job change',
      'reason for job change',
      'why leave current company',
      'why change',
      'why looking for a new role',
      'reason for leaving',
      'why switch',
    ],
    defaultAnswer:
      "I've gained valuable experience at Kimbal, particularly in firmware development, debugging, reliability, and automation. At this stage, I'm looking for opportunities that offer greater technical ownership, exposure to larger-scale engineering challenges, and room to deepen my expertise in software development. I'm interested in roles where I can contribute meaningfully while continuing to learn and grow.",
    category: 'FIT',
    requiresReview: false,
    confidence: 0.96,
    sources: ['Professional Career Goals'],
  },
  {
    id: 3,
    canonicalQuestion: 'Why do you want to join our company?',
    keywords: [
      'why do you want to join our company',
      'why join us',
      'why this company',
      'why work at',
      'what interests you about our company',
      'why interested in this company',
    ],
    defaultAnswer:
      "I'm interested in this opportunity because the role aligns with my experience and the direction I want to take my career. My background includes hands-on software development, debugging, performance optimization, and building applications. I'd like to contribute these skills to your engineering team while learning from experienced engineers and working on challenging products.",
    customizationRule:
      "Replace general statements with one or two verified details about the company's product, engineering work, or job description.",
    category: 'FIT',
    requiresReview: false,
    confidence: 0.94,
    sources: ['Company Engineering Alignment'],
  },
  {
    id: 4,
    canonicalQuestion: 'Why are you a good fit for this role?',
    keywords: [
      'why are you a good fit for this role',
      'why are you a good fit',
      'why should we consider you',
      'how do your skills match',
      'fit for the position',
      'why suitable',
    ],
    defaultAnswer:
      "I bring a combination of practical software engineering experience and strong problem-solving fundamentals. At Kimbal, I've worked on reliability and memory optimization in embedded systems, while my personal projects demonstrate experience building APIs, authentication systems, database-backed applications, and responsive interfaces. I'm comfortable learning new technologies, debugging complex issues, and working across different layers of a system.",
    tailoredAnswers: {
      embedded:
        "I bring 1.8 years of direct bare-metal firmware experience on Renesas RL78/I1C 16-bit microcontrollers using Embedded C (C99), Renesas CS+ IDE, and the CC-RL compiler. I have integrated ADC, Delta-Sigma ADC, UART, I2C, RTC, watchdog, timers, LCD, GPIO, CRC, and low-voltage detection peripherals, implemented DLMS/COSEM, IEC 1107, and RF communication, managed EEPROM/data flash/ROM flash memory mapping and event datalogging, and built AES security, tamper detection, and relay control features.",
      cpp_systems:
        "My background centers on performance-critical C/C++ and bare-metal systems programming. I have 1.8 years of experience developing low-level C/C++ firmware on Renesas RL78/I1C platforms—handling memory mapping across EEPROM and flash storage, peripheral drivers (UART, I2C, ADC, RTC, watchdog, CRC), DLMS/COSEM protocol state machines, and AES encryption, while using Git and SonarQube static analysis for production releases.",
      backend:
        "I combine low-level systems discipline with modern backend development experience. In Hirexx, I built scalable REST APIs using Node.js, TypeScript, Express, and MongoDB, incorporating RBAC, rate limiting, and centralized error handling. My experience debugging high-reliability systems at Kimbal ensures that I design backend services with fault-tolerance, observability, and clean architecture.",
      ai:
        "I offer a solid foundation in software engineering coupled with hands-on AI application development. Through Amazon ML Summer School, I built applied ML models using Python, Scikit-learn, and Flask, and in TravPlan, I integrated the Google Gemini API with modern frontend and backend architectures. I have the technical agility to build reliable AI-enabled software.",
    },
    customizationRule: 'Tailor the examples to the specific role rather than listing every skill.',
    category: 'FIT',
    requiresReview: false,
    confidence: 0.95,
    sources: ['Kimbal Technologies', 'Hirexx', 'System Engineering Fundamentals'],
  },
  {
    id: 5,
    canonicalQuestion: 'What are your strengths?',
    keywords: [
      'what are your strengths',
      'greatest strength',
      'key strengths',
      'core competencies',
      'strongest technical skill',
      'what do you excel at',
    ],
    defaultAnswer:
      "My main strengths are problem-solving, debugging, and taking a systematic approach to technical challenges. For example, at Kimbal, I worked on improving packet reliability from 60% to 95% while reducing memory usage by 25%. I also enjoy building complete applications and learning across software layers, from low-level firmware to backend APIs.",
    category: 'FIT',
    requiresReview: false,
    confidence: 0.95,
    sources: ['Kimbal Technologies Metrics', 'Full-stack experience'],
  },
  {
    id: 6,
    canonicalQuestion: 'What is your weakness?',
    keywords: [
      'what is your weakness',
      'areas for improvement',
      'greatest weakness',
      'what do you struggle with',
      'weakest area',
    ],
    defaultAnswer:
      "I sometimes spend extra time exploring implementation details because I want to understand the underlying problem thoroughly. I'm improving at balancing that depth with delivery timelines by prioritizing the main requirement first, setting clear checkpoints, and expanding the solution when necessary.",
    agentRule: 'Use this answer only if it accurately reflects your working style.',
    category: 'FIT',
    requiresReview: false,
    confidence: 0.92,
    sources: ['Engineering Self-Reflection'],
  },
  {
    id: 7,
    canonicalQuestion: 'Describe a challenging technical problem you solved',
    keywords: [
      'describe a challenging technical problem you solved',
      'challenging engineering problem',
      'complex bug',
      'difficult technical challenge',
      'tough problem solved',
      'tell me about a time you solved a difficult problem',
    ],
    defaultAnswer:
      'At Kimbal, I worked on embedded C middleware for RL78/I1C smart meters where memory consumption and packet reliability were important concerns. I analyzed the existing implementation, used systematic debugging and logic-analyzer observations to investigate failures, and refactored more than 10,000 lines of middleware. The resulting improvements reduced the memory footprint by 25% and raised packet reliability from 60% to 95%.\n\nThis experience reinforced the importance of understanding system behavior, isolating root causes, and validating improvements rather than relying on assumptions.',
    category: 'TECHNICAL',
    requiresReview: false,
    confidence: 0.98,
    sources: ['Kimbal RL78/I1C Middleware Optimization', 'Verified Resume Metrics'],
  },
  {
    id: 8,
    canonicalQuestion: 'Tell me about your most relevant project',
    keywords: [
      'tell me about your most relevant project',
      'relevant project',
      'best project',
      'featured project',
      'key project',
      'describe a project you worked on',
    ],
    defaultAnswer:
      'For backend and full-stack roles, I highlight Hirexx, my full-stack job portal built using Next.js, TypeScript, Node.js, Express, and MongoDB. It includes job search and filtering, application tracking, role-based access control, authentication, employer dashboards, and protected API routes with rate limiting and centralized error handling.\n\nFor embedded and systems roles, I highlight my work at Kimbal optimizing RL78/I1C smart meter firmware in C/C++, refactoring 10,000+ lines of middleware to reduce memory usage by 25% and raise packet reliability from 60% to 95%.',
    tailoredAnswers: {
      backend:
        'Hirexx is my full-stack job portal built using Next.js, TypeScript, Node.js, Express, and MongoDB. It features role-based access control (candidate vs. employer), JWT authentication, job search with compound filtering, application pipeline tracking, and protected REST API endpoints. I implemented input validation using schemas, centralized error handling, rate limiting for security, and MongoDB indexing for efficient queries.',
      full_stack:
        'Hirexx is a complete job search and application platform built with Next.js, TypeScript, Node.js, Express, and MongoDB. It includes responsive candidate and recruiter dashboards, resume upload handling, multi-criteria search, application status workflows, and JWT authentication. I focused on clean component architecture, state management, and protected REST API routes with rate limiting.',
      embedded:
        'I developed and maintained bare-metal Embedded C firmware for Renesas RL78/I1C single-phase smart energy meters. My work covered integrating ADC, Delta-Sigma ADC, UART, I2C, RTC, watchdog, timers, LCD, GPIO, CRC, and low-voltage detection peripherals; implementing DLMS/COSEM, IEC 1107, and RF communication; managing EEPROM, data flash, and ROM flash memory mapping for billing and event datalogging; and implementing AES encryption, tamper detection, magnetic sensor integration, and relay load control.',
      cpp_systems:
        'I developed low-level C/C++ firmware and middleware on Renesas RL78/I1C microcontrollers, refactoring 10,000+ lines of code to reduce memory usage by 25% and lift packet reliability from 60% to 95%. I also implemented EEPROM/flash memory mapping, DLMS/COSEM protocol handlers, AES encryption/key wrapping, and hardware diagnostics using Renesas CS+, CC-RL compiler, Git, and SonarQube.',
      ai:
        'TravPlan is an AI-powered travel itinerary planning application I built using the Google Gemini API, React, Node.js, and TypeScript. It generates customized day-by-day travel schedules based on user preferences, budget, and constraints. In parallel, through Amazon ML Summer School, I built applied ML models using Python, Scikit-learn, and Pandas, deploying inference endpoints via Flask and AWS SageMaker.',
    },
    category: 'TECHNICAL',
    requiresReview: false,
    confidence: 0.97,
    sources: ['Hirexx', 'Kimbal RL78/I1C Firmware', 'TravPlan'],
  },
  {
    id: 9,
    canonicalQuestion: 'Why should we hire you?',
    keywords: [
      'why should we hire you',
      'why hire you',
      'what makes you stand out',
      'why are you the best candidate',
      'value you bring',
    ],
    defaultAnswer:
      "I have practical experience solving real engineering problems, along with the ability to build software independently through projects. I've worked on firmware reliability and optimization, automated testing, backend APIs, and full-stack applications. I also have a strong foundation in data structures and algorithms. I believe this combination of hands-on experience, adaptability, and willingness to learn would help me contribute to the team.",
    category: 'FIT',
    requiresReview: false,
    confidence: 0.95,
    sources: ['Engineering Track Record'],
  },
  {
    id: 10,
    canonicalQuestion: 'What are your salary expectations?',
    keywords: [
      'what are your salary expectations',
      'expected salary',
      'expected ctc',
      'salary expectation',
      'desired compensation',
      'compensation expectations',
      'what salary do you expect',
    ],
    defaultAnswer:
      "My expected compensation is around ₹18 LPA, depending on the role's responsibilities, the overall compensation structure, and growth opportunities. I'm open to discussing a package that fairly reflects the scope of the position and my experience.",
    agentRule:
      'Use ₹18 LPA as the current stated expectation only after confirming it remains accurate. Never confuse expected salary with current CTC.',
    category: 'COMPENSATION',
    requiresReview: false,
    confidence: 0.95,
    sources: ['Configured Expected CTC: ₹18 LPA'],
  },
  {
    id: 11,
    canonicalQuestion: 'What is your current CTC?',
    keywords: [
      'what is your current ctc',
      'current salary',
      'current compensation',
      'present ctc',
      'current package',
    ],
    defaultAnswer:
      'My current compensation should be reported using my latest verified employment documents or payslip.',
    agentRule:
      'Do not automatically answer ₹12 LPA or ₹13 LPA because those figures appear in different profile versions. Ask me to confirm the current figure before submitting an application that requires it.',
    category: 'COMPENSATION',
    requiresReview: true,
    reviewReason:
      'Current CTC requires confirmation from latest payslip/employment documents. Do not guess ₹12L or ₹13L automatically without confirmation.',
    confidence: 0.80,
    sources: ['Employment Documents / Payslip'],
  },
  {
    id: 12,
    canonicalQuestion: 'What is your notice period?',
    keywords: [
      'what is your notice period',
      'notice period',
      'availability date',
      'how soon can you join',
      'earliest start date',
      'immediate joiner',
      'joining time',
    ],
    defaultAnswer:
      'My current stated notice period is 15 days or less, subject to confirmation of my employment terms and release date.',
    agentRule:
      'If a form asks whether I can join immediately, do not select "Yes" unless I explicitly confirm immediate availability.',
    category: 'LOGISTICS',
    requiresReview: false,
    confidence: 0.94,
    sources: ['Notice Period: 15 days / Immediate subject to release'],
  },
  {
    id: 13,
    canonicalQuestion: 'Are you willing to relocate?',
    keywords: [
      'are you willing to relocate',
      'willingness to relocate',
      'open to relocation',
      'preferred work location',
      'relocate to',
      'location preference',
    ],
    defaultAnswer:
      "I'm currently based in Noida and am open to considering opportunities in Delhi NCR, Bengaluru, Hyderabad, Pune, and other suitable locations. My relocation preference would depend on the role, work arrangement, and overall opportunity.",
    agentRule: 'For remote positions, confirm that the role permits employment from India.',
    category: 'LOGISTICS',
    requiresReview: false,
    confidence: 0.95,
    sources: ['Preferences: Noida / Delhi NCR / Bengaluru / Hyderabad / Pune'],
  },
  {
    id: 14,
    canonicalQuestion: 'Where do you see yourself in five years?',
    keywords: [
      'where do you see yourself in five years',
      'in 5 years',
      'career goals 5 years',
      'future career plans',
      'long term career goals',
    ],
    defaultAnswer:
      "I want to grow into an engineer who can own complex technical problems end to end, make sound design decisions, and contribute to reliable, scalable software. Over time, I'd like to deepen my expertise in my chosen engineering domain, mentor other engineers, and take greater responsibility for technical delivery.",
    category: 'FIT',
    requiresReview: false,
    confidence: 0.93,
    sources: ['Career Growth Path'],
  },
  {
    id: 15,
    canonicalQuestion: 'Describe a time you improved a process',
    keywords: [
      'describe a time you improved a process',
      'process improvement',
      'automated a workflow',
      'improved efficiency',
      'automation accomplishment',
      'increased productivity',
    ],
    defaultAnswer:
      'At Kimbal, I developed Python command-line tools and Bash scripts for UART data extraction, serial testing, and firmware deployment. These tools reduced manual QA effort by approximately 66% and increased testing throughput by 3x. The experience showed me how targeted automation can improve consistency and free up engineering time for more valuable debugging and development work.',
    category: 'TECHNICAL',
    requiresReview: false,
    confidence: 0.98,
    sources: ['Kimbal Test Automation & Tooling', 'Verified Resume Metrics'],
  },
  {
    id: 16,
    canonicalQuestion: 'Tell me about your machine learning experience',
    keywords: [
      'tell me about your machine learning experience',
      'ml experience',
      'machine learning projects',
      'ai experience',
      'experience with machine learning',
      'data science experience',
    ],
    defaultAnswer:
      'I participated in Amazon ML Summer School, where I worked on applied machine learning concepts and end-to-end projects using Python, Scikit-learn, Pandas, and Flask APIs. I also gained exposure to integrating machine learning models with backend services and deployment workflows using AWS SageMaker. Separately, I built TravPlan, an AI-powered travel planner using the Google Gemini API.',
    agentRule:
      'Keep the description aligned with the actual scope of the program and projects; do not describe the program as employment at Amazon.',
    category: 'TECHNICAL',
    requiresReview: false,
    confidence: 0.96,
    sources: ['Amazon ML Summer School', 'TravPlan'],
  },
  {
    id: 17,
    canonicalQuestion: 'What is your greatest achievement?',
    keywords: [
      'what is your greatest achievement',
      'proudest accomplishment',
      'biggest achievement',
      'most proud of',
      'significant milestone',
    ],
    defaultAnswer:
      "One of my most meaningful engineering achievements was improving embedded middleware at Kimbal to reduce memory usage by 25% and improve packet reliability from 60% to 95%. I'm also proud of being selected for Amazon ML Summer School from a highly competitive applicant pool and consistently working on projects that expand my software engineering skills.",
    category: 'FIT',
    requiresReview: false,
    confidence: 0.96,
    sources: ['Kimbal Middleware Optimization', 'Amazon ML Summer School'],
  },
  {
    id: 18,
    canonicalQuestion: 'Do you have experience with [technology from the job description]?',
    keywords: [
      'experience with',
      'hands-on experience with',
      'worked with',
      'familiar with',
      'proficiency in',
      'years of experience with',
    ],
    defaultAnswer:
      "My experience depends on the technology. I have hands-on professional experience with embedded C/C++, C#/.NET, firmware debugging, and automation, as well as project experience with React, Next.js, Node.js, TypeScript, MongoDB, REST APIs, and AI integrations.\n\nFor technologies I haven't used directly, I would explain any relevant fundamentals or transferable experience honestly rather than claim professional proficiency.",
    category: 'TECHNICAL',
    requiresReview: false,
    confidence: 0.91,
    sources: ['Verified Candidate Skills & Projects'],
  },
  {
    id: 19,
    canonicalQuestion: 'Are you open to learning a new technology?',
    keywords: [
      'are you open to learning a new technology',
      'willing to learn',
      'learn new skills',
      'adapt to new tech stack',
      'learning agility',
      'open to learning',
    ],
    defaultAnswer:
      "Yes. My experience spans embedded firmware, desktop automation, backend development, and AI-enabled applications. Moving across these areas has helped me adapt to unfamiliar tools and understand how different components work together. I'm comfortable learning a new technology when it helps solve the engineering problem at hand.",
    category: 'FIT',
    requiresReview: false,
    confidence: 0.97,
    sources: ['Cross-domain Adaptability'],
  },
  {
    id: 20,
    canonicalQuestion: 'Do you have any questions for us?',
    keywords: [
      'do you have any questions for us',
      'questions for interviewer',
      'any questions',
      'questions for the company',
      'anything you want to ask',
    ],
    defaultAnswer:
      "I'd like to understand the team's main technical challenges, the kind of problems this role would own in the first three to six months, and how the team approaches code quality, testing, and engineering growth.",
    category: 'FIT',
    requiresReview: false,
    confidence: 0.96,
    sources: ['Candidate Questions'],
  },
];

/**
 * Resolves the primary engineering domain based on job title, description, or skills.
 */
export function detectEngineeringDomain(title: string = '', description: string = '', skills: string[] = []): EngineeringDomain {
  const text = `${title} ${description} ${skills.join(' ')}`.toLowerCase();

  if (/firmware|embedded|rtos|microcontroller|mcu|bsp|device driver|uart|spi|i2c|adc|delta-sigma|dlms|cosem|iec 1107|eeprom|flash|watchdog|rtc|gpio|crc|aes|metrology|smart meter|renesas|rl78|cc-rl|bare-metal|stm32|esp32/i.test(text)) {
    return 'embedded';
  }
  if (/c\+\+|systems software|low latency|compiler|posix|linux kernel|network protocol|ipc|socket/i.test(text)) {
    return 'cpp_systems';
  }
  if (/machine learning|deep learning|applied ai|\bai\b|artificial intelligence|llm|generative ai|langchain|rag|nlp|gemini/i.test(text)) {
    return 'ai';
  }
  if (/full stack|frontend and backend|react.*node|next\.js/i.test(text)) {
    return 'full_stack';
  }
  if (/backend|node\.js|fastapi|golang|microservices|rest api|express|database/i.test(text)) {
    return 'backend';
  }
  return 'general';
}

/**
 * Calculates date-based experience duration from a starting date (e.g., Kimbal employment).
 */
export function calculateDateBasedExperience(startDate: Date | string = '2024-02-01'): {
  totalYearsText: string;
  totalMonths: number;
  years: number;
  months: number;
} {
  const start = new Date(startDate);
  const now = new Date();
  let months = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
  if (months < 1) months = 21; // fallback ~1.8 years
  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;

  return {
    totalYearsText: `${years}.${Math.round((remainingMonths / 12) * 10)} years`,
    totalMonths: months,
    years,
    months: remainingMonths,
  };
}

export interface ResolveAnswerContext {
  jobTitle?: string;
  company?: string;
  jobDescription?: string;
  requiredSkills?: string[];
  maxWords?: number;
  allowImmediateConfirmation?: boolean;
  confirmedCurrentCtc?: string;
}

export interface ResolvedAnswerResult {
  entry?: AnswerBankEntry;
  question: string;
  answer: string;
  category: AnswerCategory;
  confidence: number;
  requiresReview: boolean;
  reviewReason?: string;
  sources: string[];
}

/**
 * Matches an arbitrary question string against the 20 canonical Answer Bank entries,
 * dynamically applying role tailoring, company personalization, and strict accuracy rules.
 */
export function resolveQuestionAnswer(query: string, context: ResolveAnswerContext = {}): ResolvedAnswerResult {
  const normalizedQuery = query.toLowerCase().trim();
  const domain = detectEngineeringDomain(context.jobTitle, context.jobDescription, context.requiredSkills);
  const companyName = context.company || 'your team';

  // 1. Check for Current CTC specifically (CRITICAL AGENT RULE: Never guess 12 or 13 LPA)
  if (
    normalizedQuery.includes('current ctc') ||
    normalizedQuery.includes('current salary') ||
    normalizedQuery.includes('current package') ||
    normalizedQuery.includes('present ctc')
  ) {
    if (context.confirmedCurrentCtc) {
      return {
        question: query,
        answer: context.confirmedCurrentCtc,
        category: 'COMPENSATION',
        confidence: 0.99,
        requiresReview: false,
        sources: ['Confirmed by Dixit Kumar'],
      };
    }
    return {
      question: query,
      answer: 'My current compensation will be shared from my verified employment documents and latest payslip.',
      category: 'COMPENSATION',
      confidence: 0.80,
      requiresReview: true,
      reviewReason:
        'CRITICAL AGENT RULE: Current CTC requires explicit confirmation from payslip (do not guess ₹12L or ₹13L). Please confirm before submitting.',
      sources: ['Employment Documents / Payslip'],
    };
  }

  // 2. Check for Immediate Joining / Notice period rule
  if (normalizedQuery.includes('join immediately') || normalizedQuery.includes('immediate joiner') || normalizedQuery.includes('can you join immediately')) {
    if (context.allowImmediateConfirmation) {
      return {
        question: query,
        answer: 'Yes, I can join immediately subject to release confirmation.',
        category: 'LOGISTICS',
        confidence: 0.95,
        requiresReview: false,
        sources: ['Explicit user confirmation'],
      };
    }
    return {
      question: query,
      answer: 'My current stated notice period is 15 days or less, subject to confirmation of release date.',
      category: 'LOGISTICS',
      confidence: 0.88,
      requiresReview: true,
      reviewReason:
        'AGENT RULE: Do not select "Yes" for immediate joining unless Dixit explicitly confirms immediate availability for this specific application.',
      sources: ['Notice Period: 15 days / Immediate subject to release'],
    };
  }

  // 3. Search DIXIT_ANSWER_BANK
  let bestMatch: AnswerBankEntry | null = null;
  let highestScore = 0;

  for (const entry of DIXIT_ANSWER_BANK) {
    for (const kw of entry.keywords) {
      if (normalizedQuery.includes(kw)) {
        const score = kw.length;
        if (score > highestScore) {
          highestScore = score;
          bestMatch = entry;
        }
      }
    }
  }

  if (bestMatch) {
    let finalAnswer = bestMatch.defaultAnswer;

    // Apply domain tailoring if available
    if (bestMatch.tailoredAnswers && bestMatch.tailoredAnswers[domain]) {
      finalAnswer = bestMatch.tailoredAnswers[domain]!;
    }

    // Apply Question 3 Customization Rule: Personalize with Company Name & JD Context
    if (bestMatch.id === 3 && context.company) {
      const roleText = context.jobTitle ? `for the ${context.jobTitle} position` : '';
      finalAnswer = `I'm interested in joining ${companyName} ${roleText} because the engineering challenges align directly with my experience in performance optimization, debugging, and robust software delivery. I'd like to contribute my hands-on background in systems and application development to ${companyName}'s engineering team while working alongside experienced engineers.`;
    }

    // Apply word limit if requested
    if (context.maxWords && context.maxWords > 0) {
      const words = finalAnswer.split(/\s+/);
      if (words.length > context.maxWords) {
        finalAnswer = words.slice(0, context.maxWords).join(' ') + '...';
      }
    }

    return {
      entry: bestMatch,
      question: query,
      answer: finalAnswer,
      category: bestMatch.category,
      confidence: bestMatch.confidence,
      requiresReview: bestMatch.requiresReview,
      reviewReason: bestMatch.reviewReason,
      sources: bestMatch.sources,
    };
  }

  // 4. Fallback for technology-specific experience questions: "Do you have experience with X?"
  const techMatch = normalizedQuery.match(/(?:experience with|worked with|knowledge of|proficient in)\s+([a-zA-Z0-9#+.\s-]+)/i);
  if (techMatch && techMatch[1]) {
    const tech = techMatch[1].trim();
    const verifiedSkills = ['c', 'c++', 'embedded c', 'c#', '.net', 'python', 'react', 'next.js', 'node.js', 'typescript', 'mongodb', 'rest api', 'bash', 'uart', 'spi', 'i2c'];
    const isVerified = verifiedSkills.some((s) => tech.toLowerCase().includes(s));

    if (isVerified) {
      return {
        question: query,
        answer: `Yes, I have hands-on experience working with ${tech}. I have applied it in real-world systems and production-focused environments with a focus on code quality, testing, and reliability.`,
        category: 'TECHNICAL',
        confidence: 0.92,
        requiresReview: false,
        sources: ['Candidate Verified Skills'],
      };
    } else {
      return {
        question: query,
        answer: `While I haven't worked with ${tech} professionally as my primary stack, my strong software engineering fundamentals across systems and modern architectures allow me to adapt and learn new technologies quickly.`,
        category: 'TECHNICAL',
        confidence: 0.85,
        requiresReview: false,
        sources: ['Transferable Engineering Fundamentals'],
      };
    }
  }

  // 5. General fallback adhering to accuracy rules
  return {
    question: query,
    answer:
      "I bring around 1.8 years of practical software engineering experience spanning low-level optimization and modern software development. I take a systematic approach to debugging, value system reliability, and adapt quickly to project requirements.",
    category: 'FIT',
    confidence: 0.82,
    requiresReview: true,
    reviewReason: 'Unmatched question. Please review the suggested answer before submission.',
    sources: ['Candidate Profile Summary'],
  };
}
