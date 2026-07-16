import { STORAGE_KEYS } from './storageKeys';

export type HomeDraftMode = 'idea' | 'outline' | 'description' | 'source-deck';

const DEFAULT_MODE: HomeDraftMode = 'idea';
const HOME_DRAFT_MODES = new Set<HomeDraftMode>([
  'idea',
  'outline',
  'description',
  'source-deck',
]);

const normalizeDraftMode = (value: string | null): HomeDraftMode => {
  if (value === 'ppt_renovation') return 'source-deck';
  return value && HOME_DRAFT_MODES.has(value as HomeDraftMode)
    ? value as HomeDraftMode
    : DEFAULT_MODE;
};

export const homeDraftStore = {
  getContent: () => sessionStorage.getItem(STORAGE_KEYS.homeDraftContent) || '',

  saveContent: (content: string) => {
    if (content) {
      sessionStorage.setItem(STORAGE_KEYS.homeDraftContent, content);
      return;
    }

    sessionStorage.removeItem(STORAGE_KEYS.homeDraftContent);
  },

  getTab: () => {
    const savedTab = sessionStorage.getItem(STORAGE_KEYS.homeDraftTab);
    return normalizeDraftMode(savedTab);
  },

  saveTab: (tab: HomeDraftMode) => {
    sessionStorage.setItem(STORAGE_KEYS.homeDraftTab, tab);
  },

  clear: () => {
    sessionStorage.removeItem(STORAGE_KEYS.homeDraftContent);
    sessionStorage.removeItem(STORAGE_KEYS.homeDraftTab);
  },
};
