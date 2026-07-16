import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { useDeckWorkspaceJobs } from './useDeckWorkspaceJobs';

const mocks = vi.hoisted(() => ({
  restoreActiveJobs: vi.fn(),
  startExport: vi.fn(),
}));

vi.mock('@/entities/generation/model/useGenerationJobsStore', () => ({
  useGenerationJobsStore: () => ({
    progress: { total: 3, completed: 1 },
    jobsBySlideId: { 'slide-1': 'render-job-1' },
    warning: 'Rendering is slower than expected',
  }),
}));

vi.mock('@/entities/export/model/useExportJobsStore', () => ({
  useExportJobsStore: () => ({
    jobs: [
      {
        id: 'export-1',
        deckId: 'deck-1',
        format: 'pptx',
        status: 'running',
        createdAt: '2026-07-16T00:00:00Z',
      },
      {
        id: 'export-2',
        deckId: 'deck-2',
        format: 'pdf',
        status: 'ready',
        createdAt: '2026-07-16T00:00:00Z',
      },
    ],
    startExport: mocks.startExport,
    restoreActiveJobs: mocks.restoreActiveJobs,
  }),
}));

describe('useDeckWorkspaceJobs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.startExport.mockResolvedValue({ id: 'export-3' });
  });

  test('normalizes render state and filters exports to the active deck', () => {
    const { result } = renderHook(() => useDeckWorkspaceJobs('deck-1'));

    expect(result.current.renderProgress).toEqual({ total: 3, completed: 1 });
    expect(result.current.slideRenderJobs).toEqual({ 'slide-1': 'render-job-1' });
    expect(result.current.deckExportJobs.map((job) => job.id)).toEqual(['export-1']);
    expect(result.current.activeDeckExport).toBe(true);
    expect(mocks.restoreActiveJobs).toHaveBeenCalledOnce();
  });

  test('maps workspace transition options to the export entity contract', async () => {
    const { result } = renderHook(() => useDeckWorkspaceJobs('deck-1'));

    await act(() => result.current.startDeckExport({
      deckId: 'deck-1',
      format: 'pptx',
      slideIds: ['slide-1'],
      transitionEnabled: true,
      transitionEffects: ['fade'],
    }));

    expect(mocks.startExport).toHaveBeenCalledWith({
      deckId: 'deck-1',
      format: 'pptx',
      slideIds: ['slide-1'],
      pptxOptions: {
        transitionEnabled: true,
        transitionEffects: ['fade'],
      },
    });
  });
});
