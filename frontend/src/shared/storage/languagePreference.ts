import { STORAGE_KEYS } from './storageKeys';

export const languagePreference = {
  storageKey: STORAGE_KEYS.language,

  read: (fallback = 'zh') => {
    if (typeof window === 'undefined') return fallback;
    return localStorage.getItem(STORAGE_KEYS.language) || navigator.language || fallback;
  },

  getDateLocale: () => (languagePreference.read('zh-CN').startsWith('zh') ? 'zh-CN' : 'en-US'),

  isChinese: () => languagePreference.read('zh').startsWith('zh'),
};
