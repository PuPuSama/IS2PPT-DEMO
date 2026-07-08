import type { ReactNode } from 'react';
import type { Settings as SettingsType } from '@/types';
import type { SettingsFormData } from '@/config/settingsFormData';

export type SettingsFieldType = 'text' | 'password' | 'number' | 'select' | 'buttons' | 'switch';

export interface SettingsFieldConfig {
  key: keyof SettingsFormData;
  label: string;
  type: SettingsFieldType;
  placeholder?: string;
  description?: string;
  sensitiveField?: boolean;
  lengthKey?: keyof SettingsType;
  options?: { value: string; label: string }[];
  min?: number;
  max?: number;
  link?: string;
}

export interface SettingsSectionConfig {
  title: string;
  icon: ReactNode;
  fields: SettingsFieldConfig[];
}

export interface SettingsModelConfigItem {
  modelKey: keyof SettingsFormData;
  sourceKey: keyof SettingsFormData;
  apiKeyKey: keyof SettingsFormData;
  apiBaseKey: keyof SettingsFormData;
  apiKeyLengthKey: keyof SettingsType;
  label: string;
  placeholder: string;
  description: string;
  sourceLabel: string;
}

export interface SettingsServiceTestItem {
  key: string;
  titleKey: string;
  descriptionKey: string;
  action: (settings?: any) => Promise<any>;
  formatDetail: (data: any) => string;
}

export type ServiceTestStatus = 'idle' | 'loading' | 'success' | 'error';

export interface ServiceTestState {
  status: ServiceTestStatus;
  message?: string;
  detail?: string;
}
