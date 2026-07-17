import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import {
  createUserStyleTemplate,
  deleteUserStyleTemplate,
  extractStyleFromImage,
  listUserStyleTemplates,
} from '@/api/templatesApi';
import { styleAccentFor } from '../model/styleAccent';
import { StylePromptEditor } from './StylePromptEditor';

vi.mock('@/hooks/useT', () => ({
  useT: () => (key: string) => key,
}));

vi.mock('@/api/templatesApi', () => ({
  createUserStyleTemplate: vi.fn(),
  deleteUserStyleTemplate: vi.fn(),
  extractStyleFromImage: vi.fn(),
  listUserStyleTemplates: vi.fn(),
}));

describe('StylePromptEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(listUserStyleTemplates).mockResolvedValue({
      data: { templates: [] },
    });
    vi.mocked(deleteUserStyleTemplate).mockResolvedValue({});
  });

  test('writes the selected preset description', async () => {
    const onDescriptionChange = vi.fn();
    render(
      <StylePromptEditor
        description=""
        onDescriptionChange={onDescriptionChange}
      />,
    );
    await act(async () => {
      await Promise.resolve();
    });

    fireEvent.click(screen.getByRole('button', {
      name: 'presetStyles.businessSimple.name',
    }));

    expect(onDescriptionChange).toHaveBeenCalledWith(
      'presetStyles.businessSimple.description',
    );
  });

  test('extracts a style description from an uploaded image', async () => {
    const onDescriptionChange = vi.fn();
    const onNotify = vi.fn();
    const image = new File(['image'], 'reference.png', { type: 'image/png' });
    vi.mocked(extractStyleFromImage).mockResolvedValue({
      data: { style_description: 'Editorial grid with red accents' },
    });

    render(
      <StylePromptEditor
        description=""
        onDescriptionChange={onDescriptionChange}
        onNotify={onNotify}
      />,
    );
    fireEvent.change(screen.getByLabelText('extractFromImage'), {
      target: { files: [image] },
    });

    await waitFor(() => expect(onDescriptionChange).toHaveBeenCalledWith(
      'Editorial grid with red accents',
    ));
    expect(onNotify).toHaveBeenCalledWith({
      message: 'extractSuccess',
      type: 'success',
    });
  });

  test('saves a named style with a deterministic accent', async () => {
    const description = 'High contrast editorial layout';
    vi.mocked(createUserStyleTemplate).mockResolvedValue({
      data: {
        id: 'style-1',
        name: 'Editorial',
        description,
        color: styleAccentFor(description),
      },
    });

    render(
      <StylePromptEditor
        description={description}
        onDescriptionChange={vi.fn()}
      />,
    );
    await act(async () => {
      await Promise.resolve();
    });
    fireEvent.click(screen.getByRole('button', { name: 'saveAsTemplate' }));
    fireEvent.change(screen.getByLabelText('styleName'), {
      target: { value: 'Editorial' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'saveStyle' }));

    await waitFor(() => expect(createUserStyleTemplate).toHaveBeenCalledWith({
      name: 'Editorial',
      description,
      color: styleAccentFor(description),
    }));
  });
});
