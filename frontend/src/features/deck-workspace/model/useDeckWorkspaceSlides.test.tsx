import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import type { ImageVersionDto } from '@/entities/slide/api/pageDto';
import type { Page } from '@/types';
import { useDeckWorkspaceSlides } from './useDeckWorkspaceSlides';

const slide = (id: string, withImage = true): Page => ({
  page_id: id,
  id,
  order_index: Number(id.split('-')[1]),
  outline_content: null,
  generated_image_path: withImage ? `/slides/${id}.png` : undefined,
  status: withImage ? 'COMPLETED' : 'DRAFT',
});

const version = (
  slideId: string,
  versionNumber = 1,
  isCurrent = true,
): ImageVersionDto => ({
  version_id: `${slideId}-v${versionNumber}`,
  page_id: slideId,
  image_path: `/slides/${slideId}-v${versionNumber}.png`,
  version_number: versionNumber,
  is_current: isCurrent,
});

const renderSlides = (
  slides = [slide('slide-1'), slide('slide-2', false), slide('slide-3')],
  listVersions: (deckId: string, slideId: string) => Promise<ImageVersionDto[]> = (
    () => new Promise(() => undefined)
  ),
) => {
  const listSlideVersions = vi.fn(listVersions);
  const selectSlideVersion = vi.fn().mockResolvedValue(undefined);
  const onVersionSelected = vi.fn();
  const onVersionSelectError = vi.fn();
  const hook = renderHook(
    ({ currentSlides }) => useDeckWorkspaceSlides({
      deckId: 'deck-1',
      slides: currentSlides,
      slidesWithImages: currentSlides.filter((item) => item.generated_image_path),
      listSlideVersions,
      selectSlideVersion,
      onVersionSelected,
      onVersionSelectError,
    }),
    { initialProps: { currentSlides: slides } },
  );
  return {
    ...hook,
    listSlideVersions,
    selectSlideVersion,
    onVersionSelected,
    onVersionSelectError,
  };
};

describe('useDeckWorkspaceSlides', () => {
  test('owns multi-select commands for generated slides', () => {
    const { result } = renderSlides();

    act(() => result.current.toggleMultiSelect());
    act(() => result.current.toggleSlideSelection('slide-1'));
    expect(result.current.selectedSlideIdsForCommand()).toEqual(['slide-1']);

    act(() => result.current.selectAllSlides());
    expect(Array.from(result.current.selectedSlideIds)).toEqual(['slide-1', 'slide-3']);

    act(() => result.current.toggleMultiSelect());
    expect(result.current.selectedSlideIds.size).toBe(0);
    expect(result.current.selectedSlideIdsForCommand()).toBeUndefined();
  });

  test('clamps navigation and removes stale selections when slides change', () => {
    const { result, rerender } = renderSlides();
    act(() => result.current.selectSlide(2));
    act(() => result.current.toggleMultiSelect());
    act(() => result.current.selectAllSlides());

    rerender({ currentSlides: [slide('slide-1')] });

    expect(result.current.selectedIndex).toBe(0);
    expect(Array.from(result.current.selectedSlideIds)).toEqual(['slide-1']);
  });

  test('ignores a stale version response after navigating to another slide', async () => {
    let resolveFirstRequest: (versions: ImageVersionDto[]) => void = () => undefined;
    const firstRequest = new Promise<ImageVersionDto[]>((resolve) => {
      resolveFirstRequest = resolve;
    });
    const { result } = renderSlides(
      [slide('slide-1'), slide('slide-2')],
      (_deckId, slideId) => slideId === 'slide-1'
        ? firstRequest
        : Promise.resolve([version('slide-2')]),
    );

    act(() => result.current.selectSlide(1));
    await waitFor(() => expect(result.current.imageVersions).toEqual([version('slide-2')]));

    await act(async () => resolveFirstRequest([version('slide-1')]));
    expect(result.current.imageVersions).toEqual([version('slide-2')]);
  });

  test('switches the selected slide version and closes the menu', async () => {
    const versions = [version('slide-1'), version('slide-1', 2, false)];
    const { result, selectSlideVersion, onVersionSelected } = renderSlides(
      [slide('slide-1')],
      () => Promise.resolve(versions),
    );
    await waitFor(() => expect(result.current.imageVersions).toEqual(versions));
    act(() => result.current.toggleVersionMenu());

    await act(() => result.current.switchVersion('slide-1-v2'));

    expect(selectSlideVersion).toHaveBeenCalledWith('deck-1', 'slide-1', 'slide-1-v2');
    expect(onVersionSelected).toHaveBeenCalledTimes(1);
    expect(result.current.versionMenuOpen).toBe(false);
    expect(result.current.imageVersions.map((item) => item.is_current)).toEqual([false, true]);
  });
});
