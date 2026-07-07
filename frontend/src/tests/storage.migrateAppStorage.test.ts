import { beforeEach, describe, expect, it } from 'vitest';
import { migrateAppStorage } from '@/shared/storage/migrateAppStorage';
import { LEGACY_STORAGE_KEYS, STORAGE_KEYS } from '@/shared/storage/storageKeys';

describe('migrateAppStorage', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('copies legacy app keys into is2ppt keys', () => {
    localStorage.setItem(LEGACY_STORAGE_KEYS.accessCode, 'code-1');
    localStorage.setItem(LEGACY_STORAGE_KEYS.currentProjectId, 'project-1');
    localStorage.setItem(`${LEGACY_STORAGE_KEYS.presetCapsulesPrefix}outline`, '[{"id":"1"}]');
    localStorage.setItem(LEGACY_STORAGE_KEYS.availableExtraFields, '["视觉元素"]');
    sessionStorage.setItem(LEGACY_STORAGE_KEYS.settingsSnapshot, '{"description_generation_mode":"streaming"}');

    migrateAppStorage();

    expect(localStorage.getItem(STORAGE_KEYS.accessCode)).toBe('code-1');
    expect(localStorage.getItem(STORAGE_KEYS.currentProjectId)).toBe('project-1');
    expect(localStorage.getItem(`${STORAGE_KEYS.presetCapsulesPrefix}outline`)).toBe('[{"id":"1"}]');
    expect(localStorage.getItem(STORAGE_KEYS.availableExtraFields)).toBe('["视觉元素"]');
    expect(sessionStorage.getItem(STORAGE_KEYS.settingsSnapshot)).toBe('{"description_generation_mode":"streaming"}');
  });

  it('does not overwrite existing is2ppt keys', () => {
    localStorage.setItem(LEGACY_STORAGE_KEYS.currentProjectId, 'old-project');
    localStorage.setItem(STORAGE_KEYS.currentProjectId, 'new-project');

    migrateAppStorage();

    expect(localStorage.getItem(STORAGE_KEYS.currentProjectId)).toBe('new-project');
    expect(localStorage.getItem(LEGACY_STORAGE_KEYS.currentProjectId)).toBe('old-project');
  });
});
