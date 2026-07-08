import { useState, type Dispatch, type SetStateAction } from 'react';
import * as api from '@/api/endpoints';
import type { useT } from '@/hooks/useT';
import type { Settings as SettingsType } from '@/types';
import { projectSession } from '@/shared/storage/projectSession';

type SettingsTranslator = ReturnType<typeof useT>;
type ToastType = 'success' | 'error' | 'warning' | 'info';

interface UseOpenAIConnectionOptions {
  t: SettingsTranslator;
  setSettings: Dispatch<SetStateAction<SettingsType | null>>;
  notify: (message: string, type: ToastType) => void;
}

const OAUTH_WINDOW_FEATURES = 'width=600,height=700';

export const useOpenAIConnection = ({
  t,
  setSettings,
  notify,
}: UseOpenAIConnectionOptions) => {
  const [oauthConnecting, setOauthConnecting] = useState(false);
  const [manualCallbackUrl, setManualCallbackUrl] = useState('');
  const [manualCallbackOpen, setManualCallbackOpen] = useState(false);
  const [manualCallbackSubmitting, setManualCallbackSubmitting] = useState(false);

  const applyStatus = async () => {
    const statusResp = await api.getOpenAIOAuthStatus();
    if (statusResp.success && statusResp.data) {
      setSettings((prev) => prev ? {
        ...prev,
        openai_oauth_connected: statusResp.data!.connected,
        openai_oauth_account_id: statusResp.data!.account_id || null,
      } : prev);
    }
  };

  const handleOAuthLogin = async () => {
    setOauthConnecting(true);
    try {
      const resp = await api.getOpenAIOAuthUrl();
      if (resp.success && resp.data?.auth_url) {
        if (resp.data.callback_server_available === false) {
          setManualCallbackOpen(true);
          notify(t('settings.openaiOAuth.callbackPortBusy'), 'warning');
        }

        const popup = window.open(resp.data.auth_url, 'openai-oauth', OAUTH_WINDOW_FEATURES);
        const onMessage = async (event: MessageEvent) => {
          if (event.data?.type !== 'openai-oauth-callback') return;

          window.removeEventListener('message', onMessage);
          setOauthConnecting(false);
          if (event.data.success) {
            await applyStatus();
            return;
          }
          notify(t('settings.openaiOAuth.connectFailed'), 'error');
        };

        window.addEventListener('message', onMessage);
        const checkClosed = setInterval(() => {
          if (!popup?.closed) return;

          clearInterval(checkClosed);
          setOauthConnecting(false);
          window.removeEventListener('message', onMessage);
        }, 1000);
      }
    } catch {
      setOauthConnecting(false);
      notify(t('settings.openaiOAuth.connectFailed'), 'error');
    }
  };

  const handleOAuthDisconnect = async () => {
    try {
      const resp = await api.disconnectOpenAIOAuth();
      if (resp.success) {
        setSettings((prev) => prev ? {
          ...prev,
          openai_oauth_connected: false,
          openai_oauth_account_id: null,
        } : prev);
        notify(t('settings.openaiOAuth.disconnectSuccess'), 'success');
      }
    } catch {
      notify(t('settings.openaiOAuth.disconnectFailed'), 'error');
    }
  };

  const handleManualCallback = async () => {
    if (!manualCallbackUrl.trim()) return;

    setManualCallbackSubmitting(true);
    try {
      const resp = await api.submitOAuthManualCallback(manualCallbackUrl.trim());
      if (resp.success) {
        setManualCallbackUrl('');
        setManualCallbackOpen(false);
        await applyStatus();
        notify(t('settings.openaiOAuth.manualCallbackSuccess'), 'success');
        return;
      }
      notify(t('settings.openaiOAuth.connectFailed'), 'error');
    } catch {
      notify(t('settings.openaiOAuth.connectFailed'), 'error');
    } finally {
      setManualCallbackSubmitting(false);
    }
  };

  const markOpenAIOAuthDisconnected = () => {
    setSettings((prev) => {
      if (!prev) return prev;
      const next = {
        ...prev,
        openai_oauth_connected: false,
        openai_oauth_account_id: null,
      };
      projectSession.saveSettingsSnapshot(next);
      return next;
    });
  };

  return {
    oauthConnecting,
    manualCallbackUrl,
    manualCallbackOpen,
    manualCallbackSubmitting,
    setManualCallbackUrl,
    handleOAuthLogin,
    handleOAuthDisconnect,
    handleManualCallback,
    markOpenAIOAuthDisconnected,
    toggleManualCallback: () => setManualCallbackOpen((value) => !value),
  };
};
