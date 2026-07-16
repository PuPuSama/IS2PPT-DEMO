import { useCallback } from 'react';
import { updateProject, uploadTemplate } from '@/api/projectsApi';
import { getPageImageVersions, setCurrentImageVersion } from '@/api/pagesApi';
import type { ProjectUpdateDto } from '@/entities/deck/api/projectDto';
import type { ImageVersionDto } from '@/entities/slide/api/pageDto';
import { useProjectStore } from '@/store/useProjectStore';
import type { Page } from '@/types';

export interface ReviseSlideCommand {
  slideId: string;
  instruction: string;
  includeTemplate: boolean;
  descriptionImageUrls: string[];
  uploadedFiles?: File[];
}

export const useDeckWorkspaceProject = () => {
  const {
    currentProject,
    syncProject,
    generatePageImage,
    generateImages,
    editPageImage,
    deletePageById,
    updatePageLocal,
    isGlobalLoading,
  } = useProjectStore();

  const saveDeckSettings = useCallback(async (
    deckId: string,
    changes: ProjectUpdateDto,
  ) => {
    await updateProject(deckId, changes);
    await syncProject(deckId);
  }, [syncProject]);

  const replaceDeckTemplate = useCallback(async (deckId: string, file: File) => {
    await uploadTemplate(deckId, file);
    await syncProject(deckId);
  }, [syncProject]);

  const listSlideVersions = useCallback(async (
    deckId: string,
    slideId: string,
  ): Promise<ImageVersionDto[]> => {
    const response = await getPageImageVersions(deckId, slideId);
    return response.data?.versions ?? [];
  }, []);

  const selectSlideVersion = useCallback(async (
    deckId: string,
    slideId: string,
    versionId: string,
  ) => {
    await setCurrentImageVersion(deckId, slideId, versionId);
    await syncProject(deckId);
  }, [syncProject]);

  const reviseSlide = useCallback(async (command: ReviseSlideCommand) => {
    await editPageImage(command.slideId, command.instruction, {
      useTemplate: command.includeTemplate,
      descImageUrls: command.descriptionImageUrls,
      uploadedFiles: command.uploadedFiles,
    });
  }, [editPageImage]);

  const patchSlide = useCallback((slideId: string, changes: Partial<Page>) => {
    updatePageLocal(slideId, changes);
  }, [updatePageLocal]);

  return {
    deckSource: currentProject,
    busy: isGlobalLoading,
    reloadDeck: syncProject,
    renderSlide: generatePageImage,
    renderSlides: generateImages,
    reviseSlide,
    removeSlide: deletePageById,
    patchSlide,
    saveDeckSettings,
    replaceDeckTemplate,
    listSlideVersions,
    selectSlideVersion,
  };
};
