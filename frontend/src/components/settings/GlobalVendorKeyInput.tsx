import type { FC } from 'react';
import { Input } from '@/components/shared';
import type { useT } from '@/hooks/useT';
import type { Settings as SettingsType } from '@/types';
import { LAZYLLM_SOURCES } from '@/config/settingsProviders';

type SettingsTranslator = ReturnType<typeof useT>;

interface GlobalVendorKeyInputProps {
  vendor: string;
  value: string;
  settings: SettingsType | null;
  t: SettingsTranslator;
  onChange: (value: string) => void;
}

export const GlobalVendorKeyInput: FC<GlobalVendorKeyInputProps> = ({
  vendor,
  value,
  settings,
  t,
  onChange,
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
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      <p className="mt-1 text-sm text-gray-500 dark:text-foreground-tertiary">{t('settings.fields.vendorApiKeyDesc')}</p>
    </div>
  );
};
