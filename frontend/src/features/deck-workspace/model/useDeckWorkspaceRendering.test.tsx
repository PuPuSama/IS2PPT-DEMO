import { act, renderHook } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import type { Page } from '@/types';
import type { DeckWorkspaceSnapshot } from './deckWorkspaceSnapshot';
import { useDeckWorkspaceRendering } from './useDeckWorkspaceRendering';

const slide = (id: string, withImage = false): Page => ({
  page_id: id,
  id,
  order_index: Number(id.split('-')[1]),
  outline_content: null,
  generated_image_path: withImage ? `/slides/${id}.png` : undefined,
  status: withImage ? 'COMPLETED' : 'DRAFT',
});

const workspace = (slides: Page[]): DeckWorkspaceSnapshot => ({
  deckId: 'deck-1',
  slides,
  slidesWithImages: slides.filter((item) => item.generated_image_path),
  renderMode: 'image',
  aspectRatio: '16:9',
  extraRequirements: '',
  templateStyle: 'Editorial',
  hasTemplateAsset: false,
  allowPartialExport: false,
  hasImages: slides.some((item) => item.generated_image_path),
});

const renderCommands = (overrides: Record<string, unknown> = {}) => {
  const options = {
    workspace: workspace([slide('slide-1'), slide('slide-2')]),
    selectedSlide: slide('slide-1'),
    selectedSlideIds: new Set<string>(),
    multiSelectEnabled: false,
    jobsBySlideId: {},
    ensureStyleSource: vi.fn().mockResolvedValue(true),
    requestExecution: vi.fn(async (command: () => Promise<void>) => command()),
    renderSlides: vi.fn().mockResolvedValue(undefined),
    renderSlide: vi.fn().mockResolvedValue(undefined),
    onOverwriteRequired: vi.fn(),
    onSlideBusy: vi.fn(),
    onSlideRenderStarted: vi.fn(),
    onRenderError: vi.fn(),
    ...overrides,
  };
  return {
    ...renderHook(() => useDeckWorkspaceRendering(options)),
    options,
  };
};

describe('useDeckWorkspaceRendering', () => {
  test('requests confirmation before replacing selected generated slides', async () => {
    const selectedSlide = slide('slide-1', true);
    const { result, options } = renderCommands({
      workspace: workspace([selectedSlide, slide('slide-2')]),
      selectedSlide,
      selectedSlideIds: new Set(['slide-1']),
      multiSelectEnabled: true,
    });

    await act(() => result.current.renderDeck());

    const request = options.onOverwriteRequired.mock.calls[0][0];
    expect(request.target).toBe('selection');
    expect(request.selectedCount).toBe(1);
    expect(options.renderSlides).not.toHaveBeenCalled();

    await act(() => request.execute());
    expect(options.renderSlides).toHaveBeenCalledWith(['slide-1']);
  });

  test('renders a deck immediately when no target slide has an image', async () => {
    const { result, options } = renderCommands();

    await act(() => result.current.renderDeck());

    expect(options.onOverwriteRequired).not.toHaveBeenCalled();
    expect(options.renderSlides).toHaveBeenCalledWith(undefined);
  });

  test('blocks a duplicate render for the selected slide', async () => {
    const { result, options } = renderCommands({
      jobsBySlideId: { 'slide-1': 'running' },
    });

    await act(() => result.current.renderCurrentSlide());

    expect(options.onSlideBusy).toHaveBeenCalledTimes(1);
    expect(options.ensureStyleSource).not.toHaveBeenCalled();
    expect(options.renderSlide).not.toHaveBeenCalled();
  });

  test('reports a selected slide render failure', async () => {
    const error = new Error('render failed');
    const renderSlide = vi.fn().mockRejectedValue(error);
    const { result, options } = renderCommands({ renderSlide });

    await act(() => result.current.renderCurrentSlide());

    expect(renderSlide).toHaveBeenCalledWith('slide-1', true);
    expect(options.onRenderError).toHaveBeenCalledWith(error, 'slide');
    expect(options.onSlideRenderStarted).not.toHaveBeenCalled();
  });
});
