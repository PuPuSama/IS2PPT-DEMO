import type { PageDto, PageStatusDto } from '../api/pageDto';

export type SlideStatusScope = 'description' | 'image' | 'full';

export type SlideStatusSource = Pick<
  PageDto,
  | 'status'
  | 'description_content'
  | 'generated_image_path'
  | 'generated_image_url'
>;

export interface SlideStatusView {
  status: PageStatusDto;
  labelKey: string;
  descriptionKey: string;
}

const statusMessages: Record<
  PageStatusDto,
  Pick<SlideStatusView, 'labelKey' | 'descriptionKey'>
> = {
  DRAFT: { labelKey: 'status.draft', descriptionKey: 'status.draftStage' },
  GENERATING_DESCRIPTION: {
    labelKey: 'status.generatingDescription',
    descriptionKey: 'status.generatingDescription',
  },
  DESCRIPTION_GENERATED: {
    labelKey: 'status.descriptionGenerated',
    descriptionKey: 'status.descGenerated',
  },
  QUEUED: { labelKey: 'status.queued', descriptionKey: 'status.queuedImage' },
  GENERATING: {
    labelKey: 'status.generating',
    descriptionKey: 'status.generatingImage',
  },
  COMPLETED: { labelKey: 'status.completed', descriptionKey: 'status.allCompleted' },
  FAILED: { labelKey: 'status.failed', descriptionKey: 'status.imageFailed' },
};

const createStatusView = (
  status: PageStatusDto,
  labelKey?: string,
  descriptionKey?: string,
): SlideStatusView => ({
  status,
  labelKey: labelKey ?? statusMessages[status].labelKey,
  descriptionKey: descriptionKey ?? statusMessages[status].descriptionKey,
});

export const getSlideStatusView = (
  slide: SlideStatusSource,
  scope: SlideStatusScope = 'full',
): SlideStatusView => {
  const hasDescription = Boolean(slide.description_content);
  const hasImage = Boolean(slide.generated_image_url || slide.generated_image_path);

  if (scope === 'description') {
    if (slide.status === 'GENERATING_DESCRIPTION') {
      return createStatusView('GENERATING_DESCRIPTION');
    }

    return hasDescription
      ? createStatusView('DESCRIPTION_GENERATED')
      : createStatusView('DRAFT', 'status.notGeneratedDesc', 'status.noDescription');
  }

  if (scope === 'image') {
    if (!hasDescription) {
      return createStatusView('DRAFT', 'status.notGeneratedDesc', 'status.noDescription');
    }
    if (slide.status === 'QUEUED') {
      return createStatusView('QUEUED');
    }
    if (slide.status === 'GENERATING') {
      return createStatusView('GENERATING');
    }
    if (slide.status === 'FAILED') {
      return createStatusView('FAILED');
    }
    if (hasImage || slide.status === 'COMPLETED') {
      return createStatusView('COMPLETED', 'status.completed', 'status.imageCompleted');
    }

    return createStatusView(
      'DESCRIPTION_GENERATED',
      'status.notGeneratedImage',
      'status.waitingForImage',
    );
  }

  return createStatusView(slide.status);
};
