import { apiClient } from './client';
import type { ApiResponse } from '@/types';
import { getStoredOutputLanguage, type OutputLanguage } from './settingsApi';

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
