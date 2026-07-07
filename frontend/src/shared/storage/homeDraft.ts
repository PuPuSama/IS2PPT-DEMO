import { STORAGE_KEYS } from './storageKeys';

export type HomeDraftTab = 'idea' | 'outline' | 'description' | 'ppt_renovation';

const DEFAULT_TAB: HomeDraftTab = 'idea';
const HOME_DRAFT_TABS = new Set<HomeDraftTab>([
  'idea',
  'outline',
  'description',
  'ppt_renovation',
]);

const isHomeDraftTab = (value: string | null): value is HomeDraftTab =>
  Boolean(value && HOME_DRAFT_TABS.has(value as HomeDraftTab));

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
    return isHomeDraftTab(savedTab) ? savedTab : DEFAULT_TAB;
  },

  saveTab: (tab: HomeDraftTab) => {
    sessionStorage.setItem(STORAGE_KEYS.homeDraftTab, tab);
  },

  clear: () => {
    sessionStorage.removeItem(STORAGE_KEYS.homeDraftContent);
    sessionStorage.removeItem(STORAGE_KEYS.homeDraftTab);
  },
};
