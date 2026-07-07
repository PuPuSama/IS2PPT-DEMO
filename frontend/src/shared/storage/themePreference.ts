import { STORAGE_KEYS } from './storageKeys';

export type Theme = 'light' | 'dark' | 'system';

const DEFAULT_THEME: Theme = 'system';

const isTheme = (value: string | null): value is Theme =>
  value === 'light' || value === 'dark' || value === 'system';

export const themePreference = {
  read: () => {
    if (typeof window === 'undefined') return DEFAULT_THEME;

    const stored = localStorage.getItem(STORAGE_KEYS.theme);
    return isTheme(stored) ? stored : DEFAULT_THEME;
  },

  save: (theme: Theme) => {
    localStorage.setItem(STORAGE_KEYS.theme, theme);
  },
};
