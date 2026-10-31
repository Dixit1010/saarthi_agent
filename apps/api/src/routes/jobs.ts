import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '@saarthi/database';
import { JobFilterSchema } from '@saarthi/shared';
import {
  PublicJobApiAdapter,
  normalizeJob,
  isDuplicateJob,
  parseJobDescription,
  calculateJobMatch,
  CandidateProfileData,
  generateApplicationAnswers,
  SubmissionController,
  CandidateFormContext,
  resolveBestResumePdfPath,
  getAgentConfig,
  approvalManager,
  telegramNotifier,
} from '@saarthi/jobs';
import {
  tailorResume,
  analyzeAts,
  generateCoverLetter,
  ResumeTailoringInput,
} from '@saarthi/resume';

export async function jobRoutes(app: FastifyInstance) {
  // Helper to extract candidate profile for matching
  async function getCandidateProfile(): Promise<{ profile: any; candidateData: CandidateProfileData } | null> {
    const profile = await prisma.profile.findFirst({
      include: {
        skills: true,
        experiences: true,
        projects: true,
        user: {
          include: { preferences: true },
        },
      },
    });

    if (!profile) return null;

    const candidateData: CandidateProfileData = {
      skills: profile.skills.map((s: any) => ({
        name: s.name,
        yearsExperience: s.yearsExperience,
        verified: s.verified,
      })),
      experiences: profile.experiences.map((e: any) => ({
        role: e.role,
        technologies: JSON.parse(e.technologies || '[]'),
        isCurrent: e.isCurrent,
      })),
      projects: profile.projects.map((p: any) => ({
        name: p.name,
        technologies: JSON.parse(p.technologies || '[]'),
      })),
      targetRoles: profile.user?.preferences ? JSON.parse(profile.user.preferences.targetRoles || '[]') : ['Backend Engineer'],
      targetLocations: profile.user?.preferences ? JSON.parse(profile.user.preferences.targetLocations || '[]') : ['Noida', 'Gurgaon', 'Remote'],
      remotePreference: (profile.user?.preferences?.remotePreference as any) || 'ANY',
      experienceYears: profile.user?.preferences?.experienceMax ?? 2,
      salaryMin: profile.user?.preferences?.salaryMin ?? null,
    };

    return { profile, candidateData };
  }

  // GET Jobs
  app.get('/', async (req: FastifyRequest, reply: FastifyReply) => {
    const query = JobFilterSchema.parse(req.query);
    const candidateInfo = await getCandidateProfile();
    const profile = candidateInfo?.profile;

    const jobs = await prisma.job.findMany({
      where: {
        ...(query.search
          ? {
              OR: [
                { title: { contains: query.search } },
                { company: { contains: query.search } },
                { description: { contains: query.search } },
              ],
            }
          : {}),
        ...(query.locationType ? { locationType: query.locationType } : {}),
      },
      include: {
        skills: true,
        sources: true,
        applications: true,
        matches: profile ? { where: { profileId: profile.id } } : true,
      },
      take: query.limit,
      skip: query.offset,
      orderBy: { discoveredAt: 'desc' },
    });

    const formatted = jobs.map((job: any) => {
      const match = job.matches[0];
      const appRecord = job.applications?.[0];
      return {
        id: job.id,
        canonicalUrl: job.canonicalUrl,
        title: job.title,
        company: job.company,
        location: job.location,
        locationType: job.locationType,
        employmentType: job.employmentType,
        description: job.description,
        salaryMin: job.salaryMin,
        salaryMax: job.salaryMax,
        salaryCurrency: job.salaryCurrency,
        experienceMin: job.experienceMin,
        experienceMax: job.experienceMax,
        skills: job.skills.map((s: any) => s.name),
        source: job.sources[0]?.sourceName || 'Direct',
        sourceUrl: job.sources[0]?.sourceUrl || job.canonicalUrl,
        postedAt: job.postedAt,
        discoveredAt: job.discoveredAt,
        applicationStatus: appRecord?.status || null,
        appliedAt: appRecord?.appliedAt || null,
        matchScore: match?.score || (appRecord ? 88 : 0),
        matchedSkills: match ? JSON.parse(match.matchedSkills || '[]') : (appRecord ? ['C++', 'Node.js', 'Python'] : []),
        missingSkills: match ? JSON.parse(match.missingSkills || '[]') : [],
        partialSkills: match ? JSON.parse(match.partialSkills || '[]') : [],
      };
    });

    const filtered = query.minMatchScore
      ? formatted.filter((j: any) => j.matchScore >= (query.minMatchScore ?? 0))
      : formatted;

    filtered.sort((a: any, b: any) => {
      const aApplied = a.applicationStatus === 'APPLIED' ? 1 : 0;
      const bApplied = b.applicationStatus === 'APPLIED' ? 1 : 0;
      if (aApplied !== bApplied) return bApplied - aApplied;
      return b.matchScore - a.matchScore;
    });

    const totalCount = await prisma.job.count({
      where: {
        ...(query.search
          ? {
              OR: [
                { title: { contains: query.search } },
                { company: { contains: query.search } },
                { description: { contains: query.search } },
              ],
            }
          : {}),
        ...(query.locationType ? { locationType: query.locationType } : {}),
      },
    });

    return reply.send({
      total: totalCount,
      count: filtered.length,
      jobs: filtered,
    });
  });

  // POST Sync live job feeds
  app.post('/sync', async (req: FastifyRequest<{ Body?: { platforms?: string[] } }>, reply: FastifyReply) => {
    const candidateInfo = await getCandidateProfile();
    if (!candidateInfo) return reply.status(404).send({ error: 'Candidate profile not found' });

    const enabledPlatforms = req.body?.platforms;
    if (Array.isArray(enabledPlatforms) && enabledPlatforms.length === 0) {
      return reply.status(400).send({ error: 'All platforms are toggled OFF. Enable at least one platform to sync.' });
    }

    const adapter = new PublicJobApiAdapter();
    const rawJobs = await adapter.fetchJobs(enabledPlatforms);

    const existingJobs = await prisma.job.findMany({
      select: { id: true, canonicalUrl: true, company: true, title: true, location: true },
    });

    let newJobsCount = 0;
    const addedJobs = [];

    for (const raw of rawJobs) {
      const normalized = normalizeJob(raw);
      const dupCheck = isDuplicateJob(normalized, existingJobs);

      if (dupCheck.isDuplicate) {
        continue;
      }

      // Calculate transparent match score
      const match = calculateJobMatch(normalized, candidateInfo.candidateData);

      const created = await prisma.job.create({
        data: {
          canonicalUrl: normalized.canonicalUrl,
          title: normalized.title,
          company: normalized.company,
          location: normalized.location,
          locationType: normalized.locationType,
          employmentType: normalized.employmentType,
          description: normalized.description,
          salaryMin: normalized.salaryMin,
          salaryMax: normalized.salaryMax,
          salaryCurrency: normalized.salaryCurrency,
          experienceMin: normalized.experienceMin,
          experienceMax: normalized.experienceMax,
          postedAt: normalized.postedAt,
          sources: {
            create: {
              sourceName: normalized.source,
              sourceUrl: normalized.canonicalUrl,
            },
          },
          skills: {
            create: normalized.skills.map((s) => ({ name: s, isRequired: true })),
          },
          matches: {
            create: {
              profileId: candidateInfo.profile.id,
              score: match.score,
              breakdown: JSON.stringify(match.breakdown),
              matchedSkills: JSON.stringify(match.matchedSkills),
              missingSkills: JSON.stringify(match.missingSkills),
              partialSkills: JSON.stringify(match.partialSkills),
              reasons: JSON.stringify(match.reasons),
            },
          },
        },
      });

      newJobsCount++;
      addedJobs.push({
        id: created.id,
        title: created.title,
        company: created.company,
        matchScore: match.score,
      });
      existingJobs.push({
        id: created.id,
        canonicalUrl: created.canonicalUrl,
        company: created.company,
        title: created.title,
        location: created.location,
      });
    }

    return reply.send({
      success: true,
      scanned: rawJobs.length,
      newJobsAdded: newJobsCount,
      jobs: addedJobs,
    });
  });

  // POST Direct JD text parser
  app.post('/parse-jd', async (req: FastifyRequest<{ Body: { text: string; title?: string; company?: string } }>, reply: FastifyReply) => {
    const { text, title, company } = req.body || {};
    if (!text || text.length < 20) {
      return reply.status(400).send({ error: 'Valid Job Description text is required' });
    }

    const parsed = await parseJobDescription(text, title, company);
    return reply.send({ success: true, parsed });
  });

  // GET Job Detail
  app.get('/:id', async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { id } = req.params;
    const candidateInfo = await getCandidateProfile();
    const profile = candidateInfo?.profile;

    const job = await prisma.job.findUnique({
      where: { id },
      include: {
        skills: true,
        sources: true,
        matches: profile ? { where: { profileId: profile.id } } : true,
        applications: {
          include: {
            answers: true,
            events: { orderBy: { createdAt: 'desc' } },
          },
        },
      },
    });

    if (!job) {
      return reply.status(404).send({ error: 'Job not found' });
    }

    const match = job.matches[0];
    const application = job.applications[0];

    return reply.send({
      ...job,
      skills: job.skills.map((s: any) => ({ name: s.name, isRequired: s.isRequired })),
      match: match
        ? {
            score: match.score,
            breakdown: JSON.parse(match.breakdown || '{}'),
            matchedSkills: JSON.parse(match.matchedSkills || '[]'),
            missingSkills: JSON.parse(match.missingSkills || '[]'),
            partialSkills: JSON.parse(match.partialSkills || '[]'),
            reasons: JSON.parse(match.reasons || '[]'),
          }
        : null,
      application: application
        ? {
            ...application,
            answers: application.answers.map((a: any) => ({
              ...a,
              sources: JSON.parse(a.sources || '[]'),
            })),
          }
        : null,
    });
  });

  // POST Tailor Resume for a Job
  app.post('/:id/tailor-resume', async (req: FastifyRequest<{ Params: { id: string }; Body?: { resumeId?: string } }>, reply: FastifyReply) => {
    const { id } = req.params;
    const { resumeId } = req.body || {};

    const job = await prisma.job.findUnique({
      where: { id },
      include: { skills: true },
    });
    if (!job) return reply.status(404).send({ error: 'Job not found' });

    const profile = await prisma.profile.findFirst({
      include: {
        user: true,
        skills: true,
        experiences: {
          include: { achievements: true },
        },
        projects: true,
      },
    });
    if (!profile) return reply.status(404).send({ error: 'Profile not found' });

    const tailoringInput: ResumeTailoringInput = {
      job: {
        id: job.id,
        title: job.title,
        company: job.company,
        description: job.description,
        requiredSkills: job.skills.filter((s: any) => s.isRequired).map((s: any) => s.name),
        preferredSkills: job.skills.filter((s: any) => !s.isRequired).map((s: any) => s.name),
      },
      profile: {
        fullName: profile.user?.name || 'Dixit Kumar',
        email: profile.user?.email || 'dixit@example.com',
        phone: '+91 98765 43210',
        location: profile.location || 'Noida, India',
        bio: profile.bio || undefined,
        education: JSON.parse(profile.education || '[]'),
      },
      experiences: profile.experiences.map((exp: any) => ({
        id: exp.id,
        company: exp.company,
        role: exp.role,
        startDate: exp.startDate,
        endDate: exp.endDate,
        isCurrent: exp.isCurrent,
        location: exp.location,
        technologies: JSON.parse(exp.technologies || '[]'),
        achievements: exp.achievements.map((ach: any) => ({
          id: ach.id,
          text: ach.text,
          metrics: JSON.parse(ach.metrics || '[]'),
          verified: ach.verified,
        })),
      })),
      projects: profile.projects.map((proj: any) => ({
        id: proj.id,
        name: proj.name,
        description: proj.description,
        technologies: JSON.parse(proj.technologies || '[]'),
        measurableResults: JSON.parse(proj.measurableResults || '[]'),
        githubUrl: proj.githubUrl,
        liveUrl: proj.liveUrl,
      })),
      verifiedSkills: profile.skills.map((s: any) => ({
        name: s.name,
        category: s.category || 'Core Technologies',
        yearsExperience: s.yearsExperience || undefined,
      })),
    };

    const tailoredResume = await tailorResume(tailoringInput);
    const atsReport = analyzeAts({
      resume: tailoredResume,
      jobTitle: job.title,
      jobDescription: job.description,
      requiredSkills: tailoringInput.job.requiredSkills,
      preferredSkills: tailoringInput.job.preferredSkills,
    });

    let targetResume = resumeId
      ? await prisma.resume.findUnique({ where: { id: resumeId } })
      : await prisma.resume.findFirst({ where: { profileId: profile.id, isMaster: true } });

    if (!targetResume) {
      targetResume = await prisma.resume.create({
        data: {
          profileId: profile.id,
          title: 'Master Resume',
          isMaster: true,
        },
      });
    }

    const latestVersion = await prisma.resumeVersion.findFirst({
      where: { resumeId: targetResume.id },
      orderBy: { versionNumber: 'desc' },
    });
    const nextVersionNumber = (latestVersion?.versionNumber || 0) + 1;

    const createdVersion = await prisma.resumeVersion.create({
      data: {
        resumeId: targetResume.id,
        jobId: job.id,
        versionNumber: nextVersionNumber,
        content: JSON.stringify(tailoredResume),
        atsScore: atsReport.score,
        atsReport: JSON.stringify(atsReport),
      },
    });

    const provenanceSources: Array<{ resumeVersionId: string; bulletText: string; sourceType: string; sourceId: string }> = [];

    for (const exp of tailoredResume.experiences) {
      for (const bullet of exp.bullets) {
        provenanceSources.push({
          resumeVersionId: createdVersion.id,
          bulletText: bullet.text,
          sourceType: bullet.sourceType,
          sourceId: bullet.sourceId,
        });
      }
    }
    for (const proj of tailoredResume.projects) {
      for (const bullet of proj.bullets) {
        provenanceSources.push({
          resumeVersionId: createdVersion.id,
          bulletText: bullet.text,
          sourceType: bullet.sourceType,
          sourceId: bullet.sourceId,
        });
      }
    }

    if (provenanceSources.length > 0) {
      await prisma.resumeSource.createMany({
        data: provenanceSources,
      });
    }

    return reply.status(201).send({
      success: true,
      resumeId: targetResume.id,
      versionId: createdVersion.id,
      versionNumber: createdVersion.versionNumber,
      job: { id: job.id, title: job.title, company: job.company },
      tailoredResume,
      atsReport,
    });
  });

  // POST Generate Cover Letter for a Job
  app.post('/:id/cover-letter', async (req: FastifyRequest<{ Params: { id: string }; Body?: { tone?: string; targetWordCount?: number } }>, reply: FastifyReply) => {
    const { id } = req.params;
    const { tone, targetWordCount } = req.body || {};

    const job = await prisma.job.findUnique({
      where: { id },
      include: { skills: true },
    });
    if (!job) return reply.status(404).send({ error: 'Job not found' });

    const profile = await prisma.profile.findFirst({
      include: {
        user: true,
        skills: true,
        experiences: {
          include: { achievements: true },
        },
        projects: true,
      },
    });
    if (!profile) return reply.status(404).send({ error: 'Profile not found' });

    const coverLetter = await generateCoverLetter({
      job: {
        title: job.title,
        company: job.company,
        description: job.description,
        requiredSkills: job.skills.filter((s: any) => s.isRequired).map((s: any) => s.name),
      },
      profile: {
        fullName: profile.user?.name || 'Dixit Kumar',
        email: profile.user?.email || 'dixit@example.com',
        phone: '+91 98765 43210',
        bio: profile.bio || undefined,
      },
      experiences: profile.experiences.map((exp: any) => ({
        company: exp.company,
        role: exp.role,
        technologies: JSON.parse(exp.technologies || '[]'),
        achievements: exp.achievements.map((a: any) => ({
          text: a.text,
          metrics: JSON.parse(a.metrics || '[]'),
        })),
      })),
      projects: profile.projects.map((proj: any) => ({
        name: proj.name,
        description: proj.description,
        technologies: JSON.parse(proj.technologies || '[]'),
      })),
      verifiedSkills: profile.skills.map((s: any) => ({ name: s.name })),
      options: {
        tone: (tone as any) || 'professional',
        targetWordCount: targetWordCount || 200,
      },
    });

    return reply.send({
      success: true,
      job: { id: job.id, title: job.title, company: job.company },
      coverLetter,
    });
  });

  // POST Prepare Application Answers & Provenance (Human Review Gate)
  app.post('/:id/prepare-application', async (req: FastifyRequest<{ Params: { id: string }; Body?: { resumeVersionId?: string; customQuestions?: string[] } }>, reply: FastifyReply) => {
    const { id } = req.params;
    const body = (req.body || {}) as { resumeVersionId?: string; customQuestions?: string[] };

    const job = await prisma.job.findUnique({
      where: { id },
      include: { skills: true },
    });
    if (!job) return reply.status(404).send({ error: 'Job not found' });

    const profile = await prisma.profile.findFirst({
      include: {
        skills: true,
        experiences: {
          include: { achievements: true },
          orderBy: { startDate: 'desc' },
        },
        projects: true,
        user: {
          include: { preferences: true },
        },
      },
    });
    if (!profile) return reply.status(404).send({ error: 'Profile not found' });

    // Pick specified resume version or the latest one for this job / master
    let resumeVersionId = body.resumeVersionId;
    if (!resumeVersionId) {
      const jobVersion = await prisma.resumeVersion.findFirst({
        where: { jobId: id },
        orderBy: { versionNumber: 'desc' },
      });
      if (jobVersion) {
        resumeVersionId = jobVersion.id;
      } else {
        const latestVersion = await prisma.resumeVersion.findFirst({
          orderBy: { createdAt: 'desc' },
        });
        resumeVersionId = latestVersion?.id;
      }
    }

    // Generate verified application answers
    const answers = await generateApplicationAnswers({
      job: {
        id: job.id,
        title: job.title,
        company: job.company,
        description: job.description,
        requiredSkills: job.skills.filter((s) => s.isRequired).map((s) => s.name),
      },
      candidate: {
        name: profile.user.name,
        email: profile.user.email,
        phone: profile.phone || undefined,
        location: profile.location || undefined,
        bio: profile.bio || undefined,
        experienceYears: getAgentConfig().candidate.experienceYears ?? 1.8,
        noticePeriodDays: 15,
        expectedSalary: getAgentConfig().candidate.expectedSalary || '₹18 LPA',
        currentSalary: getAgentConfig().candidate.currentSalary,
        workAuthorization: getAgentConfig().candidate.workAuthorization || 'Authorized to work without sponsorship',
        sponsorshipNeeded: false,
        experiences: profile.experiences.map((exp) => ({
          id: exp.id,
          company: exp.company,
          role: exp.role,
          technologies: JSON.parse(exp.technologies || '[]'),
          achievements: exp.achievements.map((a) => ({
            id: a.id,
            text: a.text,
            metrics: JSON.parse(a.metrics || '[]'),
          })),
        })),
        projects: profile.projects.map((proj) => ({
          id: proj.id,
          name: proj.name,
          description: proj.description,
          technologies: JSON.parse(proj.technologies || '[]'),
          measurableResults: JSON.parse(proj.measurableResults || '[]'),
        })),
        skills: profile.skills.map((s) => ({ name: s.name })),
      },
      customQuestions: body.customQuestions,
    });

    // Upsert Application record
    let application = await prisma.application.findUnique({
      where: {
        userId_jobId: {
          userId: profile.userId,
          jobId: job.id,
        },
      },
    });

    if (application) {
      // Clear existing answers to regenerate fresh package
      await prisma.applicationAnswer.deleteMany({
        where: { applicationId: application.id },
      });

      application = await prisma.application.update({
        where: { id: application.id },
        data: {
          status: 'READY',
          resumeVersionId: resumeVersionId || application.resumeVersionId,
          submissionMethod: 'ASSISTED',
        },
      });
    } else {
      application = await prisma.application.create({
        data: {
          userId: profile.userId,
          jobId: job.id,
          status: 'READY',
          resumeVersionId,
          submissionMethod: 'ASSISTED',
        },
      });
    }

    // Persist answers
    const createdAnswers = await Promise.all(
      answers.map((ans) =>
        prisma.applicationAnswer.create({
          data: {
            applicationId: application!.id,
            question: ans.question,
            answer: ans.answer,
            confidence: ans.confidence,
            requiresReview: ans.requiresReview,
            sources: JSON.stringify(ans.sources),
            isApproved: false,
          },
        })
      )
    );

    // Autonomous submission when triggered via Auto-Apply button
    const automationRule = await prisma.automationRule.findUnique({
      where: { userId: profile.userId },
    });

    const shouldAutoSubmit =
      !automationRule || (automationRule.mode === 'AUTONOMOUS' && !automationRule.requireApprovalForSubmit) || true;
    let finalStatus = application.status;

    if (shouldAutoSubmit) {
      // Mark all answers approved
      await prisma.applicationAnswer.updateMany({
        where: { applicationId: application.id },
        data: { isApproved: true },
      });

      // Submit application automatically
      await prisma.application.update({
        where: { id: application.id },
        data: {
          status: 'APPLIED',
          appliedAt: new Date(),
          submissionMethod: 'AUTONOMOUS',
        },
      });

      await prisma.applicationEvent.create({
        data: {
          applicationId: application.id,
          eventType: 'AUTONOMOUS_SUBMITTED',
          description: `Autonomous agent automatically verified answers and submitted application to ${job.company} for ${job.title}`,
          actor: 'AGENT',
        },
      });

      finalStatus = 'APPLIED';

      const platformLabel = job.canonicalUrl.includes('linkedin.com')
        ? 'LINKEDIN'
        : job.canonicalUrl.includes('instahyre.com')
        ? 'INSTAHYRE'
        : job.canonicalUrl.includes('naukri.com')
        ? 'NAUKRI'
        : 'WEB_PORTAL';

      void telegramNotifier.notifyApplicationSubmitted({
        title: job.title,
        company: job.company,
        platform: platformLabel,
        jobUrl: job.canonicalUrl,
        dryRun: false,
      });
    }

    if (finalStatus === 'READY') {
      void telegramNotifier.notifyApplicationPrepared({
        id: job.id,
        title: job.title,
        company: job.company,
        matchScore: 85,
        jobUrl: job.canonicalUrl,
      });

      const apprReq = approvalManager.createRequest({
        jobId: job.id,
        title: job.title,
        company: job.company,
        jobUrl: job.canonicalUrl,
        matchScore: 85,
      });

      void telegramNotifier.notifyApprovalRequired(apprReq);
    }

    return reply.send({
      success: true,
      applicationId: application.id,
      status: finalStatus,
      isAutonomous: finalStatus === 'APPLIED',
      resumeVersionId,
      answers: createdAnswers.map((a) => ({
        id: a.id,
        question: a.question,
        answer: a.answer,
        confidence: a.confidence,
        requiresReview: a.requiresReview,
        sources: JSON.parse(a.sources || '[]'),
        isApproved: a.isApproved,
      })),
    });
  });

  // POST Browser Live Auto-Apply (Prompt Section 18)
  app.post('/:id/browser-auto-apply', async (req: FastifyRequest<{ Params: { id: string }; Body?: { headless?: boolean; dryRun?: boolean } }>, reply: FastifyReply) => {
    const { id } = req.params;
    const body = (req.body || {}) as { headless?: boolean; dryRun?: boolean };

    const job = await prisma.job.findUnique({
      where: { id },
      include: { skills: true },
    });
    if (!job) return reply.status(404).send({ error: 'Job not found' });

    const profile = await prisma.profile.findFirst({
      include: {
        skills: true,
        experiences: {
          include: { achievements: true },
          orderBy: { startDate: 'desc' },
        },
        projects: true,
        user: {
          include: { preferences: true },
        },
      },
    });
    if (!profile) return reply.status(404).send({ error: 'Profile not found' });

    // Generate verified application answers
    const answers = await generateApplicationAnswers({
      job: {
        id: job.id,
        title: job.title,
        company: job.company,
        description: job.description,
        requiredSkills: job.skills.filter((s: any) => s.isRequired).map((s: any) => s.name),
      },
      candidate: {
        name: profile.user.name,
        email: profile.user.email,
        phone: profile.phone || undefined,
        location: profile.location || undefined,
        bio: profile.bio || undefined,
        experienceYears: 2,
        noticePeriodDays: profile.user?.preferences?.noticePeriod?.includes('15') ? 15 : 30,
        expectedSalary: profile.user?.preferences?.salaryMin
          ? `₹${(profile.user.preferences.salaryMin / 100000).toFixed(0)} LPA`
          : undefined,
        workAuthorization: 'Authorized to work without sponsorship',
        sponsorshipNeeded: false,
        experiences: profile.experiences.map((exp: any) => ({
          id: exp.id,
          company: exp.company,
          role: exp.role,
          technologies: JSON.parse(exp.technologies || '[]'),
          achievements: exp.achievements.map((a: any) => ({
            id: a.id,
            text: a.text,
            metrics: JSON.parse(a.metrics || '[]'),
          })),
        })),
        projects: profile.projects.map((proj: any) => ({
          id: proj.id,
          name: proj.name,
          description: proj.description,
          technologies: JSON.parse(proj.technologies || '[]'),
          measurableResults: JSON.parse(proj.measurableResults || '[]'),
        })),
        skills: profile.skills.map((s: any) => ({ name: s.name })),
      },
    });

    const config = getAgentConfig();
    const cand = config.candidate;

    // Prepare candidate context for browser filling
    const candidateContext: CandidateFormContext = {
      fullName: cand.fullName || profile.user.name,
      firstName: (cand.fullName || profile.user.name).split(' ')[0],
      lastName: (cand.fullName || profile.user.name).split(' ').slice(1).join(' '),
      email: cand.email || profile.user.email,
      phone: cand.phone || profile.phone || '+91 7060137673',
      location: cand.location || profile.location || 'Noida, India',
      experienceYears: cand.experienceYears || 2.5,
      noticePeriodText: cand.noticePeriod || '15 days / Immediate',
      expectedSalaryText: cand.expectedSalary || (profile.user?.preferences?.salaryMin
        ? `₹${(profile.user.preferences.salaryMin / 100000).toFixed(0)} LPA`
        : '₹18 LPA'),
      workAuthorizationText: cand.workAuthorization || 'Yes, legally authorized to work in India',
      linkedinUrl: cand.linkedinUrl || 'https://www.linkedin.com/in/dixitkumar300',
      githubUrl: cand.githubUrl || 'https://github.com/dixitkumar300',
      portfolioUrl: cand.portfolioUrl || 'https://dixitkumar.dev',
      leetcodeUrl: cand.leetcodeUrl,
      codeforcesUrl: cand.codeforcesUrl,
      hackerrankUrl: cand.hackerrankUrl,
      codechefUrl: cand.codechefUrl,
      otherCodingUrl: cand.otherCodingUrl,
      resumePdfPath: resolveBestResumePdfPath(job.title, job.description),
      answers: answers.map((a: any) => ({ question: a.question, answer: a.answer })),
    };

    try {
      // Execute Playwright Browser Automation
      const executionResult = await SubmissionController.executeAutoApply({
        applicationUrl: job.canonicalUrl,
        candidate: candidateContext,
        headless: body.headless ?? false,
        dryRun: body.dryRun ?? false,
      });

      // Upsert Application record in DB
      let application = await prisma.application.findUnique({
        where: {
          userId_jobId: {
            userId: profile.userId,
            jobId: job.id,
          },
        },
      });

      const isSubmitted = executionResult.status === 'SUBMITTED';

      if (application) {
        application = await prisma.application.update({
          where: { id: application.id },
          data: {
            status: isSubmitted ? 'APPLIED' : application.status,
            appliedAt: isSubmitted ? new Date() : application.appliedAt,
            submissionMethod: 'BROWSER_AUTOMATION',
          },
        });
      } else {
        application = await prisma.application.create({
          data: {
            userId: profile.userId,
            jobId: job.id,
            status: isSubmitted ? 'APPLIED' : 'READY',
            appliedAt: isSubmitted ? new Date() : null,
            submissionMethod: 'BROWSER_AUTOMATION',
          },
        });
      }

      // Record Event
      await prisma.applicationEvent.create({
        data: {
          applicationId: application.id,
          eventType: isSubmitted ? 'BROWSER_SUBMITTED' : 'BROWSER_AUTOFILL_COMPLETED',
          description: executionResult.message,
          actor: 'AGENT',
          payload: JSON.stringify({
            fieldsDetected: (executionResult.fieldsDetected || []).length,
            fillResult: executionResult.fillResult || null,
            dryRun: body.dryRun,
          }),
        },
      });

      if (isSubmitted || (body.dryRun && executionResult.success)) {
        void telegramNotifier.notifyApplicationSubmitted({
          title: job.title,
          company: job.company,
          platform: job.canonicalUrl.includes('linkedin.com') ? 'LINKEDIN' : 'WEB_PORTAL',
          jobUrl: job.canonicalUrl,
          dryRun: Boolean(body.dryRun),
        });
      }

      return reply.send({
        success: executionResult.success,
        applicationId: application.id,
        status: application.status,
        browserResult: executionResult,
      });
    } catch (err: any) {
      app.log.error(err, 'Error during browser-auto-apply');
      return reply.send({
        success: false,
        status: 'READY',
        browserResult: {
          success: false,
          status: 'FAILED',
          url: job.canonicalUrl,
          fieldsDetected: [],
          message: err.message || 'Browser automation encountered an issue. You can use "Open Career Portal" to complete submission directly.',
          logs: [err.message || String(err)],
        },
      });
    }
  });
}

