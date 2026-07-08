import React, { useState } from 'react';
import { ArrowUp, CheckCircle, Info, RefreshCw } from 'lucide-react';
import { Button, Modal } from '@/components/shared';
import * as api from '@/api/endpoints';
import type { UpdateCheckInfo } from '@/api/endpoints';
import type { useT } from '@/hooks/useT';
import { APP_IDENTITY } from '@/shared/config/appIdentity';
import { appVersion } from '@/utils/appVersion';

type SettingsTranslator = ReturnType<typeof useT>;

function getLatestVersion(info: UpdateCheckInfo): string {
  const sha = info.latest?.sha;
  if (sha) {
    return sha.length > 7 ? sha.slice(0, 7) : sha;
  }
  return info.latest?.tag || '';
}

function formatUpdateMessage(t: SettingsTranslator, info: UpdateCheckInfo): string {
  if (info.status === 'up_to_date') return t('settings.about.upToDate');
  if (info.status === 'update_available') return t('settings.about.updateAvailable', { version: getLatestVersion(info) });
  return t('settings.about.unknown');
}

export const SettingsAbout: React.FC<{ t: SettingsTranslator }> = ({ t }) => {
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<UpdateCheckInfo | null>(null);
  const [updateError, setUpdateError] = useState('');
  const [updateDialogOpen, setUpdateDialogOpen] = useState(false);

  const handleCheckUpdate = async () => {
    setCheckingUpdate(true);
    setUpdateError('');
    try {
      const response = await api.checkForUpdates();
      setUpdateInfo(response.data || null);
      setUpdateDialogOpen(true);
    } catch (error: any) {
      setUpdateInfo(null);
      setUpdateError(error?.response?.data?.error?.message || error?.message || t('settings.about.failed'));
      setUpdateDialogOpen(true);
    } finally {
      setCheckingUpdate(false);
    }
  };

  const showSuccessCheck = updateInfo?.status === 'up_to_date';

  return (
    <>
      <div className="pt-4 border-t border-gray-200 dark:border-border-primary">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-foreground-primary mb-3 flex items-center">
          <Info size={20} />
          <span className="ml-2">{t('settings.sections.about')}</span>
        </h2>
        <div className="flex flex-col gap-3 text-sm text-gray-600 dark:text-foreground-tertiary sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <div title={appVersion.detail} aria-label={`${t('settings.about.version')} ${appVersion.detail}`}>
              {t('settings.about.version')}: {appVersion.display}
            </div>
            <a
              href={APP_IDENTITY.repositoryUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-brand-700 dark:text-brand hover:underline"
            >
              {t('settings.about.source')}
            </a>
            {updateInfo && (
              <div className={updateInfo.update_available ? 'text-orange-600 dark:text-orange-400' : 'text-gray-600 dark:text-foreground-tertiary'}>
                <div>{formatUpdateMessage(t, updateInfo)}</div>
              </div>
            )}
            {updateError && (
              <div className="text-red-600 dark:text-red-400">
                {t('settings.about.failed')}: {updateError}
              </div>
            )}
          </div>
          <Button
            variant="secondary"
            size="sm"
            icon={<RefreshCw size={16} className={checkingUpdate ? 'animate-spin' : ''} />}
            onClick={handleCheckUpdate}
            loading={checkingUpdate}
          >
            {checkingUpdate ? t('settings.about.checking') : t('settings.about.checkUpdate')}
          </Button>
        </div>
      </div>

      <Modal isOpen={updateDialogOpen} onClose={() => setUpdateDialogOpen(false)} title={t('settings.about.resultTitle')}>
        <div className="space-y-4">
          {updateInfo && (
            <div className="space-y-2 text-sm text-gray-700 dark:text-foreground-secondary">
              <div className="flex flex-col items-center gap-3 py-2 text-center">
                {showSuccessCheck && (
                  <CheckCircle
                    size={44}
                    data-testid="update-success-icon"
                    className="text-green-600 dark:text-green-400"
                    aria-hidden="true"
                  />
                )}
                {updateInfo.update_available && (
                  <ArrowUp
                    size={44}
                    data-testid="update-available-icon"
                    className="text-orange-600 dark:text-orange-400"
                    aria-hidden="true"
                  />
                )}
                <p className={updateInfo.update_available
                  ? 'text-xl font-semibold text-orange-600 dark:text-orange-400'
                  : 'text-xl font-semibold text-gray-900 dark:text-foreground-primary'
                }>
                  {formatUpdateMessage(t, updateInfo)}
                </p>
              </div>
            </div>
          )}
          {updateError && (
            <p className="text-sm text-red-600 dark:text-red-400">
              {t('settings.about.failed')}: {updateError}
            </p>
          )}
          <div className="flex justify-end">
            <Button variant="secondary" size="sm" onClick={() => setUpdateDialogOpen(false)}>
              {t('settings.about.close')}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
};
