import { STORAGE_KEYS } from './storageKeys';

export const detailGenerationPreferences = {
  readDetailLevel: () => sessionStorage.getItem(STORAGE_KEYS.detailLevel),
};
