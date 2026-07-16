import type { Page as LegacySlide } from '@/types';

export type DeckPlanSource = 'idea' | 'outline' | 'description' | 'source-deck';

interface DeckSourceSnapshot {
  id?: string;
  creation_type?: string;
  idea_prompt?: string;
  outline_text?: string;
  description_text?: string;
  outline_requirements?: string;
  enable_web_research?: boolean;
  pages?: LegacySlide[];
}

export interface DeckPlanSnapshot {
  deckId?: string;
  source: DeckPlanSource;
  sourceText: string;
  requirements: string;
  webResearchEnabled: boolean;
  slides: LegacySlide[];
}

export const deckPlanSourceFromType = (creationType?: string): DeckPlanSource => {
  if (creationType === 'outline') return 'outline';
  if (creationType === 'descriptions') return 'description';
  if (creationType === 'ppt_renovation') return 'source-deck';
  return 'idea';
};

export const sourceTextFromDeck = (deck: DeckSourceSnapshot | null): string => {
  if (!deck) return '';
  const source = deckPlanSourceFromType(deck.creation_type);
  if (source === 'outline' || source === 'source-deck') {
    return deck.outline_text || deck.idea_prompt || '';
  }
  if (source === 'description') {
    return deck.description_text || deck.idea_prompt || '';
  }
  return deck.idea_prompt || '';
};

export const deckPlanSnapshotFromProject = (
  deck: DeckSourceSnapshot | null,
): DeckPlanSnapshot | null => {
  if (!deck) return null;
  return {
    deckId: deck.id,
    source: deckPlanSourceFromType(deck.creation_type),
    sourceText: sourceTextFromDeck(deck),
    requirements: deck.outline_requirements || '',
    webResearchEnabled: Boolean(deck.enable_web_research),
    slides: deck.pages || [],
  };
};
