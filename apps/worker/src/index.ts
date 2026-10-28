import dotenv from 'dotenv';
import { prisma } from '@saarthi/database';

dotenv.config();

console.log('🤖 Saarthi Worker process running...');

async function runScheduledSweep() {
  console.log('[Worker] Checking for pending agent runs and scheduled sweeps...');
  const pendingRuns = await prisma.agentRun.findMany({
    where: { status: 'PENDING' },
    take: 5,
  });

  if (pendingRuns.length > 0) {
    console.log(`[Worker] Found ${pendingRuns.length} pending runs to process`);
  }
}

// Poll or listen for scheduled tasks
setInterval(() => {
  void runScheduledSweep();
}, 30000);
