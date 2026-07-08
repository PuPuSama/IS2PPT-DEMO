import type { FC } from 'react';
import { Link2 } from 'lucide-react';
import type { useT } from '@/hooks/useT';
import type { Settings as SettingsType } from '@/types';

type SettingsTranslator = ReturnType<typeof useT>;

interface SettingsOAuthPanelProps {
  settings: SettingsType | null;
  oauthConnecting: boolean;
  manualCallbackOpen: boolean;
  manualCallbackUrl: string;
  manualCallbackSubmitting: boolean;
  t: SettingsTranslator;
  onLogin: () => void;
  onDisconnect: () => void;
  onManualCallbackToggle: () => void;
  onManualCallbackUrlChange: (value: string) => void;
  onManualCallbackSubmit: () => void;
}

export const SettingsOAuthPanel: FC<SettingsOAuthPanelProps> = ({
  settings,
  oauthConnecting,
  manualCallbackOpen,
  manualCallbackUrl,
  manualCallbackSubmitting,
  t,
  onLogin,
  onDisconnect,
  onManualCallbackToggle,
  onManualCallbackUrlChange,
  onManualCallbackSubmit,
}) => {
  const isConnected = Boolean(settings?.openai_oauth_connected);

  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-900 dark:text-foreground-primary mb-1 flex items-center">
        <Link2 size={20} />
        <span className="ml-2">{t('settings.openaiOAuth.title')}</span>
      </h2>
      <p className="text-sm text-gray-500 dark:text-foreground-tertiary mb-4">
        {t('settings.openaiOAuth.description')}
      </p>
      <div className="p-4 border border-gray-200 dark:border-border-primary rounded-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-2.5 h-2.5 rounded-full ${isConnected ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`} />
            <div>
              <span className="text-sm font-medium text-gray-700 dark:text-foreground-secondary">
                {isConnected ? t('settings.openaiOAuth.connected') : t('settings.openaiOAuth.disconnected')}
              </span>
              {isConnected && settings?.openai_oauth_account_id && (
                <span className="ml-2 text-sm text-gray-500 dark:text-foreground-tertiary">
                  ({settings.openai_oauth_account_id})
                </span>
              )}
            </div>
          </div>
          <div>
            {isConnected ? (
              <button
                onClick={onDisconnect}
                className="px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
              >
                {t('settings.openaiOAuth.disconnectBtn')}
              </button>
            ) : (
              <button
                onClick={onLogin}
                disabled={oauthConnecting}
                className="px-4 py-2 text-sm font-medium text-white bg-gray-900 dark:bg-white dark:text-gray-900 rounded-lg hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors disabled:opacity-50"
              >
                {oauthConnecting ? t('settings.openaiOAuth.connecting') : t('settings.openaiOAuth.loginBtn')}
              </button>
            )}
          </div>
        </div>
        <p className="mt-3 text-xs text-gray-500 dark:text-foreground-tertiary">
          {t('settings.openaiOAuth.hint')}
        </p>
        {!isConnected && (
          <div className="mt-3">
            <button
              onClick={onManualCallbackToggle}
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
            >
              {t('settings.openaiOAuth.manualCallbackLabel')}
            </button>
            {manualCallbackOpen && (
              <div className="mt-2 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                <p className="text-xs text-amber-700 dark:text-amber-300 mb-2">
                  {t('settings.openaiOAuth.manualCallbackHint')}
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={manualCallbackUrl}
                    onChange={(e) => onManualCallbackUrlChange(e.target.value)}
                    placeholder={t('settings.openaiOAuth.manualCallbackPlaceholder')}
                    className="flex-1 px-3 py-1.5 text-xs border border-gray-300 dark:border-border-primary rounded-md bg-white dark:bg-background-secondary text-gray-900 dark:text-foreground-primary placeholder-gray-400"
                  />
                  <button
                    onClick={onManualCallbackSubmit}
                    disabled={manualCallbackSubmitting || !manualCallbackUrl.trim()}
                    className="px-3 py-1.5 text-xs font-medium text-white bg-gray-900 dark:bg-white dark:text-gray-900 rounded-md hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors disabled:opacity-50"
                  >
                    {t('settings.openaiOAuth.manualCallbackSubmit')}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
