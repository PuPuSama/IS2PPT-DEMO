import { beforeEach, describe, expect, test, vi } from 'vitest';
import {
  exportEditablePPTX,
  exportImages,
  exportPDF,
  exportPPTX,
  listExports,
} from '@/api/exportsApi';
import { getTaskStatus } from '@/api/tasksApi';
import {
  fetchExportJob,
  listDeckExports,
  requestDeckExport,
} from './exportRepository';

vi.mock('@/api/exportsApi', () => ({
  exportEditablePPTX: vi.fn(),
  exportImages: vi.fn(),
  exportPDF: vi.fn(),
  exportPPTX: vi.fn(),
  listExports: vi.fn(),
}));

vi.mock('@/api/tasksApi', () => ({ getTaskStatus: vi.fn() }));

describe('export repository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('normalizes a synchronous PPTX response', async () => {
    vi.mocked(exportPPTX).mockResolvedValue({
      data: { download_url: '/exports/Q2%20Review.pptx' },
    });

    await expect(requestDeckExport({
      deckId: 'deck-1',
      format: 'pptx',
      slideIds: ['slide-1'],
      pptxOptions: { transitionEnabled: true, transitionEffects: ['fade'] },
    })).resolves.toEqual({
      kind: 'download',
      downloadUrl: '/exports/Q2%20Review.pptx',
      filename: 'Q2 Review.pptx',
    });

    expect(exportPPTX).toHaveBeenCalledWith(
      'deck-1',
      ['slide-1'],
      { transitionEnabled: true, transitionEffects: ['fade'] },
    );
  });

  test('starts editable export as a backend job', async () => {
    vi.mocked(exportEditablePPTX).mockResolvedValue({ data: { task_id: 'job-7' } });

    await expect(requestDeckExport({
      deckId: 'deck-1',
      format: 'editable-pptx',
      filename: 'editable.pptx',
    })).resolves.toEqual({ kind: 'job', backendJobId: 'job-7' });
  });

  test('maps exported files and fetches job status', async () => {
    vi.mocked(listExports).mockResolvedValue({
      data: {
        files: [{
          filename: 'deck.pdf',
          type: 'pdf',
          size: 42,
          modified_at: '2026-07-16T09:00:00.000Z',
          download_url: '/exports/deck.pdf',
        }],
      },
    });
    vi.mocked(getTaskStatus).mockResolvedValue({
      data: { task_id: 'job-7', status: 'RUNNING' },
    });

    await expect(listDeckExports('deck-1')).resolves.toEqual([{
      filename: 'deck.pdf',
      format: 'pdf',
      size: 42,
      modifiedAt: '2026-07-16T09:00:00.000Z',
      downloadUrl: '/exports/deck.pdf',
    }]);
    await expect(fetchExportJob('deck-1', 'job-7')).resolves.toMatchObject({
      task_id: 'job-7',
      status: 'RUNNING',
    });
  });

  test.each([
    ['pdf', exportPDF],
    ['images', exportImages],
  ] as const)('routes %s requests to its API', async (format, requestApi) => {
    vi.mocked(requestApi).mockResolvedValue({ data: { download_url: `/exports/deck.${format}` } });
    await requestDeckExport({ deckId: 'deck-1', format });
    expect(requestApi).toHaveBeenCalledWith('deck-1', undefined);
  });
});
