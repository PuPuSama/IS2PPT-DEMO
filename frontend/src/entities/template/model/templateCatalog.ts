export interface PresetTemplateEntry {
  id: string;
  nameKey: string;
  imageUrl: string;
  thumbnailUrl: string;
}

export const PRESET_TEMPLATE_CATALOG: readonly PresetTemplateEntry[] = [
  {
    id: '1',
    nameKey: 'template.presets.retroScroll',
    imageUrl: '/templates/template_y.png',
    thumbnailUrl: '/templates/template_y-thumb.webp',
  },
  {
    id: '2',
    nameKey: 'template.presets.vectorIllustration',
    imageUrl: '/templates/template_vector_illustration.png',
    thumbnailUrl: '/templates/template_vector_illustration-thumb.webp',
  },
  {
    id: '3',
    nameKey: 'template.presets.glassEffect',
    imageUrl: '/templates/template_glass.png',
    thumbnailUrl: '/templates/template_glass-thumb.webp',
  },
];

export const findPresetTemplate = (templateId: string) => (
  PRESET_TEMPLATE_CATALOG.find((template) => template.id === templateId)
);
