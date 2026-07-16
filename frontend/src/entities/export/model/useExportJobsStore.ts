import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { BackendJobPoller } from '@/shared/api/backendJobPoller';
import { createBackendJobPoller } from '@/shared/api/backendJobPoller';
import { normalizeErrorMessage } from '@/utils';
import { STORAGE_KEYS } from '@/shared/storage/storageKeys';
import { fetchExportJob, requestDeckExport } from '../api/exportRepository';
import { exportJobPatchFromDto } from './exportJobMapper';
import type { ExportJob, ExportRequest } from './types';
import { isExportJobActive, isExportJobFinished } from './types';

interface ExportJobsState {
  jobs: ExportJob[];
  startExport: (request: ExportRequest) => Promise<ExportJob>;
  updateJob: (id: string, updates: Partial<ExportJob>) => void;
  removeJob: (id: string) => void;
  clearFinished: () => void;
  pollJob: (id: string) => Promise<void>;
  restoreActiveJobs: () => void;
  reset: () => void;
}

const MAX_STORED_JOBS = 20;
const activePollers = new Map<string, BackendJobPoller>();

const createJobId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `export-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

const errorMessage = (error: unknown, fallback: string): string => {
  if (error instanceof Error && error.message) return normalizeErrorMessage(error.message);
  return fallback;
};

export const useExportJobsStore = create<ExportJobsState>()(
  persist(
    (set, get) => ({
      jobs: [],

      startExport: async (request) => {
        const job: ExportJob = {
          id: createJobId(),
          deckId: request.deckId,
          format: request.format,
          status: 'queued',
          slideIds: request.slideIds,
          filename: request.filename,
          createdAt: new Date().toISOString(),
        };
        set((state) => ({ jobs: [job, ...state.jobs].slice(0, MAX_STORED_JOBS) }));

        try {
          const result = await requestDeckExport(request);
          if (result.kind === 'download') {
            const completedJob: ExportJob = {
              ...job,
              status: 'ready',
              downloadUrl: result.downloadUrl,
              filename: result.filename,
              completedAt: new Date().toISOString(),
            };
            get().updateJob(job.id, completedJob);
            return completedJob;
          }

          const runningJob: ExportJob = {
            ...job,
            backendJobId: result.backendJobId,
            status: 'running',
          };
          get().updateJob(job.id, runningJob);
          void get().pollJob(job.id);
          return runningJob;
        } catch (error) {
          const failedJob: ExportJob = {
            ...job,
            status: 'failed',
            errorMessage: errorMessage(error, 'Export request failed'),
            completedAt: new Date().toISOString(),
          };
          get().updateJob(job.id, failedJob);
          throw error;
        }
      },

      updateJob: (id, updates) => set((state) => ({
        jobs: state.jobs.map((job) => job.id === id ? { ...job, ...updates } : job),
      })),

      removeJob: (id) => {
        activePollers.get(id)?.cancel();
        activePollers.delete(id);
        set((state) => ({ jobs: state.jobs.filter((job) => job.id !== id) }));
      },

      clearFinished: () => set((state) => ({
        jobs: state.jobs.filter((job) => !isExportJobFinished(job)),
      })),

      pollJob: async (id) => {
        const job = get().jobs.find((candidate) => candidate.id === id);
        if (!job || !job.backendJobId || !isExportJobActive(job)) return;

        const existingPoller = activePollers.get(id);
        if (existingPoller) {
          await existingPoller.checkNow();
          return;
        }

        const stopPolling = () => {
          activePollers.delete(id);
        };
        const poller = createBackendJobPoller({
          deckId: job.deckId,
          jobId: job.backendJobId,
          maxConsecutiveErrors: 2,
          fetchJob: async (deckId, backendJobId) => ({
            data: await fetchExportJob(deckId, backendJobId),
          }),
          onUpdate: (dto) => {
            get().updateJob(id, exportJobPatchFromDto(dto));
          },
          onComplete: () => stopPolling(),
          onFailure: (dto) => {
            const patch = exportJobPatchFromDto(dto);
            get().updateJob(id, {
              ...patch,
              errorMessage: patch.errorMessage || 'Export failed',
            });
            stopPolling();
          },
          onUnknown: (dto) => {
            get().updateJob(id, {
              status: 'failed',
              errorMessage: `Unknown export status: ${dto.status}`,
              completedAt: new Date().toISOString(),
            });
            stopPolling();
          },
          onError: (error, _attempt, willRetry) => {
            if (willRetry) return;
            get().updateJob(id, {
              status: 'failed',
              errorMessage: errorMessage(error, 'Export status could not be read'),
              completedAt: new Date().toISOString(),
            });
            stopPolling();
          },
        });

        activePollers.set(id, poller);
        await poller.checkNow();
      },

      restoreActiveJobs: () => {
        get().jobs.filter(isExportJobActive).forEach((job) => {
          if (job.backendJobId) {
            void get().pollJob(job.id);
            return;
          }
          get().updateJob(job.id, {
            status: 'failed',
            errorMessage: 'Export was interrupted before it could be resumed',
            completedAt: new Date().toISOString(),
          });
        });
      },

      reset: () => {
        activePollers.forEach((poller) => poller.cancel());
        activePollers.clear();
        set({ jobs: [] });
      },
    }),
    {
      name: STORAGE_KEYS.exportJobs,
      version: 1,
      partialize: (state) => ({ jobs: state.jobs.slice(0, MAX_STORED_JOBS) }),
    },
  ),
);
