import type {
  DescriptionContentDto,
  ImageVersionDto,
  PageDto,
  PageStatusDto,
  PageUpdateDto,
} from '../api/pageDto';
import type {
  Slide,
  SlideDescription,
  SlideImageVersion,
  SlideStatus,
  SlideUpdate,
} from './types';

const statusFromDto: Record<PageStatusDto, SlideStatus> = {
  DRAFT: 'draft',
  GENERATING_DESCRIPTION: 'writing-description',
  DESCRIPTION_GENERATED: 'description-ready',
  QUEUED: 'queued',
  GENERATING: 'rendering',
  COMPLETED: 'ready',
  FAILED: 'failed',
};

const statusToDto: Record<SlideStatus, PageStatusDto> = {
  draft: 'DRAFT',
  'writing-description': 'GENERATING_DESCRIPTION',
  'description-ready': 'DESCRIPTION_GENERATED',
  queued: 'QUEUED',
  rendering: 'GENERATING',
  ready: 'COMPLETED',
  failed: 'FAILED',
};

const descriptionFromDto = (description: DescriptionContentDto): SlideDescription => {
  if ('text' in description) {
    return {
      format: 'text',
      text: description.text,
      extraFields: description.extra_fields,
      layoutSuggestion: description.layout_suggestion,
    };
  }

  return {
    format: 'structured',
    title: description.title,
    textContent: [...description.text_content],
    extraFields: description.extra_fields,
    layoutSuggestion: description.layout_suggestion,
  };
};

const descriptionToDto = (description: SlideDescription): DescriptionContentDto => {
  if (description.format === 'text') {
    return {
      text: description.text,
      extra_fields: description.extraFields,
      layout_suggestion: description.layoutSuggestion,
    };
  }

  return {
    title: description.title,
    text_content: [...description.textContent],
    extra_fields: description.extraFields,
    layout_suggestion: description.layoutSuggestion,
  };
};

const imageVersionFromDto = (version: ImageVersionDto): SlideImageVersion => ({
  id: version.version_id,
  slideId: version.page_id,
  assetUrl: version.image_url || version.image_path,
  version: version.version_number,
  isCurrent: version.is_current,
  createdAt: version.created_at,
});

export const pageDtoToSlide = (page: PageDto): Slide => {
  const id = page.page_id || page.id;
  if (!id) {
    throw new Error('Page DTO is missing page_id');
  }

  return {
    id,
    position: page.order_index,
    section: page.part,
    outline: page.outline_content
      ? { title: page.outline_content.title, points: [...page.outline_content.points] }
      : null,
    description: page.description_content
      ? descriptionFromDto(page.description_content)
      : undefined,
    imageUrl: page.generated_image_url || page.generated_image_path,
    svgUrl: page.generated_svg_url,
    status: statusFromDto[page.status] ?? 'draft',
    createdAt: page.created_at,
    updatedAt: page.updated_at,
    imageVersions: page.image_versions?.map(imageVersionFromDto),
  };
};

export const slideToPageUpdateDto = (slide: Partial<Slide>): PageUpdateDto => {
  const update: PageUpdateDto = {};

  if (slide.position !== undefined) update.order_index = slide.position;
  if (slide.section !== undefined) update.part = slide.section;
  if (slide.outline !== undefined) {
    update.outline_content = slide.outline
      ? { title: slide.outline.title, points: [...slide.outline.points] }
      : null;
  }
  if (slide.description !== undefined) {
    update.description_content = descriptionToDto(slide.description);
  }
  if (slide.imageUrl !== undefined) update.generated_image_url = slide.imageUrl;
  if (slide.svgUrl !== undefined) update.generated_svg_url = slide.svgUrl;
  if (slide.status !== undefined) update.status = statusToDto[slide.status];

  return update;
};

export const pageUpdateDtoToSlideUpdate = (page: PageUpdateDto): SlideUpdate => {
  const update: SlideUpdate = {};

  if (page.order_index !== undefined) update.position = page.order_index;
  if (page.part !== undefined) update.section = page.part;
  if (page.outline_content !== undefined) {
    update.outline = page.outline_content
      ? { title: page.outline_content.title, points: [...page.outline_content.points] }
      : null;
  }
  if (page.description_content !== undefined) {
    update.description = descriptionFromDto(page.description_content);
  }
  if (page.generated_image_url !== undefined || page.generated_image_path !== undefined) {
    update.imageUrl = page.generated_image_url || page.generated_image_path;
  }
  if (page.generated_svg_url !== undefined) update.svgUrl = page.generated_svg_url;
  if (page.status !== undefined) update.status = statusFromDto[page.status] ?? 'draft';

  return update;
};
