import { beforeEach, describe, expect, test, vi } from 'vitest';
import { fetchExportJob, requestDeckExport } from '../api/exportRepository';
import { useExportJobsStore } from './useExportJobsStore';

vi.mock('../api/exportRepository', () => ({
  fetchExportJob: vi.fn(),
  requestDeckExport: vi.fn(),
}));

describe('useExportJobsStore', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    useExportJobsStore.getState().reset();
  });

  test('records a synchronous export as ready', async () => {
    vi.mocked(requestDeckExport).mockResolvedValue({
      kind: 'download',
      downloadUrl: '/exports/deck.pdf',
      filename: 'deck.pdf',
    });

    const job = await useExportJobsStore.getState().startExport({
      deckId: 'deck-1',
      format: 'pdf',
      slideIds: ['slide-1'],
    });

    expect(job).toMatchObject({
      deckId: 'deck-1',
      format: 'pdf',
      status: 'ready',
      downloadUrl: '/exports/deck.pdf',
    });
    expect(useExportJobsStore.getState().jobs).toHaveLength(1);
  });

  test('polls an asynchronous export into the ready state', async () => {
    vi.mocked(fetchExportJob).mockResolvedValue({
      task_id: 'backend-1',
      status: 'COMPLETED',
      progress: {
        total: 1,
        completed: 1,
        download_url: '/exports/editable.pptx',
        filename: 'editable.pptx',
      },
    });
    useExportJobsStore.setState({
      jobs: [{
        id: 'local-1',
        backendJobId: 'backend-1',
        deckId: 'deck-1',
        format: 'editable-pptx',
        status: 'running',
        createdAt: '2026-07-16T09:00:00.000Z',
      }],
    });

    await useExportJobsStore.getState().pollJob('local-1');

    expect(useExportJobsStore.getState().jobs[0]).toMatchObject({
      status: 'ready',
      downloadUrl: '/exports/editable.pptx',
      filename: 'editable.pptx',
    });
  });

  test('marks an unresumable local request as failed', () => {
    useExportJobsStore.setState({
      jobs: [{
        id: 'local-2',
        deckId: 'deck-1',
        format: 'images',
        status: 'queued',
        createdAt: '2026-07-16T09:00:00.000Z',
      }],
    });

    useExportJobsStore.getState().restoreActiveJobs();

    expect(useExportJobsStore.getState().jobs[0]).toMatchObject({
      status: 'failed',
      errorMessage: 'Export was interrupted before it could be resumed',
    });
  });
});
