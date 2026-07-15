import type {
  ProjectDto,
  ProjectStatusDto,
  ProjectUpdateDto,
} from '../api/projectDto';
import { pageDtoToSlide } from '@/entities/slide/model/slideMapper';
import type { Deck, DeckStatus, DeckUpdate } from './types';

const statusFromDto: Record<ProjectStatusDto, DeckStatus> = {
  DRAFT: 'draft',
  OUTLINE_GENERATED: 'outlined',
  DESCRIPTIONS_GENERATED: 'specified',
  COMPLETED: 'ready',
};

const statusToDto: Record<DeckStatus, ProjectStatusDto> = {
  draft: 'DRAFT',
  outlined: 'OUTLINE_GENERATED',
  specified: 'DESCRIPTIONS_GENERATED',
  ready: 'COMPLETED',
};

export const projectDtoToDeck = (project: ProjectDto): Deck => {
  const id = project.project_id || project.id;
  if (!id) {
    throw new Error('Project DTO is missing project_id');
  }

  return {
    id,
    title: project.project_title,
    source: {
      kind: project.creation_type,
      ideaPrompt: project.idea_prompt,
      outlineText: project.outline_text,
      descriptionText: project.description_text,
    },
    requirements: {
      general: project.extra_requirements,
      outline: project.outline_requirements,
      description: project.description_requirements,
      webResearch: project.enable_web_research ?? false,
    },
    template: {
      imageUrl: project.template_image_url || project.template_image_path,
      style: project.template_style,
    },
    exportOptions: {
      allowPartial: project.export_allow_partial ?? false,
    },
    aspectRatio: project.image_aspect_ratio,
    generationMode: project.generation_mode,
    svgReasoningEffort: project.svg_reasoning_effort,
    status: statusFromDto[project.status] ?? 'draft',
    slides: (project.pages || []).map(pageDtoToSlide),
    createdAt: project.created_at,
    updatedAt: project.updated_at,
  };
};

export const deckToProjectUpdateDto = (deck: DeckUpdate): ProjectUpdateDto => {
  const update: ProjectUpdateDto = {};

  if (deck.title !== undefined) update.project_title = deck.title;
  if (deck.source?.kind !== undefined) update.creation_type = deck.source.kind;
  if (deck.source?.ideaPrompt !== undefined) update.idea_prompt = deck.source.ideaPrompt;
  if (deck.source?.outlineText !== undefined) update.outline_text = deck.source.outlineText;
  if (deck.source?.descriptionText !== undefined) {
    update.description_text = deck.source.descriptionText;
  }
  if (deck.requirements?.general !== undefined) {
    update.extra_requirements = deck.requirements.general;
  }
  if (deck.requirements?.outline !== undefined) {
    update.outline_requirements = deck.requirements.outline;
  }
  if (deck.requirements?.description !== undefined) {
    update.description_requirements = deck.requirements.description;
  }
  if (deck.requirements?.webResearch !== undefined) {
    update.enable_web_research = deck.requirements.webResearch;
  }
  if (deck.template?.imageUrl !== undefined) update.template_image_url = deck.template.imageUrl;
  if (deck.template?.style !== undefined) update.template_style = deck.template.style;
  if (deck.exportOptions?.allowPartial !== undefined) {
    update.export_allow_partial = deck.exportOptions.allowPartial;
  }
  if (deck.aspectRatio !== undefined) update.image_aspect_ratio = deck.aspectRatio;
  if (deck.generationMode !== undefined) update.generation_mode = deck.generationMode;
  if (deck.svgReasoningEffort !== undefined) {
    update.svg_reasoning_effort = deck.svgReasoningEffort;
  }
  if (deck.status !== undefined) update.status = statusToDto[deck.status];

  return update;
};
