import { describe, expect, test } from 'vitest';
import type { Page as LegacySlide } from '@/types';
import {
  deckWorkspaceSnapshotFromProject,
  exportRangeFromWorkspace,
  exportSelectionFromWorkspace,
} from './deckWorkspaceSnapshot';

const slide = (id: string, hasImage: boolean): LegacySlide => ({
  id,
  page_id: id,
  generated_image_path: hasImage ? `/slides/${id}.png` : undefined,
} as LegacySlide);

describe('deck workspace snapshot', () => {
  test('normalizes project settings and image-ready slides', () => {
    expect(deckWorkspaceSnapshotFromProject({
      id: 'deck-1',
      generation_mode: 'svg',
      image_aspect_ratio: '4:3',
      extra_requirements: 'Use diagrams',
      template_style: 'Editorial',
      template_image_path: '/templates/deck.pptx',
      export_allow_partial: true,
      pages: [slide('slide-1', true), slide('slide-2', false)],
    })).toMatchObject({
      deckId: 'deck-1',
      renderMode: 'svg',
      aspectRatio: '4:3',
      extraRequirements: 'Use diagrams',
      templateStyle: 'Editorial',
      hasTemplateAsset: true,
      allowPartialExport: true,
      hasImages: true,
      slidesWithImages: [expect.objectContaining({ id: 'slide-1' })],
    });
  });

  test('computes export readiness for a selected subset', () => {
    const workspace = deckWorkspaceSnapshotFromProject({
      pages: [slide('slide-1', true), slide('slide-2', false)],
    });
    expect(workspace).not.toBeNull();
    expect(exportSelectionFromWorkspace(workspace!, new Set(['slide-1']), true)).toMatchObject({
      ready: true,
      missingImageCount: 0,
      slides: [expect.objectContaining({ id: 'slide-1' })],
    });
    expect(exportSelectionFromWorkspace(workspace!, new Set(), false)).toMatchObject({
      ready: false,
      missingImageCount: 1,
    });
  });

  test('preserves deck order when describing a partial export range', () => {
    const workspace = deckWorkspaceSnapshotFromProject({
      pages: [slide('slide-1', true), slide('slide-2', true), slide('slide-3', true)],
    });
    expect(exportRangeFromWorkspace(
      workspace!,
      new Set(['slide-3', 'slide-1']),
      true,
    )).toEqual({
      partial: true,
      totalSlideCount: 3,
      selectedSlideNumbers: [1, 3],
    });
  });
});
