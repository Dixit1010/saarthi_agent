import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getAgentConfig, saveAgentConfig } from '@saarthi/jobs';
import { prisma } from '@saarthi/database';

export async function configRoutes(app: FastifyInstance) {
  // GET current agent configuration
  app.get('/', async (_req: FastifyRequest, reply: FastifyReply) => {
    const config = getAgentConfig();
    return reply.send({ success: true, config });
  });

  // PUT update agent configuration
  app.put('/', async (req: FastifyRequest<{ Body: any }>, reply: FastifyReply) => {
    const body = req.body || {};
    const updated = saveAgentConfig(body);

    // Sync into SQLite DB Profile & Preferences if available
    try {
      const profile = await prisma.profile.findFirst();
      if (profile) {
        if (updated.candidate) {
          await prisma.user.update({
            where: { id: profile.userId },
            data: {
              name: updated.candidate.fullName || undefined,
              email: updated.candidate.email || undefined,
            },
          });
          await prisma.profile.update({
            where: { id: profile.id },
            data: {
              phone: updated.candidate.phone || undefined,
              location: updated.candidate.location || undefined,
            },
          });
        }

        if (updated.searchPreferences) {
          await prisma.userPreference.upsert({
            where: { userId: profile.userId },
            create: {
              userId: profile.userId,
              targetRoles: JSON.stringify(updated.searchPreferences.targetRoles || []),
              targetLocations: JSON.stringify(updated.searchPreferences.targetLocations || []),
              salaryMin: parseFloat(String(updated.candidate?.expectedSalary || '18').replace(/[^0-9.]/g, '')) * 100000,
              noticePeriod: updated.candidate?.noticePeriod || '15 days / Immediate',
            },
            update: {
              targetRoles: JSON.stringify(updated.searchPreferences.targetRoles || []),
              targetLocations: JSON.stringify(updated.searchPreferences.targetLocations || []),
              salaryMin: parseFloat(String(updated.candidate?.expectedSalary || '18').replace(/[^0-9.]/g, '')) * 100000,
              noticePeriod: updated.candidate?.noticePeriod || undefined,
            },
          });
        }
      }
    } catch (err) {
      console.warn('DB sync warning in configRoutes:', err);
    }

    return reply.send({ success: true, config: updated });
  });
}
