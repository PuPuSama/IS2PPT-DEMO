import {
  backendJobPhaseFromDto,
  createBackendJobPoller,
} from '@/shared/api/backendJobPoller';
import type {
  BackendJobPhase,
  BackendJobPoller,
  BackendJobPollerOptions,
} from '@/shared/api/backendJobPoller';

export type GenerationJobPhase = BackendJobPhase;
export type GenerationJobPoller = BackendJobPoller;
export interface GenerationJobPollerOptions
  extends Omit<BackendJobPollerOptions, 'deckId'> {
  projectId: string;
}

export const generationJobPhaseFromDto = backendJobPhaseFromDto;

export const createGenerationJobPoller = (
  options: GenerationJobPollerOptions,
): GenerationJobPoller => {
  const { projectId, ...pollerOptions } = options;
  return createBackendJobPoller({
    ...pollerOptions,
    deckId: projectId,
  });
};
