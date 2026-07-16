import type { Page as LegacySlide } from '@/types';

export type WorkspaceRenderMode = 'image' | 'svg';

interface LegacyWorkspaceProject {
  id?: string;
  pages?: LegacySlide[];
  generation_mode?: string;
  image_aspect_ratio?: string;
  extra_requirements?: string;
  template_style?: string;
  template_image_path?: string;
  updated_at?: string;
  export_allow_partial?: boolean;
}

export interface DeckWorkspaceSnapshot {
  deckId?: string;
  slides: LegacySlide[];
  slidesWithImages: LegacySlide[];
  renderMode: WorkspaceRenderMode;
  aspectRatio: string;
  extraRequirements: string;
  templateStyle: string;
  hasTemplateAsset: boolean;
  templateAssetPath?: string;
  updatedAt?: string;
  allowPartialExport: boolean;
  hasImages: boolean;
}

export interface ExportSelectionSnapshot {
  slides: LegacySlide[];
  ready: boolean;
  missingImageCount: number;
}

export interface ExportRangeSnapshot {
  partial: boolean;
  totalSlideCount: number;
  selectedSlideNumbers: number[];
}

export const deckWorkspaceSnapshotFromProject = (
  project: LegacyWorkspaceProject | null,
): DeckWorkspaceSnapshot | null => {
  if (!project) return null;
  const slides = project.pages || [];
  const slidesWithImages = slides.filter((slide) => Boolean(slide.id && slide.generated_image_path));
  return {
    deckId: project.id,
    slides,
    slidesWithImages,
    renderMode: project.generation_mode === 'svg' ? 'svg' : 'image',
    aspectRatio: project.image_aspect_ratio || '16:9',
    extraRequirements: project.extra_requirements || '',
    templateStyle: project.template_style || '',
    hasTemplateAsset: Boolean(project.template_image_path),
    templateAssetPath: project.template_image_path,
    updatedAt: project.updated_at,
    allowPartialExport: Boolean(project.export_allow_partial),
    hasImages: slides.some((slide) => Boolean(slide.generated_image_path)),
  };
};

export const exportSelectionFromWorkspace = (
  workspace: DeckWorkspaceSnapshot,
  selectedSlideIds: Set<string>,
  multiSelectEnabled: boolean,
): ExportSelectionSnapshot => {
  const slides = multiSelectEnabled && selectedSlideIds.size > 0
    ? workspace.slides.filter((slide) => Boolean(slide.id && selectedSlideIds.has(slide.id)))
    : workspace.slides;
  const missingImageCount = slides.filter((slide) => !slide.generated_image_path).length;
  return {
    slides,
    ready: missingImageCount === 0,
    missingImageCount,
  };
};

export const exportRangeFromWorkspace = (
  workspace: DeckWorkspaceSnapshot,
  selectedSlideIds: Set<string>,
  multiSelectEnabled: boolean,
): ExportRangeSnapshot => {
  const partial = multiSelectEnabled && selectedSlideIds.size > 0;
  return {
    partial,
    totalSlideCount: workspace.slides.length,
    selectedSlideNumbers: partial
      ? workspace.slides
          .map((slide, index) => ({ id: slide.id, number: index + 1 }))
          .filter(({ id }) => Boolean(id && selectedSlideIds.has(id)))
          .map(({ number }) => number)
      : [],
  };
};
