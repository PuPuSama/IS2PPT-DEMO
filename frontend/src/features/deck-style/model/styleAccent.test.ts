import { describe, expect, test } from 'vitest';
import { STYLE_ACCENT_PALETTE, styleAccentFor } from './styleAccent';

describe('styleAccentFor', () => {
  test('returns a stable palette color for the same description', () => {
    expect(styleAccentFor('Editorial report')).toBe(styleAccentFor(' editorial report '));
  });

  test('always returns a supported accent color', () => {
    expect(STYLE_ACCENT_PALETTE).toContain(styleAccentFor('Product launch'));
  });
});
