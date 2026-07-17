import { describe, expect, it } from 'vitest';
import type { SlideStatusSource } from './slideStatus';
import { getSlideStatusView } from './slideStatus';

const makeSlide = (
  overrides: Partial<SlideStatusSource> = {},
): SlideStatusSource => ({
  status: 'DRAFT',
  ...overrides,
});

describe('getSlideStatusView', () => {
  it('shows missing description in the description scope', () => {
    expect(getSlideStatusView(makeSlide(), 'description')).toEqual({
      status: 'DRAFT',
      labelKey: 'status.notGeneratedDesc',
      descriptionKey: 'status.noDescription',
    });
  });

  it('treats an existing description as ready in the description scope', () => {
    const view = getSlideStatusView(
      makeSlide({
        status: 'COMPLETED',
        description_content: { text: 'ready' },
      }),
      'description',
    );

    expect(view.status).toBe('DESCRIPTION_GENERATED');
  });

  it('keeps queued and rendering states in the image scope', () => {
    const base = makeSlide({ description_content: { text: 'ready' } });

    expect(getSlideStatusView({ ...base, status: 'QUEUED' }, 'image').status).toBe('QUEUED');
    expect(getSlideStatusView({ ...base, status: 'GENERATING' }, 'image').status).toBe('GENERATING');
  });

  it('reports a failed render even when no image was produced', () => {
    const view = getSlideStatusView(
      makeSlide({
        status: 'FAILED',
        description_content: { text: 'ready' },
      }),
      'image',
    );

    expect(view).toEqual({
      status: 'FAILED',
      labelKey: 'status.failed',
      descriptionKey: 'status.imageFailed',
    });
  });

  it('uses the source status in the full scope', () => {
    expect(getSlideStatusView(makeSlide({ status: 'COMPLETED' }))).toEqual({
      status: 'COMPLETED',
      labelKey: 'status.completed',
      descriptionKey: 'status.allCompleted',
    });
  });
});
