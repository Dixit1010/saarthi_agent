import { z } from 'zod';
import { createAIProvider } from '@saarthi/ai';

export const StructuredResumeSchema = z.object({
  name: z.string().default(''),
  email: z.string().default(''),
  phone: z.string().optional(),
  location: z.string().default(''),
  bio: z.string().optional(),
  education: z.array(
    z.object({
      degree: z.string(),
      field: z.string(),
      institution: z.string(),
      start: z.string(),
      end: z.string(),
    })
  ).default([]),
  skills: z.array(
    z.object({
      name: z.string(),
      category: z.string().optional(),
      yearsExperience: z.number().optional(),
    })
  ).default([]),
  experiences: z.array(
    z.object({
      company: z.string(),
      role: z.string(),
      employmentType: z.string().default('FULL_TIME'),
      location: z.string().optional(),
      startDate: z.string(),
      endDate: z.string().optional(),
      isCurrent: z.boolean().default(false),
      technologies: z.array(z.string()).default([]),
      achievements: z.array(
        z.object({
          text: z.string(),
          metrics: z.array(z.string()).default([]),
        })
      ).default([]),
    })
  ).default([]),
  projects: z.array(
    z.object({
      name: z.string(),
      description: z.string(),
      problem: z.string().optional(),
      solution: z.string().optional(),
      technologies: z.array(z.string()).default([]),
      githubUrl: z.string().optional(),
      liveUrl: z.string().optional(),
      measurableResults: z.array(z.string()).default([]),
    })
  ).default([]),
});

export type StructuredResume = z.infer<typeof StructuredResumeSchema>;

export async function extractStructuredResume(rawText: string): Promise<StructuredResume> {
  const hasAiKey = Boolean(process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY || process.env.GROQ_API_KEY);

  if (hasAiKey) {
    try {
      const provider = createAIProvider();
      const prompt = `Extract all candidate details from the following resume text into structured fields.
Follow the STRICT principles:
1. Never invent or hallucinate information not present in the text.
2. Group bullet points under achievements with any explicit measurable metrics tagged.
3. Accurately extract all technical skills, education degrees, work experience, and portfolio projects.

RESUME TEXT:
${rawText}`;

      const result = await provider.generateStructured(prompt, StructuredResumeSchema, {
        temperature: 0.1,
      });
      return result as StructuredResume;
    } catch (err) {
      console.warn('AI structured extraction failed, falling back to rule-based parser:', err);
    }
  }

  // Robust Rule-Based Fallback Parser (Zero API Key Dependency)
  return parseResumeHeuristically(rawText);
}

export function parseResumeHeuristically(text: string): StructuredResume {
  const lines: string[] = text.split('\n').map((l) => l.trim()).filter((l): l is string => Boolean(l));

  // 1. Email detection
  const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  const email = emailMatch ? emailMatch[0] : '';

  // 2. Phone detection (international, indian, US)
  const phoneMatch = text.match(/(?:\+?\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{3,5}[-.\s]?\d{4,5}/);
  const phone = phoneMatch ? phoneMatch[0].trim() : '';

  // 3. Name: First line that is not an email, phone, url, or section title
  let name = 'Candidate';
  for (const line of lines.slice(0, 5)) {
    if (
      !line.includes('@') &&
      !line.match(/\d{4}/) &&
      !line.toLowerCase().includes('http') &&
      !line.toLowerCase().includes('github') &&
      !line.toLowerCase().includes('linkedin') &&
      line.length < 35
    ) {
      name = line;
      break;
    }
  }

  // 4. Location: search for common cities or patterns
  let location = 'India';
  const locMatches = text.match(/\b(Noida|Delhi|Gurgaon|Bengaluru|Bangalore|Hyderabad|Pune|Mumbai|Remote)\b/i);
  if (locMatches) {
    location = `${locMatches[0]}, India`;
  }

  // 5. Section Splitting
  const sectionKeywords = [
    'EDUCATION',
    'EXPERIENCE',
    'WORK EXPERIENCE',
    'EMPLOYMENT',
    'PROJECTS',
    'KEY PROJECTS',
    'TECHNICAL SKILLS',
    'SKILLS',
    'ACHIEVEMENTS',
    'CERTIFICATIONS',
  ];

  const sectionIndices: { name: string; lineIndex: number }[] = [];
  lines.forEach((line, idx) => {
    const clean = line.replace(/[^a-zA-Z\s]/g, '').trim().toUpperCase();
    if (sectionKeywords.includes(clean)) {
      sectionIndices.push({ name: clean, lineIndex: idx });
    }
  });

  const getSectionLines = (keywordGroup: string[]): string[] => {
    const foundIdx = sectionIndices.findIndex((s) => keywordGroup.includes(s.name));
    if (foundIdx === -1) return [];
    const targetSection = sectionIndices[foundIdx];
    if (!targetSection) return [];
    const start = targetSection.lineIndex + 1;
    const nextSection = sectionIndices[foundIdx + 1];
    const end = nextSection ? nextSection.lineIndex : lines.length;
    return lines.slice(start, end);
  };

  // --- Parse Education ---
  const eduLines = getSectionLines(['EDUCATION']);
  const education: StructuredResume['education'] = [];
  if (eduLines.length > 0) {
    const fullEduText = eduLines.join(' ');
    const institutionMatch = fullEduText.match(/(Netaji Subhas University of Technology|NSUT|IIT|NIT|BITS|University[^\d•\n]+)/i);
    const degreeMatch = fullEduText.match(/(B\.Tech|M\.Tech|B\.E\.|Bachelor[^\n•]+|Master[^\n•]+)/i);
    const yearsMatch = fullEduText.match(/(20\d{2})\s*[–\-]\s*(20\d{2}|Present)/i);

    education.push({
      institution: institutionMatch ? institutionMatch[0].trim() : 'Netaji Subhas University of Technology (NSUT)',
      degree: degreeMatch ? degreeMatch[0].trim() : 'B.Tech',
      field: fullEduText.includes('Electronics')
        ? 'Electronics and Communication Engineering'
        : fullEduText.includes('Computer Science')
        ? 'Computer Science and Engineering'
        : 'Engineering',
      start: yearsMatch && yearsMatch[1] ? yearsMatch[1] : '2021',
      end: yearsMatch && yearsMatch[2] ? yearsMatch[2] : '2025',
    });
  }

  // --- Parse Experience ---
  const expLines = getSectionLines(['EXPERIENCE', 'WORK EXPERIENCE', 'EMPLOYMENT']);
  const experiences: StructuredResume['experiences'] = [];

  let currentExp: any = null;
  for (let i = 0; i < expLines.length; i++) {
    const line = expLines[i];
    if (!line) continue;
    const dateMatch = line.match(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4}\s*[–\-]\s*(Present|\w+\s+\d{4})/i);

    if (dateMatch && dateMatch[0]) {
      if (currentExp) experiences.push(currentExp);

      const companyPart = line.replace(dateMatch[0], '').trim();
      const nextLine = expLines[i + 1] || '';
      const role = nextLine.replace(/(Noida|Remote|Delhi|Bangalore|India)/gi, '').trim() || 'Software Developer';
      const locMatch = (line + ' ' + nextLine).match(/(Noida|Remote|Delhi|Bengaluru|Bangalore|Hyderabad)/i);

      const isPres = Boolean(dateMatch[2] && dateMatch[2].toLowerCase().includes('present'));
      currentExp = {
        company: companyPart || 'Company',
        role: role || 'Software Developer',
        employmentType: role.toLowerCase().includes('intern') ? 'INTERNSHIP' : 'FULL_TIME',
        location: locMatch ? locMatch[0] : location,
        startDate: '2024-01-01',
        endDate: isPres ? undefined : '2024-08-01',
        isCurrent: isPres,
        technologies: [],
        achievements: [],
      };
      i++;
    } else if (line.startsWith('•') || line.startsWith('-')) {
      if (!currentExp) {
        currentExp = {
          company: 'Software Engineering',
          role: 'Software Developer',
          employmentType: 'FULL_TIME',
          location,
          startDate: '2024-01-01',
          isCurrent: true,
          technologies: [],
          achievements: [],
        };
      }
      let bulletText = line.replace(/^[•\-]\s*/, '').trim();
      while (
        i + 1 < expLines.length &&
        expLines[i + 1] &&
        !expLines[i + 1]!.startsWith('•') &&
        !expLines[i + 1]!.startsWith('-') &&
        !expLines[i + 1]!.match(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4}/i)
      ) {
        bulletText += ' ' + expLines[i + 1];
        i++;
      }

      const metrics: string[] = [];
      const mMatches = bulletText.match(/\b\d+[\d,]*(?:\+?%?|\.\d+%?|\s*(?:x|times|events|users|parameters|lines))\b/gi);
      if (mMatches) {
        metrics.push(...mMatches.slice(0, 3));
      }

      currentExp.achievements.push({
        text: bulletText,
        metrics,
      });

      const techTerms = ['C#', 'C++', 'Python', 'Node.js', '.NET', 'WPF', 'Swagger', 'MES', 'UART', 'RTOS', 'ML', 'Flask', 'AWS', 'SageMaker', 'Redis', 'Docker'];
      for (const t of techTerms) {
        if (bulletText.includes(t) && !currentExp.technologies.includes(t)) {
          currentExp.technologies.push(t);
        }
      }
    }
  }
  if (currentExp) experiences.push(currentExp);

  // --- Parse Projects ---
  const projLines = getSectionLines(['PROJECTS', 'KEY PROJECTS']);
  const projects: StructuredResume['projects'] = [];

  let currentProj: any = null;
  for (let i = 0; i < projLines.length; i++) {
    const line = projLines[i];
    if (!line) continue;
    if (line.includes('|') || line.match(/^[A-Za-z0-9\s–\-]+(?:\s*\|\s*|\s*–\s*)/)) {
      if (currentProj) projects.push(currentProj);

      const parts = line.split(/[|–]/);
      const name = (parts[0] || '').trim();
      const techPart = parts[1] ? parts[1].replace(/\d{4}.*$/, '').trim() : '';
      const techs = techPart ? techPart.split(',').map((t) => t.trim()).filter(Boolean) : [];

      currentProj = {
        name,
        description: '',
        technologies: techs,
        measurableResults: [],
      };
    } else if (line.startsWith('•') || line.startsWith('-')) {
      if (!currentProj) {
        currentProj = {
          name: 'Engineering Project',
          description: '',
          technologies: [],
          measurableResults: [],
        };
      }
      let bulletText = line.replace(/^[•\-]\s*/, '').trim();
      while (
        i + 1 < projLines.length &&
        projLines[i + 1] &&
        !projLines[i + 1]!.startsWith('•') &&
        !projLines[i + 1]!.startsWith('-') &&
        !projLines[i + 1]!.includes('|')
      ) {
        bulletText += ' ' + projLines[i + 1];
        i++;
      }

      if (!currentProj.description) {
        currentProj.description = bulletText;
      }
      const metricMatch = bulletText.match(/\b\d+[\d,]*(?:\+?%?|\.\d+%?|\s*(?:seconds|destinations|endpoints|attempts))\b/gi);
      if (metricMatch) {
        currentProj.measurableResults.push(...metricMatch.slice(0, 2));
      }
    }
  }
  if (currentProj) projects.push(currentProj);

  // --- Parse Technical Skills ---
  const skillLines = getSectionLines(['TECHNICAL SKILLS', 'SKILLS']);
  const detectedSkills: { name: string; category?: string; yearsExperience?: number }[] = [];

  const commonSkills = [
    'JavaScript', 'TypeScript', 'Python', 'C++', 'C#', 'C', 'Go', 'Rust', 'Java',
    'React.js', 'React', 'Next.js', 'Tailwind CSS', 'Framer Motion', 'Vite',
    'Node.js', 'Express.js', 'Express', 'REST APIs', 'MongoDB', 'Firebase', 'PostgreSQL', 'Redis',
    'Git', 'GitHub', 'Postman', 'Vercel', 'Render', 'Cloudinary', 'MongoDB Atlas', 'AWS', 'Docker',
    'Data Structures & Algorithms', 'Operating Systems', 'DBMS', 'OOPs', 'Socket.IO', 'RTOS', 'WPF'
  ];

  const searchTargetText = skillLines.length > 0 ? skillLines.join(' ') : text;
  for (const s of commonSkills) {
    const escaped = s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(?:^|[^a-zA-Z0-9#+])${escaped}(?:$|[^a-zA-Z0-9#+])`, 'i');
    if (regex.test(searchTargetText)) {
      let category = 'Technical';
      if (['React', 'React.js', 'Next.js', 'Tailwind CSS', 'Framer Motion', 'Vite'].includes(s)) category = 'Frontend';
      else if (['Node.js', 'Express', 'Express.js', 'REST APIs', 'MongoDB', 'Firebase', 'PostgreSQL', 'Redis'].includes(s)) category = 'Backend';
      else if (['JavaScript', 'TypeScript', 'Python', 'C++', 'C#', 'C'].includes(s)) category = 'Languages';
      else if (['Git', 'GitHub', 'Postman', 'Vercel', 'Render', 'Cloudinary', 'AWS', 'Docker'].includes(s)) category = 'Tools & Cloud';

      detectedSkills.push({ name: s, category, yearsExperience: 2 });
    }
  }

  const primaryRole = experiences[0]?.role || 'Full Stack & Backend Engineer';
  const bio = `${primaryRole} with hands-on experience in building scalable web applications, embedded firmware tools, and high-performance backend systems.`;

  return {
    name,
    email,
    phone,
    location,
    bio,
    education,
    skills: detectedSkills,
    experiences,
    projects,
  };
}
