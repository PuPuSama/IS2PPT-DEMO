import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import type { Page } from '@/types';
import { SlideEditDialog } from './SlideEditDialog';

vi.mock('@/hooks/useT', () => ({
  useT: () => (key: string) => key,
}));

vi.mock('@/api/client', () => ({
  getImageUrl: (path: string) => `/files/${path}`,
}));

const currentSlide: Page = {
  page_id: 'slide-1',
  id: 'slide-1',
  order_index: 0,
  outline_content: {
    title: 'Original title',
    points: ['Original point'],
  },
  description_content: {
    text: 'Original description',
  },
  generated_image_path: 'slide-1.png',
  status: 'COMPLETED',
};

const renderDialog = () => {
  const props: React.ComponentProps<typeof SlideEditDialog> = {
    isOpen: true,
    slide: currentSlide,
    aspectRatioStyle: '16/9',
    onClose: vi.fn(),
    onOpenSvgEditor: vi.fn(),
    onSaveMetadata: vi.fn(),
    onSubmitEdit: vi.fn().mockResolvedValue(undefined),
  };
  render(<SlideEditDialog {...props} />);
  return props;
};

describe('SlideEditDialog', () => {
  test('saves only changed slide metadata', () => {
    const props = renderDialog();
    fireEvent.click(screen.getByRole('button', { name: 'preview.pageOutline' }));
    fireEvent.change(screen.getByPlaceholderText('preview.enterTitle'), {
      target: { value: 'Revised title' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'preview.saveOutlineOnly' }));

    expect(props.onSaveMetadata).toHaveBeenCalledWith('slide-1', {
      outline_content: {
        title: 'Revised title',
        points: ['Original point'],
      },
    });
    expect(props.onClose).toHaveBeenCalledOnce();
  });

  test('submits a store-independent slide edit command', async () => {
    const props = renderDialog();
    fireEvent.change(screen.getByPlaceholderText('preview.editPromptPlaceholder'), {
      target: { value: 'Make the title larger' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'preview.generateImage' }));

    await waitFor(() => expect(props.onSubmitEdit).toHaveBeenCalledWith({
      slideId: 'slide-1',
      instruction: 'Make the title larger',
      references: {
        useTemplate: false,
        descriptionImageUrls: [],
        uploadedFiles: [],
      },
    }));
  });
});
