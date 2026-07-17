import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import {
  deleteUserTemplate,
  listUserTemplates,
  uploadUserTemplate,
} from '@/api/templatesApi';
import { TemplateGallery } from './TemplateGallery';

vi.mock('@/hooks/useT', () => ({
  useT: () => (key: string) => key,
}));

vi.mock('@/api/templatesApi', () => ({
  listUserTemplates: vi.fn(),
  uploadUserTemplate: vi.fn(),
  deleteUserTemplate: vi.fn(),
}));

describe('TemplateGallery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(listUserTemplates).mockResolvedValue({
      data: { templates: [] },
    });
    vi.mocked(deleteUserTemplate).mockResolvedValue({});
  });

  test('reports the preset source explicitly', async () => {
    const onChoose = vi.fn();
    render(<TemplateGallery onChoose={onChoose} />);
    await act(async () => {
      await Promise.resolve();
    });

    fireEvent.click(screen.getByRole('button', {
      name: 'template.presets.retroScroll',
    }));

    expect(onChoose).toHaveBeenCalledWith({
      kind: 'preset',
      templateId: '1',
    });
  });

  test('keeps the upload file when saving a new library template', async () => {
    const onChoose = vi.fn();
    const file = new File(['template'], 'brand.png', { type: 'image/png' });
    vi.mocked(uploadUserTemplate).mockResolvedValue({
      data: {
        template_id: 'library-1',
        template_image_url: '/templates/library-1.png',
      },
    });

    render(<TemplateGallery onChoose={onChoose} />);
    fireEvent.change(screen.getByLabelText('template.uploadTemplate'), {
      target: { files: [file] },
    });

    await waitFor(() => expect(onChoose).toHaveBeenCalledWith({
      kind: 'library',
      templateId: 'library-1',
      file,
    }));
  });
});
