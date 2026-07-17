import { useCallback } from 'react';
import type { Page as LegacySlide } from '@/types';
import {
  exportSelectionFromWorkspace,
  type DeckWorkspaceSnapshot,
} from './deckWorkspaceSnapshot';

type RenderScope = 'deck' | 'slide';

export interface DeckOverwriteRequest {
  target: 'deck' | 'selection';
  selectedCount: number;
  execute: () => Promise<void>;
}

interface UseDeckWorkspaceRenderingOptions {
  workspace: DeckWorkspaceSnapshot | null;
  selectedSlide: LegacySlide | undefined;
  selectedSlideIds: Set<string>;
  multiSelectEnabled: boolean;
  jobsBySlideId: Record<string, string>;
  ensureStyleSource: () => Promise<boolean>;
  requestExecution: (command: () => Promise<void>) => Promise<void>;
  renderSlides: (slideIds?: string[]) => Promise<void>;
  renderSlide: (slideId: string, force: boolean) => Promise<void>;
  onOverwriteRequired: (request: DeckOverwriteRequest) => void;
  onSlideBusy: () => void;
  onSlideRenderStarted: () => void;
  onRenderError: (error: unknown, scope: RenderScope) => void;
}

export const useDeckWorkspaceRendering = ({
  workspace,
  selectedSlide,
  selectedSlideIds,
  multiSelectEnabled,
  jobsBySlideId,
  ensureStyleSource,
  requestExecution,
  renderSlides,
  renderSlide,
  onOverwriteRequired,
  onSlideBusy,
  onSlideRenderStarted,
  onRenderError,
}: UseDeckWorkspaceRenderingOptions) => {
  const renderDeck = useCallback(async () => {
    if (!workspace || !(await ensureStyleSource())) return;

    await requestExecution(async () => {
      const partial = multiSelectEnabled && selectedSlideIds.size > 0;
      const slideIds = partial ? Array.from(selectedSlideIds) : undefined;
      const targetSlides = exportSelectionFromWorkspace(
        workspace,
        selectedSlideIds,
        partial,
      ).slides;
      const overwritesExistingSlides = targetSlides.some(
        (slide) => Boolean(slide.generated_image_path),
      );
      const execute = async () => {
        try {
          await renderSlides(slideIds);
        } catch (error) {
          onRenderError(error, 'deck');
        }
      };

      if (overwritesExistingSlides) {
        onOverwriteRequired({
          target: partial ? 'selection' : 'deck',
          selectedCount: selectedSlideIds.size,
          execute,
        });
        return;
      }

      await execute();
    });
  }, [
    ensureStyleSource,
    multiSelectEnabled,
    onOverwriteRequired,
    onRenderError,
    renderSlides,
    requestExecution,
    selectedSlideIds,
    workspace,
  ]);

  const renderCurrentSlide = useCallback(async () => {
    const slideId = selectedSlide?.id;
    if (!slideId) return;
    if (jobsBySlideId[slideId]) {
      onSlideBusy();
      return;
    }
    if (!(await ensureStyleSource())) return;

    await requestExecution(async () => {
      try {
        await renderSlide(slideId, true);
        onSlideRenderStarted();
      } catch (error) {
        onRenderError(error, 'slide');
      }
    });
  }, [
    ensureStyleSource,
    jobsBySlideId,
    onRenderError,
    onSlideBusy,
    onSlideRenderStarted,
    renderSlide,
    requestExecution,
    selectedSlide?.id,
  ]);

  return {
    renderDeck,
    renderCurrentSlide,
  };
};
