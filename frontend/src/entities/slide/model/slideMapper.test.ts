import { describe, expect, test } from 'vitest';
import type { PageDto } from '../api/pageDto';
import { pageDtoToSlide, slideToPageUpdateDto } from './slideMapper';

const pageDto: PageDto = {
  page_id: 'slide-02',
  order_index: 1,
  part: 'Analysis',
  outline_content: { title: 'Market', points: ['Large', 'Growing'] },
  description_content: {
    text: 'Show market growth',
    extra_fields: { visual: 'line chart' },
  },
  generated_image_path: '/files/slide-02.png',
  status: 'DESCRIPTION_GENERATED',
};

describe('slide DTO mapping', () => {
  test('normalizes page aliases into a slide', () => {
    expect(pageDtoToSlide(pageDto)).toMatchObject({
      id: 'slide-02',
      position: 1,
      section: 'Analysis',
      imageUrl: '/files/slide-02.png',
      status: 'description-ready',
      description: {
        format: 'text',
        text: 'Show market growth',
        extraFields: { visual: 'line chart' },
      },
    });
  });

  test('maps a slide patch back to the backend update contract', () => {
    expect(slideToPageUpdateDto({
      position: 2,
      status: 'rendering',
      description: {
        format: 'structured',
        title: 'Market',
        textContent: ['Growing quickly'],
      },
    })).toEqual({
      order_index: 2,
      status: 'GENERATING',
      description_content: {
        title: 'Market',
        text_content: ['Growing quickly'],
        extra_fields: undefined,
        layout_suggestion: undefined,
      },
    });
  });
});
