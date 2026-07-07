import { beforeEach, describe, expect, it } from 'vitest';

import {
  extraFieldCatalog,
  getDefaultDescriptionFields,
} from '@/shared/storage/extraFieldCatalog';
import { STORAGE_KEYS } from '@/shared/storage/storageKeys';

describe('extraFieldCatalog', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns default fields when no catalog exists', () => {
    expect(extraFieldCatalog.read()).toEqual(getDefaultDescriptionFields());
  });

  it('falls back to defaults for invalid catalog data', () => {
    localStorage.setItem(STORAGE_KEYS.availableExtraFields, '{broken');

    expect(extraFieldCatalog.read()).toEqual(getDefaultDescriptionFields());
  });

  it('saves custom fields', () => {
    extraFieldCatalog.save(['视觉元素', 'Custom']);

    expect(extraFieldCatalog.read()).toEqual(['视觉元素', 'Custom']);
  });

  it('merges fields and keeps the merged catalog', () => {
    const merged = extraFieldCatalog.mergeAndSave(['A', 'B'], ['B', 'C']);

    expect(merged).toEqual(['A', 'B', 'C']);
    expect(extraFieldCatalog.read()).toEqual(['A', 'B', 'C']);
  });
});
