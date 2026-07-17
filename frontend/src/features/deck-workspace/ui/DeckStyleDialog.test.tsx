import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { DeckStyleDialog } from './DeckStyleDialog';

vi.mock('@/hooks/useT', () => ({
  useT: () => (key: string) => key,
}));

vi.mock('@/api/templatesApi', () => ({
  listUserTemplates: vi.fn().mockResolvedValue({
    data: { templates: [{ id: 'library-template' }] },
  }),
}));

vi.mock('@/entities/template/api/templateAssetRepository', () => ({
  loadTemplateAsset: vi.fn().mockImplementation(async () => (
    new File(['template'], 'template.png', { type: 'image/png' })
  )),
}));

vi.mock('@/entities/template/ui/TemplateGallery', () => ({
  TemplateGallery: ({
    onChoose,
  }: {
    onChoose: (choice: { kind: 'preset'; templateId: string }) => Promise<void>;
  }) => (
    <button
      type="button"
      onClick={() => void onChoose({ kind: 'preset', templateId: '12' })}
    >
      choose-template
    </button>
  ),
}));

describe('DeckStyleDialog', () => {
  test('resolves a catalog template before applying the project command', async () => {
    const onApplyImageTemplate = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();

    render(
      <DeckStyleDialog
        isOpen
        currentTextStyle=""
        initialMode="image"
        onClose={onClose}
        onApplyImageTemplate={onApplyImageTemplate}
        onApplyTextStyle={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'choose-template' }));

    await waitFor(() => expect(onApplyImageTemplate).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'template.png' }),
    ));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
