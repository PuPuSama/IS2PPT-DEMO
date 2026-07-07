import { beforeEach, describe, expect, it } from 'vitest';

import { detailGenerationPreferences } from '@/shared/storage/detailGenerationPreferences';
import { STORAGE_KEYS } from '@/shared/storage/storageKeys';

describe('detailGenerationPreferences', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('returns null when no detail level is cached', () => {
    expect(detailGenerationPreferences.readDetailLevel()).toBeNull();
  });

  it('reads the cached detail level', () => {
    sessionStorage.setItem(STORAGE_KEYS.detailLevel, 'detailed');

    expect(detailGenerationPreferences.readDetailLevel()).toBe('detailed');
  });
});
