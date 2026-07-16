import { describe, expect, test } from 'vitest';
import type { Page } from '@/types';
import {
  descriptionImageUrls,
  slideMetadataDraftFromSlide,
  slideMetadataPatch,
} from './slideEditSession';

const slide = (overrides: Partial<Page> = {}): Page => ({
  page_id: 'slide-1',
  id: 'slide-1',
  order_index: 0,
  outline_content: {
    title: 'Opening',
    points: ['First point', 'Second point'],
  },
  description_content: {
    title: 'Visual direction',
    text_content: ['Use a clean layout.', '![Reference](https://cdn.example.com/ref.png)'],
  },
  status: 'COMPLETED',
  ...overrides,
});

describe('slideEditSession', () => {
  test('creates a metadata draft from both supported description shapes', () => {
    expect(slideMetadataDraftFromSlide(slide())).toEqual({
      title: 'Opening',
      pointsText: 'First point\nSecond point',
      descriptionText: 'Use a clean layout.\n![Reference](https://cdn.example.com/ref.png)',
    });
  });

  test('returns only changed metadata and normalizes outline points', () => {
    expect(slideMetadataPatch(slide(), {
      title: 'Opening revised',
      pointsText: ' First point \n\n New point ',
      descriptionText: 'Use a clean layout.\n![Reference](https://cdn.example.com/ref.png)',
    })).toEqual({
      outline_content: {
        title: 'Opening revised',
        points: ['First point', 'New point'],
      },
    });
  });

  test('ignores non-web image references in description markdown', () => {
    expect(descriptionImageUrls({
      text: [
        '![Remote](https://cdn.example.com/remote.png)',
        '![Local](/uploads/local.png)',
        '![Data](data:image/png;base64,abc)',
        '![HTTP](http://cdn.example.com/plain.png)',
      ].join('\n'),
    })).toEqual([
      'https://cdn.example.com/remote.png',
      'http://cdn.example.com/plain.png',
    ]);
  });
});
