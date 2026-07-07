import { beforeEach, describe, expect, it } from 'vitest';

import { uiDismissals } from '@/shared/storage/uiDismissals';

describe('uiDismissals', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('defaults to showing one-time UI prompts', () => {
    expect(uiDismissals.hasSeenHomeHelp()).toBe(false);
    expect(uiDismissals.shouldSkipLowResolutionWarning()).toBe(false);
  });

  it('tracks home help dismissal', () => {
    uiDismissals.markHomeHelpSeen();

    expect(uiDismissals.hasSeenHomeHelp()).toBe(true);
  });

  it('tracks low resolution warning dismissal', () => {
    uiDismissals.skipLowResolutionWarning();

    expect(uiDismissals.shouldSkipLowResolutionWarning()).toBe(true);
  });
});
