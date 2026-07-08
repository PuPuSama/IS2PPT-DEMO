import type { OutputLanguage } from '@/api/endpoints';
import type { Settings as SettingsType } from '@/types';
import { resolveLazyllmVendor } from '@/config/settingsProviders';

export const initialSettingsFormData = {
  ai_provider_format: 'gemini' as string,
  api_base_url: '',
  api_key: '',
  text_model: '',
  image_model: '',
  image_caption_model: '',
  mineru_api_base: '',
  mineru_token: '',
  generation_mode: 'image' as 'image' | 'svg',
  image_resolution: '2K',
  max_description_workers: 5,
  max_image_workers: 8,
  output_language: 'zh' as OutputLanguage,
  // 推理模式配置（分别控制文本和图像）
  enable_text_reasoning: false,
  text_thinking_budget: 1024,
  enable_image_reasoning: false,
  image_thinking_budget: 1024,
  baidu_api_key: '',
  // LazyLLM 配置
  text_model_source: '',
  image_model_source: '',
  image_caption_model_source: '',
  lazyllm_api_keys: {} as Record<string, string>,
  // Per-model API credentials (for gemini/openai per-model overrides)
  text_api_key: '',
  text_api_base_url: '',
  image_api_key: '',
  image_api_base_url: '',
  image_caption_api_key: '',
  image_caption_api_base_url: '',
  openai_image_api_protocol: 'auto',
};

export type SettingsFormData = typeof initialSettingsFormData;

export const formDataFromSettings = (data: SettingsType): SettingsFormData => ({
  ai_provider_format: resolveLazyllmVendor(data.ai_provider_format || 'gemini', data.lazyllm_api_keys_info),
  api_base_url: data.api_base_url || '',
  api_key: '',
  generation_mode: data.generation_mode || 'image',
  image_resolution: data.image_resolution || '2K',
  max_description_workers: data.max_description_workers || 5,
  max_image_workers: data.max_image_workers || 8,
  text_model: data.text_model || '',
  image_model: data.image_model || '',
  mineru_api_base: data.mineru_api_base || '',
  mineru_token: '',
  image_caption_model: data.image_caption_model || '',
  output_language: data.output_language || 'zh',
  enable_text_reasoning: data.enable_text_reasoning || false,
  text_thinking_budget: data.text_thinking_budget || 1024,
  enable_image_reasoning: data.enable_image_reasoning || false,
  image_thinking_budget: data.image_thinking_budget || 1024,
  baidu_api_key: '',
  text_model_source: data.text_model_source || '',
  image_model_source: data.image_model_source || '',
  image_caption_model_source: data.image_caption_model_source || '',
  lazyllm_api_keys: {},
  text_api_key: '',
  text_api_base_url: data.text_api_base_url || '',
  image_api_key: '',
  image_api_base_url: data.image_api_base_url || '',
  image_caption_api_key: '',
  image_caption_api_base_url: data.image_caption_api_base_url || '',
  openai_image_api_protocol: data.openai_image_api_protocol || 'auto',
});
