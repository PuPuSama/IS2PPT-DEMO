export type SlideStatus =
  | 'draft'
  | 'writing-description'
  | 'description-ready'
  | 'queued'
  | 'rendering'
  | 'ready'
  | 'failed';

export interface SlideOutline {
  title: string;
  points: string[];
}

export type SlideDescription =
  | {
      format: 'text';
      text: string;
      extraFields?: Record<string, string>;
      layoutSuggestion?: string;
    }
  | {
      format: 'structured';
      title: string;
      textContent: string[];
      extraFields?: Record<string, string>;
      layoutSuggestion?: string;
    };

export interface SlideImageVersion {
  id: string;
  slideId: string;
  assetUrl: string;
  version: number;
  isCurrent: boolean;
  createdAt?: string;
}

export interface Slide {
  id: string;
  position: number;
  section?: string;
  outline: SlideOutline | null;
  description?: SlideDescription;
  imageUrl?: string;
  svgUrl?: string;
  status: SlideStatus;
  createdAt?: string;
  updatedAt?: string;
  imageVersions?: SlideImageVersion[];
}

export type SlideUpdate = Partial<Slide>;
