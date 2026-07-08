import React from 'react';
import { Input } from '@/components/shared';
import type { useT } from '@/hooks/useT';
import type { Settings as SettingsType } from '@/types';
import { LAZYLLM_SOURCES } from '@/config/settingsProviders';
import type { SettingsFormData } from '@/config/settingsFormData';

type SettingsTranslator = ReturnType<typeof useT>;

interface GlobalVendorKeyInputProps {
  vendor: string;
  formData: SettingsFormData;
  setFormData: React.Dispatch<React.SetStateAction<SettingsFormData>>;
  settings: SettingsType | null;
  t: SettingsTranslator;
}

export const GlobalVendorKeyInput: React.FC<GlobalVendorKeyInputProps> = ({
  vendor,
  formData,
  setFormData,
  settings,
  t,
}) => {
  const vendorLabel = LAZYLLM_SOURCES.find(s => s.value === vendor)?.label || vendor.toUpperCase();
  const keyLength = settings?.lazyllm_api_keys_info?.[vendor] || 0;
  const placeholder = keyLength > 0
    ? t('settings.fields.vendorApiKeySet', { length: keyLength })
    : t('settings.fields.vendorApiKeyPlaceholder', { vendor: vendorLabel });

  return (
    <div className="pl-3 border-l-2 border-amber-300 dark:border-amber-600">
      <Input
        label={t('settings.fields.vendorApiKey', { vendor: vendorLabel })}
        type="password"
        placeholder={placeholder}
        value={formData.lazyllm_api_keys[vendor] || ''}
        onChange={(e) => {
          setFormData(prev => ({
            ...prev,
            lazyllm_api_keys: { ...prev.lazyllm_api_keys, [vendor]: e.target.value }
          }));
        }}
      />
      <p className="mt-1 text-sm text-gray-500 dark:text-foreground-tertiary">{t('settings.fields.vendorApiKeyDesc')}</p>
    </div>
  );
};
