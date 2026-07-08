import { useState } from 'react';
import * as api from '@/api/endpoints';
import type { useT } from '@/hooks/useT';
import type { SettingsFormData } from '@/config/settingsFormData';
import { buildSettingsTestPayload } from '@/config/settingsTestPayload';
import type { ServiceTestState, SettingsServiceTestItem } from '@/types/settingsPage';

type SettingsTranslator = ReturnType<typeof useT>;
type ToastType = 'success' | 'error';

interface UseSettingsServiceRunnerOptions {
  formData: SettingsFormData;
  t: SettingsTranslator;
  notify: (message: string, type: ToastType) => void;
  onOpenAIDisconnected: () => void;
}

export const useSettingsServiceRunner = ({
  formData,
  t,
  notify,
  onOpenAIDisconnected,
}: UseSettingsServiceRunnerOptions) => {
  const [serviceTestStates, setServiceTestStates] = useState<Record<string, ServiceTestState>>({});

  const updateServiceTest = (key: string, nextState: ServiceTestState) => {
    setServiceTestStates((prev) => ({ ...prev, [key]: nextState }));
  };

  const runServiceTest = async (item: SettingsServiceTestItem) => {
    updateServiceTest(item.key, { status: 'loading' });
    try {
      const testSettings = buildSettingsTestPayload(formData);
      const response = await item.action(testSettings);
      const taskId = response.data.task_id;

      let isActive = true;
      // eslint-disable-next-line prefer-const
      let pollInterval: ReturnType<typeof setInterval>;
      const finish = (nextState: ServiceTestState, toastMsg: string, toastType: ToastType) => {
        if (!isActive) return;
        isActive = false;
        clearInterval(pollInterval);
        updateServiceTest(item.key, nextState);
        notify(toastMsg, toastType);
      };

      pollInterval = setInterval(async () => {
        try {
          const statusResponse = await api.getTestStatus(taskId);
          const statusData = statusResponse?.data;
          if (!statusData) {
            throw new Error(t('settings.serviceTest.testFailed'));
          }

          if (statusData.status === 'COMPLETED') {
            const detail = item.formatDetail(statusData.result || {});
            const message = statusData.message || t('settings.messages.testSuccess');
            finish({ status: 'success', message, detail }, message, 'success');
            return;
          }

          if (statusData.status === 'FAILED') {
            const errorMessage = statusData.error || t('settings.serviceTest.testFailed');
            if (statusData.openai_oauth_disconnected) {
              onOpenAIDisconnected();
            }
            finish({ status: 'error', message: errorMessage }, `${t('settings.serviceTest.testFailed')}: ${errorMessage}`, 'error');
          }
        } catch (pollError: any) {
          const errorMessage = pollError?.response?.data?.error?.message || pollError?.message || t('settings.serviceTest.testFailed');
          finish({ status: 'error', message: errorMessage }, `${t('settings.serviceTest.testFailed')}: ${errorMessage}`, 'error');
        }
      }, 2000);

      setTimeout(() => {
        finish({ status: 'error', message: t('settings.serviceTest.testTimeout') }, t('settings.serviceTest.testTimeout'), 'error');
      }, 600000);
    } catch (error: any) {
      const errorMessage = error?.response?.data?.error?.message || error?.message || t('common.unknownError');
      updateServiceTest(item.key, { status: 'error', message: errorMessage });
      notify(`${t('settings.serviceTest.testFailed')}: ${errorMessage}`, 'error');
    }
  };

  return {
    serviceTestStates,
    runServiceTest,
  };
};
