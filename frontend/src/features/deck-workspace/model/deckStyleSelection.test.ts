import { describe, expect, test } from 'vitest';
import { deckStyleSelectionForTemplate } from './deckStyleSelection';

describe('deckStyleSelectionForTemplate', () => {
  test('classifies short numeric identifiers as preset templates', () => {
    expect(deckStyleSelectionForTemplate('12')).toEqual({
      libraryTemplateId: null,
      presetTemplateId: '12',
    });
  });

  test('classifies stable resource identifiers as library templates', () => {
    expect(deckStyleSelectionForTemplate('template-2026')).toEqual({
      libraryTemplateId: 'template-2026',
      presetTemplateId: null,
    });
  });
});
