import { apiClient } from './client';
import type { ApiResponse, Page, SvgReasoningEffort } from '@/types';
import { accessCodeSession } from '@/shared/auth/accessCodeSession';
import { getStoredOutputLanguage, type OutputLanguage } from './settingsApi';

/**
 * 从描述文本生成大纲和页面描述（一次性完成）
 * @param projectId 项目ID
 * @param descriptionText 描述文本（可选）
 * @param language 输出语言（可选，默认从 sessionStorage 获取）
 */
export const generateFromDescription = async (projectId: string, descriptionText?: string, language?: OutputLanguage): Promise<ApiResponse> => {
  const lang = language || await getStoredOutputLanguage();
  const response = await apiClient.post<ApiResponse>(
    `/api/projects/${projectId}/generate/from-description`,
    {
      ...(descriptionText ? { description_text: descriptionText } : {}),
      language: lang
    }
  );
  return response.data;
};

/**
 * 批量生成描述（并行模式）
 * @param projectId 项目ID
 * @param language 输出语言（可选，默认从 sessionStorage 获取）
 */
export const generateDescriptions = async (
  projectId: string,
  language?: OutputLanguage,
  detailLevel?: string,
  enableWebResearch?: boolean,
  generationMode?: 'image' | 'svg',
  svgReasoningEffort?: SvgReasoningEffort
): Promise<ApiResponse> => {
  const lang = language || await getStoredOutputLanguage();
  const response = await apiClient.post<ApiResponse>(
    `/api/projects/${projectId}/generate/descriptions`,
    {
      language: lang,
      detail_level: detailLevel || 'default',
      enable_web_research: enableWebResearch,
      ...(generationMode ? { generation_mode: generationMode } : {}),
      ...(svgReasoningEffort ? { svg_reasoning_effort: svgReasoningEffort } : {}),
    }
  );
  return response.data;
};

/**
 * 流式生成描述（SSE）
 */
export interface DescriptionStreamEvent {
  page_index: number;
  page_id: string;
  text: string;
  extra_fields?: Record<string, string>;
}

export interface DescriptionStreamCallbacks {
  onDescription: (data: DescriptionStreamEvent) => void;
  onDone: (data: { total: number; pages: Page[] }) => void;
  onError: (message: string) => void;
}

export const generateDescriptionsStream = async (
  projectId: string,
  callbacks: DescriptionStreamCallbacks,
  language?: OutputLanguage,
  detailLevel?: string,
  enableWebResearch?: boolean,
  generationMode?: 'image' | 'svg',
  svgReasoningEffort?: SvgReasoningEffort,
): Promise<void> => {
  const lang = language || await getStoredOutputLanguage();

  const response = await fetch(`/api/projects/${projectId}/generate/descriptions/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...accessCodeSession.getAuthHeaders(),
    },
    body: JSON.stringify({
      language: lang,
      detail_level: detailLevel || 'default',
      enable_web_research: enableWebResearch,
      ...(generationMode ? { generation_mode: generationMode } : {}),
      ...(svgReasoningEffort ? { svg_reasoning_effort: svgReasoningEffort } : {}),
    }),
  });

  if (!response.ok || !response.body) {
    callbacks.onError(`HTTP ${response.status}`);
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  let readResult = await reader.read();
  while (!readResult.done) {
    const { value } = readResult;

    buffer += decoder.decode(value, { stream: true });

    const parts = buffer.split('\n\n');
    buffer = parts.pop() || '';

    for (const part of parts) {
      const lines = part.split('\n');
      let eventType = '';
      let eventData = '';

      for (const line of lines) {
        if (line.startsWith('event: ')) eventType = line.slice(7);
        else if (line.startsWith('data: ')) eventData = line.slice(6);
      }

      if (!eventType || !eventData) continue;

      try {
        const parsed = JSON.parse(eventData);
        if (eventType === 'description') callbacks.onDescription(parsed);
        else if (eventType === 'done') callbacks.onDone(parsed);
        else if (eventType === 'error') callbacks.onError(parsed.message);
      } catch {
        // Skip malformed events
      }
    }

    readResult = await reader.read();
  }
};

/**
 * 生成单页描述
 */
export const generatePageDescription = async (
  projectId: string,
  pageId: string,
  forceRegenerate: boolean = false,
  language?: OutputLanguage,
  detailLevel?: string,
  enableWebResearch?: boolean
): Promise<ApiResponse> => {
  const lang = language || await getStoredOutputLanguage();
  const response = await apiClient.post<ApiResponse>(
    `/api/projects/${projectId}/pages/${pageId}/generate/description`,
    { force_regenerate: forceRegenerate, language: lang, detail_level: detailLevel || 'default', enable_web_research: enableWebResearch }
  );
  return response.data;
};

/**
 * 根据用户要求修改页面描述
 * @param projectId 项目ID
 * @param userRequirement 用户要求
 * @param previousRequirements 历史要求（可选）
 * @param language 输出语言（可选，默认从 sessionStorage 获取）
 */
export const refineDescriptions = async (
  projectId: string,
  userRequirement: string,
  previousRequirements?: string[],
  language?: OutputLanguage
): Promise<ApiResponse<{ pages: Page[]; message: string }>> => {
  const lang = language || await getStoredOutputLanguage();
  const response = await apiClient.post<ApiResponse<{ pages: Page[]; message: string }>>(
    `/api/projects/${projectId}/refine/descriptions`,
    {
      user_requirement: userRequirement,
      previous_requirements: previousRequirements || [],
      language: lang
    }
  );
  return response.data;
};
