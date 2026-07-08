import { apiClient } from './client';
import type { ApiResponse } from '@/types';

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
