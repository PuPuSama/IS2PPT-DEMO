import type { BackendJobDto } from '@/shared/api/backendJobDto';
import type {
  ExportJobStatus,
  ExportProgress,
  ExportWarningDetails,
  ExportWarningItem,
} from './types';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const stringList = (value: unknown): string[] | undefined => {
  if (!Array.isArray(value)) return undefined;
  return value.filter((item): item is string => typeof item === 'string');
};

const warningItems = (
  value: unknown,
  fields: Array<'element_id' | 'text' | 'path' | 'context'>,
): ExportWarningItem[] | undefined => {
  if (!Array.isArray(value)) return undefined;

  return value.flatMap((item) => {
    if (!isRecord(item) || typeof item.reason !== 'string') return [];
    const mapped: ExportWarningItem = { reason: item.reason };
    fields.forEach((field) => {
      const fieldValue = item[field];
      if (typeof fieldValue !== 'string') return;
      if (field === 'element_id') mapped.elementId = fieldValue;
      if (field === 'text') mapped.text = fieldValue;
      if (field === 'path') mapped.path = fieldValue;
      if (field === 'context') mapped.context = fieldValue;
    });
    return [mapped];
  });
};

const warningDetailsFromDto = (value: unknown): ExportWarningDetails | undefined => {
  if (!isRecord(value)) return undefined;

  return {
    styleExtractionFailed: warningItems(value.style_extraction_failed, ['element_id']),
    textRenderFailed: warningItems(value.text_render_failed, ['text']),
    imageAddFailed: warningItems(value.image_add_failed, ['path']),
    jsonParseFailed: warningItems(value.json_parse_failed, ['context']),
    otherWarnings: stringList(value.other_warnings),
    totalWarnings: typeof value.total_warnings === 'number' ? value.total_warnings : undefined,
  };
};

const parseProgress = (value: unknown): Record<string, unknown> | undefined => {
  if (isRecord(value)) return value;
  if (typeof value !== 'string') return undefined;

  try {
    const parsed: unknown = JSON.parse(value);
    return isRecord(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
};

export const exportJobStatusFromDto = (status: string): ExportJobStatus => {
  if (status === 'PENDING') return 'queued';
  if (status === 'PROCESSING' || status === 'RUNNING') return 'running';
  if (status === 'COMPLETED') return 'ready';
  return 'failed';
};

export const exportProgressFromDto = (value: unknown): ExportProgress | undefined => {
  const progress = parseProgress(value);
  if (!progress) return undefined;

  return {
    total: typeof progress.total === 'number' ? progress.total : 0,
    completed: typeof progress.completed === 'number' ? progress.completed : 0,
    percent: typeof progress.percent === 'number' ? progress.percent : undefined,
    currentStep: typeof progress.current_step === 'string' ? progress.current_step : undefined,
    helpText: typeof progress.help_text === 'string' ? progress.help_text : undefined,
    messages: stringList(progress.messages),
    warnings: stringList(progress.warnings),
    warningDetails: warningDetailsFromDto(progress.warning_details),
  };
};

const errorMessageFromDto = (job: BackendJobDto): string | undefined => {
  if (typeof job.error_message === 'string' && job.error_message) return job.error_message;
  if (typeof job.error === 'string' && job.error) return job.error;
  if (isRecord(job.error) && typeof job.error.message === 'string') return job.error.message;
  return undefined;
};

export const exportJobPatchFromDto = (
  job: BackendJobDto,
  completedAt = new Date().toISOString(),
) => {
  const rawProgress = parseProgress(job.progress);
  const progress = exportProgressFromDto(job.progress);
  const status = exportJobStatusFromDto(job.status);

  return {
    status,
    ...(progress ? { progress } : {}),
    ...(typeof rawProgress?.download_url === 'string'
      ? { downloadUrl: rawProgress.download_url }
      : {}),
    ...(typeof rawProgress?.filename === 'string'
      ? { filename: rawProgress.filename }
      : {}),
    ...(status === 'failed' ? { errorMessage: errorMessageFromDto(job) } : {}),
    ...(status === 'ready' || status === 'failed'
      ? { completedAt: job.completed_at || completedAt }
      : {}),
  };
};
