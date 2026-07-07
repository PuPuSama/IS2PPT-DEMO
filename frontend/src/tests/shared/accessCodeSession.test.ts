import { beforeEach, describe, expect, it } from 'vitest';

import { ACCESS_CODE_HEADER, accessCodeSession } from '@/shared/auth/accessCodeSession';

describe('accessCodeSession', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('saves and clears access codes', () => {
    accessCodeSession.save('demo-code');

    expect(accessCodeSession.get()).toBe('demo-code');

    accessCodeSession.clear();

    expect(accessCodeSession.get()).toBeNull();
  });

  it('builds auth headers only when a code exists', () => {
    expect(accessCodeSession.getAuthHeaders()).toEqual({});

    accessCodeSession.save('demo-code');

    expect(accessCodeSession.getAuthHeaders()).toEqual({
      [ACCESS_CODE_HEADER]: 'demo-code',
    });
  });
});
