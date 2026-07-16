import { useCallback, useState } from 'react';
import { getSettings } from '@/api/settingsApi';
import { uiDismissals } from '@/shared/storage/uiDismissals';
import { generationQualityDecision } from './generationQualityGate';

type GenerationCommand = () => Promise<void>;

export const useGenerationQualityGate = () => {
  const [pendingCommand, setPendingCommand] = useState<GenerationCommand | null>(null);
  const [confirmationOpen, setConfirmationOpen] = useState(false);

  const requestExecution = useCallback(async (command: GenerationCommand) => {
    if (uiDismissals.shouldSkipLowResolutionWarning()) {
      await command();
      return;
    }

    try {
      const response = await getSettings();
      const decision = generationQualityDecision(
        response.data?.image_resolution,
        false,
      );
      if (decision === 'confirm-low-resolution') {
        setPendingCommand(() => command);
        setConfirmationOpen(true);
        return;
      }
    } catch (error) {
      console.error('Failed to read image quality settings:', error);
    }

    await command();
  }, []);

  const confirmExecution = useCallback(async (dismissFutureWarnings: boolean) => {
    if (dismissFutureWarnings) {
      uiDismissals.skipLowResolutionWarning();
    }

    const command = pendingCommand;
    setConfirmationOpen(false);
    setPendingCommand(null);
    if (command) {
      await command();
    }
  }, [pendingCommand]);

  const cancelExecution = useCallback(() => {
    setConfirmationOpen(false);
    setPendingCommand(null);
  }, []);

  return {
    confirmationOpen,
    requestExecution,
    confirmExecution,
    cancelExecution,
  };
};
