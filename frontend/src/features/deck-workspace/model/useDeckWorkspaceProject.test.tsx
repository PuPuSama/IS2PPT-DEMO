import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { useDeckWorkspaceProject } from './useDeckWorkspaceProject';

const mocks = vi.hoisted(() => ({
  reloadDeck: vi.fn(),
  renderSlide: vi.fn(),
  renderSlides: vi.fn(),
  editPageImage: vi.fn(),
  removeSlide: vi.fn(),
  patchSlide: vi.fn(),
  updateProject: vi.fn(),
  uploadTemplate: vi.fn(),
  getPageImageVersions: vi.fn(),
  setCurrentImageVersion: vi.fn(),
}));

vi.mock('@/store/useProjectStore', () => ({
  useProjectStore: () => ({
    currentProject: { id: 'deck-1', pages: [] },
    syncProject: mocks.reloadDeck,
    generatePageImage: mocks.renderSlide,
    generateImages: mocks.renderSlides,
    editPageImage: mocks.editPageImage,
    deletePageById: mocks.removeSlide,
    updatePageLocal: mocks.patchSlide,
    isGlobalLoading: false,
  }),
}));

vi.mock('@/api/projectsApi', () => ({
  updateProject: mocks.updateProject,
  uploadTemplate: mocks.uploadTemplate,
}));

vi.mock('@/api/pagesApi', () => ({
  getPageImageVersions: mocks.getPageImageVersions,
  setCurrentImageVersion: mocks.setCurrentImageVersion,
}));

describe('useDeckWorkspaceProject', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.reloadDeck.mockResolvedValue(undefined);
    mocks.updateProject.mockResolvedValue(undefined);
    mocks.uploadTemplate.mockResolvedValue(undefined);
    mocks.setCurrentImageVersion.mockResolvedValue(undefined);
    mocks.editPageImage.mockResolvedValue(undefined);
    mocks.getPageImageVersions.mockResolvedValue({ data: { versions: [] } });
  });

  test('exposes deck state behind workspace terminology', () => {
    const { result } = renderHook(() => useDeckWorkspaceProject());

    expect(result.current.deckSource).toEqual({ id: 'deck-1', pages: [] });
    expect(result.current.busy).toBe(false);
    expect(result.current.renderSlide).toBe(mocks.renderSlide);
    expect(result.current.renderSlides).toBe(mocks.renderSlides);
    expect(result.current.removeSlide).toBe(mocks.removeSlide);
  });

  test('saves deck settings and reloads the canonical deck', async () => {
    const { result } = renderHook(() => useDeckWorkspaceProject());

    await act(() => result.current.saveDeckSettings('deck-1', {
      template_style: 'Editorial grid',
    }));

    expect(mocks.updateProject).toHaveBeenCalledWith('deck-1', {
      template_style: 'Editorial grid',
    });
    expect(mocks.reloadDeck).toHaveBeenCalledWith('deck-1');
  });

  test('maps a slide revision command to the legacy store contract', async () => {
    const { result } = renderHook(() => useDeckWorkspaceProject());
    const file = new File(['reference'], 'reference.png', { type: 'image/png' });

    await act(() => result.current.reviseSlide({
      slideId: 'slide-1',
      instruction: 'Increase contrast',
      includeTemplate: true,
      descriptionImageUrls: ['https://cdn.example.com/reference.png'],
      uploadedFiles: [file],
    }));

    expect(mocks.editPageImage).toHaveBeenCalledWith(
      'slide-1',
      'Increase contrast',
      {
        useTemplate: true,
        descImageUrls: ['https://cdn.example.com/reference.png'],
        uploadedFiles: [file],
      },
    );
  });

  test('selects an image version before reloading the deck', async () => {
    const { result } = renderHook(() => useDeckWorkspaceProject());

    await act(() => result.current.selectSlideVersion('deck-1', 'slide-1', 'version-2'));

    expect(mocks.setCurrentImageVersion).toHaveBeenCalledWith(
      'deck-1',
      'slide-1',
      'version-2',
    );
    expect(mocks.reloadDeck).toHaveBeenCalledWith('deck-1');
  });
});
