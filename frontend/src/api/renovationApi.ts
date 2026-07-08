import { apiClient } from './client';
import type { ApiResponse } from '@/types';
import { getStoredOutputLanguage, type OutputLanguage } from './settingsApi';

/**
 * 创建 PPT 翻新项目
 * 上传 PDF/PPTX 文件，后端异步解析内容并填充大纲+描述
 */
export const createPptRenovationProject = async (
  file: File,
  options?: {
    keepLayout?: boolean;
    templateStyle?: string;
    language?: string;
  }
): Promise<ApiResponse<{ project_id: string; task_id: string; page_count: number }>> => {
  const formData = new FormData();
  formData.append('file', file);
  if (options?.keepLayout) {
    formData.append('keep_layout', 'true');
  }
  if (options?.templateStyle) {
    formData.append('template_style', options.templateStyle);
  }
  if (options?.language) {
    formData.append('language', options.language);
  }

  const response = await apiClient.post<ApiResponse<{ project_id: string; task_id: string; page_count: number }>>(
    '/api/projects/renovation',
    formData
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
