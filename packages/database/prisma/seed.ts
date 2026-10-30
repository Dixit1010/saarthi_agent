import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // 1. Create or upsert Dixit Kumar's user record
  const user = await prisma.user.upsert({
    where: { email: 'dixit@example.com' },
    update: {},
    create: {
      email: 'dixit@example.com',
      name: 'Dixit Kumar',
      passwordHash: '$2b$10$abcdefghijklmnopqrstuvwxyzaBCDEFGHIJKLMNOPQRSTUVWXYZ12', // dummy bcrypt hash for dev
      role: 'USER',
    },
  });

  // 2. Candidate Profile
  const profile = await prisma.profile.upsert({
    where: { userId: user.id },
    update: {},
    create: {
      userId: user.id,
      location: 'Noida, India',
      phone: '+91 98765 43210',
      bio: 'Full-stack & Backend engineer experienced in high-throughput Node.js microservices, distributed systems, and AI workflows.',
      education: JSON.stringify([
        {
          degree: 'B.Tech',
          field: 'Electronics and Communication Engineering',
          institution: 'Netaji Subhas University of Technology (NSUT)',
          start: '2021',
          end: '2025',
        },
      ]),
    },
  });

  // 3. Skills
  const sampleSkills = [
    { name: 'Embedded C', category: 'Languages & Low-Level', yearsExperience: 1.8, verified: true },
    { name: 'C99', category: 'Languages & Low-Level', yearsExperience: 1.8, verified: true },
    { name: 'C++', category: 'Languages & Low-Level', yearsExperience: 1.8, verified: true },
    { name: 'Renesas RL78/I1C', category: 'MCU & Compiler/IDE', yearsExperience: 1.8, verified: true },
    { name: 'Renesas CS+ IDE', category: 'MCU & Compiler/IDE', yearsExperience: 1.8, verified: true },
    { name: 'Renesas CC-RL Compiler', category: 'MCU & Compiler/IDE', yearsExperience: 1.8, verified: true },
    { name: 'Bare-Metal Firmware', category: 'MCU & Compiler/IDE', yearsExperience: 1.8, verified: true },
    { name: 'ADC / Delta-Sigma ADC', category: 'Peripherals', yearsExperience: 1.8, verified: true },
    { name: 'UART', category: 'Peripherals', yearsExperience: 1.8, verified: true },
    { name: 'I2C', category: 'Peripherals', yearsExperience: 1.8, verified: true },
    { name: 'SPI', category: 'Peripherals', yearsExperience: 1.8, verified: true },
    { name: 'RTC', category: 'Peripherals', yearsExperience: 1.8, verified: true },
    { name: 'Watchdog', category: 'Peripherals', yearsExperience: 1.8, verified: true },
    { name: 'GPIO', category: 'Peripherals', yearsExperience: 1.8, verified: true },
    { name: 'LCD', category: 'Peripherals', yearsExperience: 1.8, verified: true },
    { name: 'CRC', category: 'Peripherals', yearsExperience: 1.8, verified: true },
    { name: 'DLMS/COSEM', category: 'Communication & Protocols', yearsExperience: 1.8, verified: true },
    { name: 'IEC 1107', category: 'Communication & Protocols', yearsExperience: 1.8, verified: true },
    { name: 'RF Communication', category: 'Communication & Protocols', yearsExperience: 1.8, verified: true },
    { name: 'EEPROM', category: 'Memory & Storage', yearsExperience: 1.8, verified: true },
    { name: 'Data Flash / ROM Flash', category: 'Memory & Storage', yearsExperience: 1.8, verified: true },
    { name: 'AES Encryption', category: 'Security & Metrology', yearsExperience: 1.8, verified: true },
    { name: 'Energy Metrology', category: 'Security & Metrology', yearsExperience: 1.8, verified: true },
    { name: 'Tamper Detection', category: 'Security & Metrology', yearsExperience: 1.8, verified: true },
    { name: 'Relay Control', category: 'Security & Metrology', yearsExperience: 1.8, verified: true },
    { name: 'SonarQube', category: 'Tools & Practices', yearsExperience: 1.8, verified: true },
    { name: 'Git', category: 'Tools & Practices', yearsExperience: 1.8, verified: true },
    { name: 'Node.js', category: 'Backend', yearsExperience: 1.8, verified: true },
    { name: 'TypeScript', category: 'Language', yearsExperience: 1.8, verified: true },
    { name: 'PostgreSQL', category: 'Database', yearsExperience: 1.8, verified: true },
    { name: 'REST APIs', category: 'Backend', yearsExperience: 1.8, verified: true },
    { name: 'Python', category: 'Language', yearsExperience: 1.8, verified: true },
    { name: 'Docker', category: 'DevOps', yearsExperience: 1.0, verified: true },
    { name: 'Redis', category: 'Database', yearsExperience: 1.5, verified: true },
    { name: 'React', category: 'Frontend', yearsExperience: 1.5, verified: true },
    { name: 'Next.js', category: 'Frontend', yearsExperience: 1.0, verified: true },
  ];

  for (const s of sampleSkills) {
    const existing = await prisma.skill.findFirst({
      where: { profileId: profile.id, name: s.name },
    });
    if (!existing) {
      await prisma.skill.create({
        data: {
          profileId: profile.id,
          name: s.name,
          category: s.category,
          yearsExperience: s.yearsExperience,
          verified: s.verified,
        },
      });
    }
  }

  // 4. Experience Bank
  const existingExp = await prisma.experience.findFirst({
    where: { profileId: profile.id, company: 'FinTech Labs' },
  });

  let expId = existingExp?.id;
  if (!existingExp) {
    const exp = await prisma.experience.create({
      data: {
        profileId: profile.id,
        company: 'FinTech Labs',
        role: 'Software Engineering Intern',
        employmentType: 'INTERNSHIP',
        location: 'Noida, India',
        startDate: new Date('2024-01-10'),
        endDate: new Date('2024-07-20'),
        isCurrent: false,
        technologies: JSON.stringify([
          'Embedded C', 'C99', 'C++', 'Renesas RL78/I1C', 'Renesas CS+', 'CC-RL',
          'DLMS/COSEM', 'IEC 1107', 'UART', 'I2C', 'ADC', 'Delta-Sigma ADC',
          'EEPROM', 'Flash', 'AES', 'RTC', 'Watchdog', 'GPIO', 'LCD', 'CRC', 'Git', 'SonarQube',
          'Node.js', 'PostgreSQL', 'Redis', 'Docker'
        ]),
        achievements: {
          create: [
            {
              text: 'Developed and maintained Embedded C firmware for Renesas RL78/I1C single-phase smart energy meter platforms.',
              metrics: JSON.stringify(['Renesas RL78/I1C', 'Embedded C']),
              verified: true,
            },
            {
              text: 'Integrated ADC, Delta-Sigma ADC, UART, I2C, RTC, watchdog, timers, LCD, GPIO, CRC, and low-voltage detection peripherals.',
              metrics: JSON.stringify(['ADC / Delta-Sigma ADC', 'UART / I2C / RTC / WDT']),
              verified: true,
            },
            {
              text: 'Implemented and maintained DLMS/COSEM meter communication, RF communication, IEC 1107 interfaces, and meter command processing.',
              metrics: JSON.stringify(['DLMS/COSEM', 'IEC 1107']),
              verified: true,
            },
            {
              text: 'Worked on EEPROM, data flash, ROM flash, memory mapping, event datalogging, billing data, and configuration storage.',
              metrics: JSON.stringify(['EEPROM', 'Data Flash / ROM Flash']),
              verified: true,
            },
            {
              text: 'Implemented AES-based security functions, authentication handling, tamper detection, magnetic sensor integration, and relay/load-control features.',
              metrics: JSON.stringify(['AES Encryption', 'Tamper Detection']),
              verified: true,
            },
            {
              text: 'Supported production builds, firmware versioning, hardware diagnostics, static analysis, and code-quality review using CS+, CC-RL, Git, and SonarQube.',
              metrics: JSON.stringify(['Renesas CS+ / CC-RL', 'SonarQube']),
              verified: true,
            },
          ],
        },
      },
    });
    expId = exp.id;
  }

  // 5. Project Bank
  const existingProj = await prisma.project.findFirst({
    where: { profileId: profile.id, name: 'Distributed Task Orchestrator' },
  });

  if (!existingProj) {
    await prisma.project.create({
      data: {
        profileId: profile.id,
        name: 'Distributed Task Orchestrator',
        description: 'Fault-tolerant distributed job runner with exponential backoff and observability.',
        problem: 'Background operations failed unpredictably without retry policies or centralized event telemetry.',
        solution: 'Built modular queue orchestrator in TypeScript with Redis pub/sub and Prometheus metrics.',
        technologies: JSON.stringify(['TypeScript', 'Node.js', 'Redis', 'Docker', 'Jest']),
        githubUrl: 'https://github.com/dixitkumar/task-orchestrator',
        liveUrl: 'https://orchestrator-demo.dev',
        measurableResults: JSON.stringify(['Zero message loss over 1M simulated jobs', '50ms dispatch overhead']),
        verified: true,
      },
    });
  }

  // 6. User Preferences & Automation Rule
  await prisma.userPreference.upsert({
    where: { userId: user.id },
    update: {},
    create: {
      userId: user.id,
      targetRoles: JSON.stringify([
        'Embedded Firmware Engineer',
        'Embedded Software Engineer',
        'Firmware Developer',
        'C++ Developer',
        'Embedded C Developer',
        'Backend Engineer',
        'SDE-1',
        'AI Engineer',
      ]),
      targetLocations: JSON.stringify(['Noida', 'Gurgaon', 'Delhi', 'Remote']),
      remotePreference: 'ANY',
      experienceMin: 0,
      experienceMax: 3,
      salaryMin: 1200000,
      noticePeriod: 'Immediate / 15 Days',
      excludedCompanies: JSON.stringify(['SpamCorp']),
      excludedKeywords: JSON.stringify(['Senior Architect', '10+ years']),
    },
  });

  await prisma.automationRule.upsert({
    where: { userId: user.id },
    update: {},
    create: {
      userId: user.id,
      mode: 'ASSISTED',
      minimumMatchScore: 80,
      dailyApplicationCap: 10,
      requireApprovalForSubmit: true,
    },
  });

  // 7. Sample Canonical Jobs & Matches
  const jobsData = [
    {
      canonicalUrl: 'https://careers.razorpay.com/jobs/backend-engineer-sde1-01',
      title: 'Backend Engineer (SDE-1)',
      company: 'Razorpay',
      location: 'Gurgaon, India',
      locationType: 'HYBRID',
      employmentType: 'FULL_TIME',
      description: 'Razorpay is looking for an SDE-1 Backend Engineer to design and build scalable payment services. Requirements: Strong proficiency in Node.js or Go, experience with PostgreSQL and distributed caching (Redis). Knowledge of RESTful APIs, clean architecture, and 0-2 years of software engineering experience.',
      salaryMin: 1400000,
      salaryMax: 1800000,
      experienceMin: 0,
      experienceMax: 2,
      skills: ['Node.js', 'PostgreSQL', 'Redis', 'REST APIs'],
      matchScore: 91,
      matched: ['Node.js', 'PostgreSQL', 'REST APIs', '1–2 years experience'],
      partial: ['Docker'],
      missing: ['Kubernetes'],
    },
    {
      canonicalUrl: 'https://swiggy.careers/openings/software-engineer-backend-2026',
      title: 'Software Development Engineer - Backend',
      company: 'Swiggy',
      location: 'Remote',
      locationType: 'REMOTE',
      employmentType: 'FULL_TIME',
      description: 'Join the Logistics Platform team building real-time dispatch systems. Stack: Node.js/TypeScript, PostgreSQL, Kafka. You will work on event-driven architectures handling millions of daily delivery events.',
      salaryMin: 1600000,
      salaryMax: 2200000,
      experienceMin: 1,
      experienceMax: 3,
      skills: ['TypeScript', 'Node.js', 'PostgreSQL', 'Kafka'],
      matchScore: 86,
      matched: ['Node.js', 'TypeScript', 'PostgreSQL', 'Remote preference'],
      partial: ['System Design'],
      missing: ['Kafka'],
    },
    {
      canonicalUrl: 'https://postman.com/careers/ai-backend-engineer-delhi',
      title: 'AI & Backend Systems Engineer',
      company: 'Postman',
      location: 'Noida, India',
      locationType: 'ONSITE',
      employmentType: 'FULL_TIME',
      description: 'Postman is seeking an AI-focused backend developer to power developer productivity workflows. Hands-on experience with LLM APIs, vector search, Python/Node.js, and API development required.',
      salaryMin: 1500000,
      salaryMax: 2000000,
      experienceMin: 0,
      experienceMax: 3,
      skills: ['Python', 'Node.js', 'REST APIs', 'AI/LLM'],
      matchScore: 88,
      matched: ['Python', 'Node.js', 'REST APIs', 'Location: Noida'],
      partial: ['Vector DBs'],
      missing: ['Go'],
    },
  ];

  for (const j of jobsData) {
    const job = await prisma.job.upsert({
      where: { canonicalUrl: j.canonicalUrl },
      update: {},
      create: {
        canonicalUrl: j.canonicalUrl,
        title: j.title,
        company: j.company,
        location: j.location,
        locationType: j.locationType,
        employmentType: j.employmentType,
        description: j.description,
        salaryMin: j.salaryMin,
        salaryMax: j.salaryMax,
        experienceMin: j.experienceMin,
        experienceMax: j.experienceMax,
        postedAt: new Date(Date.now() - 3600 * 1000 * 12),
        sources: {
          create: {
            sourceName: 'CAREER_PAGE',
            sourceUrl: j.canonicalUrl,
          },
        },
        skills: {
          create: j.skills.map((s) => ({ name: s, isRequired: true })),
        },
      },
    });

    await prisma.jobMatch.upsert({
      where: {
        jobId_profileId: {
          jobId: job.id,
          profileId: profile.id,
        },
      },
      update: {},
      create: {
        jobId: job.id,
        profileId: profile.id,
        score: j.matchScore,
        breakdown: JSON.stringify({
          skills: 92,
          experience: 95,
          role: 90,
          location: 100,
          projects: 85,
          education: 90,
          salary: 95,
          preferences: 90,
        }),
        matchedSkills: JSON.stringify(j.matched),
        missingSkills: JSON.stringify(j.missing),
        partialSkills: JSON.stringify(j.partial),
        reasons: JSON.stringify([
          'Strong stack alignment on core backend technologies',
          'Candidate experience of 0-3 years matches JD criteria',
          'Preferred location matches candidate target cities',
        ]),
      },
    });

    // Create an application in READY state for Razorpay
    if (j.company === 'Razorpay') {
      const existingApp = await prisma.application.findFirst({
        where: { userId: user.id, jobId: job.id },
      });

      if (!existingApp) {
        const app = await prisma.application.create({
          data: {
            userId: user.id,
            jobId: job.id,
            status: 'READY',
            submissionMethod: 'ASSISTED',
            coverLetterText: 'Dear Razorpay Hiring Team,\n\nI am writing to express my strong interest in the Backend Engineer (SDE-1) position at Razorpay. With my background in architecting Node.js microservices handling 45,000+ daily events and optimizing PostgreSQL query latencies by 84%, I am eager to contribute to Razorpay\'s payment systems.\n\nBest regards,\nDixit Kumar',
            notes: 'High priority match. Tailored resume v21 generated. Waiting for final human review.',
            events: {
              create: [
                {
                  eventType: 'DISCOVERED',
                  description: 'Job discovered from Razorpay careers portal',
                  actor: 'AGENT',
                },
                {
                  eventType: 'JD_PARSED',
                  description: 'Extracted required skills: Node.js, PostgreSQL, Redis, REST APIs',
                  actor: 'AGENT',
                },
                {
                  eventType: 'MATCH_CALCULATED',
                  description: 'Calculated 91% match score based on candidate profile',
                  actor: 'AGENT',
                },
                {
                  eventType: 'RESUME_TAILORED',
                  description: 'Tailored Resume v21 created with provenance links',
                  actor: 'AGENT',
                },
                {
                  eventType: 'FORM_PREPARED',
                  description: '12 fields detected; 10 fields filled, 2 require confirmation',
                  actor: 'AGENT',
                },
              ],
            },
            answers: {
              create: [
                {
                  question: 'Why do you want to work at Razorpay?',
                  answer: 'Razorpay powers mission-critical financial infrastructure across India. My experience optimizing database latencies and designing robust distributed webhooks aligns directly with the engineering demands of high-volume financial services.',
                  confidence: 0.94,
                  requiresReview: false,
                  sources: JSON.stringify([{ type: 'EXPERIENCE', id: expId || 'exp1', label: 'FinTech Labs Internship' }]),
                  isApproved: true,
                },
                {
                  question: 'What is your expected CTC (Annual INR)?',
                  answer: '15,00,000',
                  confidence: 0.85,
                  requiresReview: true,
                  sources: JSON.stringify([{ type: 'PREFERENCE', id: 'pref1', label: 'User Salary Preference' }]),
                  isApproved: false,
                },
              ],
            },
          },
        });
      }
    }
  }

  // 8. Sample Agent Run (#3821)
  const agentRun = await prisma.agentRun.create({
    data: {
      trigger: 'MANUAL',
      status: 'PAUSED_FOR_HUMAN',
      jobsScanned: 137,
      newJobs: 42,
      qualified: 18,
      resumesGenerated: 12,
      applicationsPrepared: 9,
      submitted: 5,
      needsReview: 4,
      logs: {
        create: [
          { level: 'INFO', message: 'Agent Run #3821 started: Scanning career pages for Backend & AI roles in Noida/Gurgaon' },
          { level: 'INFO', message: 'Scanned 137 postings across 18 company career portals' },
          { level: 'INFO', message: 'Normalized and deduplicated 42 new distinct job listings' },
          { level: 'INFO', message: '18 jobs meet candidate threshold score >= 80%' },
          { level: 'INFO', message: 'Tailored 12 JD-specific resume versions with full provenance verification' },
          { level: 'INFO', message: 'Prepared 9 applications in ASSISTED mode; safe fields auto-filled' },
          { level: 'WARN', message: '4 applications flagged with subjective questions requiring human confirmation' },
          { level: 'INFO', message: 'Paused for Human Review: Waiting for candidate approval before final submission' },
        ],
      },
    },
  });

  console.log(`✅ Seeded successfully! Agent Run ID: ${agentRun.id}`);
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
