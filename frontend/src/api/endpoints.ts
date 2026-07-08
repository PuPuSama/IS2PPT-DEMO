import { apiClient } from './client';
import type { Task, ApiResponse, Page, Material, SvgReasoningEffort } from '@/types';
import { accessCodeSession } from '@/shared/auth/accessCodeSession';
import { getStoredOutputLanguage, type OutputLanguage } from './settingsApi';

export type { Material };
export { checkAccessCode, verifyAccessCode } from './accessCodeApi';
export {
  createProject,
  uploadTemplate,
  listProjects,
  getProject,
  deleteProject,
  updateProject,
  updatePagesOrder,
} from './projectsApi';
export {
  exportPPTX,
  exportPDF,
  exportImages,
  exportEditablePPTX,
  listExports,
} from './exportsApi';
export {
  uploadReferenceFile,
  getReferenceFile,
  listProjectReferenceFiles,
  deleteReferenceFile,
  triggerFileParse,
  associateFileToProject,
  dissociateFileFromProject,
} from './referenceFilesApi';
export type { ReferenceFile } from './referenceFilesApi';
export {
  uploadUserTemplate,
  listUserTemplates,
  deleteUserTemplate,
  createUserStyleTemplate,
  listUserStyleTemplates,
  deleteUserStyleTemplate,
  extractStyleFromImage,
} from './templatesApi';
export type { UserTemplate, UserStyleTemplate } from './templatesApi';
export {
  uploadMaterial,
  getMaterialCaption,
  getMaterialByUrl,
} from './materialsApi';
export { createPptRenovationProject } from './renovationApi';
export {
  OUTPUT_LANGUAGE_OPTIONS,
  getDefaultOutputLanguage,
  getStoredOutputLanguage,
  getSettings,
  updateSettings,
  resetSettings,
  getOpenAIOAuthUrl,
  disconnectOpenAIOAuth,
  getOpenAIOAuthStatus,
  getOpenAIOAuthModels,
  submitOAuthManualCallback,
  verifyApiKey,
  testBaiduOcr,
  testTextModel,
  testCaptionModel,
  testBaiduInpaint,
  testImageModel,
  testMineruPdf,
  getTestStatus,
  checkForUpdates,
} from './settingsApi';
export type {
  OutputLanguage,
  OutputLanguageOption,
  TestSettingsOverride,
  UpdateCheckInfo,
} from './settingsApi';

// ===== 大纲生成 =====

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

// ===== 描述生成 =====

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
 * 重新生成 PPT 翻新项目的单页（重新解析原 PDF 并提取内容）
 */
export const regenerateRenovationPage = async (
  projectId: string,
  pageId: string,
  keepLayout: boolean = false,
  language?: OutputLanguage
): Promise<ApiResponse> => {
  const lang = language || await getStoredOutputLanguage();
  const response = await apiClient.post<ApiResponse>(
    `/api/projects/${projectId}/pages/${pageId}/regenerate-renovation`,
    { keep_layout: keepLayout, language: lang }
  );
  return response.data;
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

// ===== 图片生成 =====

/**
 * 批量生成图片
 * @param projectId 项目ID
 * @param language 输出语言（可选，默认从 sessionStorage 获取）
 * @param pageIds 可选的页面ID列表，如果不提供则生成所有页面
 */
export const generateImages = async (projectId: string, language?: OutputLanguage, pageIds?: string[]): Promise<ApiResponse> => {
  const lang = language || await getStoredOutputLanguage();
  const response = await apiClient.post<ApiResponse>(
    `/api/projects/${projectId}/generate/images`,
    { language: lang, page_ids: pageIds }
  );
  return response.data;
};

/**
 * 生成单页图片
 */
export const generatePageImage = async (
  projectId: string,
  pageId: string,
  forceRegenerate: boolean = false,
  language?: OutputLanguage
): Promise<ApiResponse> => {
  const lang = language || await getStoredOutputLanguage();
  const response = await apiClient.post<ApiResponse>(
    `/api/projects/${projectId}/pages/${pageId}/generate/image`,
    { force_regenerate: forceRegenerate, language: lang }
  );
  return response.data;
};

/**
 * 编辑图片（自然语言修改）
 */
export const editPageImage = async (
  projectId: string,
  pageId: string,
  editPrompt: string,
  contextImages?: {
    useTemplate?: boolean;
    descImageUrls?: string[];
    uploadedFiles?: File[];
  }
): Promise<ApiResponse> => {
  // 如果有上传的文件，使用 multipart/form-data
  if (contextImages?.uploadedFiles && contextImages.uploadedFiles.length > 0) {
    const formData = new FormData();
    formData.append('edit_instruction', editPrompt);
    formData.append('use_template', String(contextImages.useTemplate || false));
    if (contextImages.descImageUrls && contextImages.descImageUrls.length > 0) {
      formData.append('desc_image_urls', JSON.stringify(contextImages.descImageUrls));
    }
    // 添加上传的文件
    contextImages.uploadedFiles.forEach((file) => {
      formData.append('context_images', file);
    });

    const response = await apiClient.post<ApiResponse>(
      `/api/projects/${projectId}/pages/${pageId}/edit/image`,
      formData
    );
    return response.data;
  } else {
    // 使用 JSON
    const response = await apiClient.post<ApiResponse>(
      `/api/projects/${projectId}/pages/${pageId}/edit/image`,
      {
        edit_instruction: editPrompt,
        context_images: {
          use_template: contextImages?.useTemplate || false,
          desc_image_urls: contextImages?.descImageUrls || [],
        },
      }
    );
    return response.data;
  }
};

/**
 * 获取页面图片历史版本
 */
export const getPageImageVersions = async (
  projectId: string,
  pageId: string
): Promise<ApiResponse<{ versions: any[] }>> => {
  const response = await apiClient.get<ApiResponse<{ versions: any[] }>>(
    `/api/projects/${projectId}/pages/${pageId}/image-versions`
  );
  return response.data;
};

/**
 * 设置当前使用的图片版本
 */
export const setCurrentImageVersion = async (
  projectId: string,
  pageId: string,
  versionId: string
): Promise<ApiResponse> => {
  const response = await apiClient.post<ApiResponse>(
    `/api/projects/${projectId}/pages/${pageId}/image-versions/${versionId}/set-current`
  );
  return response.data;
};

// ===== 页面操作 =====

/**
 * 更新页面
 */
export const updatePage = async (
  projectId: string,
  pageId: string,
  data: Partial<Page>
): Promise<ApiResponse<Page>> => {
  const response = await apiClient.put<ApiResponse<Page>>(
    `/api/projects/${projectId}/pages/${pageId}`,
    data
  );
  return response.data;
};

/**
 * 获取页面的源 SVG（SVG 生成模式）
 */
export const getPageSvg = async (
  projectId: string,
  pageId: string
): Promise<ApiResponse<{ svg: string }>> => {
  const response = await apiClient.get<ApiResponse<{ svg: string }>>(
    `/api/projects/${projectId}/pages/${pageId}/svg`
  );
  return response.data;
};

/**
 * 保存编辑后的源 SVG：后端校验契约、重渲 PNG 新版本并持久化，返回更新后的 Page。
 */
export const savePageSvg = async (
  projectId: string,
  pageId: string,
  svg: string
): Promise<ApiResponse<Page>> => {
  const response = await apiClient.put<ApiResponse<Page>>(
    `/api/projects/${projectId}/pages/${pageId}/svg`,
    { svg }
  );
  return response.data;
};

/**
 * 更新页面描述
 */
export const updatePageDescription = async (
  projectId: string,
  pageId: string,
  descriptionContent: any,
  language?: OutputLanguage
): Promise<ApiResponse<Page>> => {
  const lang = language || await getStoredOutputLanguage();
  const response = await apiClient.put<ApiResponse<Page>>(
    `/api/projects/${projectId}/pages/${pageId}/description`,
    { description_content: descriptionContent, language: lang }
  );
  return response.data;
};

/**
 * 更新页面大纲
 */
export const updatePageOutline = async (
  projectId: string,
  pageId: string,
  outlineContent: any,
  language?: OutputLanguage
): Promise<ApiResponse<Page>> => {
  const lang = language || await getStoredOutputLanguage();
  const response = await apiClient.put<ApiResponse<Page>>(
    `/api/projects/${projectId}/pages/${pageId}/outline`,
    { outline_content: outlineContent, language: lang }
  );
  return response.data;
};

/**
 * 删除页面
 */
export const deletePage = async (projectId: string, pageId: string): Promise<ApiResponse> => {
  const response = await apiClient.delete<ApiResponse>(
    `/api/projects/${projectId}/pages/${pageId}`
  );
  return response.data;
};

/**
 * 添加页面
 */
export const addPage = async (projectId: string, data: Partial<Page>): Promise<ApiResponse<Page>> => {
  const response = await apiClient.post<ApiResponse<Page>>(
    `/api/projects/${projectId}/pages`,
    data
  );
  return response.data;
};

// ===== 任务查询 =====

/**
 * 查询任务状态
 */
export const getTaskStatus = async (projectId: string, taskId: string): Promise<ApiResponse<Task>> => {
  const response = await apiClient.get<ApiResponse<Task>>(`/api/projects/${projectId}/tasks/${taskId}`);
  return response.data;
};
