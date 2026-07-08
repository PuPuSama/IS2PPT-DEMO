import { apiClient } from './client';
import type { ApiResponse, Page } from '@/types';
import { accessCodeSession } from '@/shared/auth/accessCodeSession';
import { getStoredOutputLanguage, type OutputLanguage } from './settingsApi';

/**
 * 生成大纲
 * @param projectId 项目ID
 * @param language 输出语言（可选，默认从 sessionStorage 获取）
 */
export const generateOutline = async (projectId: string, language?: OutputLanguage, enableWebResearch?: boolean): Promise<ApiResponse> => {
  const lang = language || await getStoredOutputLanguage();
  const response = await apiClient.post<ApiResponse>(
    `/api/projects/${projectId}/generate/outline`,
    { language: lang, enable_web_research: enableWebResearch }
  );
  return response.data;
};

/**
 * 流式生成大纲（SSE）
 * 返回 ReadableStream，每个 page 事件包含一个页面对象
 */
export interface OutlineStreamPage {
  index: number;
  title: string;
  points: string[];
  part?: string;
  description_text?: string;
  extra_fields?: Record<string, string>;
}

export interface OutlineStreamCallbacks {
  onPage: (page: OutlineStreamPage) => void;
  onDone: (data: { total: number; pages: Page[] }) => void;
  onError: (message: string) => void;
}

export const generateOutlineStream = async (
  projectId: string,
  callbacks: OutlineStreamCallbacks,
  language?: OutputLanguage,
  lockPageCount?: boolean,
  enableWebResearch?: boolean,
): Promise<void> => {
  const lang = language || await getStoredOutputLanguage();

  const response = await fetch(`/api/projects/${projectId}/generate/outline/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...accessCodeSession.getAuthHeaders(),
    },
    body: JSON.stringify({ language: lang, lock_page_count: lockPageCount, enable_web_research: enableWebResearch }),
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

    // Parse SSE events from buffer
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
        if (eventType === 'page') callbacks.onPage(parsed);
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
 * 根据用户要求修改大纲
 * @param projectId 项目ID
 * @param userRequirement 用户要求
 * @param previousRequirements 历史要求（可选）
 * @param language 输出语言（可选，默认从 sessionStorage 获取）
 */
export const refineOutline = async (
  projectId: string,
  userRequirement: string,
  previousRequirements?: string[],
  language?: OutputLanguage
): Promise<ApiResponse<{ pages: Page[]; message: string }>> => {
  const lang = language || await getStoredOutputLanguage();
  const response = await apiClient.post<ApiResponse<{ pages: Page[]; message: string }>>(
    `/api/projects/${projectId}/refine/outline`,
    {
      user_requirement: userRequirement,
      previous_requirements: previousRequirements || [],
      language: lang
    }
  );
  return response.data;
};
