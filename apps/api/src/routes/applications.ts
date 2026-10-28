import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '@saarthi/database';
import { UpdateApplicationStatusSchema } from '@saarthi/shared';

export async function applicationRoutes(app: FastifyInstance) {
  // GET Applications
  app.get('/', async (_req: FastifyRequest, reply: FastifyReply) => {
    const applications = await prisma.application.findMany({
      include: {
        job: {
          include: {
            skills: true,
            matches: true,
          },
        },
        resumeVersion: true,
        answers: true,
        events: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return reply.send({
      total: applications.length,
      applications: applications.map((app: any) => ({
        id: app.id,
        status: app.status,
        submissionMethod: app.submissionMethod,
        appliedAt: app.appliedAt,
        notes: app.notes,
        coverLetterText: app.coverLetterText,
        createdAt: app.createdAt,
        updatedAt: app.updatedAt,
        job: {
          id: app.job.id,
          title: app.job.title,
          company: app.job.company,
          location: app.job.location,
          locationType: app.job.locationType,
          canonicalUrl: app.job.canonicalUrl,
          matchScore: app.job.matches[0]?.score || 88,
        },
        answersCount: app.answers.length,
        pendingReviewCount: app.answers.filter((a: any) => a.requiresReview && !a.isApproved).length,
        events: app.events,
      })),
    });
  });

  // PATCH Update Application Status
  app.patch('/:id/status', async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { id } = req.params;
    const body = UpdateApplicationStatusSchema.parse(req.body);

    const appRecord = await prisma.application.findUnique({ where: { id } });
    if (!appRecord) return reply.status(404).send({ error: 'Application not found' });

    const updated = await prisma.application.update({
      where: { id },
      data: {
        status: body.status,
        notes: body.notes !== undefined ? body.notes : appRecord.notes,
        appliedAt: body.status === 'APPLIED' && !appRecord.appliedAt ? new Date() : undefined,
        events: {
          create: {
            eventType: `STATUS_${body.status}`,
            description: `Application transitioned to ${body.status}${body.notes ? `: ${body.notes}` : ''}`,
            actor: 'USER',
          },
        },
      },
    });

    return reply.send({ success: true, application: updated });
  });

  // GET Single Application Detail with Answers and Events
  app.get('/:id', async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { id } = req.params;
    const application = await prisma.application.findUnique({
      where: { id },
      include: {
        job: {
          include: {
            skills: true,
            matches: true,
          },
        },
        resumeVersion: {
          include: {
            sources: true,
          },
        },
        answers: {
          orderBy: { createdAt: 'asc' },
        },
        events: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!application) return reply.status(404).send({ error: 'Application not found' });

    return reply.send({
      id: application.id,
      status: application.status,
      submissionMethod: application.submissionMethod,
      appliedAt: application.appliedAt,
      notes: application.notes,
      coverLetterText: application.coverLetterText,
      createdAt: application.createdAt,
      updatedAt: application.updatedAt,
      job: {
        id: application.job.id,
        title: application.job.title,
        company: application.job.company,
        location: application.job.location,
        locationType: application.job.locationType,
        canonicalUrl: application.job.canonicalUrl,
        description: application.job.description,
        skills: application.job.skills,
        matchScore: application.job.matches[0]?.score ?? 0,
      },
      resumeVersion: application.resumeVersion
        ? {
            id: application.resumeVersion.id,
            versionNumber: application.resumeVersion.versionNumber,
            atsScore: application.resumeVersion.atsScore,
            content: JSON.parse(application.resumeVersion.content || '{}'),
            sources: application.resumeVersion.sources,
          }
        : null,
      answers: application.answers.map((a) => ({
        id: a.id,
        question: a.question,
        answer: a.answer,
        confidence: a.confidence,
        requiresReview: a.requiresReview,
        isApproved: a.isApproved,
        sources: JSON.parse(a.sources || '[]'),
      })),
      events: application.events.map((e) => ({
        id: e.id,
        eventType: e.eventType,
        description: e.description,
        actor: e.actor,
        payload: e.payload ? JSON.parse(e.payload) : null,
        createdAt: e.createdAt,
      })),
    });
  });

  // PUT Update Specific Application Answer
  app.put('/:id/answers/:answerId', async (req: FastifyRequest<{ Params: { id: string; answerId: string }; Body: { answer: string; isApproved?: boolean } }>, reply: FastifyReply) => {
    const { id, answerId } = req.params;
    const { answer, isApproved } = req.body;

    let answerRecord = await prisma.applicationAnswer.findFirst({
      where: { id: answerId, applicationId: id },
    });

    if (!answerRecord && answerId.startsWith('ans_')) {
      const index = parseInt(answerId.replace('ans_', ''), 10);
      const allAnswers = await prisma.applicationAnswer.findMany({
        where: { applicationId: id },
        orderBy: { createdAt: 'asc' },
      });
      if (!isNaN(index) && allAnswers[index]) {
        answerRecord = allAnswers[index];
      }
    }

    if (!answerRecord) return reply.status(404).send({ error: 'Application answer not found' });

    const updated = await prisma.applicationAnswer.update({
      where: { id: answerRecord.id },
      data: {
        answer,
        isApproved: isApproved !== undefined ? isApproved : true,
      },
    });

    await prisma.applicationEvent.create({
      data: {
        applicationId: id,
        eventType: 'ANSWER_EDITED',
        description: `Candidate modified answer for "${answerRecord.question.substring(0, 40)}..."`,
        actor: 'USER',
      },
    });

    return reply.send({ success: true, answer: updated });
  });

  // POST Approve and Submit Application
  app.post('/:id/approve-submit', async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { id } = req.params;

    const appRecord = await prisma.application.findUnique({
      where: { id },
      include: { job: true },
    });

    if (!appRecord) return reply.status(404).send({ error: 'Application not found' });

    // Mark answers as approved
    await prisma.applicationAnswer.updateMany({
      where: { applicationId: id },
      data: { isApproved: true },
    });

    const updated = await prisma.application.update({
      where: { id },
      data: {
        status: 'APPLIED',
        appliedAt: new Date(),
        events: {
          create: [
            {
              eventType: 'HUMAN_APPROVED',
              description: 'User approved application form answers and resume version',
              actor: 'USER',
            },
            {
              eventType: 'SUBMITTED',
              description: `Application submitted to ${appRecord.job.company} for ${appRecord.job.title}`,
              actor: 'AGENT',
            },
          ],
        },
      },
    });

    return reply.send({ success: true, application: updated });
  });
}
