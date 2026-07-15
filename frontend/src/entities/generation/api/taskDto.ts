export type GenerationJobStatusDto =
  | 'PENDING'
  | 'PROCESSING'
  | 'RUNNING'
  | 'COMPLETED'
  | 'FAILED';

export interface GenerationJobProgressDto {
  total: number;
  completed: number;
  failed?: number;
  percent?: number;
  current_step?: string;
  messages?: string[];
  warning_message?: string;
  download_url?: string;
  filename?: string;
  [key: string]: unknown;
}

export interface GenerationJobDto {
  task_id: string;
  id?: string;
  task_type?: string;
  status: GenerationJobStatusDto;
  progress?: GenerationJobProgressDto;
  error_message?: string;
  error?: string;
  result?: unknown;
  created_at?: string;
  completed_at?: string;
}
