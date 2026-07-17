import type React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { DeckSettingsDialog } from './DeckSettingsDialog';

vi.mock('@/hooks/useT', () => ({
  useT: () => (key: string) => key,
}));

vi.mock('@/components/settings/SettingsWorkspace', () => ({
  SettingsWorkspace: () => <div>application-settings</div>,
}));

const createProps = (): React.ComponentProps<typeof DeckSettingsDialog> => ({
  isOpen: true,
  onClose: vi.fn(),
  extraRequirements: '',
  templateStyle: '',
  onExtraRequirementsChange: vi.fn(),
  onTemplateStyleChange: vi.fn(),
  onSaveExtraRequirements: vi.fn(),
  onSaveTemplateStyle: vi.fn(),
  isSavingRequirements: false,
  isSavingTemplateStyle: false,
  exportAllowPartial: false,
  onExportAllowPartialChange: vi.fn(),
  onSaveExportSettings: vi.fn(),
});

describe('DeckSettingsDialog', () => {
  test('does not render while closed', () => {
    render(<DeckSettingsDialog {...createProps()} isOpen={false} />);

    expect(screen.queryByText('deckSettings.title')).not.toBeInTheDocument();
  });

  test('switches between deck and application settings', () => {
    render(<DeckSettingsDialog {...createProps()} />);

    expect(screen.getByText('deckSettings.projectConfigTitle')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'deckSettings.globalConfig' }));

    expect(screen.getByText('application-settings')).toBeInTheDocument();
  });

  test('emits export policy changes and save commands', () => {
    const props = createProps();
    render(<DeckSettingsDialog {...props} />);
    fireEvent.click(screen.getByRole('button', { name: 'deckSettings.exportConfig' }));
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'deckSettings.saveExportSettings' }));

    expect(props.onExportAllowPartialChange).toHaveBeenCalledWith(true);
    expect(props.onSaveExportSettings).toHaveBeenCalledOnce();
  });
});
