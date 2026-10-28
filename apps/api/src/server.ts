import fastify from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import multipart from '@fastify/multipart';
import dotenv from 'dotenv';
import { authRoutes } from './routes/auth.js';
import { profileRoutes } from './routes/profile.js';
import { jobRoutes } from './routes/jobs.js';
import { applicationRoutes } from './routes/applications.js';
import { agentRoutes } from './routes/agent.js';
import { analyticsRoutes } from './routes/analytics.js';
import { resumeRoutes } from './routes/resumes.js';
import { configRoutes } from './routes/config.js';
import path from 'path';
import { telegramBot, approvalManager, agentState } from '@saarthi/jobs';

dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });

const app = fastify({
  logger: {
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  },
});

async function main() {
  // CORS configuration (allow localhost and mobile devices on local network)
  await app.register(cors, {
    origin: true,
    credentials: true,
  });

  // Cookies for sessions
  await app.register(cookie, {
    secret: process.env.SESSION_SECRET || 'saarthi-session-secret-cookie-entropy-key-32',
  });

  // Rate limiting to protect API endpoints
  await app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
  });

  // Multipart for PDF/DOCX file uploads
  await app.register(multipart, {
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  });

  // Health check
  app.get('/health', async () => {
    return {
      status: 'ok',
      service: 'saarthi-api',
      timestamp: new Date().toISOString(),
    };
  });

  // Domain Routes
  await app.register(authRoutes, { prefix: '/api/auth' });
  await app.register(profileRoutes, { prefix: '/api/profile' });
  await app.register(resumeRoutes, { prefix: '/api/resumes' });
  await app.register(jobRoutes, { prefix: '/api/jobs' });
  await app.register(applicationRoutes, { prefix: '/api/applications' });
  await app.register(configRoutes, { prefix: '/api/config' });
  await app.register(agentRoutes, { prefix: '/api/agent' });
  await app.register(analyticsRoutes, { prefix: '/api/analytics' });

  // Global Error Handler
  app.setErrorHandler((error: any, _request, reply) => {
    app.log.error(error);
    const statusCode = error.statusCode || 500;
    return reply.status(statusCode).send({
      error: error.name || 'InternalServerError',
      message: error.message || 'An unexpected error occurred',
      statusCode,
    });
  });

  const port = Number(process.env.PORT) || 4000;
  const host = '0.0.0.0';

  // Connect approval pending count getter to agentState
  agentState.registerPendingApprovalsGetter(() => approvalManager.getPendingCount());

  try {
    await app.listen({ port, host });
    console.log(`🚀 Saarthi API server listening on http://localhost:${port}`);
    // Start Telegram long polling bot if configured
    void telegramBot.start();
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }

  // Graceful shutdown handling
  const shutdown = async (signal: string) => {
    console.log(`\n[Server] Received ${signal}. Shutting down gracefully...`);
    telegramBot.stop();
    await app.close().catch(() => {});
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

void main();
