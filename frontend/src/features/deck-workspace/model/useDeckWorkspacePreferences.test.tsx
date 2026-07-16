import { act, renderHook } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import type { DeckWorkspaceSnapshot } from './deckWorkspaceSnapshot';
import {
  aspectRatioCssValue,
  useDeckWorkspacePreferences,
} from './useDeckWorkspacePreferences';

const workspace = (overrides: Partial<DeckWorkspaceSnapshot> = {}): DeckWorkspaceSnapshot => ({
  deckId: 'deck-1',
  slides: [],
  slidesWithImages: [],
  renderMode: 'image',
  aspectRatio: '16:9',
  extraRequirements: 'Use concise copy',
  templateStyle: 'Editorial grid',
  hasTemplateAsset: false,
  allowPartialExport: false,
  hasImages: false,
  ...overrides,
});

const renderPreferences = () => {
  const saveDeckSettings = vi.fn().mockResolvedValue(undefined);
  const onSaved = vi.fn();
  const onSaveError = vi.fn();
  const initialProps = { workspace: workspace() };
  const hook = renderHook(
    ({ workspace: currentWorkspace }) => useDeckWorkspacePreferences({
      deckId: 'deck-1',
      workspace: currentWorkspace,
      saveDeckSettings,
      onSaved,
      onSaveError,
    }),
    { initialProps },
  );
  return { ...hook, saveDeckSettings, onSaved, onSaveError };
};

describe('useDeckWorkspacePreferences', () => {
  test('initializes the workspace preference draft', () => {
    const { result } = renderPreferences();

    expect(result.current.extraRequirements).toBe('Use concise copy');
    expect(result.current.templateStyle).toBe('Editorial grid');
    expect(result.current.partialExport).toBe(false);
    expect(result.current.aspectRatioStyle).toBe('16/9');
  });

  test('protects an active text draft while syncing non-text settings', () => {
    const { result, rerender } = renderPreferences();
    act(() => result.current.setExtraRequirements('Local draft'));

    rerender({
      workspace: workspace({
        extraRequirements: 'Server replacement',
        aspectRatio: '4:3',
        allowPartialExport: true,
      }),
    });

    expect(result.current.extraRequirements).toBe('Local draft');
    expect(result.current.aspectRatio).toBe('4:3');
    expect(result.current.partialExport).toBe(true);
  });

  test('persists the normalized settings patch and reports success', async () => {
    const { result, saveDeckSettings, onSaved } = renderPreferences();
    act(() => result.current.setExtraRequirements('Revised guidance'));

    await act(() => result.current.saveExtraRequirements());

    expect(saveDeckSettings).toHaveBeenCalledWith('deck-1', {
      extra_requirements: 'Revised guidance',
    });
    expect(onSaved).toHaveBeenCalledWith('extraRequirements');
  });

  test('reports settings save failures through the preference callback', async () => {
    const { result, saveDeckSettings, onSaveError } = renderPreferences();
    const error = new Error('save failed');
    saveDeckSettings.mockRejectedValueOnce(error);

    await act(() => result.current.saveTemplateStyle());

    expect(onSaveError).toHaveBeenCalledWith('templateStyle', error);
    expect(result.current.savingTemplateStyle).toBe(false);
  });

  test('lets direct style application own its notification flow', async () => {
    const { result, saveDeckSettings, onSaved, onSaveError } = renderPreferences();
    const error = new Error('apply failed');
    saveDeckSettings.mockRejectedValueOnce(error);

    await expect(act(() => result.current.applyTemplateStyle('New style')))
      .rejects.toThrow('apply failed');

    expect(onSaved).not.toHaveBeenCalled();
    expect(onSaveError).not.toHaveBeenCalled();
    expect(result.current.savingTemplateStyle).toBe(false);
  });

  test('normalizes invalid aspect ratios to the workspace default', () => {
    expect(aspectRatioCssValue('4:3')).toBe('4/3');
    expect(aspectRatioCssValue('invalid')).toBe('16/9');
  });
});
