import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import type { Page as LegacySlide } from '@/types';
import { SlideNavigator } from './SlideNavigator';

vi.mock('@/hooks/useT', () => ({
  useT: () => (key: string) => key,
}));

vi.mock('@/components/preview/SlideCard', () => ({
  SlideCard: ({ index, onEdit }: { index: number; onEdit: () => void }) => (
    <button type="button" data-testid={`edit-slide-${index}`} onClick={onEdit}>
      Edit
    </button>
  ),
}));

const makeSlide = (id: string, hasImage = true): LegacySlide => ({
  id,
  page_id: id,
  generated_image_path: hasImage ? `/slides/${id}.png` : undefined,
} as LegacySlide);

const renderNavigator = (overrides: Partial<React.ComponentProps<typeof SlideNavigator>> = {}) => {
  const props: React.ComponentProps<typeof SlideNavigator> = {
    slides: [makeSlide('slide-1'), makeSlide('slide-2')],
    selectedIndex: 0,
    selectedSlideIds: new Set(),
    multiSelectEnabled: false,
    jobsBySlideId: {},
    aspectRatio: '16:9',
    onGenerate: vi.fn(),
    onToggleMultiSelect: vi.fn(),
    onSelectAll: vi.fn(),
    onClearSelection: vi.fn(),
    onToggleSlide: vi.fn(),
    onSelectSlide: vi.fn(),
    onEditSlide: vi.fn(),
    onDeleteSlide: vi.fn(),
    ...overrides,
  };
  render(<SlideNavigator {...props} />);
  return props;
};

describe('SlideNavigator', () => {
  test('opens the editor for the clicked slide index', () => {
    const props = renderNavigator();
    fireEvent.click(screen.getByTestId('edit-slide-1'));
    expect(props.onEditSlide).toHaveBeenCalledWith(1);
  });

  test('requires a selection before generating in multi-select mode', () => {
    renderNavigator({ multiSelectEnabled: true });
    expect(screen.getByRole('button', { name: 'preview.batchGenerate' })).toBeDisabled();
  });
});
