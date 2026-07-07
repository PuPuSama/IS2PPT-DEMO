import type { Settings } from '@/types';

import { STORAGE_KEYS } from './storageKeys';

type DescriptionGenerationMode = Settings['description_generation_mode'];

const DEFAULT_DESCRIPTION_MODE: DescriptionGenerationMode = 'streaming';

const isDescriptionGenerationMode = (value: unknown): value is DescriptionGenerationMode =>
  value === 'streaming' || value === 'parallel';

const readSettingsSnapshot = (): Partial<Settings> | null => {
  const cached = sessionStorage.getItem(STORAGE_KEYS.settingsSnapshot);
  if (!cached) return null;

  try {
    const parsed = JSON.parse(cached);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
};

export const projectSession = {
  getActiveProjectId: () => localStorage.getItem(STORAGE_KEYS.currentProjectId),

  setActiveProjectId: (projectId: string) => {
    localStorage.setItem(STORAGE_KEYS.currentProjectId, projectId);
  },

  clearActiveProjectId: () => {
    localStorage.removeItem(STORAGE_KEYS.currentProjectId);
  },

  getSettingsSnapshot: readSettingsSnapshot,

  saveSettingsSnapshot: (settings: Partial<Settings>) => {
    sessionStorage.setItem(STORAGE_KEYS.settingsSnapshot, JSON.stringify(settings));
  },

  getDescriptionGenerationMode: () => {
    const mode = readSettingsSnapshot()?.description_generation_mode;
    return isDescriptionGenerationMode(mode) ? mode : DEFAULT_DESCRIPTION_MODE;
  },
};
