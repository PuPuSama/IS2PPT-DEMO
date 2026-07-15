import { apiClient } from './client';
import type { ApiResponse } from '@/types';
import type { GenerationJobDto } from '@/entities/generation/api/taskDto';

/**
 * 查询任务状态
 */
export const getTaskStatus = async (projectId: string, taskId: string): Promise<ApiResponse<GenerationJobDto>> => {
  const response = await apiClient.get<ApiResponse<GenerationJobDto>>(`/api/projects/${projectId}/tasks/${taskId}`);
  return response.data;
};
