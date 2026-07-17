import { useCallback } from 'react';
import type { ExportJob } from '@/entities/export/model/types';
import type {
  DeckExportFormat,
  StartDeckExportCommand,
} from './useDeckWorkspaceJobs';

export interface DeckExportOptions {
  transitionEnabled?: boolean;
  transitionEffects?: string[];
}

interface UseDeckWorkspaceExportOptions {
  deckId: string | undefined;
  selectedSlideIds: Set<string>;
  multiSelectEnabled: boolean;
  startDeckExport: (command: StartDeckExportCommand) => Promise<ExportJob>;
  onDownloadReady: (url: string) => void;
  onExportStarted: () => void;
  onExportError: (error: unknown) => void;
}

export const useDeckWorkspaceExport = ({
  deckId,
  selectedSlideIds,
  multiSelectEnabled,
  startDeckExport,
  onDownloadReady,
  onExportStarted,
  onExportError,
}: UseDeckWorkspaceExportOptions) => {
  const exportDeck = useCallback(async (
    format: DeckExportFormat,
    options?: DeckExportOptions,
  ) => {
    if (!deckId) return;
    const slideIds = multiSelectEnabled && selectedSlideIds.size > 0
      ? Array.from(selectedSlideIds)
      : undefined;

    try {
      const job = await startDeckExport({
        deckId,
        format,
        slideIds,
        transitionEnabled: options?.transitionEnabled,
        transitionEffects: options?.transitionEffects,
      });

      if (job.status === 'ready' && job.downloadUrl) {
        onDownloadReady(job.downloadUrl);
      } else if (job.status === 'queued' || job.status === 'running') {
        onExportStarted();
      }
    } catch (error) {
      onExportError(error);
    }
  }, [
    deckId,
    multiSelectEnabled,
    onDownloadReady,
    onExportError,
    onExportStarted,
    selectedSlideIds,
    startDeckExport,
  ]);

  return { exportDeck };
};
