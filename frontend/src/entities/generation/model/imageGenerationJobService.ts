import type { GenerationJobPhase } from '../api/generationJobPoller';
import type { GenerationJobDto } from '../api/taskDto';

interface ImageJobLogger {
  debug: (message: string) => void;
  warn: (message: string) => void;
  error: (message: string, error?: unknown) => void;
}

interface ImageGenerationJobOptions {
  jobId: string;
  slideIds: string[];
  readAssignments: () => Record<string, string>;
  writeAssignments: (assignments: Record<string, string>) => void;
  refreshDeck: () => Promise<void>;
  isSlideSettled: (slideId: string) => boolean;
  areSlideAssetsReady: () => boolean | null;
  setWarning: (warning: string | null) => void;
  setError: (message: string) => void;
  failureMessage: (job: GenerationJobDto) => string;
  maxAssetSyncRetries?: number;
  assetSyncDelayMs?: number;
  delay?: (delayMs: number) => Promise<void>;
  logger?: ImageJobLogger;
}

export interface ImageGenerationJobCallbacks {
  onUpdate: (job: GenerationJobDto, phase: GenerationJobPhase) => Promise<void>;
  onComplete: (job: GenerationJobDto) => Promise<void>;
  onFailure: (job: GenerationJobDto) => Promise<void>;
  onUnknown: (job: GenerationJobDto) => void;
  onError: (error: unknown) => void;
}

const silentLogger: ImageJobLogger = {
  debug: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};

const defaultDelay = (delayMs: number) => new Promise<void>((resolve) => {
  setTimeout(resolve, delayMs);
});

export const createImageGenerationJobCallbacks = (
  options: ImageGenerationJobOptions,
): ImageGenerationJobCallbacks => {
  const logger = options.logger ?? silentLogger;
  const delay = options.delay ?? defaultDelay;
  const maxRetries = options.maxAssetSyncRetries ?? 5;
  const retryDelayMs = options.assetSyncDelayMs ?? 1000;

  const releaseSlides = (shouldRelease: (slideId: string) => boolean) => {
    const assignments = { ...options.readAssignments() };
    let changed = false;

    options.slideIds.forEach((slideId) => {
      if (assignments[slideId] === options.jobId && shouldRelease(slideId)) {
        delete assignments[slideId];
        changed = true;
      }
    });

    if (changed) options.writeAssignments(assignments);
  };

  const releaseAllSlides = () => releaseSlides(() => true);

  const synchronizeAssets = async () => {
    for (let retry = 0; retry <= maxRetries; retry += 1) {
      await options.refreshDeck();
      const ready = options.areSlideAssetsReady();
      if (ready === null) return;
      if (ready) {
        logger.debug('All generated slide assets are synchronized');
        return;
      }

      if (retry === maxRetries) {
        logger.warn('Generated slide assets did not synchronize before the retry limit');
        return;
      }

      const nextRetry = retry + 1;
      logger.debug(
        `Generated slide assets are not ready; retrying in ${retryDelayMs}ms (${nextRetry}/${maxRetries})`,
      );
      await delay(retryDelayMs);
    }
  };

  return {
    onUpdate: async (job, phase) => {
      logger.debug(`Image generation job ${options.jobId} reported ${job.status}`);
      if (phase !== 'waiting' && phase !== 'running') return;

      const warning = job.progress?.warning_message;
      if (warning) options.setWarning(warning);

      await options.refreshDeck();
      releaseSlides(options.isSlideSettled);
    },

    onComplete: async (job) => {
      logger.debug(`Image generation job ${options.jobId} completed`);
      releaseAllSlides();
      options.setWarning(job.progress?.warning_message || null);
      await synchronizeAssets();
    },

    onFailure: async (job) => {
      logger.error(
        `Image generation job ${options.jobId} failed`,
        job.error_message || job.error,
      );
      releaseAllSlides();
      options.setError(options.failureMessage(job));
      await options.refreshDeck();
    },

    onUnknown: (job) => {
      logger.warn(`Image generation job ${options.jobId} reported unknown status ${job.status}`);
      releaseAllSlides();
    },

    onError: (error) => {
      logger.error(`Image generation job ${options.jobId} polling failed`, error);
      releaseAllSlides();
    },
  };
};
