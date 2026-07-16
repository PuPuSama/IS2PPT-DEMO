import type React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { DeckWorkspaceHeader } from './DeckWorkspaceHeader';

vi.mock('@/hooks/useT', () => ({
  useT: () => (key: string) => key,
}));

const renderHeader = () => {
  const props: React.ComponentProps<typeof DeckWorkspaceHeader> = {
    projectId: 'deck-1',
    slides: [],
    renderMode: 'image',
    activeExportJob: false,
    exportJobCount: 0,
    refreshing: false,
    multiSelectEnabled: false,
    selectedSlideCount: 0,
    exportReady: true,
    missingImageCount: 0,
    onHome: vi.fn(),
    onBack: vi.fn(),
    onPrevious: vi.fn(),
    onOpenSettings: vi.fn(),
    onOpenStyle: vi.fn(),
    onRefresh: vi.fn(),
    onOpenPptxExport: vi.fn(),
    onOpenEditablePptxExport: vi.fn(),
    onExport: vi.fn(),
  };
  render(<DeckWorkspaceHeader {...props} />);
  return props;
};

describe('DeckWorkspaceHeader', () => {
  test('owns the export menu while emitting format commands', () => {
    const props = renderHeader();
    fireEvent.click(screen.getByRole('button', { name: 'preview.export' }));
    fireEvent.click(screen.getByRole('button', { name: 'preview.exportPdf' }));

    expect(props.onExport).toHaveBeenCalledWith('pdf');
    expect(screen.queryByRole('button', { name: 'preview.exportPdf' })).not.toBeInTheDocument();
  });

  test('emits workspace navigation and settings commands', () => {
    const props = renderHeader();
    fireEvent.click(screen.getByRole('button', { name: 'common.back' }));
    fireEvent.click(screen.getByRole('button', { name: 'preview.projectSettings' }));

    expect(props.onBack).toHaveBeenCalledOnce();
    expect(props.onOpenSettings).toHaveBeenCalledOnce();
  });
});
