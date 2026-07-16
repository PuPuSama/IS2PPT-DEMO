import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { DeckExportDialogs } from './DeckExportDialogs';

vi.mock('@/hooks/useT', () => ({
  useT: () => (key: string, params?: Record<string, unknown>) => (
    params ? `${key}:${JSON.stringify(params)}` : key
  ),
}));

const renderDialogs = (overrides: Partial<React.ComponentProps<typeof DeckExportDialogs>> = {}) => {
  const props: React.ComponentProps<typeof DeckExportDialogs> = {
    pptxOpen: true,
    editablePptxOpen: false,
    transitionsEnabled: false,
    transitionEffects: ['fade'],
    exportRange: {
      partial: false,
      totalSlideCount: 4,
      selectedSlideNumbers: [],
    },
    onClosePptx: vi.fn(),
    onCloseEditablePptx: vi.fn(),
    onTransitionsEnabledChange: vi.fn(),
    onTransitionEffectsChange: vi.fn(),
    onStartPptx: vi.fn(),
    onStartEditablePptx: vi.fn(),
    ...overrides,
  };
  render(<DeckExportDialogs {...props} />);
  return props;
};

describe('DeckExportDialogs', () => {
  test('submits normalized PPTX transition options', () => {
    const props = renderDialogs();
    fireEvent.click(screen.getByRole('button', { name: 'preview.pptxStartExport' }));
    expect(props.onStartPptx).toHaveBeenCalledWith({
      transitionEnabled: false,
      transitionEffects: ['fade'],
    });
  });

  test('renders the ordered partial export range', () => {
    renderDialogs({
      pptxOpen: false,
      editablePptxOpen: true,
      exportRange: {
        partial: true,
        totalSlideCount: 5,
        selectedSlideNumbers: [1, 3, 5],
      },
    });
    expect(screen.getByText('preview.editablePptxRangePages:{"pages":"1, 3, 5","count":3}')).toBeInTheDocument();
  });
});
