import { describe, expect, test } from 'vitest';
import {
  deckPlanSnapshotFromProject,
  deckPlanSourceFromType,
  sourceTextFromDeck,
} from './planSource';

describe('deck plan source model', () => {
  test('normalizes backend creation types', () => {
    expect(deckPlanSourceFromType('idea')).toBe('idea');
    expect(deckPlanSourceFromType('outline')).toBe('outline');
    expect(deckPlanSourceFromType('descriptions')).toBe('description');
    expect(deckPlanSourceFromType('ppt_renovation')).toBe('source-deck');
  });

  test('selects the source text without exposing backend fields to the UI', () => {
    expect(sourceTextFromDeck({
      creation_type: 'outline',
      idea_prompt: 'fallback',
      outline_text: 'outline source',
    })).toBe('outline source');
    expect(sourceTextFromDeck({
      creation_type: 'descriptions',
      idea_prompt: 'fallback',
      description_text: 'description source',
    })).toBe('description source');
  });

  test('builds a UI-facing deck plan snapshot', () => {
    const slide = { id: 'slide-1' } as never;
    expect(deckPlanSnapshotFromProject({
      id: 'deck-1',
      creation_type: 'ppt_renovation',
      outline_text: 'Imported source',
      outline_requirements: 'Keep it concise',
      enable_web_research: true,
      pages: [slide],
    })).toEqual({
      deckId: 'deck-1',
      source: 'source-deck',
      sourceText: 'Imported source',
      requirements: 'Keep it concise',
      webResearchEnabled: true,
      slides: [slide],
    });
  });
});
