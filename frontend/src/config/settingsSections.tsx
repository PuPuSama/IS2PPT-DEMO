import { Brain, FileText, Globe, Image, Zap } from 'lucide-react';
import { OUTPUT_LANGUAGE_OPTIONS } from '@/api/settingsApi';
import type { useT } from '@/hooks/useT';
import type { SettingsSectionConfig } from '@/types/settingsPage';

type SettingsTranslator = ReturnType<typeof useT>;

// 配置驱动的表单区块定义（使用翻译）
export const createSettingsSections = (t: SettingsTranslator): SettingsSectionConfig[] => [
  // Global API config & Model config are rendered separately above
  {
    title: t('settings.sections.mineruConfig'),
    icon: <FileText size={20} />,
    fields: [
      {
        key: 'mineru_api_base',
        label: t('settings.fields.mineruApiBase'),
        type: 'text',
        placeholder: t('settings.fields.mineruApiBasePlaceholder'),
        description: t('settings.fields.mineruApiBaseDesc'),
      },
      {
        key: 'mineru_token',
        label: t('settings.fields.mineruToken'),
        type: 'password',
        placeholder: t('settings.fields.mineruTokenPlaceholder'),
        sensitiveField: true,
        lengthKey: 'mineru_token_length',
        description: t('settings.fields.mineruTokenDesc'),
        link: 'https://mineru.net/apiManage/token',
      },
    ],
  },
  {
    title: t('settings.sections.imageConfig'),
    icon: <Image size={20} />,
    fields: [
      {
        key: 'image_resolution',
        label: t('settings.fields.imageResolution'),
        type: 'select',
        description: t('settings.fields.imageResolutionDesc'),
        options: [
          { value: '1K', label: '1K (1024px)' },
          { value: '2K', label: '2K (2048px)' },
          { value: '4K', label: '4K (4096px)' },
        ],
      },
    ],
  },
  {
    title: t('settings.sections.performanceConfig'),
    icon: <Zap size={20} />,
    fields: [
      {
        key: 'max_description_workers',
        label: t('settings.fields.maxDescriptionWorkers'),
        type: 'number',
        min: 1,
        max: 20,
        description: t('settings.fields.maxDescriptionWorkersDesc'),
      },
      {
        key: 'max_image_workers',
        label: t('settings.fields.maxImageWorkers'),
        type: 'number',
        min: 1,
        max: 20,
        description: t('settings.fields.maxImageWorkersDesc'),
      },
    ],
  },
  {
    title: t('settings.sections.outputLanguage'),
    icon: <Globe size={20} />,
    fields: [
      {
        key: 'output_language',
        label: t('settings.fields.defaultOutputLanguage'),
        type: 'buttons',
        description: t('settings.fields.defaultOutputLanguageDesc'),
        options: OUTPUT_LANGUAGE_OPTIONS,
      },
    ],
  },
  {
    title: t('settings.sections.textReasoning'),
    icon: <Brain size={20} />,
    fields: [
      {
        key: 'enable_text_reasoning',
        label: t('settings.fields.enableTextReasoning'),
        type: 'switch',
        description: t('settings.fields.enableTextReasoningDesc'),
      },
      {
        key: 'text_thinking_budget',
        label: t('settings.fields.textThinkingBudget'),
        type: 'number',
        min: 1,
        max: 8192,
        description: t('settings.fields.textThinkingBudgetDesc'),
      },
    ],
  },
  {
    title: t('settings.sections.imageReasoning'),
    icon: <Brain size={20} />,
    fields: [
      {
        key: 'enable_image_reasoning',
        label: t('settings.fields.enableImageReasoning'),
        type: 'switch',
        description: t('settings.fields.enableImageReasoningDesc'),
      },
      {
        key: 'image_thinking_budget',
        label: t('settings.fields.imageThinkingBudget'),
        type: 'number',
        min: 1,
        max: 8192,
        description: t('settings.fields.imageThinkingBudgetDesc'),
      },
    ],
  },
  {
    title: t('settings.sections.baiduOcr'),
    icon: <FileText size={20} />,
    fields: [
      {
        key: 'baidu_api_key',
        label: t('settings.fields.baiduOcrApiKey'),
        type: 'password',
        placeholder: t('settings.fields.baiduOcrApiKeyPlaceholder'),
        sensitiveField: true,
        lengthKey: 'baidu_api_key_length',
        description: t('settings.fields.baiduOcrApiKeyDesc'),
        link: 'https://console.bce.baidu.com/iam/#/iam/apikey/list',
      },
    ],
  },
];
