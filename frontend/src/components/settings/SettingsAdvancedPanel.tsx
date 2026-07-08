import type { FC } from 'react';
import { ChevronDown } from 'lucide-react';
import type { useT } from '@/hooks/useT';
import type { Settings as SettingsType } from '@/types';
import type { SettingsFormData } from '@/config/settingsFormData';
import type { SettingsSectionConfig } from '@/types/settingsPage';
import { SettingsOAuthPanel } from '@/components/settings/SettingsOAuthPanel';
import { SettingsSectionList } from '@/components/settings/SettingsSectionList';

type SettingsTranslator = ReturnType<typeof useT>;

interface SettingsAdvancedPanelProps {
  open: boolean;
  settings: SettingsType | null;
  oauthConnecting: boolean;
  manualCallbackOpen: boolean;
  manualCallbackUrl: string;
  manualCallbackSubmitting: boolean;
  sections: SettingsSectionConfig[];
  formData: SettingsFormData;
  t: SettingsTranslator;
  onToggle: () => void;
  onOAuthLogin: () => void;
  onOAuthDisconnect: () => void;
  onManualCallbackToggle: () => void;
  onManualCallbackUrlChange: (value: string) => void;
  onManualCallbackSubmit: () => void;
  onFieldChange: (key: keyof SettingsFormData, value: string | number | boolean) => void;
}

export const SettingsAdvancedPanel: FC<SettingsAdvancedPanelProps> = ({
  open,
  settings,
  oauthConnecting,
  manualCallbackOpen,
  manualCallbackUrl,
  manualCallbackSubmitting,
  sections,
  formData,
  t,
  onToggle,
  onOAuthLogin,
  onOAuthDisconnect,
  onManualCallbackToggle,
  onManualCallbackUrlChange,
  onManualCallbackSubmit,
  onFieldChange,
}) => (
  <div className="border-t border-gray-200 dark:border-border-primary pt-2">
    <button
      type="button"
      onClick={onToggle}
      className="w-full flex items-center justify-between px-0 py-3 text-left hover:opacity-80 transition-opacity"
    >
      <span className="text-lg font-semibold text-gray-900 dark:text-foreground-primary">
        {t('settings.sections.advancedSettings')}
      </span>
      <ChevronDown
        size={20}
        className={`text-gray-500 dark:text-foreground-tertiary transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
      />
    </button>
    {open && (
      <div className="pb-4 space-y-8">
        <SettingsOAuthPanel
          settings={settings}
          oauthConnecting={oauthConnecting}
          manualCallbackOpen={manualCallbackOpen}
          manualCallbackUrl={manualCallbackUrl}
          manualCallbackSubmitting={manualCallbackSubmitting}
          t={t}
          onLogin={onOAuthLogin}
          onDisconnect={onOAuthDisconnect}
          onManualCallbackToggle={onManualCallbackToggle}
          onManualCallbackUrlChange={onManualCallbackUrlChange}
          onManualCallbackSubmit={onManualCallbackSubmit}
        />

        <SettingsSectionList
          sections={sections}
          formData={formData}
          settings={settings}
          t={t}
          onChange={onFieldChange}
        />
      </div>
    )}
  </div>
);
