import { STORAGE_KEYS } from './storageKeys';

export const uiDismissals = {
  hasSeenHomeHelp: () => localStorage.getItem(STORAGE_KEYS.hasSeenHelp) === 'true',

  markHomeHelpSeen: () => {
    localStorage.setItem(STORAGE_KEYS.hasSeenHelp, 'true');
  },

  shouldSkipLowResolutionWarning: () =>
    localStorage.getItem(STORAGE_KEYS.skip1KResolutionWarning) === 'true',

  skipLowResolutionWarning: () => {
    localStorage.setItem(STORAGE_KEYS.skip1KResolutionWarning, 'true');
  },
};
