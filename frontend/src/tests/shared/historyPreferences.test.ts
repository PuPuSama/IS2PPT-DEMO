import { beforeEach, describe, expect, it } from 'vitest';

import { DEFAULT_HISTORY_PAGE_SIZE, historyPreferences } from '@/shared/storage/historyPreferences';
import { STORAGE_KEYS } from '@/shared/storage/storageKeys';

describe('historyPreferences', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('defaults the page size', () => {
    expect(historyPreferences.readPageSize()).toBe(DEFAULT_HISTORY_PAGE_SIZE);
  });

  it('saves the selected page size', () => {
    historyPreferences.savePageSize(20);

    expect(historyPreferences.readPageSize()).toBe(20);
  });

  it('ignores invalid page size values', () => {
    localStorage.setItem(STORAGE_KEYS.historyPageSize, 'not-a-number');

    expect(historyPreferences.readPageSize()).toBe(DEFAULT_HISTORY_PAGE_SIZE);
  });
});
