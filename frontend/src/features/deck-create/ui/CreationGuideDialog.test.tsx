import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, test, vi } from 'vitest';
import { CreationGuideDialog } from './CreationGuideDialog';

vi.mock('@/hooks/useT', () => ({
  useT: () => (key: string) => key,
}));

const renderGuide = (isOpen = true, onClose = vi.fn()) => {
  render(
    <MemoryRouter>
      <CreationGuideDialog isOpen={isOpen} onClose={onClose} />
    </MemoryRouter>,
  );
  return onClose;
};

describe('CreationGuideDialog', () => {
  test('stays absent while closed', () => {
    renderGuide(false);

    expect(screen.queryByText('guide.setupTitle')).not.toBeInTheDocument();
  });

  test('moves through the creation workflow and closes', () => {
    const onClose = renderGuide();
    expect(screen.getByText('guide.setupTitle')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'guide.next' }));
    expect(screen.getByText('guide.workflowTitle')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'common.close' }));

    expect(onClose).toHaveBeenCalledOnce();
  });
});
