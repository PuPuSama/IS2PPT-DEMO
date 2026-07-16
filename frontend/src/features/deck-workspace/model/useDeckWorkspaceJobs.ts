import { useCallback, useEffect, useMemo } from 'react';
import { useGenerationJobsStore } from '@/entities/generation/model/useGenerationJobsStore';
import { useExportJobsStore } from '@/entities/export/model/useExportJobsStore';
import {
  isExportJobActive,
  type ExportFormat,
  type ExportJob,
} from '@/entities/export/model/types';

export type DeckExportFormat = ExportFormat;

export interface StartDeckExportCommand {
  deckId: string;
  format: DeckExportFormat;
  slideIds?: string[];
  transitionEnabled?: boolean;
  transitionEffects?: string[];
}

export const useDeckWorkspaceJobs = (deckId: string | undefined) => {
  const {
    progress,
    jobsBySlideId,
    warning,
  } = useGenerationJobsStore();
  const {
    jobs,
    startExport,
    restoreActiveJobs,
  } = useExportJobsStore();

  useEffect(() => {
    restoreActiveJobs();
  }, [restoreActiveJobs]);

  const deckExportJobs = useMemo<ExportJob[]>(
    () => jobs.filter((job) => job.deckId === deckId),
    [deckId, jobs],
  );

  const startDeckExport = useCallback(async (command: StartDeckExportCommand) => (
    startExport({
      deckId: command.deckId,
      format: command.format,
      slideIds: command.slideIds,
      pptxOptions: command.format === 'pptx'
        ? {
            transitionEnabled: command.transitionEnabled,
            transitionEffects: command.transitionEffects,
          }
        : undefined,
    })
  ), [startExport]);

  return {
    renderProgress: progress,
    slideRenderJobs: jobsBySlideId,
    renderWarning: warning,
    deckExportJobs,
    activeDeckExport: deckExportJobs.some(isExportJobActive),
    startDeckExport,
  };
};
