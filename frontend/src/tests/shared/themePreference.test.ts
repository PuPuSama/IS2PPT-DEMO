import { beforeEach, describe, expect, it } from 'vitest';

import { themePreference } from '@/shared/storage/themePreference';
import { STORAGE_KEYS } from '@/shared/storage/storageKeys';

describe('themePreference', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('defaults to system when no theme is saved', () => {
    expect(themePreference.read()).toBe('system');
  });

  it('saves the selected theme', () => {
    themePreference.save('dark');

    expect(themePreference.read()).toBe('dark');
  });

  it('ignores invalid saved theme values', () => {
    localStorage.setItem(STORAGE_KEYS.theme, 'blue');

    expect(themePreference.read()).toBe('system');
  });
});
