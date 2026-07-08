import type { SettingsFormData } from '@/config/settingsFormData';

export const buildSettingsTestPayload = (formData: SettingsFormData): Record<string, any> => {
  const payload: Record<string, any> = {};

  if (formData.api_key) payload.api_key = formData.api_key;
  if (formData.api_base_url) payload.api_base_url = formData.api_base_url;
  if (formData.ai_provider_format) payload.ai_provider_format = formData.ai_provider_format;
  if (formData.text_model) payload.text_model = formData.text_model;
  if (formData.image_model) payload.image_model = formData.image_model;
  if (formData.image_caption_model) payload.image_caption_model = formData.image_caption_model;
  if (formData.mineru_api_base) payload.mineru_api_base = formData.mineru_api_base;
  if (formData.mineru_token) payload.mineru_token = formData.mineru_token;
  if (formData.baidu_api_key) payload.baidu_api_key = formData.baidu_api_key;
  if (formData.image_resolution) payload.image_resolution = formData.image_resolution;

  payload.text_model_source = formData.text_model_source || '';
  payload.image_model_source = formData.image_model_source || '';
  payload.image_caption_model_source = formData.image_caption_model_source || '';

  if (formData.text_api_key) payload.text_api_key = formData.text_api_key;
  if (formData.text_api_base_url) payload.text_api_base_url = formData.text_api_base_url;
  if (formData.image_api_key) payload.image_api_key = formData.image_api_key;
  if (formData.image_api_base_url) payload.image_api_base_url = formData.image_api_base_url;
  if (formData.image_caption_api_key) payload.image_caption_api_key = formData.image_caption_api_key;
  if (formData.image_caption_api_base_url) payload.image_caption_api_base_url = formData.image_caption_api_base_url;

  if (formData.enable_text_reasoning !== undefined) {
    payload.enable_text_reasoning = formData.enable_text_reasoning;
  }
  if (formData.text_thinking_budget !== undefined) {
    payload.text_thinking_budget = formData.text_thinking_budget;
  }
  if (formData.enable_image_reasoning !== undefined) {
    payload.enable_image_reasoning = formData.enable_image_reasoning;
  }
  if (formData.image_thinking_budget !== undefined) {
    payload.image_thinking_budget = formData.image_thinking_budget;
  }

  return payload;
};
