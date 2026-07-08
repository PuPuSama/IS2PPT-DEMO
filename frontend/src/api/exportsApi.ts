import { apiClient } from './client';
import type { ApiResponse } from '@/types';

/**
 * Helper function to build query string with page_ids
 */
const buildPageIdsQuery = (pageIds?: string[]): string => {
  if (!pageIds || pageIds.length === 0) return '';
  const params = new URLSearchParams();
  params.set('page_ids', pageIds.join(','));
  return `?${params.toString()}`;
};

const buildExportQuery = (params: Record<string, string | string[] | boolean | undefined>): string => {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined) return;
    if (Array.isArray(value)) {
      if (value.length > 0) query.set(key, value.join(','));
      return;
    }
    query.set(key, String(value));
  });
  const queryString = query.toString();
  return queryString ? `?${queryString}` : '';
};

/**
 * 导出为PPTX
 * @param projectId 项目ID
 * @param pageIds 可选的页面ID列表，如果不提供则导出所有页面
 */
export const exportPPTX = async (
  projectId: string,
  pageIds?: string[],
  options?: {
    transitionEnabled?: boolean;
    transitionEffects?: string[];
  }
): Promise<ApiResponse<{ download_url: string; download_url_absolute?: string }>> => {
  const url = `/api/projects/${projectId}/export/pptx${buildExportQuery({
    page_ids: pageIds,
    transition_enabled: options?.transitionEnabled ? true : undefined,
    transition_effects: options?.transitionEnabled ? options.transitionEffects : undefined,
  })}`;
  const response = await apiClient.get<
    ApiResponse<{ download_url: string; download_url_absolute?: string }>
  >(url);
  return response.data;
};

/**
 * 导出为PDF
 * @param projectId 项目ID
 * @param pageIds 可选的页面ID列表，如果不提供则导出所有页面
 */
export const exportPDF = async (
  projectId: string,
  pageIds?: string[]
): Promise<ApiResponse<{ download_url: string; download_url_absolute?: string }>> => {
  const url = `/api/projects/${projectId}/export/pdf${buildPageIdsQuery(pageIds)}`;
  const response = await apiClient.get<
    ApiResponse<{ download_url: string; download_url_absolute?: string }>
  >(url);
  return response.data;
};

/**
 * 导出为图片（单张直接下载，多张打包ZIP）
 */
export const exportImages = async (
  projectId: string,
  pageIds?: string[]
): Promise<ApiResponse<{ download_url: string; download_url_absolute?: string }>> => {
  const url = `/api/projects/${projectId}/export/images${buildPageIdsQuery(pageIds)}`;
  const response = await apiClient.get<
    ApiResponse<{ download_url: string; download_url_absolute?: string }>
  >(url);
  return response.data;
};

/**
 * 导出为可编辑PPTX（异步任务）
 * @param projectId 项目ID
 * @param filename 可选的文件名
 * @param pageIds 可选的页面ID列表，如果不提供则导出所有页面
 */
export const exportEditablePPTX = async (
  projectId: string,
  filename?: string,
  pageIds?: string[]
): Promise<ApiResponse<{ task_id: string }>> => {
  const response = await apiClient.post<
    ApiResponse<{ task_id: string }>
  >(`/api/projects/${projectId}/export/editable-pptx`, {
    filename,
    page_ids: pageIds
  });
  return response.data;
};

/**
 * 列出项目已导出的文件
 */
export const listExports = async (
  projectId: string,
): Promise<ApiResponse<{ files: Array<{
  filename: string;
  type: string;
  size: number;
  modified_at: string;
  download_url: string;
}> }>> => {
  const response = await apiClient.get(`/api/projects/${projectId}/exports`);
  return response.data;
};
