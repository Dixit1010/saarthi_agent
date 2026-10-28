import { prisma } from '@saarthi/database';
import { agentState } from '@saarthi/jobs';

export interface TaskJob {
  id: string;
  agentRunId: string;
  taskType: string;
  payload: Record<string, unknown>;
}

type TaskHandler = (job: TaskJob) => Promise<void>;

class InMemoryQueue {
  private queue: TaskJob[] = [];
  private processing = false;
  private handlers = new Map<string, TaskHandler>();

  constructor() {
    agentState.registerQueueSizeGetter(() => this.getSize());
  }

  getSize(): number {
    return this.queue.length;
  }

  registerHandler(taskType: string, handler: TaskHandler) {
    this.handlers.set(taskType, handler);
  }

  enqueue(job: TaskJob) {
    this.queue.push(job);
    void this.processNext();
  }

  private async processNext() {
    if (this.processing || this.queue.length === 0) return;

    if (agentState.isPaused()) {
      // Agent is paused; defer processing until resumed
      setTimeout(() => void this.processNext(), 3000);
      return;
    }

    this.processing = true;

    const job = this.queue.shift();
    if (!job) {
      this.processing = false;
      return;
    }

    try {
      const handler = this.handlers.get(job.taskType);
      if (handler) {
        await handler(job);
      } else {
        console.warn(`No handler registered for task type: ${job.taskType}`);
      }
    } catch (err) {
      console.error(`Error processing job ${job.id}:`, err);
      await prisma.agentLog.create({
        data: {
          agentRunId: job.agentRunId,
          level: 'ERROR',
          message: `Task ${job.taskType} failed: ${String(err)}`,
        },
      });
    } finally {
      this.processing = false;
      if (this.queue.length > 0) {
        setImmediate(() => void this.processNext());
      }
    }
  }
}

export const taskQueue = new InMemoryQueue();
