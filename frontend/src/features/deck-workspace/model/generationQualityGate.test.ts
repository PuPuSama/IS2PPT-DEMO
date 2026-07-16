import { describe, expect, test } from 'vitest';
import { generationQualityDecision } from './generationQualityGate';

describe('generationQualityDecision', () => {
  test('requires confirmation for 1K generation', () => {
    expect(generationQualityDecision('1K', false)).toBe('confirm-low-resolution');
  });

  test('proceeds when the warning was dismissed or quality is higher', () => {
    expect(generationQualityDecision('1K', true)).toBe('proceed');
    expect(generationQualityDecision('2K', false)).toBe('proceed');
    expect(generationQualityDecision(undefined, false)).toBe('proceed');
  });
});
