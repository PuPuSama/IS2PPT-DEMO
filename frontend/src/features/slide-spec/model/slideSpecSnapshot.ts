import type { Page as LegacySlide, SvgReasoningEffort } from '@/types';

export type SlideRenderMode = 'image' | 'svg';

interface LegacyDeckSnapshot {
  id?: string;
  pages?: LegacySlide[];
  creation_type?: string;
  description_requirements?: string;
  enable_web_research?: boolean;
  generation_mode?: string;
  svg_reasoning_effort?: SvgReasoningEffort;
}

export interface SlideSpecSnapshot {
  deckId?: string;
  slides: LegacySlide[];
  requirements: string;
  webResearchEnabled: boolean;
  renderMode: SlideRenderMode;
  svgReasoningEffort: SvgReasoningEffort;
  sourceDeckMode: boolean;
  completedSlideCount: number;
  missingSlideCount: number;
  hasAnySpec: boolean;
  isComplete: boolean;
}

export const slideHasSpec = (slide: LegacySlide): boolean => Boolean(slide.description_content);

export const slideHasSpecText = (slide: LegacySlide): boolean => {
  const content = slide.description_content;
  return Boolean(
    content
    && typeof content === 'object'
    && 'text' in content
    && content.text?.trim(),
  );
};

export const slideIdentity = (slide: LegacySlide): string | undefined => (
  slide.id || slide.page_id
);

export const markSlideSpecGenerating = (
  slide: LegacySlide,
  sourceDeckProcessing: boolean,
): LegacySlide => (
  sourceDeckProcessing && !slideHasSpecText(slide)
    ? { ...slide, status: 'GENERATING_DESCRIPTION' }
    : slide
);

export const slideSpecSnapshotFromProject = (
  deck: LegacyDeckSnapshot | null,
): SlideSpecSnapshot | null => {
  if (!deck) return null;
  const slides = deck.pages || [];
  const completedSlideCount = slides.filter(slideHasSpec).length;
  return {
    deckId: deck.id,
    slides,
    requirements: deck.description_requirements || '',
    webResearchEnabled: Boolean(deck.enable_web_research),
    renderMode: deck.generation_mode === 'svg' ? 'svg' : 'image',
    svgReasoningEffort: deck.svg_reasoning_effort || 'high',
    sourceDeckMode: deck.creation_type === 'ppt_renovation',
    completedSlideCount,
    missingSlideCount: slides.length - completedSlideCount,
    hasAnySpec: completedSlideCount > 0,
    isComplete: completedSlideCount === slides.length,
  };
};
