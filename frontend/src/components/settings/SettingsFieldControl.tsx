import type { FC } from 'react';
import { Input } from '@/components/shared/Input';
import type { SettingsFormData } from '@/config/settingsFormData';
import type { useT } from '@/hooks/useT';
import type { Settings as SettingsType } from '@/types';
import type { SettingsFieldConfig } from '@/types/settingsPage';

type SettingsTranslator = ReturnType<typeof useT>;

interface SettingsFieldControlProps {
  field: SettingsFieldConfig;
  formData: SettingsFormData;
  settings: SettingsType | null;
  t: SettingsTranslator;
  onChange: (key: keyof SettingsFormData, value: string | number | boolean) => void;
}

const getButtonClassName = (selected: boolean, value: string) => {
  if (!selected) {
    return 'bg-white dark:bg-background-secondary border border-gray-200 dark:border-border-primary text-gray-700 dark:text-foreground-secondary hover:bg-gray-50 dark:hover:bg-background-hover hover:border-gray-300 dark:hover:border-gray-500';
  }
  if (value === 'openai') {
    return 'bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-md';
  }
  if (value === 'lazyllm') {
    return 'bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-md';
  }
  return 'bg-gradient-to-r from-emerald-500 to-green-600 text-white shadow-md';
};

export const SettingsFieldControl: FC<SettingsFieldControlProps> = ({
  field,
  formData,
  settings,
  t,
  onChange,
}) => {
  const value = formData[field.key] as string | number | boolean;

  if (field.type === 'buttons' && field.options) {
    return (
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-foreground-secondary mb-2">
          {field.label}
        </label>
        <div className="flex flex-wrap gap-2">
          {field.options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(field.key, option.value)}
              className={[
                'px-4 py-2 rounded-lg text-sm font-medium transition-all',
                getButtonClassName(value === option.value, option.value),
              ].join(' ')}
            >
              {option.label}
            </button>
          ))}
        </div>
        {field.description && (
          <p className="mt-1 text-xs text-gray-500 dark:text-foreground-tertiary">{field.description}</p>
        )}
      </div>
    );
  }

  if (field.type === 'select' && field.options) {
    return (
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-foreground-secondary mb-2">
          {field.label}
        </label>
        <select
          value={value as string}
          onChange={(e) => onChange(field.key, e.target.value)}
          className="w-full h-10 px-4 rounded-lg border border-gray-200 dark:border-border-primary bg-white dark:bg-background-secondary focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
        >
          {!(value as string) && (
            <option value="" disabled>
              {field.placeholder || t('settings.fields.selectPlaceholder')}
            </option>
          )}
          {field.options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {field.description && (
          <p className="mt-1 text-sm text-gray-500 dark:text-foreground-tertiary">{field.description}</p>
        )}
      </div>
    );
  }

  if (field.type === 'switch') {
    const isEnabled = Boolean(value);
    return (
      <div>
        <div className="flex items-center justify-between">
          <label className="block text-sm font-medium text-gray-700 dark:text-foreground-secondary">
            {field.label}
          </label>
          <button
            type="button"
            onClick={() => onChange(field.key, !isEnabled)}
            className={[
              'relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2',
              isEnabled ? 'bg-brand-500' : 'bg-gray-200',
            ].join(' ')}
          >
            <span
              className={[
                'inline-block h-4 w-4 transform rounded-full bg-white dark:bg-background-secondary transition-transform',
                isEnabled ? 'translate-x-6' : 'translate-x-1',
              ].join(' ')}
            />
          </button>
        </div>
        {field.description && (
          <p className="mt-1 text-sm text-gray-500 dark:text-foreground-tertiary">{field.description}</p>
        )}
      </div>
    );
  }

  const placeholder = field.sensitiveField && settings && field.lengthKey && (settings[field.lengthKey] as number) > 0
    ? t('settings.fields.apiKeySet', { length: settings[field.lengthKey] as string | number })
    : field.placeholder || '';

  const isDisabled =
    (field.key === 'text_thinking_budget' && !formData.enable_text_reasoning) ||
    (field.key === 'image_thinking_budget' && !formData.enable_image_reasoning);

  return (
    <div className={isDisabled ? 'opacity-50' : ''}>
      <Input
        label={field.label}
        type={field.type === 'number' ? 'number' : field.type}
        placeholder={placeholder}
        value={value as string | number}
        onChange={(e) => {
          const nextValue = field.type === 'number'
            ? parseInt(e.target.value) || (field.min ?? 0)
            : e.target.value;
          onChange(field.key, nextValue);
        }}
        min={field.min}
        max={field.max}
        disabled={isDisabled}
      />
      {(field.description || field.link) && (
        <p className="mt-1 text-sm text-gray-500 dark:text-foreground-tertiary">
          {field.description}
          {field.link && (
            <a href={field.link} target="_blank" rel="noopener noreferrer" className="text-brand-500 hover:underline">
              {t('settings.fields.applyLink')}
            </a>
          )}
        </p>
      )}
    </div>
  );
};
