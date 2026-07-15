import { describe, expect, test, vi } from 'vitest';
import type { GenerationJobDto } from '../api/taskDto';
import { createImageGenerationJobCallbacks } from './imageGenerationJobService';

const job = (
  status: GenerationJobDto['status'],
  warning?: string,
): GenerationJobDto => ({
  task_id: 'job-1',
  status,
  progress: {
    total: 2,
    completed: status === 'COMPLETED' ? 2 : 1,
    warning_message: warning,
  },
});

const createHarness = () => {
  let assignments: Record<string, string> = {
    'slide-1': 'job-1',
    'slide-2': 'job-1',
    'slide-3': 'other-job',
  };
  const writeAssignments = vi.fn((next: Record<string, string>) => {
    assignments = next;
  });
  const refreshDeck = vi.fn().mockResolvedValue(undefined);
  const setWarning = vi.fn();
  const setError = vi.fn();

  return {
    readAssignments: () => assignments,
    writeAssignments,
    refreshDeck,
    setWarning,
    setError,
  };
};

describe('createImageGenerationJobCallbacks', () => {
  test('refreshes active jobs and releases only settled slides', async () => {
    const harness = createHarness();
    const callbacks = createImageGenerationJobCallbacks({
      jobId: 'job-1',
      slideIds: ['slide-1', 'slide-2'],
      ...harness,
      isSlideSettled: (slideId) => slideId === 'slide-1',
      areSlideAssetsReady: () => false,
      failureMessage: () => 'failed',
    });

    await callbacks.onUpdate(job('RUNNING', 'Partial output'), 'running');

    expect(harness.refreshDeck).toHaveBeenCalledOnce();
    expect(harness.setWarning).toHaveBeenCalledWith('Partial output');
    expect(harness.readAssignments()).toEqual({
      'slide-2': 'job-1',
      'slide-3': 'other-job',
    });
  });

  test('retries deck refresh until completed assets are visible', async () => {
    const harness = createHarness();
    let assetCheck = 0;
    const delay = vi.fn().mockResolvedValue(undefined);
    const callbacks = createImageGenerationJobCallbacks({
      jobId: 'job-1',
      slideIds: ['slide-1', 'slide-2'],
      ...harness,
      isSlideSettled: () => true,
      areSlideAssetsReady: () => {
        assetCheck += 1;
        return assetCheck === 3;
      },
      failureMessage: () => 'failed',
      delay,
    });

    await callbacks.onComplete(job('COMPLETED'));

    expect(harness.refreshDeck).toHaveBeenCalledTimes(3);
    expect(delay).toHaveBeenCalledTimes(2);
    expect(harness.readAssignments()).toEqual({ 'slide-3': 'other-job' });
  });

  test('clears tracked slides and reports terminal failures', async () => {
    const harness = createHarness();
    const callbacks = createImageGenerationJobCallbacks({
      jobId: 'job-1',
      slideIds: ['slide-1', 'slide-2'],
      ...harness,
      isSlideSettled: () => false,
      areSlideAssetsReady: () => false,
      failureMessage: () => 'Image generation failed',
    });

    await callbacks.onFailure({
      ...job('FAILED'),
      error_message: 'provider error',
    });

    expect(harness.setError).toHaveBeenCalledWith('Image generation failed');
    expect(harness.refreshDeck).toHaveBeenCalledOnce();
    expect(harness.readAssignments()).toEqual({ 'slide-3': 'other-job' });
  });

  test('cleans up assignments when polling itself fails', () => {
    const harness = createHarness();
    const callbacks = createImageGenerationJobCallbacks({
      jobId: 'job-1',
      slideIds: ['slide-1', 'slide-2'],
      ...harness,
      isSlideSettled: () => false,
      areSlideAssetsReady: () => false,
      failureMessage: () => 'failed',
    });

    callbacks.onError(new Error('offline'));

    expect(harness.readAssignments()).toEqual({ 'slide-3': 'other-job' });
  });
});
