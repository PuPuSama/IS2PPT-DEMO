import { apiClient } from './client';
import type { ApiResponse, Page } from '@/types';
import { getStoredOutputLanguage, type OutputLanguage } from './settingsApi';

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
