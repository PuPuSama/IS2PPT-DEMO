export interface GenerationProgress {
  total: number;
  completed: number;
  failed?: number;
  percent?: number;
  currentStep?: string;
  messages?: string[];
}

export type GenerationStream = 'outline' | 'description';

export interface GenerationJobsSnapshot {
  activeJobId: string | null;
  progress: GenerationProgress | null;
  jobsBySlideId: Record<string, string>;
  warning: string | null;
  outlineStreamActive: boolean;
  descriptionStreamActive: boolean;
}
