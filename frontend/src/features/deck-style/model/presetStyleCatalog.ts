export interface PresetStyleEntry {
  id: string;
  nameKey: string;
  descriptionKey: string;
  previewImage: string;
  accentColor: string;
}

export const PRESET_STYLE_CATALOG: readonly PresetStyleEntry[] = [
  {
    id: 'business-simple',
    nameKey: 'presetStyles.businessSimple.name',
    descriptionKey: 'presetStyles.businessSimple.description',
    previewImage: '/preset-previews/business-simple.webp',
    accentColor: '#0B1F3B',
  },
  {
    id: 'tech-modern',
    nameKey: 'presetStyles.techModern.name',
    descriptionKey: 'presetStyles.techModern.description',
    previewImage: '/preset-previews/tech-modern.webp',
    accentColor: '#7C3AED',
  },
  {
    id: 'academic-formal',
    nameKey: 'presetStyles.academicFormal.name',
    descriptionKey: 'presetStyles.academicFormal.description',
    previewImage: '/preset-previews/academic-formal.webp',
    accentColor: '#7F1D1D',
  },
  {
    id: 'creative-fun',
    nameKey: 'presetStyles.creativeFun.name',
    descriptionKey: 'presetStyles.creativeFun.description',
    previewImage: '/preset-previews/creative-fun.webp',
    accentColor: '#FF6A00',
  },
  {
    id: 'minimalist-clean',
    nameKey: 'presetStyles.minimalistClean.name',
    descriptionKey: 'presetStyles.minimalistClean.description',
    previewImage: '/preset-previews/minimalist-clean.webp',
    accentColor: '#6B7280',
  },
  {
    id: 'luxury-premium',
    nameKey: 'presetStyles.luxuryPremium.name',
    descriptionKey: 'presetStyles.luxuryPremium.description',
    previewImage: '/preset-previews/luxury-premium.webp',
    accentColor: '#F7E7CE',
  },
  {
    id: 'nature-fresh',
    nameKey: 'presetStyles.natureFresh.name',
    descriptionKey: 'presetStyles.natureFresh.description',
    previewImage: '/preset-previews/nature-fresh.webp',
    accentColor: '#14532D',
  },
  {
    id: 'gradient-vibrant',
    nameKey: 'presetStyles.gradientVibrant.name',
    descriptionKey: 'presetStyles.gradientVibrant.description',
    previewImage: '/preset-previews/gradient-vibrant.webp',
    accentColor: '#2563EB',
  },
];
