import { apiClient } from './client';
import type { ApiResponse } from '@/types';

export interface UserTemplate {
  template_id: string;
  name?: string;
  template_image_url: string;
  thumb_url?: string;  // Thumbnail URL for faster loading
  created_at?: string;
  updated_at?: string;
}

/**
 * 上传用户模板
 */
export const uploadUserTemplate = async (
  templateImage: File,
  name?: string
): Promise<ApiResponse<UserTemplate>> => {
  const formData = new FormData();
  formData.append('template_image', templateImage);
  if (name) {
    formData.append('name', name);
  }

  const response = await apiClient.post<ApiResponse<UserTemplate>>(
    '/api/user-templates',
    formData
  );
  return response.data;
};

/**
 * 获取用户模板列表
 */
export const listUserTemplates = async (): Promise<ApiResponse<{ templates: UserTemplate[] }>> => {
  const response = await apiClient.get<ApiResponse<{ templates: UserTemplate[] }>>(
    '/api/user-templates'
  );
  return response.data;
};

/**
 * 删除用户模板
 */
export const deleteUserTemplate = async (templateId: string): Promise<ApiResponse> => {
  const response = await apiClient.delete<ApiResponse>(`/api/user-templates/${templateId}`);
  return response.data;
};

export interface UserStyleTemplate {
  id: string;
  name: string;
  description: string;
  color?: string;
  created_at?: string;
}

export const createUserStyleTemplate = async (
  data: { name: string; description: string; color?: string }
): Promise<ApiResponse<UserStyleTemplate>> => {
  const response = await apiClient.post<ApiResponse<UserStyleTemplate>>(
    '/api/user-style-templates',
    data
  );
  return response.data;
};

export const listUserStyleTemplates = async (): Promise<ApiResponse<{ templates: UserStyleTemplate[] }>> => {
  const response = await apiClient.get<ApiResponse<{ templates: UserStyleTemplate[] }>>(
    '/api/user-style-templates'
  );
  return response.data;
};

export const deleteUserStyleTemplate = async (id: string): Promise<ApiResponse> => {
  const response = await apiClient.delete<ApiResponse>(`/api/user-style-templates/${id}`);
  return response.data;
};

/**
 * 从图片提取风格描述（通用，不绑定项目）
 */
export const extractStyleFromImage = async (
  imageFile: File
): Promise<ApiResponse<{ style_description: string }>> => {
  const formData = new FormData();
  formData.append('image', imageFile);

  const response = await apiClient.post<ApiResponse<{ style_description: string }>>(
    '/api/extract-style',
    formData
  );
  return response.data;
};
