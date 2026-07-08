import type { FC } from 'react';
import type { useT } from '@/hooks/useT';
import type { Settings as SettingsType } from '@/types';
import type { SettingsFormData } from '@/config/settingsFormData';
import type { SettingsSectionConfig } from '@/types/settingsPage';
import { SettingsFieldControl } from '@/components/settings/SettingsFieldControl';

type SettingsTranslator = ReturnType<typeof useT>;

interface SettingsSectionListProps {
  sections: SettingsSectionConfig[];
  formData: SettingsFormData;
  settings: SettingsType | null;
  t: SettingsTranslator;
  onChange: (key: keyof SettingsFormData, value: string | number | boolean) => void;
  className?: string;
}

export const SettingsSectionList: FC<SettingsSectionListProps> = ({
  sections,
  formData,
  settings,
  t,
  onChange,
  className = 'space-y-8',
}) => (
  <div className={className}>
    {sections.map((section) => (
      <div key={section.title}>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-foreground-primary mb-4 flex items-center">
          {section.icon}
          <span className="ml-2">{section.title}</span>
        </h2>
        <div className="space-y-4">
          {section.fields.map((field) => (
            <SettingsFieldControl
              key={field.key}
              field={field}
              formData={formData}
              settings={settings}
              t={t}
              onChange={onChange}
            />
          ))}
        </div>
      </div>
    ))}
  </div>
);
