import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ImageVersionDto } from '@/entities/slide/api/pageDto';
import type { Page as LegacySlide } from '@/types';

interface UseDeckWorkspaceSlidesOptions {
  deckId: string | undefined;
  slides: LegacySlide[];
  slidesWithImages: LegacySlide[];
  listSlideVersions: (deckId: string, slideId: string) => Promise<ImageVersionDto[]>;
  selectSlideVersion: (
    deckId: string,
    slideId: string,
    versionId: string,
  ) => Promise<void>;
  onVersionSelected: () => void;
  onVersionSelectError: (error: unknown) => void;
}

export const useDeckWorkspaceSlides = ({
  deckId,
  slides,
  slidesWithImages,
  listSlideVersions,
  selectSlideVersion,
  onVersionSelected,
  onVersionSelectError,
}: UseDeckWorkspaceSlidesOptions) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [multiSelectEnabled, setMultiSelectEnabled] = useState(false);
  const [selectedSlideIds, setSelectedSlideIds] = useState<Set<string>>(new Set());
  const [imageVersions, setImageVersions] = useState<ImageVersionDto[]>([]);
  const [versionMenuOpen, setVersionMenuOpen] = useState(false);
  const selectedSlide = slides[selectedIndex];
  const selectableSlideIds = useMemo(
    () => slidesWithImages.flatMap((slide) => slide.id ? [slide.id] : []),
    [slidesWithImages],
  );

  useEffect(() => {
    setSelectedIndex((current) => Math.min(current, Math.max(0, slides.length - 1)));
    const selectableIds = new Set(selectableSlideIds);
    setSelectedSlideIds((current) => {
      const next = new Set(Array.from(current).filter((id) => selectableIds.has(id)));
      return next.size === current.size ? current : next;
    });
  }, [selectableSlideIds, slides.length]);

  useEffect(() => {
    let active = true;
    setImageVersions([]);
    setVersionMenuOpen(false);

    if (!deckId || !selectedSlide?.id) {
      return () => {
        active = false;
      };
    }

    void listSlideVersions(deckId, selectedSlide.id)
      .then((versions) => {
        if (active) setImageVersions(versions);
      })
      .catch(() => {
        if (active) setImageVersions([]);
      });

    return () => {
      active = false;
    };
  }, [deckId, listSlideVersions, selectedSlide?.id]);

  const selectSlide = useCallback((index: number) => {
    setSelectedIndex(Math.max(0, Math.min(index, slides.length - 1)));
  }, [slides.length]);

  const toggleSlideSelection = useCallback((slideId: string) => {
    if (!selectableSlideIds.includes(slideId)) return;
    setSelectedSlideIds((current) => {
      const next = new Set(current);
      if (next.has(slideId)) {
        next.delete(slideId);
      } else {
        next.add(slideId);
      }
      return next;
    });
  }, [selectableSlideIds]);

  const selectAllSlides = useCallback(() => {
    setSelectedSlideIds(new Set(selectableSlideIds));
  }, [selectableSlideIds]);

  const clearSlideSelection = useCallback(() => {
    setSelectedSlideIds(new Set());
  }, []);

  const toggleMultiSelect = useCallback(() => {
    setMultiSelectEnabled((current) => {
      if (current) setSelectedSlideIds(new Set());
      return !current;
    });
  }, []);

  const selectedSlideIdsForCommand = useCallback((): string[] | undefined => {
    if (!multiSelectEnabled || selectedSlideIds.size === 0) return undefined;
    return Array.from(selectedSlideIds);
  }, [multiSelectEnabled, selectedSlideIds]);

  const toggleVersionMenu = useCallback(() => {
    setVersionMenuOpen((current) => !current);
  }, []);

  const switchVersion = useCallback(async (versionId: string) => {
    if (!deckId || !selectedSlide?.id) return;
    try {
      await selectSlideVersion(deckId, selectedSlide.id, versionId);
      setImageVersions((current) => current.map((version) => ({
        ...version,
        is_current: version.version_id === versionId,
      })));
      setVersionMenuOpen(false);
      onVersionSelected();
    } catch (error) {
      onVersionSelectError(error);
    }
  }, [deckId, onVersionSelectError, onVersionSelected, selectSlideVersion, selectedSlide?.id]);

  return {
    selectedIndex,
    selectedSlide,
    selectSlide,
    multiSelectEnabled,
    selectedSlideIds,
    toggleMultiSelect,
    toggleSlideSelection,
    selectAllSlides,
    clearSlideSelection,
    selectedSlideIdsForCommand,
    imageVersions,
    versionMenuOpen,
    toggleVersionMenu,
    switchVersion,
  };
};
