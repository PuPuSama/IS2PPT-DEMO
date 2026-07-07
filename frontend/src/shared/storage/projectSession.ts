import { STORAGE_KEYS } from './storageKeys';

export const projectSession = {
  getActiveProjectId: () => localStorage.getItem(STORAGE_KEYS.currentProjectId),

  setActiveProjectId: (projectId: string) => {
    localStorage.setItem(STORAGE_KEYS.currentProjectId, projectId);
  },

  clearActiveProjectId: () => {
    localStorage.removeItem(STORAGE_KEYS.currentProjectId);
  },
};
