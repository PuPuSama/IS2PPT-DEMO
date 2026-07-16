export type ExportFormat = 'pptx' | 'pdf' | 'editable-pptx' | 'images';

export type ExportJobStatus = 'queued' | 'running' | 'ready' | 'failed';

export interface ExportWarningItem {
  reason: string;
  elementId?: string;
  text?: string;
  path?: string;
  context?: string;
}

export interface ExportWarningDetails {
  styleExtractionFailed?: ExportWarningItem[];
  textRenderFailed?: ExportWarningItem[];
  imageAddFailed?: ExportWarningItem[];
  jsonParseFailed?: ExportWarningItem[];
  otherWarnings?: string[];
  totalWarnings?: number;
}

export interface ExportProgress {
  total: number;
  completed: number;
  percent?: number;
  currentStep?: string;
  helpText?: string;
  messages?: string[];
  warnings?: string[];
  warningDetails?: ExportWarningDetails;
}

export interface ExportJob {
  id: string;
  backendJobId?: string;
  deckId: string;
  format: ExportFormat;
  status: ExportJobStatus;
  slideIds?: string[];
  progress?: ExportProgress;
  downloadUrl?: string;
  filename?: string;
  errorMessage?: string;
  createdAt: string;
  completedAt?: string;
}

export interface ExportRequest {
  deckId: string;
  format: ExportFormat;
  slideIds?: string[];
  filename?: string;
  pptxOptions?: {
    transitionEnabled?: boolean;
    transitionEffects?: string[];
  };
}

export interface ExportedFile {
  filename: string;
  format: string;
  size: number;
  modifiedAt: string;
  downloadUrl: string;
}

export const isExportJobActive = (job: ExportJob): boolean =>
  job.status === 'queued' || job.status === 'running';

export const isExportJobFinished = (job: ExportJob): boolean =>
  job.status === 'ready' || job.status === 'failed';
