import { describe, expect, test } from 'vitest';
import type { Page as LegacySlide } from '@/types';
import {
  markSlideSpecGenerating,
  slideIdentity,
  slideSpecSnapshotFromProject,
} from './slideSpecSnapshot';

const slide = (id: string, description?: string): LegacySlide => ({
  id,
  page_id: id,
  description_content: description ? { text: description } : undefined,
} as LegacySlide);

describe('slide spec snapshot', () => {
  test('normalizes legacy deck fields and computes completion', () => {
    expect(slideSpecSnapshotFromProject({
      id: 'deck-1',
      creation_type: 'ppt_renovation',
      description_requirements: 'Use concise visual direction',
      enable_web_research: true,
      generation_mode: 'svg',
      svg_reasoning_effort: 'xhigh',
      pages: [slide('slide-1', 'Ready'), slide('slide-2')],
    })).toMatchObject({
      deckId: 'deck-1',
      requirements: 'Use concise visual direction',
      webResearchEnabled: true,
      renderMode: 'svg',
      svgReasoningEffort: 'xhigh',
      sourceDeckMode: true,
      completedSlideCount: 1,
      missingSlideCount: 1,
      hasAnySpec: true,
      isComplete: false,
    });
  });

  test('keeps legacy identity and processing status behind helpers', () => {
    const pending = slide('slide-2');
    expect(slideIdentity(pending)).toBe('slide-2');
    expect(markSlideSpecGenerating(pending, true).status).toBe('GENERATING_DESCRIPTION');
    expect(markSlideSpecGenerating(slide('slide-1', 'Ready'), true).status).not.toBe('GENERATING_DESCRIPTION');
  });
});
