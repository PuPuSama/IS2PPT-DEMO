import type { GenerationJobProgressDto } from '../api/taskDto';
import type { GenerationProgress } from './types';

export const generationProgressFromDto = (
  progress: GenerationJobProgressDto,
): GenerationProgress => ({
  total: progress.total,
  completed: progress.completed,
  ...(typeof progress.failed === 'number' ? { failed: progress.failed } : {}),
  ...(typeof progress.percent === 'number' ? { percent: progress.percent } : {}),
  ...(typeof progress.current_step === 'string'
    ? { currentStep: progress.current_step }
    : {}),
  ...(Array.isArray(progress.messages)
    ? { messages: progress.messages.filter((message): message is string => typeof message === 'string') }
    : {}),
});
