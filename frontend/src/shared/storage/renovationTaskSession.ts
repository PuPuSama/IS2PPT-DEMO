import { STORAGE_KEYS } from './storageKeys';

export const renovationTaskSession = {
  getTaskId: () => localStorage.getItem(STORAGE_KEYS.renovationTaskId),

  trackTask: (taskId: string) => {
    localStorage.setItem(STORAGE_KEYS.renovationTaskId, taskId);
  },

  clearTask: () => {
    localStorage.removeItem(STORAGE_KEYS.renovationTaskId);
  },
};
