import { apiClient } from './client';
import type { ApiResponse } from '@/types';
import type { BackendJobDto } from '@/shared/api/backendJobDto';

/**
 * 查询任务状态
 */
export const getTaskStatus = async (projectId: string, taskId: string): Promise<ApiResponse<BackendJobDto>> => {
  const response = await apiClient.get<ApiResponse<BackendJobDto>>(`/api/projects/${projectId}/tasks/${taskId}`);
  return response.data;
};
