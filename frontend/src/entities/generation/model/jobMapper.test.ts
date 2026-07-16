import { describe, expect, test } from 'vitest';
import { generationProgressFromDto } from './jobMapper';

describe('generationProgressFromDto', () => {
  test('maps backend progress names into the generation domain', () => {
    expect(generationProgressFromDto({
      total: 8,
      completed: 3,
      failed: 1,
      percent: 37.5,
      current_step: 'Rendering slides',
      messages: ['Queued', 'Rendering'],
      warning_message: 'One slide was skipped',
    })).toEqual({
      total: 8,
      completed: 3,
      failed: 1,
      percent: 37.5,
      currentStep: 'Rendering slides',
      messages: ['Queued', 'Rendering'],
    });
  });
});
