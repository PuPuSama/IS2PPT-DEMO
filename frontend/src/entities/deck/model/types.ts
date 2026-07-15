import type { Slide } from '@/entities/slide/model/types';

export type DeckStatus = 'draft' | 'outlined' | 'specified' | 'ready';
export type DeckGenerationMode = 'image' | 'svg';
export type DeckReasoningEffort = 'low' | 'medium' | 'high' | 'xhigh';

export interface DeckSource {
  kind?: string;
  ideaPrompt: string;
  outlineText?: string;
  descriptionText?: string;
}

export interface DeckRequirements {
  general?: string;
  outline?: string;
  description?: string;
  webResearch: boolean;
}

export interface DeckTemplate {
  imageUrl?: string;
  style?: string;
}

export interface DeckExportOptions {
  allowPartial: boolean;
}

export interface Deck {
  id: string;
  title?: string;
  source: DeckSource;
  requirements: DeckRequirements;
  template: DeckTemplate;
  exportOptions: DeckExportOptions;
  aspectRatio?: string;
  generationMode?: DeckGenerationMode;
  svgReasoningEffort?: DeckReasoningEffort;
  status: DeckStatus;
  slides: Slide[];
  createdAt: string;
  updatedAt: string;
}

export type DeckUpdate = Omit<
  Partial<Deck>,
  'source' | 'requirements' | 'template' | 'exportOptions'
> & {
  source?: Partial<DeckSource>;
  requirements?: Partial<DeckRequirements>;
  template?: Partial<DeckTemplate>;
  exportOptions?: Partial<DeckExportOptions>;
};
