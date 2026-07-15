import { describe, expect, test } from 'vitest';
import type { ProjectDto } from '../api/projectDto';
import {
  getDeckDisplayTitle,
  getDeckProgress,
  getDeckRoute,
} from './deckSelectors';
import { projectDtoToLegacyProject } from './legacyProjectAdapter';
import { deckToProjectUpdateDto, projectDtoToDeck } from './projectMapper';

const projectDto: ProjectDto = {
  project_id: 'deck-01',
  project_title: 'Quarterly Review',
  idea_prompt: 'Summarize the quarter',
  outline_text: 'Growth and risks',
  creation_type: 'outline',
  enable_web_research: true,
  extra_requirements: 'Use concise charts',
  template_image_url: '/files/template.png',
  export_allow_partial: true,
  image_aspect_ratio: '16:9',
  generation_mode: 'svg',
  status: 'DESCRIPTIONS_GENERATED',
  pages: [
    {
      page_id: 'slide-01',
      order_index: 0,
      outline_content: { title: 'Highlights', points: ['Revenue grew'] },
      description_content: {
        title: 'Highlights',
        text_content: ['Revenue grew by 20%'],
        extra_fields: { chart: 'bar' },
      },
      generated_image_url: '/files/slide-01.png',
      status: 'COMPLETED',
      updated_at: '2026-07-15T10:00:00Z',
    },
  ],
  created_at: '2026-07-15T09:00:00Z',
  updated_at: '2026-07-15T10:00:00Z',
};

describe('projectDtoToDeck', () => {
  test('isolates backend field names from the deck domain model', () => {
    const deck = projectDtoToDeck(projectDto);

    expect(deck).toMatchObject({
      id: 'deck-01',
      title: 'Quarterly Review',
      source: {
        kind: 'outline',
        ideaPrompt: 'Summarize the quarter',
        outlineText: 'Growth and risks',
      },
      requirements: {
        general: 'Use concise charts',
        webResearch: true,
      },
      template: { imageUrl: '/files/template.png' },
      exportOptions: { allowPartial: true },
      aspectRatio: '16:9',
      generationMode: 'svg',
      status: 'specified',
    });
    expect(deck.slides[0]).toMatchObject({
      id: 'slide-01',
      position: 0,
      imageUrl: '/files/slide-01.png',
      status: 'ready',
      description: {
        format: 'structured',
        textContent: ['Revenue grew by 20%'],
        extraFields: { chart: 'bar' },
      },
    });
  });

  test('creates a backend update payload only for supplied deck fields', () => {
    expect(deckToProjectUpdateDto({
      title: 'Updated review',
      requirements: { webResearch: false },
      template: { style: 'Minimal editorial' },
    })).toEqual({
      project_title: 'Updated review',
      enable_web_research: false,
      template_style: 'Minimal editorial',
    });
  });
});

describe('legacy project compatibility', () => {
  test('keeps old store aliases outside generic utilities', () => {
    const project = projectDtoToLegacyProject(projectDto);

    expect(project.id).toBe('deck-01');
    expect(project.template_image_path).toBe('/files/template.png');
    expect(project.pages[0].id).toBe('slide-01');
    expect(project.pages[0].generated_image_path).toBe('/files/slide-01.png');
  });
});

describe('deck selectors', () => {
  test('derive history display state without backend DTO field names', () => {
    const deck = projectDtoToDeck(projectDto);

    expect(getDeckDisplayTitle(deck, 'Untitled')).toBe('Quarterly Review');
    expect(getDeckProgress(deck)).toBe('complete');
    expect(getDeckRoute(deck)).toBe('/project/deck-01/preview');
  });
});
