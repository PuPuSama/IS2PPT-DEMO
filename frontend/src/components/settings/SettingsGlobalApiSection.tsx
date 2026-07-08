import type { FC } from 'react';
import { HelpCircle, Key } from 'lucide-react';
import { Input } from '@/components/shared';
import type { useT } from '@/hooks/useT';
import type { Settings as SettingsType } from '@/types';
import type { SettingsFormData } from '@/config/settingsFormData';
import {
  ALL_PROVIDER_SOURCES,
  API_KEY_PROVIDERS,
  isLazyllmVendor,
} from '@/config/settingsProviders';
import { GlobalVendorKeyInput } from '@/components/settings/GlobalVendorKeyInput';

type SettingsTranslator = ReturnType<typeof useT>;

interface SettingsGlobalApiSectionProps {
  formData: SettingsFormData;
  settings: SettingsType | null;
  t: SettingsTranslator;
  onFieldChange: (key: keyof SettingsFormData, value: string | number | boolean) => void;
  onVendorKeyChange: (vendor: string, value: string) => void;
  onLinkCopied: () => void;
}

const AIHUBMIX_URL = ['https://', 'aihubmix', '.com/?', 'aff=17EC'].join('');

const copyText = (text: string) => {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  document.body.removeChild(textarea);
};

export const SettingsGlobalApiSection: FC<SettingsGlobalApiSectionProps> = ({
  formData,
  settings,
  t,
  onFieldChange,
  onVendorKeyChange,
  onLinkCopied,
}) => {
  const copyAffiliateLink = () => {
    copyText(AIHUBMIX_URL);
    onLinkCopied();
  };

  return (
    <div data-testid="global-api-config-section">
      <h2 className="text-xl font-semibold text-gray-900 dark:text-foreground-primary mb-1 flex items-center">
        <Key size={20} />
        <span className="ml-2">{t('settings.sections.apiConfig')}</span>
      </h2>
      <p className="text-sm text-gray-500 dark:text-foreground-tertiary mb-4">{t('settings.sections.apiConfigDesc')}</p>
      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-foreground-secondary mb-2">
            {t('settings.fields.aiProviderFormat')}
          </label>
          <select
            value={formData.ai_provider_format}
            onChange={(event) => onFieldChange('ai_provider_format', event.target.value)}
            className="w-full h-10 px-4 rounded-lg border border-gray-200 dark:border-border-primary bg-white dark:bg-background-secondary focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
          >
            {ALL_PROVIDER_SOURCES.map((option) => (
              <option
                key={option.value}
                value={option.value}
                disabled={option.value === 'codex' && !settings?.openai_oauth_connected}
              >
                {option.label}{option.value === 'codex' && !settings?.openai_oauth_connected ? ` (${t('settings.openaiOAuth.disconnected')})` : ''}
              </option>
            ))}
          </select>
          <p className="mt-1 text-sm text-gray-500 dark:text-foreground-tertiary">{t('settings.fields.aiProviderFormatDesc')}</p>
        </div>

        {API_KEY_PROVIDERS.has(formData.ai_provider_format) && (
          <div className="space-y-3 pl-3 border-l-2 border-brand-300 dark:border-brand-600">
            <Input
              label={t('settings.fields.apiBaseUrl')}
              type="text"
              placeholder={t('settings.fields.apiBaseUrlPlaceholder')}
              value={formData.api_base_url}
              onChange={(event) => onFieldChange('api_base_url', event.target.value)}
            />
            <p className="-mt-2 text-sm text-gray-500 dark:text-foreground-tertiary">{t('settings.fields.apiBaseUrlDesc')}</p>
            <div>
              <Input
                label={t('settings.fields.apiKey')}
                type="password"
                placeholder={
                  settings && (settings.api_key_length as number) > 0
                    ? t('settings.fields.apiKeySet', { length: settings.api_key_length })
                    : t('settings.fields.apiKeyPlaceholder')
                }
                value={formData.api_key}
                onChange={(event) => onFieldChange('api_key', event.target.value)}
              />
              <p className="mt-1 text-sm text-gray-500 dark:text-foreground-tertiary">{t('settings.fields.apiKeyDesc')}</p>
            </div>
          </div>
        )}

        {isLazyllmVendor(formData.ai_provider_format) && (
          <GlobalVendorKeyInput
            vendor={formData.ai_provider_format}
            value={formData.lazyllm_api_keys[formData.ai_provider_format] || ''}
            settings={settings}
            t={t}
            onChange={(value) => onVendorKeyChange(formData.ai_provider_format, value)}
          />
        )}
      </div>

      <div className="mt-3 pl-4 border-l-4 border-blue-300 dark:border-blue-600">
        <p className="text-sm text-gray-700 dark:text-foreground-secondary">
          {t('settings.apiKeyTip.before')}
          <a href={AIHUBMIX_URL} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 underline font-medium">AIHubmix 申请 API key</a>
        </p>
      </div>

      <div className="mt-2 pl-4 border-l-4 border-blue-300 dark:border-blue-600">
        <p className="text-sm font-medium text-gray-800 dark:text-foreground-primary flex items-center gap-1.5 mb-2">
          <HelpCircle size={15} className="text-blue-500" />
          {t('settings.apiKeyHelp.title')}
        </p>
        <ol className="text-sm text-gray-700 dark:text-foreground-secondary space-y-1 list-decimal list-inside ml-1">
          <li>
            {t('settings.apiKeyHelp.step1', { link: '{{link}}' }).split('{{link}}')[0]}
            <span className="inline-flex items-center gap-2">
              <a
                href={AIHUBMIX_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800 underline font-medium"
              >
                点击此处访问 AIHubmix →
              </a>
              <button
                onClick={copyAffiliateLink}
                className="text-xs px-2 py-0.5 bg-blue-100 hover:bg-blue-200 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded transition-colors"
              >
                复制链接
              </button>
            </span>
            {t('settings.apiKeyHelp.step1', { link: '{{link}}' }).split('{{link}}')[1]}
          </li>
          <li>{t('settings.apiKeyHelp.step2')}</li>
          <li>{t('settings.apiKeyHelp.step3')}</li>
          <li>{t('settings.apiKeyHelp.step4')}</li>
        </ol>
      </div>
    </div>
  );
};
