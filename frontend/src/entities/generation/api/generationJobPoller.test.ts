import { afterEach, describe, expect, test, vi } from 'vitest';
import {
  createGenerationJobPoller,
  generationJobPhaseFromDto,
} from './generationJobPoller';
import type { GenerationJobDto } from './taskDto';

const job = (status: GenerationJobDto['status']): GenerationJobDto => ({
  task_id: 'job-1',
  status,
  progress: { total: 2, completed: status === 'COMPLETED' ? 2 : 1 },
});

describe('generationJobPhaseFromDto', () => {
  test('normalizes both active backend statuses', () => {
    expect(generationJobPhaseFromDto('PENDING')).toBe('waiting');
    expect(generationJobPhaseFromDto('PROCESSING')).toBe('running');
    expect(generationJobPhaseFromDto('RUNNING')).toBe('running');
  });
});

describe('createGenerationJobPoller', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  test('schedules active jobs and stops on completion', async () => {
    vi.useFakeTimers();
    const fetchJob = vi
      .fn()
      .mockResolvedValueOnce({ data: job('RUNNING') })
      .mockResolvedValueOnce({ data: job('COMPLETED') });
    const onComplete = vi.fn();
    const poller = createGenerationJobPoller({
      projectId: 'deck-1',
      jobId: 'job-1',
      fetchJob,
      onComplete,
    });

    await poller.checkNow();
    expect(fetchJob).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(2000);
    expect(fetchJob).toHaveBeenCalledTimes(2);
    expect(onComplete).toHaveBeenCalledWith(job('COMPLETED'));

    await vi.advanceTimersByTimeAsync(2000);
    expect(fetchJob).toHaveBeenCalledTimes(2);
  });

  test('retries transient errors up to the configured limit', async () => {
    vi.useFakeTimers();
    const fetchJob = vi.fn().mockRejectedValue(new Error('offline'));
    const onError = vi.fn();
    const poller = createGenerationJobPoller({
      projectId: 'deck-1',
      jobId: 'job-1',
      fetchJob,
      maxConsecutiveErrors: 2,
      onError,
    });

    await poller.checkNow();
    await vi.advanceTimersByTimeAsync(4000);

    expect(fetchJob).toHaveBeenCalledTimes(3);
    expect(onError).toHaveBeenLastCalledWith(expect.any(Error), 3, false);
  });

  test('cancels a scheduled check', async () => {
    vi.useFakeTimers();
    const fetchJob = vi.fn().mockResolvedValue({ data: job('PENDING') });
    const poller = createGenerationJobPoller({
      projectId: 'deck-1',
      jobId: 'job-1',
      fetchJob,
    });

    await poller.checkNow();
    poller.cancel();
    await vi.advanceTimersByTimeAsync(2000);

    expect(poller.isCancelled()).toBe(true);
    expect(fetchJob).toHaveBeenCalledTimes(1);
  });

  test('starts once even when requested repeatedly', async () => {
    vi.useFakeTimers();
    const fetchJob = vi.fn().mockResolvedValue({ data: job('COMPLETED') });
    const poller = createGenerationJobPoller({
      projectId: 'deck-1',
      jobId: 'job-1',
      fetchJob,
    });

    poller.start();
    poller.start();
    await vi.advanceTimersByTimeAsync(2000);

    expect(fetchJob).toHaveBeenCalledTimes(1);
  });
});
