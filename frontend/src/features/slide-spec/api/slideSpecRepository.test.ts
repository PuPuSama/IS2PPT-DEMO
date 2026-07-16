import { beforeEach, describe, expect, test, vi } from 'vitest';
import { refineDescriptions } from '@/api/descriptionApi';
import { addPage } from '@/api/pagesApi';
import { updateProject } from '@/api/projectsApi';
import { getSettings, updateSettings } from '@/api/settingsApi';
import { getTaskStatus } from '@/api/tasksApi';
import { detailGenerationPreferences } from '@/shared/storage/detailGenerationPreferences';
import { extraFieldCatalog } from '@/shared/storage/extraFieldCatalog';
import { projectSession } from '@/shared/storage/projectSession';
import {
  appendSlideSpecs,
  loadSourceDeckJob,
  loadSlideSpecPreferences,
  refineSlideSpecs,
  saveSlideSpecPreferences,
  saveSlideSpecRequirements,
} from './slideSpecRepository';

vi.mock('@/api/descriptionApi', () => ({ refineDescriptions: vi.fn() }));
vi.mock('@/api/pagesApi', () => ({ addPage: vi.fn() }));
vi.mock('@/api/projectsApi', () => ({ updateProject: vi.fn() }));
vi.mock('@/api/settingsApi', () => ({ getSettings: vi.fn(), updateSettings: vi.fn() }));
vi.mock('@/api/tasksApi', () => ({ getTaskStatus: vi.fn() }));
vi.mock('@/shared/storage/detailGenerationPreferences', () => ({
  detailGenerationPreferences: { readDetailLevel: vi.fn() },
}));
vi.mock('@/shared/storage/extraFieldCatalog', () => ({
  DEFAULT_DESCRIPTION_FIELDS: ['content'],
  extraFieldCatalog: { read: vi.fn(), save: vi.fn(), mergeAndSave: vi.fn() },
  getDefaultDescriptionFields: vi.fn(() => ['content']),
  getDefaultImagePromptFields: vi.fn(() => []),
}));
vi.mock('@/shared/storage/projectSession', () => ({
  projectSession: { saveSettingsSnapshot: vi.fn() },
}));
vi.mock('@/shared/storage/renovationTaskSession', () => ({
  renovationTaskSession: { getTaskId: vi.fn(), clearTask: vi.fn() },
}));

describe('slide spec repository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('saves requirements through the legacy project field', async () => {
    vi.mocked(updateProject).mockResolvedValue({});
    await saveSlideSpecRequirements('deck-1', 'Focus on diagrams');
    expect(updateProject).toHaveBeenCalledWith('deck-1', {
      description_requirements: 'Focus on diagrams',
    });
  });

  test('normalizes the refinement response', async () => {
    vi.mocked(refineDescriptions).mockResolvedValue({
      data: { pages: [], message: 'Updated' },
    });
    await expect(refineSlideSpecs('deck-1', 'Shorter', [])).resolves.toBe('Updated');
  });

  test('maps imported specs to backend page requests', async () => {
    vi.mocked(addPage).mockResolvedValue({});
    await appendSlideSpecs('deck-1', [{
      title: 'Opening',
      points: ['Context'],
      description: 'Use a clean timeline',
      section: 'Intro',
      extraFields: { audience: 'Leadership' },
    }], 2);
    expect(addPage).toHaveBeenCalledWith('deck-1', {
      outline_content: { title: 'Opening', points: ['Context'] },
      description_content: {
        text: 'Use a clean timeline',
        extra_fields: { audience: 'Leadership' },
      },
      part: 'Intro',
      order_index: 2,
    });
  });

  test('maps backend source-deck jobs to feature states', async () => {
    vi.mocked(getTaskStatus).mockResolvedValue({
      data: {
        task_id: 'job-1',
        status: 'PROCESSING',
        progress: { total: 6, completed: 2 },
      },
    });
    await expect(loadSourceDeckJob('deck-1', 'job-1')).resolves.toEqual({
      state: 'running',
      total: 6,
      completed: 2,
      errorMessage: undefined,
    });
  });

  test('normalizes stored generation preferences', async () => {
    const settings = {
      description_generation_mode: 'parallel',
      description_extra_fields: ['chart'],
      image_prompt_extra_fields: ['chart'],
    } as never;
    vi.mocked(getSettings).mockResolvedValue({ data: settings });
    vi.mocked(detailGenerationPreferences.readDetailLevel).mockReturnValue('detailed');
    vi.mocked(extraFieldCatalog.read).mockReturnValue(['content']);
    vi.mocked(extraFieldCatalog.mergeAndSave).mockReturnValue(['content', 'chart']);

    await expect(loadSlideSpecPreferences()).resolves.toEqual({
      detailLevel: 'detailed',
      generationMode: 'parallel',
      activeFields: ['chart'],
      imagePromptFields: ['chart'],
      availableFields: ['content', 'chart'],
    });
    expect(projectSession.saveSettingsSnapshot).toHaveBeenCalledWith(settings);
  });

  test('maps feature preference patches to backend settings', async () => {
    vi.mocked(updateSettings).mockResolvedValue({});
    await saveSlideSpecPreferences({
      generationMode: 'streaming',
      activeFields: ['content', 'chart'],
      imagePromptFields: ['chart'],
    });
    expect(updateSettings).toHaveBeenCalledWith({
      description_generation_mode: 'streaming',
      description_extra_fields: ['content', 'chart'],
      image_prompt_extra_fields: ['chart'],
    });
  });
});
