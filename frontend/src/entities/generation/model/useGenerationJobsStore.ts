import { create } from 'zustand';
import type {
  GenerationJobsSnapshot,
  GenerationProgress,
  GenerationStream,
} from './types';

interface GenerationJobsState extends GenerationJobsSnapshot {
  syncSnapshot: (snapshot: GenerationJobsSnapshot) => void;
  startJob: (jobId: string) => void;
  updateProgress: (progress: GenerationProgress | null) => void;
  finishActiveJob: () => void;
  assignSlides: (jobId: string, slideIds: string[]) => void;
  releaseSlides: (slideIds: string[], jobId?: string) => void;
  setWarning: (warning: string | null) => void;
  setStreamActive: (stream: GenerationStream, active: boolean) => void;
  reset: () => void;
}

const emptySnapshot = (): GenerationJobsSnapshot => ({
  activeJobId: null,
  progress: null,
  jobsBySlideId: {},
  warning: null,
  outlineStreamActive: false,
  descriptionStreamActive: false,
});

export const useGenerationJobsStore = create<GenerationJobsState>((set) => ({
  ...emptySnapshot(),

  syncSnapshot: (snapshot) => set({
    ...snapshot,
    progress: snapshot.progress
      ? {
          ...snapshot.progress,
          ...(snapshot.progress.messages
            ? { messages: [...snapshot.progress.messages] }
            : {}),
        }
      : null,
    jobsBySlideId: { ...snapshot.jobsBySlideId },
  }),

  startJob: (jobId) => set({ activeJobId: jobId, progress: null }),

  updateProgress: (progress) => set({
    progress: progress ? { ...progress } : null,
  }),

  finishActiveJob: () => set({ activeJobId: null, progress: null }),

  assignSlides: (jobId, slideIds) => set((state) => {
    const jobsBySlideId = { ...state.jobsBySlideId };
    slideIds.forEach((slideId) => {
      jobsBySlideId[slideId] = jobId;
    });
    return { jobsBySlideId };
  }),

  releaseSlides: (slideIds, jobId) => set((state) => {
    const jobsBySlideId = { ...state.jobsBySlideId };
    slideIds.forEach((slideId) => {
      if (!jobId || jobsBySlideId[slideId] === jobId) {
        delete jobsBySlideId[slideId];
      }
    });
    return { jobsBySlideId };
  }),

  setWarning: (warning) => set({ warning }),

  setStreamActive: (stream, active) => set(
    stream === 'outline'
      ? { outlineStreamActive: active }
      : { descriptionStreamActive: active },
  ),

  reset: () => set(emptySnapshot()),
}));
