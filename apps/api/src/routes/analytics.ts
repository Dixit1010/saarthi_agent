import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '@saarthi/database';

export async function analyticsRoutes(app: FastifyInstance) {
  app.get('/', async (_req: FastifyRequest, reply: FastifyReply) => {
    const totalJobs = await prisma.job.count();
    const highMatchMatches = await prisma.jobMatch.count({
      where: { score: { gte: 85 } },
    });

    const applications = await prisma.application.findMany({
      select: { status: true },
    });

    const preparedCount = applications.filter((a: any) => a.status === 'READY' || a.status === 'SHORTLISTED').length;
    const submittedCount = applications.filter(
      (a: any) =>
        a.status === 'APPLIED' ||
        a.status === 'OA' ||
        a.status === 'INTERVIEW' ||
        a.status === 'TECHNICAL' ||
        a.status === 'HR' ||
        a.status === 'OFFER'
    ).length;

    const interviewCount = applications.filter(
      (a: any) => a.status === 'INTERVIEW' || a.status === 'TECHNICAL' || a.status === 'HR' || a.status === 'OFFER'
    ).length;

    const responseRate = submittedCount > 0 ? Math.round((interviewCount / submittedCount) * 100) : 0;

    const matches = await prisma.jobMatch.findMany({ select: { score: true } });
    const avgScore =
      matches.length > 0
        ? Math.round(matches.reduce((acc: number, m: any) => acc + m.score, 0) / matches.length)
        : 0;

    return reply.send({
      jobsDiscovered: totalJobs,
      highMatchJobs: highMatchMatches,
      applicationsPrepared: preparedCount,
      applicationsSubmitted: submittedCount,
      interviews: interviewCount,
      responseRate,
      averageMatchScore: avgScore,
    });
  });
}
