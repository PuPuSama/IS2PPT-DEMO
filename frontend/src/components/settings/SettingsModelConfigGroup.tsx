import type { FC } from 'react';
import { Input } from '@/components/shared/Input';
import type { SettingsFormData } from '@/config/settingsFormData';
import {
  ALL_PROVIDER_SOURCES,
  API_KEY_PROVIDERS,
  LAZYLLM_SOURCES,
  isLazyllmVendor,
} from '@/config/settingsProviders';
import type { useT } from '@/hooks/useT';
import type { Settings as SettingsType } from '@/types';
import type { SettingsModelConfigItem } from '@/types/settingsPage';

type SettingsTranslator = ReturnType<typeof useT>;

interface SettingsModelConfigGroupProps {
  item: SettingsModelConfigItem;
  formData: SettingsFormData;
  settings: SettingsType | null;
  t: SettingsTranslator;
  onFieldChange: (key: keyof SettingsFormData, value: string | number | boolean) => void;
  onVendorKeyChange: (vendor: string, value: string) => void;
}

export const SettingsModelConfigGroup: FC<SettingsModelConfigGroupProps> = ({
  item,
  formData,
  settings,
  t,
  onFieldChange,
  onVendorKeyChange,
}) => {
  const sourceValue = formData[item.sourceKey] as string;
  const isApiKeyProvider = API_KEY_PROVIDERS.has(sourceValue);
  const isLazyllm = Boolean(sourceValue && isLazyllmVendor(sourceValue));

  return (
    <div className="pb-6 border-b border-gray-200 dark:border-border-primary last:border-b-0 last:pb-0 space-y-3">
      <Input
        label={item.label}
        type="text"
        placeholder={item.placeholder}
        value={formData[item.modelKey] as string}
        onChange={(e) => onFieldChange(item.modelKey, e.target.value)}
      />
      {item.description && (
        <p className="-mt-1 text-sm text-gray-500 dark:text-foreground-tertiary">{item.description}</p>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-foreground-secondary mb-2">
          {item.sourceLabel}
        </label>
        <select
          value={sourceValue}
          onChange={(e) => onFieldChange(item.sourceKey, e.target.value)}
          className="w-full h-10 px-4 rounded-lg border border-gray-200 dark:border-border-primary bg-white dark:bg-background-secondary focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
        >
          <option value="">{t('settings.fields.modelProviderPlaceholder')}</option>
          {ALL_PROVIDER_SOURCES.map((option) => (
            <option
              key={option.value}
              value={option.value}
              disabled={option.value === 'codex' && !settings?.openai_oauth_connected}
            >
              {option.label}
              {option.value === 'codex' && !settings?.openai_oauth_connected
                ? ` (${t('settings.openaiOAuth.disconnected')})`
                : ''}
            </option>
          ))}
        </select>
        <p className="mt-1 text-sm text-gray-500 dark:text-foreground-tertiary">
          {t('settings.fields.modelProviderDesc')}
        </p>
      </div>

      {isApiKeyProvider && (
        <div className="space-y-3 pl-3 border-l-2 border-brand-300 dark:border-brand-600">
          <Input
            label={t('settings.fields.perModelApiBaseUrl')}
            type="text"
            placeholder={t('settings.fields.perModelApiBaseUrlPlaceholder')}
            value={formData[item.apiBaseKey] as string}
            onChange={(e) => onFieldChange(item.apiBaseKey, e.target.value)}
          />
          <div>
            <Input
              label={t('settings.fields.perModelApiKey')}
              type="password"
              placeholder={
                settings && (settings[item.apiKeyLengthKey] as number) > 0
                  ? t('settings.fields.perModelApiKeySet', { length: settings[item.apiKeyLengthKey] as number })
                  : t('settings.fields.perModelApiKeyPlaceholder')
              }
              value={formData[item.apiKeyKey] as string}
              onChange={(e) => onFieldChange(item.apiKeyKey, e.target.value)}
            />
            <p className="mt-1 text-sm text-gray-500 dark:text-foreground-tertiary">
              {t('settings.fields.perModelApiKeyDesc')}
            </p>
          </div>
        </div>
      )}

      {item.sourceKey === 'image_model_source' && (sourceValue === 'openai' || (!sourceValue && formData.ai_provider_format === 'openai')) && (
        <div className="pl-3 border-l-2 border-brand-300 dark:border-brand-600">
          <label className="block text-sm font-medium text-gray-700 dark:text-foreground-secondary mb-2">
            {t('settings.fields.imageApiProtocol')}
          </label>
          <select
            value={formData.openai_image_api_protocol}
            onChange={(e) => onFieldChange('openai_image_api_protocol', e.target.value)}
            className="w-full h-10 px-4 rounded-lg border border-gray-200 dark:border-border-primary bg-white dark:bg-background-secondary focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
          >
            <option value="auto">{t('settings.fields.imageApiProtocolAuto')}</option>
            <option value="images">{t('settings.fields.imageApiProtocolImages')}</option>
            <option value="chat">{t('settings.fields.imageApiProtocolChat')}</option>
          </select>
          <p className="mt-1 text-sm text-gray-500 dark:text-foreground-tertiary">
            {t('settings.fields.imageApiProtocolDesc')}
          </p>
        </div>
      )}

      {isLazyllm && (() => {
        const vendorLabel = LAZYLLM_SOURCES.find((source) => source.value === sourceValue)?.label || sourceValue.toUpperCase();
        const keyLength = settings?.lazyllm_api_keys_info?.[sourceValue] || 0;
        const placeholder = keyLength > 0
          ? t('settings.fields.vendorApiKeySet', { length: keyLength })
          : t('settings.fields.vendorApiKeyPlaceholder', { vendor: vendorLabel });

        return (
          <div className="pl-3 border-l-2 border-amber-300 dark:border-amber-600">
            <Input
              label={t('settings.fields.vendorApiKey', { vendor: vendorLabel })}
              type="password"
              placeholder={placeholder}
              value={formData.lazyllm_api_keys[sourceValue] || ''}
              onChange={(e) => onVendorKeyChange(sourceValue, e.target.value)}
            />
            <p className="mt-1 text-sm text-gray-500 dark:text-foreground-tertiary">
              {t('settings.fields.vendorApiKeyDesc')}
            </p>
          </div>
        );
      })()}
    </div>
  );
};
