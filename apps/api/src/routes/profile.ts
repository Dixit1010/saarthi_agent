import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '@saarthi/database';
import {
  UpdateProfileSchema,
  CreateExperienceSchema,
  CreateProjectSchema,
  UpdatePreferencesSchema,
} from '@saarthi/shared';

export async function profileRoutes(app: FastifyInstance) {
  // Helper to get active profile
  async function getActiveProfile() {
    let profile = await prisma.profile.findFirst({
      include: {
        skills: true,
        experiences: {
          include: { achievements: true },
        },
        projects: true,
        user: {
          include: {
            preferences: true,
            automationRule: true,
          },
        },
      },
    });

    if (!profile) {
      // If no profile, auto-create one for first user or default Dixit Kumar
      let user = await prisma.user.findFirst();
      if (!user) {
        user = await prisma.user.create({
          data: {
            email: 'dixit@example.com',
            name: 'Dixit Kumar',
            passwordHash: 'dummy',
          },
        });
      }
      profile = await prisma.profile.create({
        data: {
          userId: user.id,
          location: 'Noida, India',
        },
        include: {
          skills: true,
          experiences: {
            include: { achievements: true },
          },
          projects: true,
          user: {
            include: {
              preferences: true,
              automationRule: true,
            },
          },
        },
      });
    }

    return profile;
  }

  // GET Profile
  app.get('/', async (_req: FastifyRequest, reply: FastifyReply) => {
    const profile = await getActiveProfile();

    return reply.send({
      id: profile.id,
      userId: profile.userId,
      name: profile.user.name,
      email: profile.user.email,
      phone: profile.phone,
      location: profile.location,
      bio: profile.bio,
      education: JSON.parse(profile.education || '[]'),
      skills: profile.skills,
      experiences: profile.experiences.map((exp: any) => ({
        ...exp,
        technologies: JSON.parse(exp.technologies || '[]'),
        achievements: exp.achievements.map((ach: any) => ({
          ...ach,
          metrics: JSON.parse(ach.metrics || '[]'),
        })),
      })),
      projects: profile.projects.map((proj: any) => ({
        ...proj,
        technologies: JSON.parse(proj.technologies || '[]'),
        measurableResults: JSON.parse(proj.measurableResults || '[]'),
      })),
      preferences: profile.user.preferences
        ? {
            ...profile.user.preferences,
            targetRoles: JSON.parse(profile.user.preferences.targetRoles || '[]'),
            targetLocations: JSON.parse(profile.user.preferences.targetLocations || '[]'),
            excludedCompanies: JSON.parse(profile.user.preferences.excludedCompanies || '[]'),
            excludedKeywords: JSON.parse(profile.user.preferences.excludedKeywords || '[]'),
          }
        : null,
      automationRule: profile.user.automationRule,
    });
  });

  // PUT Update Profile
  app.put('/', async (req: FastifyRequest, reply: FastifyReply) => {
    const body = UpdateProfileSchema.parse(req.body);
    const profile = await getActiveProfile();

    const updated = await prisma.profile.update({
      where: { id: profile.id },
      data: {
        phone: body.phone,
        location: body.location,
        bio: body.bio,
        education: body.education ? JSON.stringify(body.education) : undefined,
      },
    });

    if (body.name) {
      await prisma.user.update({
        where: { id: profile.userId },
        data: { name: body.name },
      });
    }

    return reply.send({ success: true, profile: updated });
  });

  // POST Add Experience
  app.post('/experiences', async (req: FastifyRequest, reply: FastifyReply) => {
    const body = CreateExperienceSchema.parse(req.body);
    const profile = await getActiveProfile();

    const experience = await prisma.experience.create({
      data: {
        profileId: profile.id,
        company: body.company,
        role: body.role,
        employmentType: body.employmentType,
        location: body.location,
        startDate: new Date(body.startDate),
        endDate: body.endDate ? new Date(body.endDate) : null,
        isCurrent: body.isCurrent,
        technologies: JSON.stringify(body.technologies),
        achievements: {
          create: body.achievements.map((ach) => ({
            text: ach.text,
            metrics: JSON.stringify(ach.metrics),
            verified: ach.verified,
          })),
        },
      },
      include: {
        achievements: true,
      },
    });

    return reply.status(201).send(experience);
  });

  // POST Add Project
  app.post('/projects', async (req: FastifyRequest, reply: FastifyReply) => {
    const body = CreateProjectSchema.parse(req.body);
    const profile = await getActiveProfile();

    const project = await prisma.project.create({
      data: {
        profileId: profile.id,
        name: body.name,
        description: body.description,
        problem: body.problem,
        solution: body.solution,
        technologies: JSON.stringify(body.technologies),
        githubUrl: body.githubUrl,
        liveUrl: body.liveUrl,
        measurableResults: JSON.stringify(body.measurableResults),
        verified: body.verified,
      },
    });

    return reply.status(201).send(project);
  });

  // PUT Update Experience
  app.put('/experiences/:id', async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { id } = req.params;
    const body = CreateExperienceSchema.partial().parse(req.body);

    const updated = await prisma.experience.update({
      where: { id },
      data: {
        company: body.company,
        role: body.role,
        employmentType: body.employmentType,
        location: body.location,
        startDate: body.startDate ? new Date(body.startDate) : undefined,
        endDate: body.endDate ? new Date(body.endDate) : undefined,
        isCurrent: body.isCurrent,
        technologies: body.technologies ? JSON.stringify(body.technologies) : undefined,
      },
    });

    return reply.send({ success: true, experience: updated });
  });

  // DELETE Experience
  app.delete('/experiences/:id', async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { id } = req.params;
    await prisma.experience.delete({ where: { id } });
    return reply.send({ success: true });
  });

  // PUT Update Project
  app.put('/projects/:id', async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { id } = req.params;
    const body = CreateProjectSchema.partial().parse(req.body);

    const updated = await prisma.project.update({
      where: { id },
      data: {
        name: body.name,
        description: body.description,
        problem: body.problem,
        solution: body.solution,
        technologies: body.technologies ? JSON.stringify(body.technologies) : undefined,
        githubUrl: body.githubUrl,
        liveUrl: body.liveUrl,
        measurableResults: body.measurableResults ? JSON.stringify(body.measurableResults) : undefined,
      },
    });

    return reply.send({ success: true, project: updated });
  });

  // DELETE Project
  app.delete('/projects/:id', async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { id } = req.params;
    await prisma.project.delete({ where: { id } });
    return reply.send({ success: true });
  });

  // POST Add Skill
  app.post('/skills', async (req: FastifyRequest<{ Body: { name: string; category?: string; yearsExperience?: number } }>, reply: FastifyReply) => {
    const { name, category, yearsExperience } = req.body || {};
    if (!name) return reply.status(400).send({ error: 'Skill name is required' });

    const profile = await getActiveProfile();
    const skill = await prisma.skill.create({
      data: {
        profileId: profile.id,
        name,
        category: category || 'Technical',
        yearsExperience: yearsExperience ? Number(yearsExperience) : 1.0,
        verified: true,
      },
    });

    return reply.status(201).send(skill);
  });

  // DELETE Skill
  app.delete('/skills/:id', async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { id } = req.params;
    await prisma.skill.delete({ where: { id } });
    return reply.send({ success: true });
  });

  // PUT Update Preferences & Automation Rules
  app.put('/preferences', async (req: FastifyRequest, reply: FastifyReply) => {
    const body = UpdatePreferencesSchema.parse(req.body);
    const profile = await getActiveProfile();

    await prisma.userPreference.upsert({
      where: { userId: profile.userId },
      update: {
        targetRoles: body.targetRoles ? JSON.stringify(body.targetRoles) : undefined,
        targetLocations: body.targetLocations ? JSON.stringify(body.targetLocations) : undefined,
        remotePreference: body.remotePreference,
        experienceMin: body.experienceMin,
        experienceMax: body.experienceMax,
        salaryMin: body.salaryMin,
        noticePeriod: body.noticePeriod,
        excludedCompanies: body.excludedCompanies ? JSON.stringify(body.excludedCompanies) : undefined,
        excludedKeywords: body.excludedKeywords ? JSON.stringify(body.excludedKeywords) : undefined,
      },
      create: {
        userId: profile.userId,
        targetRoles: JSON.stringify(body.targetRoles || []),
        targetLocations: JSON.stringify(body.targetLocations || []),
        remotePreference: body.remotePreference || 'ANY',
        experienceMin: body.experienceMin ?? 0,
        experienceMax: body.experienceMax ?? 3,
        salaryMin: body.salaryMin,
        noticePeriod: body.noticePeriod,
        excludedCompanies: JSON.stringify(body.excludedCompanies || []),
        excludedKeywords: JSON.stringify(body.excludedKeywords || []),
      },
    });

    if (body.automationMode || body.requireApprovalForSubmit !== undefined) {
      await prisma.automationRule.upsert({
        where: { userId: profile.userId },
        update: {
          mode: body.automationMode,
          requireApprovalForSubmit: body.requireApprovalForSubmit,
        },
        create: {
          userId: profile.userId,
          mode: body.automationMode || 'ASSISTED',
          requireApprovalForSubmit: body.requireApprovalForSubmit ?? true,
        },
      });
    }

    return reply.send({ success: true });
  });
}
