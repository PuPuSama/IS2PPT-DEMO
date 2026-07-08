import { apiClient } from './client';
import type { ApiResponse, Settings } from '@/types';

// ===== 输出语言设置 =====

export type OutputLanguage = 'zh' | 'ja' | 'en' | 'auto';

export interface OutputLanguageOption {
  value: OutputLanguage;
  label: string;
}

export const OUTPUT_LANGUAGE_OPTIONS: OutputLanguageOption[] = [
  { value: 'zh', label: '中文' },
  { value: 'ja', label: '日本語' },
  { value: 'en', label: 'English' },
  { value: 'auto', label: '自动' },
];

/**
 * 获取默认输出语言设置（从服务器环境变量读取）
 *
 * 注意：这只返回服务器配置的默认语言。
 * 实际的语言选择应由前端在 sessionStorage 中管理，
 * 并在每次生成请求时通过 language 参数传递。
 */
export const getDefaultOutputLanguage = async (): Promise<ApiResponse<{ language: OutputLanguage }>> => {
  const response = await apiClient.get<ApiResponse<{ language: OutputLanguage }>>(
    '/api/output-language'
  );
  return response.data;
};

/**
 * 从后端 Settings 获取用户的输出语言偏好
 * 如果获取失败，返回默认值 'zh'
 */
export const getStoredOutputLanguage = async (): Promise<OutputLanguage> => {
  try {
    const response = await apiClient.get<ApiResponse<{ language: OutputLanguage }>>('/api/output-language');
    return response.data.data?.language || 'zh';
  } catch (error) {
    console.warn('Failed to load output language from settings, using default', error);
    return 'zh';
  }
};

/**
 * 获取系统设置
 */
export const getSettings = async (): Promise<ApiResponse<Settings>> => {
  const response = await apiClient.get<ApiResponse<Settings>>('/api/settings');
  return response.data;
};

/**
 * 更新系统设置
 */
export const updateSettings = async (
  data: Partial<Omit<Settings, 'id' | 'api_key_length' | 'mineru_token_length' | 'baidu_api_key_length' | 'created_at' | 'updated_at'>> & {
    api_key?: string;
    mineru_token?: string;
    baidu_api_key?: string;
    text_api_key?: string;
    image_api_key?: string;
    image_caption_api_key?: string;
    lazyllm_api_keys?: Record<string, string>;
  }
): Promise<ApiResponse<Settings>> => {
  const response = await apiClient.put<ApiResponse<Settings>>('/api/settings', data);
  return response.data;
};

/**
 * 重置系统设置
 */
export const resetSettings = async (): Promise<ApiResponse<Settings>> => {
  const response = await apiClient.post<ApiResponse<Settings>>('/api/settings/reset');
  return response.data;
};

/**
 * OpenAI OAuth: get authorization URL
 */
export const getOpenAIOAuthUrl = async (): Promise<ApiResponse<{ auth_url: string; callback_server_available?: boolean }>> => {
  const response = await apiClient.get<ApiResponse<{ auth_url: string; callback_server_available?: boolean }>>('/api/settings/openai-oauth/authorize');
  return response.data;
};

/**
 * OpenAI OAuth: disconnect
 */
export const disconnectOpenAIOAuth = async (): Promise<ApiResponse<{ message: string }>> => {
  const response = await apiClient.post<ApiResponse<{ message: string }>>('/api/settings/openai-oauth/disconnect');
  return response.data;
};

/**
 * OpenAI OAuth: get connection status
 */
export const getOpenAIOAuthStatus = async (): Promise<ApiResponse<{ connected: boolean; account_id: string | null }>> => {
  const response = await apiClient.get<ApiResponse<{ connected: boolean; account_id: string | null }>>('/api/settings/openai-oauth/status');
  return response.data;
};

/**
 * OpenAI OAuth: list available models
 */
export const getOpenAIOAuthModels = async (): Promise<ApiResponse<{ models: string[] }>> => {
  const response = await apiClient.get<ApiResponse<{ models: string[] }>>('/api/settings/openai-oauth/models');
  return response.data;
};

/**
 * 手动提交 OAuth 回调 URL（端口 1455 不可用时的兜底）
 */
export const submitOAuthManualCallback = async (callbackUrl: string): Promise<ApiResponse<{ message: string; account_id: string | null }>> => {
  const response = await apiClient.post<ApiResponse<{ message: string; account_id: string | null }>>('/api/settings/openai-oauth/manual-callback', { callback_url: callbackUrl });
  return response.data;
};

/**
 * 验证 API key 是否可用
 */
export const verifyApiKey = async (): Promise<ApiResponse<{ available: boolean; message: string }>> => {
  const response = await apiClient.post<ApiResponse<{ available: boolean; message: string }>>('/api/settings/verify');
  return response.data;
};

/**
 * 可选的测试设置类型
 */
export interface TestSettingsOverride {
  api_key?: string;
  api_base_url?: string;
  text_model?: string;
  image_model?: string;
  image_caption_model?: string;
  image_caption_model_source?: string;
  mineru_api_base?: string;
  mineru_token?: string;
  baidu_api_key?: string;
  ai_provider_format?: string;
  image_resolution?: string;
  enable_text_reasoning?: boolean;
  text_thinking_budget?: number;
  enable_image_reasoning?: boolean;
  image_thinking_budget?: number;
}

/**
 * 测试百度 OCR 服务（异步）
 * @param settings 可选的设置覆盖（未保存的设置）
 * @returns 返回任务ID，需要通过 getTestStatus 轮询结果
 */
export const testBaiduOcr = async (settings?: TestSettingsOverride): Promise<ApiResponse<{ task_id: string; status: string }>> => {
  const response = await apiClient.post<ApiResponse<{ task_id: string; status: string }>>('/api/settings/tests/baidu-ocr', settings || {});
  return response.data;
};

/**
 * 测试文本生成模型（异步）
 * @param settings 可选的设置覆盖（未保存的设置）
 * @returns 返回任务ID，需要通过 getTestStatus 轮询结果
 */
export const testTextModel = async (settings?: TestSettingsOverride): Promise<ApiResponse<{ task_id: string; status: string }>> => {
  const response = await apiClient.post<ApiResponse<{ task_id: string; status: string }>>('/api/settings/tests/text-model', settings || {});
  return response.data;
};

/**
 * 测试图片识别模型（异步）
 * @param settings 可选的设置覆盖（未保存的设置）
 * @returns 返回任务ID，需要通过 getTestStatus 轮询结果
 */
export const testCaptionModel = async (settings?: TestSettingsOverride): Promise<ApiResponse<{ task_id: string; status: string }>> => {
  const response = await apiClient.post<ApiResponse<{ task_id: string; status: string }>>('/api/settings/tests/caption-model', settings || {});
  return response.data;
};

/**
 * 测试百度图像修复（异步）
 * @param settings 可选的设置覆盖（未保存的设置）
 * @returns 返回任务ID，需要通过 getTestStatus 轮询结果
 */
export const testBaiduInpaint = async (settings?: TestSettingsOverride): Promise<ApiResponse<{ task_id: string; status: string }>> => {
  const response = await apiClient.post<ApiResponse<{ task_id: string; status: string }>>('/api/settings/tests/baidu-inpaint', settings || {});
  return response.data;
};

/**
 * 测试图像生成模型（异步）
 * @param settings 可选的设置覆盖（未保存的设置）
 * @returns 返回任务ID，需要通过 getTestStatus 轮询结果
 */
export const testImageModel = async (settings?: TestSettingsOverride): Promise<ApiResponse<{ task_id: string; status: string }>> => {
  const response = await apiClient.post<ApiResponse<{ task_id: string; status: string }>>('/api/settings/tests/image-model', settings || {});
  return response.data;
};

/**
 * 测试 MinerU PDF 解析（异步）
 * @param settings 可选的设置覆盖（未保存的设置）
 * @returns 返回任务ID，需要通过 getTestStatus 轮询结果
 */
export const testMineruPdf = async (settings?: TestSettingsOverride): Promise<ApiResponse<{ task_id: string; status: string }>> => {
  const response = await apiClient.post<ApiResponse<{ task_id: string; status: string }>>('/api/settings/tests/mineru-pdf', settings || {});
  return response.data;
};

/**
 * 查询测试任务状态
 * @param taskId 任务ID
 * @returns 任务状态信息
 */
export const getTestStatus = async (taskId: string): Promise<ApiResponse<{
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  result?: any;
  error?: string;
  message?: string;
  openai_oauth_disconnected?: boolean;
}>> => {
  const response = await apiClient.get<ApiResponse<any>>(`/api/settings/tests/${taskId}/status`);
  return response.data;
};

export interface UpdateCheckInfo {
  status: 'up_to_date' | 'update_available' | 'unknown';
  update_available: boolean;
  message: string;
  repository: string;
  current: {
    tag?: string;
    commit_sha?: string;
    short_sha?: string;
    is_docker: boolean;
  };
  latest: null | {
    tag: string;
    sha?: string;
    last_updated: string;
    image: string;
  };
}

export const checkForUpdates = async (): Promise<ApiResponse<UpdateCheckInfo>> => {
  const response = await apiClient.get<ApiResponse<UpdateCheckInfo>>('/api/settings/check-update');
  return response.data;
};
