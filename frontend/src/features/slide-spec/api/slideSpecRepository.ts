import { refineDescriptions } from '@/api/descriptionApi';
import { addPage } from '@/api/pagesApi';
import { updateProject } from '@/api/projectsApi';
import { getSettings, updateSettings } from '@/api/settingsApi';
import { getTaskStatus } from '@/api/tasksApi';
import { detailGenerationPreferences } from '@/shared/storage/detailGenerationPreferences';
import {
  DEFAULT_DESCRIPTION_FIELDS,
  extraFieldCatalog,
  getDefaultDescriptionFields,
  getDefaultImagePromptFields,
} from '@/shared/storage/extraFieldCatalog';
import { projectSession } from '@/shared/storage/projectSession';
import { renovationTaskSession } from '@/shared/storage/renovationTaskSession';

export type SlideSpecGenerationMode = 'streaming' | 'parallel';

export interface SlideSpecDraft {
  title: string;
  points: string[];
  description?: string;
  section?: string;
  extraFields?: Record<string, string>;
}

export interface SlideSpecPreferences {
  detailLevel: string;
  generationMode: SlideSpecGenerationMode;
  activeFields: string[];
  imagePromptFields: string[];
  availableFields: string[];
}

export interface SlideSpecPreferencesPatch {
  generationMode?: SlideSpecGenerationMode;
  activeFields?: string[];
  imagePromptFields?: string[];
}

export interface SourceDeckJobSnapshot {
  state: 'running' | 'completed' | 'failed';
  total: number;
  completed: number;
  errorMessage?: string;
}

export const DEFAULT_SLIDE_SPEC_FIELDS = new Set<string>(DEFAULT_DESCRIPTION_FIELDS);

export const loadSlideSpecPreferences = async (): Promise<SlideSpecPreferences | null> => {
  const response = await getSettings();
  const settings = response.data;
  if (!settings) return null;
  const activeFields = settings.description_extra_fields || getDefaultDescriptionFields();
  const imagePromptFields = settings.image_prompt_extra_fields || getDefaultImagePromptFields();
  const availableFields = extraFieldCatalog.mergeAndSave(extraFieldCatalog.read(), activeFields);
  projectSession.saveSettingsSnapshot(settings);
  return {
    detailLevel: detailGenerationPreferences.readDetailLevel() || 'default',
    generationMode: settings.description_generation_mode || 'streaming',
    activeFields,
    imagePromptFields,
    availableFields,
  };
};

export const saveSlideSpecPreferences = async (
  patch: SlideSpecPreferencesPatch,
): Promise<void> => {
  const payload: Parameters<typeof updateSettings>[0] = {};
  if (patch.generationMode) payload.description_generation_mode = patch.generationMode;
  if (patch.activeFields) payload.description_extra_fields = patch.activeFields;
  if (patch.imagePromptFields) payload.image_prompt_extra_fields = patch.imagePromptFields;
  const response = await updateSettings(payload);
  if (response.data) projectSession.saveSettingsSnapshot(response.data);
};

export const readSlideSpecFieldCatalog = (): string[] => extraFieldCatalog.read();

export const saveSlideSpecFieldCatalog = (fields: string[]): void => {
  extraFieldCatalog.save(fields);
};

export const defaultSlideSpecFields = (): string[] => getDefaultDescriptionFields();

export const defaultImagePromptFields = (): string[] => getDefaultImagePromptFields();

export const saveSlideSpecRequirements = async (
  deckId: string,
  requirements: string,
): Promise<void> => {
  await updateProject(deckId, { description_requirements: requirements });
};

export const refineSlideSpecs = async (
  deckId: string,
  requirement: string,
  previousRequirements: string[],
): Promise<string | undefined> => {
  const response = await refineDescriptions(deckId, requirement, previousRequirements);
  return response.data?.message;
};

export const appendSlideSpecs = async (
  deckId: string,
  drafts: SlideSpecDraft[],
  startOrder: number,
): Promise<void> => {
  await Promise.all(drafts.map((draft, index) => addPage(deckId, {
    outline_content: { title: draft.title, points: draft.points },
    description_content: draft.description
      ? {
          text: draft.description,
          ...(draft.extraFields ? { extra_fields: draft.extraFields } : {}),
        }
      : undefined,
    part: draft.section,
    order_index: startOrder + index,
  })));
};

export const readSourceDeckJobId = (): string | null => renovationTaskSession.getTaskId();

export const clearSourceDeckJob = (): void => {
  renovationTaskSession.clearTask();
};

export const loadSourceDeckJob = async (
  deckId: string,
  jobId: string,
): Promise<SourceDeckJobSnapshot | null> => {
  const response = await getTaskStatus(deckId, jobId);
  const task = response.data;
  if (!task) return null;
  return {
    state: task.status === 'COMPLETED'
      ? 'completed'
      : task.status === 'FAILED'
        ? 'failed'
        : 'running',
    total: task.progress?.total || 0,
    completed: task.progress?.completed || 0,
    errorMessage: task.error_message || task.error,
  };
};
