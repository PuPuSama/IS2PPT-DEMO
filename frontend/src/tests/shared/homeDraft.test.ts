import { beforeEach, describe, expect, it } from 'vitest';

import { homeDraftStore } from '@/shared/storage/homeDraft';
import { STORAGE_KEYS } from '@/shared/storage/storageKeys';

describe('homeDraftStore', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('returns the default empty draft', () => {
    expect(homeDraftStore.getContent()).toBe('');
    expect(homeDraftStore.getTab()).toBe('idea');
  });

  it('saves and clears draft content', () => {
    homeDraftStore.saveContent('Slide idea');

    expect(homeDraftStore.getContent()).toBe('Slide idea');

    homeDraftStore.saveContent('');

    expect(homeDraftStore.getContent()).toBe('');
    expect(sessionStorage.getItem(STORAGE_KEYS.homeDraftContent)).toBeNull();
  });

  it('ignores invalid saved tabs', () => {
    sessionStorage.setItem(STORAGE_KEYS.homeDraftTab, 'invalid');

    expect(homeDraftStore.getTab()).toBe('idea');
  });

  it('clears the full draft', () => {
    homeDraftStore.saveContent('Outline');
    homeDraftStore.saveTab('outline');

    homeDraftStore.clear();

    expect(homeDraftStore.getContent()).toBe('');
    expect(homeDraftStore.getTab()).toBe('idea');
  });
});
