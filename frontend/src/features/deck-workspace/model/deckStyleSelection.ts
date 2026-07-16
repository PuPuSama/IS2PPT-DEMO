export interface DeckStyleSelection {
  libraryTemplateId: string | null;
  presetTemplateId: string | null;
}

export type DeckStyleMode = 'image' | 'text';

export const deckStyleSelectionForTemplate = (templateId: string): DeckStyleSelection => {
  const isPreset = templateId.length <= 3 && /^\d+$/.test(templateId);
  return isPreset
    ? { libraryTemplateId: null, presetTemplateId: templateId }
    : { libraryTemplateId: templateId, presetTemplateId: null };
};
