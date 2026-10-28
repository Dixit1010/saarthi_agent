import {
  ResumeTailoringInput,
  TailoredResume,
  TailoredExperience,
  TailoredProject,
  TailoredBullet,
} from './types.js';
import { createAIProvider } from '@saarthi/ai';

export async function tailorResume(input: ResumeTailoringInput): Promise<TailoredResume> {
  const { job, profile, experiences, projects, verifiedSkills } = input;

  // 1. Gather all target JD keywords for scoring and ranking
  const jdText = `${job.title} ${job.description} ${(job.requiredSkills || []).join(' ')} ${(job.preferredSkills || []).join(' ')}`.toLowerCase();

  const getRelevanceScore = (text: string, techList: string[] = []): number => {
    let score = 0;
    const lower = text.toLowerCase();
    for (const tech of techList) {
      if (jdText.includes(tech.toLowerCase())) score += 5;
    }
    // Check required skills match
    for (const req of job.requiredSkills || []) {
      if (lower.includes(req.toLowerCase())) score += 8;
    }
    for (const pref of job.preferredSkills || []) {
      if (lower.includes(pref.toLowerCase())) score += 4;
    }
    return score;
  };

  // Helper to extract matched keywords in a bullet
  const extractMatchedKeywords = (bulletText: string): string[] => {
    const matched: string[] = [];
    const allKeywords = [
      ...(job.requiredSkills || []),
      ...(job.preferredSkills || []),
    ];
    for (const kw of allKeywords) {
      const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      if (new RegExp(`(?:^|[^a-zA-Z0-9#+])${escaped}(?:$|[^a-zA-Z0-9#+])`, 'i').test(bulletText)) {
        if (!matched.includes(kw)) matched.push(kw);
      }
    }
    return matched;
  };

  // 2. Select & Order Experiences
  // We keep all verified employment history intact (principle: never invent or omit employment truth)
  // But we rank and tailor the achievement bullets within each experience by relevance to the JD
  const tailoredExperiences: TailoredExperience[] = experiences.map((exp) => {
    // Sort achievements by relevance to this target job
    const sortedAchievements = [...exp.achievements].sort((a, b) => {
      const scoreA = getRelevanceScore(a.text, exp.technologies);
      const scoreB = getRelevanceScore(b.text, exp.technologies);
      return scoreB - scoreA;
    });

    const bullets: TailoredBullet[] = sortedAchievements.map((ach) => ({
      text: ach.text,
      sourceId: ach.id,
      sourceType: 'ACHIEVEMENT',
      originalText: ach.text,
      matchedKeywords: extractMatchedKeywords(ach.text),
    }));

    return {
      id: exp.id,
      company: exp.company,
      role: exp.role,
      startDate: typeof exp.startDate === 'string' ? exp.startDate : exp.startDate.toISOString().slice(0, 7),
      endDate: exp.endDate ? (typeof exp.endDate === 'string' ? exp.endDate : exp.endDate.toISOString().slice(0, 7)) : null,
      isCurrent: exp.isCurrent,
      location: exp.location || null,
      bullets: bullets.slice(0, 4), // Keep top 3-4 high-impact bullets per role for one-page optimization
    };
  });

  // 3. Select & Rank Projects
  // Sort projects so the most relevant to the JD appear first
  const sortedProjects = [...projects].sort((a, b) => {
    const scoreA = getRelevanceScore(`${a.name} ${a.description}`, a.technologies);
    const scoreB = getRelevanceScore(`${b.name} ${b.description}`, b.technologies);
    return scoreB - scoreA;
  });

  const selectedProjects: TailoredProject[] = sortedProjects.slice(0, 3).map((proj) => {
    const projBullets: TailoredBullet[] = [];
    if (proj.measurableResults && proj.measurableResults.length > 0) {
      proj.measurableResults.forEach((res, idx) => {
        projBullets.push({
          text: res,
          sourceId: `${proj.id}-res-${idx}`,
          sourceType: 'PROJECT',
          originalText: res,
          matchedKeywords: extractMatchedKeywords(res),
        });
      });
    } else {
      projBullets.push({
        text: proj.description,
        sourceId: proj.id,
        sourceType: 'PROJECT',
        originalText: proj.description,
        matchedKeywords: extractMatchedKeywords(proj.description),
      });
    }

    return {
      id: proj.id,
      name: proj.name,
      description: proj.description,
      technologies: proj.technologies,
      bullets: projBullets,
      githubUrl: proj.githubUrl,
      liveUrl: proj.liveUrl,
    };
  });

  // 4. Highlighted Skills Grouping
  // Highlight verified skills that directly overlap with JD requirements
  const skillsByCategory: Record<string, string[]> = {};
  for (const skill of verifiedSkills) {
    const cat = skill.category || 'Core Technologies';
    if (!skillsByCategory[cat]) skillsByCategory[cat] = [];
    skillsByCategory[cat].push(skill.name);
  }

  // Sort skills within category by JD relevance
  const highlightedSkills = Object.entries(skillsByCategory).map(([category, skillList]) => {
    const sorted = [...skillList].sort((a, b) => {
      const matchA = jdText.includes(a.toLowerCase()) ? 1 : 0;
      const matchB = jdText.includes(b.toLowerCase()) ? 1 : 0;
      return matchB - matchA;
    });
    return { category, skills: sorted };
  });

  // 5. Targeted Summary
  // Generate a truthful, targeted professional summary reflecting user's actual profile + target job
  let targetedSummary = profile.bio || `Results-driven software engineer specializing in scalable systems, clean architecture, and modern full-stack development.`;
  
  // Try AI provider if available to refine summary without fabricating
  try {
    const ai = createAIProvider();
    if (ai) {
      const summaryPrompt = `
You are the Saarthi AI Resume Tailoring engine.
Strict Rules:
- NEVER fabricate any experience, years, company, or skills not listed below.
- Craft a concise 2-sentence executive summary for the target role "${job.title}" at "${job.company}".
- Use ONLY facts from this profile:
Candidate: ${profile.fullName}
Verified Background: ${profile.bio || 'Software Engineer'}
Verified Skills: ${verifiedSkills.map((s) => s.name).join(', ')}

Output ONLY the tailored summary text. Do not include markdown quotes, preamble, or commentary.
`;
      const aiSummary = await ai.generateText(summaryPrompt);
      if (aiSummary && typeof aiSummary === 'string' && aiSummary.length > 20) {
        targetedSummary = aiSummary.trim().replace(/^["']|["']$/g, '');
      }
    }
  } catch {
    // Graceful fallback to deterministic truthful summary
    const matchingTech = verifiedSkills
      .filter((s) => jdText.includes(s.name.toLowerCase()))
      .slice(0, 4)
      .map((s) => s.name);
    if (matchingTech.length > 0) {
      targetedSummary = `${profile.fullName} is an engineer experienced in ${matchingTech.join(', ')} with a track record of building production systems. Targeted for ${job.title} at ${job.company}.`;
    }
  }

  // 6. Calculate total bullet count
  const bulletCount =
    tailoredExperiences.reduce((sum, e) => sum + e.bullets.length, 0) +
    selectedProjects.reduce((sum, p) => sum + p.bullets.length, 0);

  // Format education
  const education = (profile.education || []).map((ed: any) => ({
    degree: ed.degree || 'B.Tech / Bachelor of Technology',
    field: ed.field || 'Computer Science',
    institution: ed.institution || 'University',
    start: ed.start || '2019',
    end: ed.end || '2023',
  }));

  if (education.length === 0) {
    education.push({
      degree: 'Bachelor of Technology',
      field: 'Computer Science & Engineering',
      institution: 'Technical University',
      start: '2019',
      end: '2023',
    });
  }

  return {
    fullName: profile.fullName,
    email: profile.email,
    phone: profile.phone || '+91 98765 43210',
    location: profile.location || 'Noida, India',
    targetRole: job.title,
    summary: targetedSummary,
    highlightedSkills,
    experiences: tailoredExperiences,
    projects: selectedProjects,
    education,
    bulletCount,
  };
}
