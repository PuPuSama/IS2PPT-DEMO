import type { FC } from 'react';
import { FileText } from 'lucide-react';
import type { useT } from '@/hooks/useT';
import type { Settings as SettingsType } from '@/types';
import type { SettingsFormData } from '@/config/settingsFormData';
import type { SettingsModelConfigItem } from '@/types/settingsPage';
import { SettingsModelConfigGroup } from '@/components/settings/SettingsModelConfigGroup';

type SettingsTranslator = ReturnType<typeof useT>;

interface SettingsModelConfigSectionProps {
  items: SettingsModelConfigItem[];
  formData: SettingsFormData;
  settings: SettingsType | null;
  t: SettingsTranslator;
  onFieldChange: (key: keyof SettingsFormData, value: string | number | boolean) => void;
  onVendorKeyChange: (vendor: string, value: string) => void;
}

export const SettingsModelConfigSection: FC<SettingsModelConfigSectionProps> = ({
  items,
  formData,
  settings,
  t,
  onFieldChange,
  onVendorKeyChange,
}) => (
  <div>
    <h2 className="text-xl font-semibold text-gray-900 dark:text-foreground-primary mb-4 flex items-center">
      <FileText size={20} />
      <span className="ml-2">{t('settings.sections.modelConfig')}</span>
    </h2>
    <div className="space-y-4">
      {items.map((item) => (
        <SettingsModelConfigGroup
          key={item.modelKey}
          item={item}
          formData={formData}
          settings={settings}
          t={t}
          onFieldChange={onFieldChange}
          onVendorKeyChange={onVendorKeyChange}
        />
      ))}
    </div>
  </div>
);
