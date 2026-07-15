import { getTaskStatus } from '@/api/tasksApi';
import type { ApiResponse } from '@/types';
import type { GenerationJobDto, GenerationJobStatusDto } from './taskDto';

export type GenerationJobPhase =
  | 'waiting'
  | 'running'
  | 'completed'
  | 'failed'
  | 'unknown';

type MaybePromise = void | Promise<void>;
type FetchGenerationJob = (
  projectId: string,
  jobId: string,
) => Promise<ApiResponse<GenerationJobDto>>;
type SchedulePoll = (
  callback: () => void,
  delayMs: number,
) => unknown;

interface GenerationJobPollerOptions {
  projectId: string;
  jobId: string;
  intervalMs?: number;
  maxConsecutiveErrors?: number;
  fetchJob?: FetchGenerationJob;
  onUpdate?: (job: GenerationJobDto, phase: GenerationJobPhase) => MaybePromise;
  onComplete?: (job: GenerationJobDto) => MaybePromise;
  onFailure?: (job: GenerationJobDto) => MaybePromise;
  onUnknown?: (job: GenerationJobDto) => MaybePromise;
  onError?: (error: unknown, attempt: number, willRetry: boolean) => MaybePromise;
  schedule?: SchedulePoll;
  cancelSchedule?: (timer: unknown) => void;
}

export interface GenerationJobPoller {
  start: () => void;
  checkNow: () => Promise<void>;
  cancel: () => void;
  isCancelled: () => boolean;
}

export const generationJobPhaseFromDto = (
  status: GenerationJobStatusDto | string,
): GenerationJobPhase => {
  if (status === 'PENDING') return 'waiting';
  if (status === 'PROCESSING' || status === 'RUNNING') return 'running';
  if (status === 'COMPLETED') return 'completed';
  if (status === 'FAILED') return 'failed';
  return 'unknown';
};

export const createGenerationJobPoller = (
  options: GenerationJobPollerOptions,
): GenerationJobPoller => {
  const fetchJob = options.fetchJob ?? getTaskStatus;
  const schedule = options.schedule ?? ((callback, delayMs) => setTimeout(callback, delayMs));
  const cancelSchedule = options.cancelSchedule ?? ((timer) => {
    clearTimeout(timer as ReturnType<typeof setTimeout>);
  });
  const intervalMs = options.intervalMs ?? 2000;
  const maxConsecutiveErrors = options.maxConsecutiveErrors ?? 0;

  let cancelled = false;
  let consecutiveErrors = 0;
  let scheduledPoll: unknown | null = null;
  let inFlight: Promise<void> | null = null;

  const scheduleNext = () => {
    if (cancelled || scheduledPoll !== null) return;
    scheduledPoll = schedule(() => {
      scheduledPoll = null;
      void checkNow();
    }, intervalMs);
  };

  const runCheck = async () => {
    if (cancelled) return;

    try {
      const response = await fetchJob(options.projectId, options.jobId);
      if (cancelled) return;
      const job = response.data;
      if (!job) {
        throw new Error('Generation job response did not include task data');
      }

      consecutiveErrors = 0;
      const phase = generationJobPhaseFromDto(job.status);
      await options.onUpdate?.(job, phase);

      if (phase === 'waiting' || phase === 'running') {
        scheduleNext();
      } else if (phase === 'completed') {
        await options.onComplete?.(job);
      } else if (phase === 'failed') {
        await options.onFailure?.(job);
      } else {
        await options.onUnknown?.(job);
      }
    } catch (error) {
      if (cancelled) return;
      consecutiveErrors += 1;
      const willRetry = consecutiveErrors <= maxConsecutiveErrors;
      await options.onError?.(error, consecutiveErrors, willRetry);
      if (willRetry) scheduleNext();
    }
  };

  const checkNow = (): Promise<void> => {
    if (inFlight) return inFlight;
    inFlight = runCheck().finally(() => {
      inFlight = null;
    });
    return inFlight;
  };

  return {
    start: scheduleNext,
    checkNow,
    cancel: () => {
      cancelled = true;
      if (scheduledPoll !== null) {
        cancelSchedule(scheduledPoll);
        scheduledPoll = null;
      }
    },
    isCancelled: () => cancelled,
  };
};
