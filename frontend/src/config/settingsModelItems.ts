import type { useT } from '@/hooks/useT';
import type { SettingsModelConfigItem } from '@/types/settingsPage';

type SettingsTranslator = ReturnType<typeof useT>;

export const createSettingsModelItems = (t: SettingsTranslator): SettingsModelConfigItem[] => [
  {
    modelKey: 'text_model',
    sourceKey: 'text_model_source',
    apiKeyKey: 'text_api_key',
    apiBaseKey: 'text_api_base_url',
    apiKeyLengthKey: 'text_api_key_length',
    label: t('settings.fields.textModel'),
    placeholder: t('settings.fields.textModelPlaceholder'),
    description: t('settings.fields.textModelDesc'),
    sourceLabel: t('settings.fields.textModelSource'),
  },
  {
    modelKey: 'image_model',
    sourceKey: 'image_model_source',
    apiKeyKey: 'image_api_key',
    apiBaseKey: 'image_api_base_url',
    apiKeyLengthKey: 'image_api_key_length',
    label: t('settings.fields.imageModel'),
    placeholder: t('settings.fields.imageModelPlaceholder'),
    description: t('settings.fields.imageModelDesc'),
    sourceLabel: t('settings.fields.imageModelSource'),
  },
  {
    modelKey: 'image_caption_model',
    sourceKey: 'image_caption_model_source',
    apiKeyKey: 'image_caption_api_key',
    apiBaseKey: 'image_caption_api_base_url',
    apiKeyLengthKey: 'image_caption_api_key_length',
    label: t('settings.fields.imageCaptionModel'),
    placeholder: t('settings.fields.imageCaptionModelPlaceholder'),
    description: t('settings.fields.imageCaptionModelDesc'),
    sourceLabel: t('settings.fields.imageCaptionModelSource'),
  },
];
