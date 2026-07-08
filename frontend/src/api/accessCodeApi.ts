import { apiClient } from './client';
import type { ApiResponse } from '@/types';

export const checkAccessCode = async (): Promise<ApiResponse<{ enabled: boolean }>> => {
  const response = await apiClient.get<ApiResponse<{ enabled: boolean }>>('/api/access-code/check');
  return response.data;
};

export const verifyAccessCode = async (code: string): Promise<ApiResponse<{ valid: boolean }>> => {
  const response = await apiClient.post<ApiResponse<{ valid: boolean }>>('/api/access-code/verify', { code });
  return response.data;
};
