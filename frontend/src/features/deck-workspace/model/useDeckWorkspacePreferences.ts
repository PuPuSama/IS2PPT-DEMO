import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ProjectUpdateDto } from '@/entities/deck/api/projectDto';
import type { DeckWorkspaceSnapshot } from './deckWorkspaceSnapshot';

export type DeckPreferenceKey =
  | 'extraRequirements'
  | 'templateStyle'
  | 'partialExport'
  | 'aspectRatio';

interface UseDeckWorkspacePreferencesOptions {
  deckId: string | undefined;
  workspace: DeckWorkspaceSnapshot | null;
  saveDeckSettings: (deckId: string, changes: ProjectUpdateDto) => Promise<void>;
  onSaved: (preference: DeckPreferenceKey) => void;
  onSaveError: (preference: DeckPreferenceKey, error: unknown) => void;
}

export const aspectRatioCssValue = (aspectRatio: string): string => {
  const [widthText, heightText] = aspectRatio.split(':');
  const width = Number.parseInt(widthText ?? '', 10);
  const height = Number.parseInt(heightText ?? '', 10);
  return width > 0 && height > 0 ? `${width}/${height}` : '16/9';
};

export const useDeckWorkspacePreferences = ({
  deckId,
  workspace,
  saveDeckSettings,
  onSaved,
  onSaveError,
}: UseDeckWorkspacePreferencesOptions) => {
  const [extraRequirements, setExtraRequirementsValue] = useState('');
  const [templateStyle, setTemplateStyleValue] = useState('');
  const [partialExport, setPartialExport] = useState(false);
  const [aspectRatio, setAspectRatio] = useState('16:9');
  const [savingExtraRequirements, setSavingExtraRequirements] = useState(false);
  const [savingTemplateStyle, setSavingTemplateStyle] = useState(false);
  const [savingPartialExport, setSavingPartialExport] = useState(false);
  const [savingAspectRatio, setSavingAspectRatio] = useState(false);
  const editingExtraRequirementsRef = useRef(false);
  const editingTemplateStyleRef = useRef(false);
  const lastDeckIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!workspace) return;
    const changedDeck = lastDeckIdRef.current !== workspace.deckId;

    if (changedDeck) {
      setExtraRequirementsValue(workspace.extraRequirements);
      setTemplateStyleValue(workspace.templateStyle);
      setPartialExport(workspace.allowPartialExport);
      setAspectRatio(workspace.aspectRatio);
      lastDeckIdRef.current = workspace.deckId ?? null;
      editingExtraRequirementsRef.current = false;
      editingTemplateStyleRef.current = false;
      return;
    }

    if (!editingExtraRequirementsRef.current) {
      setExtraRequirementsValue(workspace.extraRequirements);
    }
    if (!editingTemplateStyleRef.current) {
      setTemplateStyleValue(workspace.templateStyle);
    }
    setPartialExport(workspace.allowPartialExport);
    setAspectRatio(workspace.aspectRatio);
  }, [workspace]);

  const setExtraRequirements = useCallback((value: string) => {
    editingExtraRequirementsRef.current = true;
    setExtraRequirementsValue(value);
  }, []);

  const setTemplateStyle = useCallback((value: string) => {
    editingTemplateStyleRef.current = true;
    setTemplateStyleValue(value);
  }, []);

  const saveExtraRequirements = useCallback(async () => {
    if (!deckId) return;
    setSavingExtraRequirements(true);
    try {
      await saveDeckSettings(deckId, { extra_requirements: extraRequirements || '' });
      editingExtraRequirementsRef.current = false;
      onSaved('extraRequirements');
    } catch (error) {
      onSaveError('extraRequirements', error);
    } finally {
      setSavingExtraRequirements(false);
    }
  }, [deckId, extraRequirements, onSaveError, onSaved, saveDeckSettings]);

  const persistTemplateStyle = useCallback(async (
    value: string,
    notify: boolean,
  ) => {
    if (!deckId) return;
    editingTemplateStyleRef.current = true;
    setTemplateStyleValue(value);
    setSavingTemplateStyle(true);
    try {
      await saveDeckSettings(deckId, { template_style: value || '' });
      editingTemplateStyleRef.current = false;
      if (notify) onSaved('templateStyle');
    } catch (error) {
      if (notify) {
        onSaveError('templateStyle', error);
        return;
      }
      throw error;
    } finally {
      setSavingTemplateStyle(false);
    }
  }, [deckId, onSaveError, onSaved, saveDeckSettings]);

  const saveTemplateStyle = useCallback(
    () => persistTemplateStyle(templateStyle, true),
    [persistTemplateStyle, templateStyle],
  );

  const applyTemplateStyle = useCallback(
    (value: string) => persistTemplateStyle(value, false),
    [persistTemplateStyle],
  );

  const savePartialExport = useCallback(async () => {
    if (!deckId) return;
    setSavingPartialExport(true);
    try {
      await saveDeckSettings(deckId, { export_allow_partial: partialExport });
      onSaved('partialExport');
    } catch (error) {
      onSaveError('partialExport', error);
    } finally {
      setSavingPartialExport(false);
    }
  }, [deckId, onSaveError, onSaved, partialExport, saveDeckSettings]);

  const saveAspectRatio = useCallback(async () => {
    if (!deckId) return;
    setSavingAspectRatio(true);
    try {
      await saveDeckSettings(deckId, { image_aspect_ratio: aspectRatio });
      onSaved('aspectRatio');
    } catch (error) {
      onSaveError('aspectRatio', error);
    } finally {
      setSavingAspectRatio(false);
    }
  }, [aspectRatio, deckId, onSaveError, onSaved, saveDeckSettings]);

  return {
    extraRequirements,
    setExtraRequirements,
    templateStyle,
    setTemplateStyle,
    partialExport,
    setPartialExport,
    aspectRatio,
    setAspectRatio,
    aspectRatioStyle: useMemo(() => aspectRatioCssValue(aspectRatio), [aspectRatio]),
    savingExtraRequirements,
    savingTemplateStyle,
    savingPartialExport,
    savingAspectRatio,
    saveExtraRequirements,
    saveTemplateStyle,
    applyTemplateStyle,
    savePartialExport,
    saveAspectRatio,
  };
};
