import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import { getSettings, resetSettings, updateSettings } from '@/api/settingsApi';
import type { useT } from '@/hooks/useT';
import type { Settings as SettingsType } from '@/types';
import {
  formDataFromSettings,
  initialSettingsFormData,
  type SettingsFormData,
} from '@/config/settingsFormData';
import { projectSession } from '@/shared/storage/projectSession';

type SettingsTranslator = ReturnType<typeof useT>;
type ToastType = 'success' | 'error' | 'warning' | 'info';

type Confirm = (
  message: string,
  onConfirm: (checkboxValue?: boolean) => void,
  options?: {
    title?: string;
    confirmText?: string;
    cancelText?: string;
    variant?: 'danger' | 'warning' | 'info';
  }
) => void;

interface UseSettingsFormControllerOptions {
  t: SettingsTranslator;
  confirm: Confirm;
  notify: (message: string, type: ToastType) => void;
}

const buildUpdatePayload = (formData: SettingsFormData): Parameters<typeof updateSettings>[0] => {
  const {
    api_key,
    mineru_token,
    baidu_api_key,
    lazyllm_api_keys,
    text_api_key,
    image_api_key,
    image_caption_api_key,
    ...otherData
  } = formData;

  const payload: Parameters<typeof updateSettings>[0] = {
    ...otherData,
    ai_provider_format: otherData.ai_provider_format,
  };

  if (api_key) payload.api_key = api_key;
  if (mineru_token) payload.mineru_token = mineru_token;
  if (baidu_api_key) payload.baidu_api_key = baidu_api_key;
  if (text_api_key) payload.text_api_key = text_api_key;
  if (image_api_key) payload.image_api_key = image_api_key;
  if (image_caption_api_key) payload.image_caption_api_key = image_caption_api_key;

  const nonEmptyKeys = Object.fromEntries(
    Object.entries(lazyllm_api_keys).filter(([, value]) => value)
  );
  if (Object.keys(nonEmptyKeys).length > 0) {
    payload.lazyllm_api_keys = nonEmptyKeys;
  }

  return payload;
};

const clearSensitiveFields = (formData: SettingsFormData): SettingsFormData => ({
  ...formData,
  api_key: '',
  mineru_token: '',
  baidu_api_key: '',
  lazyllm_api_keys: {},
  text_api_key: '',
  image_api_key: '',
  image_caption_api_key: '',
});

export const useSettingsFormController = ({
  t,
  confirm,
  notify,
}: UseSettingsFormControllerOptions): {
  settings: SettingsType | null;
  setSettings: Dispatch<SetStateAction<SettingsType | null>>;
  isLoading: boolean;
  isSaving: boolean;
  formData: SettingsFormData;
  handleSave: () => Promise<void>;
  handleReset: () => void;
  handleFieldChange: (key: keyof SettingsFormData, value: string | number | boolean) => void;
  handleVendorApiKeyChange: (vendor: string, value: string) => void;
} => {
  const [settings, setSettings] = useState<SettingsType | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState(initialSettingsFormData);

  const loadSettings = async () => {
    setIsLoading(true);
    try {
      const response = await getSettings();
      if (response.data) {
        setSettings(response.data);
        setFormData(formDataFromSettings(response.data));
        projectSession.saveSettingsSnapshot(response.data);
      }
    } catch (error: any) {
      console.error('Failed to load settings:', error);
      notify(
        t('settings.messages.loadFailed') + ': ' + (error?.message || t('settings.messages.unknownError')),
        'error'
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadSettings();
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const response = await updateSettings(buildUpdatePayload(formData));
      if (response.data) {
        setSettings(response.data);
        projectSession.saveSettingsSnapshot(response.data);
        notify(t('settings.messages.saveSuccess'), 'success');
        notify(t('settings.messages.testServiceTip'), 'info');
        setFormData((prev) => clearSensitiveFields(prev));
      }
    } catch (error: any) {
      console.error('Failed to save settings:', error);
      notify(
        t('settings.messages.saveFailed') + ': ' + (error?.response?.data?.error?.message || error?.message || t('settings.messages.unknownError')),
        'error'
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    confirm(
      t('settings.messages.resetConfirm'),
      async () => {
        setIsSaving(true);
        try {
          const response = await resetSettings();
          if (response.data) {
            setSettings(response.data);
            setFormData(formDataFromSettings(response.data));
            notify(t('settings.messages.resetSuccess'), 'success');
          }
        } catch (error: any) {
          console.error('Failed to reset settings:', error);
          notify(
            t('settings.messages.resetFailed') + ': ' + (error?.message || t('settings.messages.unknownError')),
            'error'
          );
        } finally {
          setIsSaving(false);
        }
      },
      {
        title: t('settings.messages.resetTitle'),
        confirmText: t('settings.messages.resetConfirmBtn'),
        cancelText: t('settings.messages.resetCancelBtn'),
        variant: 'warning',
      }
    );
  };

  const handleFieldChange = (key: keyof SettingsFormData, value: string | number | boolean) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const handleVendorApiKeyChange = (vendor: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      lazyllm_api_keys: { ...prev.lazyllm_api_keys, [vendor]: value },
    }));
  };

  return {
    settings,
    setSettings,
    isLoading,
    isSaving,
    formData,
    handleSave,
    handleReset,
    handleFieldChange,
    handleVendorApiKeyChange,
  };
};
