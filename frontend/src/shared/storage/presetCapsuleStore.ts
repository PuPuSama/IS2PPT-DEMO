import { getPresetCapsulesStorageKey } from './storageKeys';

export interface PresetCapsule {
  name: string;
  content: string;
}

export type PresetType = 'outline' | 'description';

const isPresetCapsule = (value: unknown): value is PresetCapsule => {
  if (!value || typeof value !== 'object') return false;

  const preset = value as Record<string, unknown>;
  return typeof preset.name === 'string' && typeof preset.content === 'string';
};

export const presetCapsuleStore = {
  read: (type: PresetType) => {
    try {
      const raw = localStorage.getItem(getPresetCapsulesStorageKey(type));
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed.filter(isPresetCapsule) : [];
    } catch {
      return [];
    }
  },

  save: (type: PresetType, presets: PresetCapsule[]) => {
    localStorage.setItem(getPresetCapsulesStorageKey(type), JSON.stringify(presets));
  },
};
