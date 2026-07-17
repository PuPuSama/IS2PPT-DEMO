import { act, renderHook } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import type { ExportJob } from '@/entities/export/model/types';
import { useDeckWorkspaceExport } from './useDeckWorkspaceExport';

const exportJob = (overrides: Partial<ExportJob> = {}): ExportJob => ({
  id: 'export-1',
  deckId: 'deck-1',
  format: 'pptx',
  status: 'running',
  createdAt: '2026-07-16T00:00:00Z',
  ...overrides,
});

const renderExport = (overrides: Record<string, unknown> = {}) => {
  const options = {
    deckId: 'deck-1',
    selectedSlideIds: new Set(['slide-2', 'slide-4']),
    multiSelectEnabled: true,
    startDeckExport: vi.fn().mockResolvedValue(exportJob()),
    onDownloadReady: vi.fn(),
    onExportStarted: vi.fn(),
    onExportError: vi.fn(),
    ...overrides,
  };
  return {
    ...renderHook(() => useDeckWorkspaceExport(options)),
    options,
  };
};

describe('useDeckWorkspaceExport', () => {
  test('maps selected slides and transition settings to the export command', async () => {
    const { result, options } = renderExport();

    await act(() => result.current.exportDeck('pptx', {
      transitionEnabled: true,
      transitionEffects: ['fade'],
    }));

    expect(options.startDeckExport).toHaveBeenCalledWith({
      deckId: 'deck-1',
      format: 'pptx',
      slideIds: ['slide-2', 'slide-4'],
      transitionEnabled: true,
      transitionEffects: ['fade'],
    });
    expect(options.onExportStarted).toHaveBeenCalledTimes(1);
  });

  test('opens a completed export download', async () => {
    const url = '/api/exports/export-1/download';
    const startDeckExport = vi.fn().mockResolvedValue(exportJob({
      status: 'ready',
      downloadUrl: url,
    }));
    const { result, options } = renderExport({ startDeckExport });

    await act(() => result.current.exportDeck('pdf'));

    expect(options.onDownloadReady).toHaveBeenCalledWith(url);
    expect(options.onExportStarted).not.toHaveBeenCalled();
  });

  test('reports export request failures', async () => {
    const error = new Error('export failed');
    const startDeckExport = vi.fn().mockRejectedValue(error);
    const { result, options } = renderExport({ startDeckExport });

    await act(() => result.current.exportDeck('editable-pptx'));

    expect(options.onExportError).toHaveBeenCalledWith(error);
  });

  test('does not submit without a deck id', async () => {
    const { result, options } = renderExport({ deckId: undefined });

    await act(() => result.current.exportDeck('images'));

    expect(options.startDeckExport).not.toHaveBeenCalled();
  });
});
