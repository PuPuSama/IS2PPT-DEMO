import type { Deck } from './types';

export type DeckProgress = 'not-started' | 'needs-description' | 'needs-images' | 'complete';

export const getDeckDisplayTitle = (deck: Deck, fallback: string): string => {
  if (deck.title?.trim()) return deck.title.trim();

  const firstSlideTitle = [...deck.slides]
    .sort((left, right) => left.position - right.position)
    .find((slide) => slide.outline?.title.trim())
    ?.outline?.title.trim();
  if (firstSlideTitle) return firstSlideTitle;

  const sourceTitle = [
    deck.source.ideaPrompt,
    deck.source.outlineText,
    deck.source.descriptionText,
  ]
    .find((value) => value?.trim())
    ?.trim();

  return sourceTitle?.replace(/\s+/g, ' ') || fallback;
};

export const getDeckProgress = (deck: Deck): DeckProgress => {
  if (deck.slides.length === 0) return 'not-started';
  if (deck.slides.some((slide) => slide.imageUrl)) return 'complete';
  if (deck.slides.some((slide) => slide.description)) return 'needs-images';
  return 'needs-description';
};

export const getDeckCoverImage = (deck: Deck): string | null =>
  deck.slides.find((slide) => slide.imageUrl)?.imageUrl || null;

export const getDeckRoute = (deck: Deck): string => {
  if (deck.slides.some((slide) => slide.imageUrl)) {
    return `/project/${deck.id}/preview`;
  }
  if (deck.slides.some((slide) => slide.description)) {
    return `/project/${deck.id}/detail`;
  }
  return `/project/${deck.id}/outline`;
};
