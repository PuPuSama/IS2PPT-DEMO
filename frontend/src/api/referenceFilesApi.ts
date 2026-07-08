import { apiClient } from './client';
import type { ApiResponse } from '@/types';

export interface ReferenceFile {
  id: string;
  project_id: string | null;
  filename: string;
  file_size: number;
  file_type: string;
  parse_status: 'pending' | 'parsing' | 'completed' | 'failed';
  markdown_content: string | null;
  error_message: string | null;
  image_caption_failed_count?: number;  // Optional, calculated dynamically
  created_at: string;
  updated_at: string;
}

/**
 * 上传参考文件
 * @param file 文件
 * @param projectId 可选的项目ID（如果不提供或为'none'，则为全局文件）
 */
export const uploadReferenceFile = async (
  file: File,
  projectId?: string | null
): Promise<ApiResponse<{ file: ReferenceFile }>> => {
  const formData = new FormData();
  formData.append('file', file);
  if (projectId && projectId !== 'none') {
    formData.append('project_id', projectId);
  }

  const response = await apiClient.post<ApiResponse<{ file: ReferenceFile }>>(
    '/api/reference-files/upload',
    formData
  );
  return response.data;
};

/**
 * 获取参考文件信息
 * @param fileId 文件ID
 */
export const getReferenceFile = async (fileId: string): Promise<ApiResponse<{ file: ReferenceFile }>> => {
  const response = await apiClient.get<ApiResponse<{ file: ReferenceFile }>>(
    `/api/reference-files/${fileId}`
  );
  return response.data;
};

/**
 * 列出项目的参考文件
 * @param projectId 项目ID（'global' 或 'none' 表示列出全局文件）
 */
export const listProjectReferenceFiles = async (
  projectId: string
): Promise<ApiResponse<{ files: ReferenceFile[] }>> => {
  const response = await apiClient.get<ApiResponse<{ files: ReferenceFile[] }>>(
    `/api/reference-files/project/${projectId}`
  );
  return response.data;
};

/**
 * 删除参考文件
 * @param fileId 文件ID
 */
export const deleteReferenceFile = async (fileId: string): Promise<ApiResponse<{ message: string }>> => {
  const response = await apiClient.delete<ApiResponse<{ message: string }>>(
    `/api/reference-files/${fileId}`
  );
  return response.data;
};

/**
 * 触发文件解析
 * @param fileId 文件ID
 */
export const triggerFileParse = async (fileId: string): Promise<ApiResponse<{ file: ReferenceFile; message: string }>> => {
  const response = await apiClient.post<ApiResponse<{ file: ReferenceFile; message: string }>>(
    `/api/reference-files/${fileId}/parse`
  );
  return response.data;
};

/**
 * 将参考文件关联到项目
 * @param fileId 文件ID
 * @param projectId 项目ID
 */
export const associateFileToProject = async (
  fileId: string,
  projectId: string
): Promise<ApiResponse<{ file: ReferenceFile }>> => {
  const response = await apiClient.post<ApiResponse<{ file: ReferenceFile }>>(
    `/api/reference-files/${fileId}/associate`,
    { project_id: projectId }
  );
  return response.data;
};

/**
 * 从项目中移除参考文件（不删除文件本身）
 * @param fileId 文件ID
 */
export const dissociateFileFromProject = async (
  fileId: string
): Promise<ApiResponse<{ file: ReferenceFile; message: string }>> => {
  const response = await apiClient.post<ApiResponse<{ file: ReferenceFile; message: string }>>(
    `/api/reference-files/${fileId}/dissociate`
  );
  return response.data;
};
