import { apiClient } from './client';
import type { ApiResponse, Material } from '@/types';

/**
 * 上传编辑器内联图片
 * @param file 图片文件
 * @param projectId 可选的项目ID
 *   - If provided: Upload material bound to the project
 *   - If not provided or 'none': Upload as global material (not bound to any project)
 */
export const uploadMaterial = async (
  file: File,
  projectId?: string | null,
  generateCaption?: boolean
): Promise<ApiResponse<Material & { caption?: string }>> => {
  const formData = new FormData();
  formData.append('file', file);

  let url: string;
  if (!projectId || projectId === 'none') {
    // Use global upload endpoint for materials not bound to any project
    url = '/api/materials/upload';
  } else {
    // Use project-specific upload endpoint
    url = `/api/projects/${projectId}/materials/upload`;
  }

  if (generateCaption) {
    url += (url.includes('?') ? '&' : '?') + 'generate_caption=true';
  }

  const response = await apiClient.post<ApiResponse<Material & { caption?: string }>>(url, formData);
  return response.data;
};

/**
 * Generate caption for an existing material
 */
export const getMaterialCaption = async (materialId: string): Promise<ApiResponse<{ caption: string }>> => {
  const response = await apiClient.get<ApiResponse<{ caption: string }>>(`/api/materials/${materialId}/caption`);
  return response.data;
};

/**
 * Get material by URL and ensure it has a caption
 */
export const getMaterialByUrl = async (url: string): Promise<ApiResponse<Material>> => {
  const response = await apiClient.get<ApiResponse<Material>>(`/api/materials/by-url`, { params: { url } });
  return response.data;
};
