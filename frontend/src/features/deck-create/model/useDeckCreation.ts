import { useCallback, useState } from 'react';
import type { UserTemplate } from '@/api/templatesApi';
import { associateFileToProject } from '@/api/referenceFilesApi';
import { createPptRenovationProject } from '@/api/renovationApi';
import { loadTemplateAsset } from '@/entities/template/api/templateAssetRepository';
import { useProjectStore } from '@/store/useProjectStore';
import { homeDraftStore } from '@/shared/storage/homeDraft';
import { projectSession } from '@/shared/storage/projectSession';
import { renovationTaskSession } from '@/shared/storage/renovationTaskSession';
import { createDeckFromCommand } from './createDeckWorkflow';
import type { DeckCreationCommand, DeckCreationResult } from './types';

export const useDeckCreation = (userTemplates: UserTemplate[]) => {
  const { initializeProject, isGlobalLoading } = useProjectStore();
  const [isCreating, setIsCreating] = useState(false);

  const createDeck = useCallback(async (
    command: DeckCreationCommand,
  ): Promise<DeckCreationResult> => {
    setIsCreating(true);
    try {
      return await createDeckFromCommand(command, {
        loadTemplate: (templateId) => loadTemplateAsset(templateId, userTemplates),
        initializeDeck: async (input) => initializeProject(
          input.mode,
          input.brief,
          input.templateFile,
          input.style,
          input.referenceIds,
          input.aspectRatio,
        ),
        importSourceDeck: async (input) => {
          const response = await createPptRenovationProject(input.sourceFile, {
            keepLayout: input.keepLayout,
            templateStyle: input.style,
          });
          return {
            deckId: response.data?.project_id,
            jobId: response.data?.task_id,
          };
        },
        associateReference: async (referenceId, deckId) => {
          await associateFileToProject(referenceId, deckId);
        },
        activateDeck: (deckId) => projectSession.setActiveProjectId(deckId),
        trackImportJob: (jobId) => renovationTaskSession.trackTask(jobId),
        clearDraft: () => homeDraftStore.clear(),
      });
    } finally {
      setIsCreating(false);
    }
  }, [initializeProject, userTemplates]);

  return {
    createDeck,
    isCreating: isCreating || isGlobalLoading,
  };
};
