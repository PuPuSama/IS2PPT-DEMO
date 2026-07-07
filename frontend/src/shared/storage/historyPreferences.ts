import { STORAGE_KEYS } from './storageKeys';

export const DEFAULT_HISTORY_PAGE_SIZE = 5;

export const historyPreferences = {
  readPageSize: () => {
    const saved = localStorage.getItem(STORAGE_KEYS.historyPageSize);
    const pageSize = saved ? Number(saved) : DEFAULT_HISTORY_PAGE_SIZE;
    return Number.isFinite(pageSize) && pageSize > 0 ? pageSize : DEFAULT_HISTORY_PAGE_SIZE;
  },

  savePageSize: (pageSize: number) => {
    localStorage.setItem(STORAGE_KEYS.historyPageSize, String(pageSize));
  },
};
