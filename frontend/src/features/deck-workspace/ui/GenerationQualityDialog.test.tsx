import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { GenerationQualityDialog } from './GenerationQualityDialog';

vi.mock('@/hooks/useT', () => ({
  useT: () => (key: string) => key,
}));

describe('GenerationQualityDialog', () => {
  test('returns the future-warning preference with confirmation', () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    render(
      <GenerationQualityDialog
        isOpen
        onCancel={vi.fn()}
        onConfirm={onConfirm}
      />,
    );

    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'preview.generateAnyway' }));

    expect(onConfirm).toHaveBeenCalledWith(true);
  });
});
