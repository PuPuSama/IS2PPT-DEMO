import { describe, expect, test } from 'vitest';
import { deckWorkspaceErrorDetail } from './deckWorkspaceError';

describe('deckWorkspaceErrorDetail', () => {
  test('prefers a nested API error message', () => {
    expect(deckWorkspaceErrorDetail({
      message: 'request failed',
      response: {
        data: {
          error: { message: 'backend detail' },
          message: 'response detail',
        },
      },
    }, 'fallback')).toBe('backend detail');
  });

  test('supports string API errors and regular errors', () => {
    expect(deckWorkspaceErrorDetail({
      response: { data: { error: 'string detail' } },
    }, 'fallback')).toBe('string detail');
    expect(deckWorkspaceErrorDetail(new Error('runtime detail'), 'fallback'))
      .toBe('runtime detail');
  });

  test('uses the caller fallback for unknown failures', () => {
    expect(deckWorkspaceErrorDetail(null, 'fallback')).toBe('fallback');
  });
});
