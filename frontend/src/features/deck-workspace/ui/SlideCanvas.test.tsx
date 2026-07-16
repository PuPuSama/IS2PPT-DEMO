import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import type { Page as LegacySlide } from '@/types';
import { SlideCanvas } from './SlideCanvas';

vi.mock('@/hooks/useT', () => ({
  useT: () => (key: string) => key,
}));

vi.mock('@/components/preview/InlineSvgImage', () => ({
  default: () => <div data-testid="inline-svg" />,
}));

const slide = (id: string): LegacySlide => ({ id, page_id: id } as LegacySlide);

const renderCanvas = (slides: LegacySlide[], selectedIndex = 0) => {
  const props: React.ComponentProps<typeof SlideCanvas> = {
    slides,
    selectedIndex,
    jobsBySlideId: {},
    aspectRatioStyle: '16/9',
    imageVersions: [],
    versionMenuOpen: false,
    refreshing: false,
    onBackToPlan: vi.fn(),
    onSelectSlide: vi.fn(),
    onGenerateSlide: vi.fn(),
    onOpenTemplate: vi.fn(),
    onRefresh: vi.fn(),
    onToggleVersionMenu: vi.fn(),
    onSwitchVersion: vi.fn(),
    onEditSlide: vi.fn(),
    onRegenerateSlide: vi.fn(),
  };
  render(<SlideCanvas {...props} />);
  return props;
};

describe('SlideCanvas', () => {
  test('returns to the plan from an empty workspace', () => {
    const props = renderCanvas([]);
    fireEvent.click(screen.getByRole('button', { name: 'preview.backToEdit' }));
    expect(props.onBackToPlan).toHaveBeenCalledOnce();
  });

  test('requests the next slide without owning selection state', () => {
    const props = renderCanvas([slide('slide-1'), slide('slide-2')]);
    fireEvent.click(screen.getByRole('button', { name: 'preview.nextPage' }));
    expect(props.onSelectSlide).toHaveBeenCalledWith(1);
  });
});
