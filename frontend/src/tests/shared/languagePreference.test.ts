import { beforeEach, describe, expect, it } from 'vitest';

import { languagePreference } from '@/shared/storage/languagePreference';

describe('languagePreference', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('reads the saved language', () => {
    localStorage.setItem(languagePreference.storageKey, 'en');

    expect(languagePreference.read()).toBe('en');
  });

  it('maps date locale from the saved language', () => {
    localStorage.setItem(languagePreference.storageKey, 'en');
    expect(languagePreference.getDateLocale()).toBe('en-US');

    localStorage.setItem(languagePreference.storageKey, 'zh-CN');
    expect(languagePreference.getDateLocale()).toBe('zh-CN');
  });

  it('detects Chinese language variants', () => {
    localStorage.setItem(languagePreference.storageKey, 'zh-TW');
    expect(languagePreference.isChinese()).toBe(true);

    localStorage.setItem(languagePreference.storageKey, 'en');
    expect(languagePreference.isChinese()).toBe(false);
  });
});
