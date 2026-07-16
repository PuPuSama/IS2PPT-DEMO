import type { DescriptionContent, Page } from '@/types';

export interface SlideMetadataDraft {
  title: string;
  pointsText: string;
  descriptionText: string;
}

export interface SlideReferenceSelection {
  useTemplate: boolean;
  descriptionImageUrls: string[];
  uploadedFiles: File[];
}

export interface SlideEditSession {
  instruction: string;
  references: SlideReferenceSelection;
}

export const emptySlideEditSession = (): SlideEditSession => ({
  instruction: '',
  references: {
    useTemplate: false,
    descriptionImageUrls: [],
    uploadedFiles: [],
  },
});

export const cloneSlideEditSession = (session: SlideEditSession): SlideEditSession => ({
  instruction: session.instruction,
  references: {
    useTemplate: session.references.useTemplate,
    descriptionImageUrls: [...session.references.descriptionImageUrls],
    uploadedFiles: [...session.references.uploadedFiles],
  },
});

export const descriptionTextFromContent = (
  description: DescriptionContent | undefined,
): string => {
  if (!description) return '';
  if ('text' in description) return description.text;
  return description.text_content.join('\n');
};

export const slideMetadataDraftFromSlide = (slide: Page): SlideMetadataDraft => ({
  title: slide.outline_content?.title ?? '',
  pointsText: slide.outline_content?.points?.join('\n') ?? '',
  descriptionText: descriptionTextFromContent(slide.description_content),
});

export const slideMetadataPatch = (
  slide: Page,
  draft: SlideMetadataDraft,
): Partial<Page> => {
  const patch: Partial<Page> = {};
  const original = slideMetadataDraftFromSlide(slide);

  if (draft.title !== original.title || draft.pointsText !== original.pointsText) {
    patch.outline_content = {
      title: draft.title,
      points: draft.pointsText
        .split('\n')
        .map((point) => point.trim())
        .filter(Boolean),
    };
  }

  if (draft.descriptionText !== original.descriptionText) {
    patch.description_content = { text: draft.descriptionText };
  }

  return patch;
};

export const descriptionImageUrls = (
  description: DescriptionContent | undefined,
): string[] => {
  const text = descriptionTextFromContent(description);
  const urls: string[] = [];
  const markdownImagePattern = /!\[.*?\]\((.*?)\)/g;
  let match: RegExpExecArray | null;

  while ((match = markdownImagePattern.exec(text)) !== null) {
    const url = match[1]?.trim();
    if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
      urls.push(url);
    }
  }

  return urls;
};
