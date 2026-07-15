import { beforeEach, describe, expect, test } from 'vitest';
import { useGenerationJobsStore } from './useGenerationJobsStore';

describe('useGenerationJobsStore', () => {
  beforeEach(() => {
    useGenerationJobsStore.getState().reset();
  });

  test('tracks an active job and its progress', () => {
    const store = useGenerationJobsStore.getState();
    store.startJob('job-42');
    store.updateProgress({ total: 4, completed: 2, currentStep: 'Rendering' });

    expect(useGenerationJobsStore.getState()).toMatchObject({
      activeJobId: 'job-42',
      progress: { total: 4, completed: 2, currentStep: 'Rendering' },
    });

    useGenerationJobsStore.getState().finishActiveJob();
    expect(useGenerationJobsStore.getState()).toMatchObject({
      activeJobId: null,
      progress: null,
    });
  });

  test('assigns and conditionally releases slide jobs', () => {
    const store = useGenerationJobsStore.getState();
    store.assignSlides('job-a', ['slide-1', 'slide-2']);
    store.assignSlides('job-b', ['slide-2']);
    store.releaseSlides(['slide-1', 'slide-2'], 'job-a');

    expect(useGenerationJobsStore.getState().jobsBySlideId).toEqual({
      'slide-2': 'job-b',
    });
  });

  test('syncs compatibility snapshots without retaining mutable maps', () => {
    const jobsBySlideId: Record<string, string> = { 'slide-1': 'job-a' };
    useGenerationJobsStore.getState().syncSnapshot({
      activeJobId: null,
      progress: null,
      jobsBySlideId,
      warning: 'Partial output',
      outlineStreamActive: true,
      descriptionStreamActive: false,
    });
    jobsBySlideId['slide-2'] = 'job-b';

    expect(useGenerationJobsStore.getState()).toMatchObject({
      jobsBySlideId: { 'slide-1': 'job-a' },
      warning: 'Partial output',
      outlineStreamActive: true,
    });
  });
});
