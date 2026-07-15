import { beforeEach, describe, expect, test } from 'vitest';
import type { Slide } from './types';
import { useSlidesStore } from './useSlidesStore';

const slides: Slide[] = [
  {
    id: 'slide-a',
    position: 0,
    outline: { title: 'A', points: [] },
    status: 'draft',
  },
  {
    id: 'slide-b',
    position: 1,
    outline: { title: 'B', points: [] },
    status: 'draft',
  },
];

describe('useSlidesStore', () => {
  beforeEach(() => {
    useSlidesStore.setState({ slides: [] });
  });

  test('replaces and updates slides without backend field names', () => {
    useSlidesStore.getState().replaceSlides(slides);
    useSlidesStore.getState().updateSlide('slide-a', {
      section: 'Intro',
      outline: { title: 'Updated A', points: ['Point'] },
    });

    expect(useSlidesStore.getState().slides[0]).toMatchObject({
      id: 'slide-a',
      section: 'Intro',
      outline: { title: 'Updated A', points: ['Point'] },
    });
  });

  test('reorders slides and recalculates positions', () => {
    useSlidesStore.getState().replaceSlides(slides);
    useSlidesStore.getState().reorderSlides(['slide-b', 'slide-a']);

    expect(useSlidesStore.getState().slides.map(({ id, position }) => ({ id, position }))).toEqual([
      { id: 'slide-b', position: 0 },
      { id: 'slide-a', position: 1 },
    ]);
  });

  test('appends, removes, and clears slides', () => {
    useSlidesStore.getState().appendSlide(slides[0]);
    useSlidesStore.getState().appendSlide(slides[1]);
    useSlidesStore.getState().removeSlide('slide-a');
    expect(useSlidesStore.getState().slides.map((slide) => slide.id)).toEqual(['slide-b']);

    useSlidesStore.getState().clearSlides();
    expect(useSlidesStore.getState().slides).toEqual([]);
  });
});
