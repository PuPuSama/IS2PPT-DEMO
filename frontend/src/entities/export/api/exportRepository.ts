import {
  exportEditablePPTX,
  exportImages,
  exportPDF,
  exportPPTX,
  listExports,
} from '@/api/exportsApi';
import { getTaskStatus } from '@/api/tasksApi';
import type { BackendJobDto } from '@/shared/api/backendJobDto';
import type { ExportedFile, ExportRequest } from '../model/types';

export type ExportRequestResult =
  | { kind: 'download'; downloadUrl: string; filename?: string }
  | { kind: 'job'; backendJobId: string };

const filenameFromUrl = (url: string): string | undefined => {
  const filename = url.split('/').pop()?.split('?')[0];
  return filename ? decodeURIComponent(filename) : undefined;
};

const downloadResult = (data: {
  download_url: string;
  download_url_absolute?: string;
} | undefined): ExportRequestResult => {
  const downloadUrl = data?.download_url || data?.download_url_absolute;
  if (!downloadUrl) throw new Error('Export response did not include a download URL');
  return { kind: 'download', downloadUrl, filename: filenameFromUrl(downloadUrl) };
};

export const requestDeckExport = async (
  request: ExportRequest,
): Promise<ExportRequestResult> => {
  if (request.format === 'editable-pptx') {
    const response = await exportEditablePPTX(
      request.deckId,
      request.filename,
      request.slideIds,
    );
    const backendJobId = response.data?.task_id;
    if (!backendJobId) throw new Error('Export response did not include a job ID');
    return { kind: 'job', backendJobId };
  }

  if (request.format === 'pptx') {
    const response = await exportPPTX(
      request.deckId,
      request.slideIds,
      request.pptxOptions,
    );
    return downloadResult(response.data);
  }

  if (request.format === 'pdf') {
    const response = await exportPDF(request.deckId, request.slideIds);
    return downloadResult(response.data);
  }

  const response = await exportImages(request.deckId, request.slideIds);
  return downloadResult(response.data);
};

export const fetchExportJob = async (
  deckId: string,
  backendJobId: string,
): Promise<BackendJobDto> => {
  const response = await getTaskStatus(deckId, backendJobId);
  if (!response.data) throw new Error('Export job response did not include task data');
  return response.data;
};

export const listDeckExports = async (deckId: string): Promise<ExportedFile[]> => {
  const response = await listExports(deckId);
  return response.data?.files.map((file) => ({
    filename: file.filename,
    format: file.type,
    size: file.size,
    modifiedAt: file.modified_at,
    downloadUrl: file.download_url,
  })) ?? [];
};
