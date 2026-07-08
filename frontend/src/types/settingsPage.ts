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

export type ServiceTestStatus = 'idle' | 'loading' | 'success' | 'error';

export interface ServiceTestState {
  status: ServiceTestStatus;
  message?: string;
  detail?: string;
}
