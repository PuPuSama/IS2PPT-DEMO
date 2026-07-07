import { STORAGE_KEYS } from '@/shared/storage/storageKeys';

export const ACCESS_CODE_HEADER = 'X-Access-Code';

export const accessCodeSession = {
  get: () => localStorage.getItem(STORAGE_KEYS.accessCode),

  save: (code: string) => {
    localStorage.setItem(STORAGE_KEYS.accessCode, code);
  },

  clear: () => {
    localStorage.removeItem(STORAGE_KEYS.accessCode);
  },

  getAuthHeaders: () => {
    const accessCode = accessCodeSession.get();
    return accessCode ? { [ACCESS_CODE_HEADER]: accessCode } : {};
  },
};
