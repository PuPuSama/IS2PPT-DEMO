import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Home, Key, Save, RotateCcw, FileText, ArrowUp, HelpCircle, Link2, ChevronDown } from 'lucide-react';
import { useT } from '@/hooks/useT';
import { settingsI18n } from '@/config/settingsI18n';
import { Button, Input, Card, Loading, useToast, useConfirm } from '@/components/shared';
import * as api from '@/api/endpoints';
import type { Settings as SettingsType } from '@/types';
import { projectSession } from '@/shared/storage/projectSession';
import { createSettingsSections } from '@/config/settingsSections';
import {
  ALL_PROVIDER_SOURCES,
  API_KEY_PROVIDERS,
  LAZYLLM_SOURCES,
  isLazyllmVendor,
} from '@/config/settingsProviders';
import {
  formDataFromSettings,
  initialSettingsFormData,
  type SettingsFormData,
} from '@/config/settingsFormData';
import { SettingsAbout } from '@/components/settings/SettingsAbout';
import { GlobalVendorKeyInput } from '@/components/settings/GlobalVendorKeyInput';
import type {
  ServiceTestStatus,
  ServiceTestState,
  SettingsFieldConfig,
} from '@/types/settingsPage';

// Settings 组件 - 纯嵌入模式（可复用）
export const Settings: React.FC = () => {
  const t = useT(settingsI18n);
  const { show, ToastContainer } = useToast();
  const { confirm, ConfirmDialog } = useConfirm();

  const copyToClipboard = (text: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
    } else {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
    show({ message: '链接已复制到剪贴板', type: 'success' });
  };

  const [settings, setSettings] = useState<SettingsType | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState(initialSettingsFormData);
  const [serviceTestStates, setServiceTestStates] = useState<Record<string, ServiceTestState>>({});
  const [oauthConnecting, setOauthConnecting] = useState(false);
  const [manualCallbackUrl, setManualCallbackUrl] = useState('');
  const [manualCallbackOpen, setManualCallbackOpen] = useState(false);
  const [manualCallbackSubmitting, setManualCallbackSubmitting] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const handleOAuthLogin = async () => {
    setOauthConnecting(true);
    try {
      const resp = await api.getOpenAIOAuthUrl();
      if (resp.success && resp.data?.auth_url) {
        if (resp.data.callback_server_available === false) {
          setManualCallbackOpen(true);
          show({ message: t('settings.openaiOAuth.callbackPortBusy'), type: 'warning' });
        }
        const popup = window.open(resp.data.auth_url, 'openai-oauth', 'width=600,height=700');
        const onMessage = async (event: MessageEvent) => {
          if (event.data?.type === 'openai-oauth-callback') {
            window.removeEventListener('message', onMessage);
            setOauthConnecting(false);
            if (event.data.success) {
              const statusResp = await api.getOpenAIOAuthStatus();
      if (statusResp.success && statusResp.data) {
        setSettings(prev => prev ? {
          ...prev,
          openai_oauth_connected: statusResp.data!.connected,
          openai_oauth_account_id: statusResp.data!.account_id || null,
        } : prev);
      }
            } else {
              show({ message: t('settings.openaiOAuth.connectFailed'), type: 'error' });
            }
          }
        };
        window.addEventListener('message', onMessage);
        const checkClosed = setInterval(() => {
          if (popup?.closed) {
            clearInterval(checkClosed);
            setOauthConnecting(false);
            window.removeEventListener('message', onMessage);
          }
        }, 1000);
      }
    } catch {
      setOauthConnecting(false);
      show({ message: t('settings.openaiOAuth.connectFailed'), type: 'error' });
    }
  };

  const handleOAuthDisconnect = async () => {
    try {
      const resp = await api.disconnectOpenAIOAuth();
      if (resp.success) {
        setSettings(prev => prev ? {
          ...prev,
          openai_oauth_connected: false,
          openai_oauth_account_id: null,
        } : prev);
        show({ message: t('settings.openaiOAuth.disconnectSuccess'), type: 'success' });
      }
    } catch {
      show({ message: t('settings.openaiOAuth.disconnectFailed'), type: 'error' });
    }
  };

  const handleManualCallback = async () => {
    if (!manualCallbackUrl.trim()) return;
    setManualCallbackSubmitting(true);
    try {
      const resp = await api.submitOAuthManualCallback(manualCallbackUrl.trim());
      if (resp.success) {
        setManualCallbackUrl('');
        setManualCallbackOpen(false);
        const statusResp = await api.getOpenAIOAuthStatus();
        if (statusResp.success && statusResp.data) {
          setSettings(prev => prev ? {
            ...prev,
            openai_oauth_connected: statusResp.data!.connected,
            openai_oauth_account_id: statusResp.data!.account_id || null,
          } : prev);
        }
        show({ message: t('settings.openaiOAuth.manualCallbackSuccess'), type: 'success' });
      } else {
        show({ message: t('settings.openaiOAuth.connectFailed'), type: 'error' });
      }
    } catch {
      show({ message: t('settings.openaiOAuth.connectFailed'), type: 'error' });
    } finally {
      setManualCallbackSubmitting(false);
    }
  };

  const settingsSections = createSettingsSections(t);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setIsLoading(true);
    try {
      const response = await api.getSettings();
      if (response.data) {
        setSettings(response.data);
        setFormData(formDataFromSettings(response.data));
        projectSession.saveSettingsSnapshot(response.data);
      }
    } catch (error: any) {
      console.error('加载设置失败:', error);
      show({
        message: t('settings.messages.loadFailed') + ': ' + (error?.message || t('settings.messages.unknownError')),
        type: 'error'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const markOpenAIOAuthDisconnected = () => {
    setSettings(prev => {
      if (!prev) return prev;
      const next = {
        ...prev,
        openai_oauth_connected: false,
        openai_oauth_account_id: null,
      };
      projectSession.saveSettingsSnapshot(next);
      return next;
    });
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const {
        api_key, mineru_token, baidu_api_key, lazyllm_api_keys,
        text_api_key, image_api_key, image_caption_api_key,
        ...otherData
      } = formData;
      const payload: Parameters<typeof api.updateSettings>[0] = {
        ...otherData,
        ai_provider_format: otherData.ai_provider_format,
      };

      // Only send sensitive fields if user entered a new value
      if (api_key) payload.api_key = api_key;
      if (mineru_token) payload.mineru_token = mineru_token;
      if (baidu_api_key) payload.baidu_api_key = baidu_api_key;
      if (text_api_key) payload.text_api_key = text_api_key;
      if (image_api_key) payload.image_api_key = image_api_key;
      if (image_caption_api_key) payload.image_caption_api_key = image_caption_api_key;

      // Send lazyllm API keys (only non-empty values)
      const nonEmptyKeys = Object.fromEntries(
        Object.entries(lazyllm_api_keys).filter(([, v]) => v)
      );
      if (Object.keys(nonEmptyKeys).length > 0) {
        payload.lazyllm_api_keys = nonEmptyKeys;
      }

      const response = await api.updateSettings(payload);
      if (response.data) {
        setSettings(response.data);
        projectSession.saveSettingsSnapshot(response.data);
        show({ message: t('settings.messages.saveSuccess'), type: 'success' });
        show({ message: t('settings.messages.testServiceTip'), type: 'info' });
        // Clear all sensitive fields after save
        setFormData(prev => ({
          ...prev,
          api_key: '', mineru_token: '', baidu_api_key: '',
          lazyllm_api_keys: {},
          text_api_key: '', image_api_key: '', image_caption_api_key: '',
        }));
      }
    } catch (error: any) {
      console.error('保存设置失败:', error);
      show({
        message: t('settings.messages.saveFailed') + ': ' + (error?.response?.data?.error?.message || error?.message || t('settings.messages.unknownError')),
        type: 'error'
      });
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
          const response = await api.resetSettings();
          if (response.data) {
            setSettings(response.data);
            setFormData(formDataFromSettings(response.data));
            show({ message: t('settings.messages.resetSuccess'), type: 'success' });
          }
        } catch (error: any) {
          console.error('重置设置失败:', error);
          show({
            message: t('settings.messages.resetFailed') + ': ' + (error?.message || t('settings.messages.unknownError')),
            type: 'error'
          });
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

  const handleFieldChange = (key: string, value: any) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  const updateServiceTest = (key: string, nextState: ServiceTestState) => {
    setServiceTestStates(prev => ({ ...prev, [key]: nextState }));
  };

  const handleServiceTest = async (
    key: string,
    action: (settings?: any) => Promise<any>,
    formatDetail: (data: any) => string
  ) => {
    updateServiceTest(key, { status: 'loading' });
    try {
      // 准备测试时要使用的设置（包括未保存的修改）
      const testSettings: any = {};

      // 只传递用户已填写的非空值
      if (formData.api_key) testSettings.api_key = formData.api_key;
      if (formData.api_base_url) testSettings.api_base_url = formData.api_base_url;
      if (formData.ai_provider_format) {
        testSettings.ai_provider_format = formData.ai_provider_format;
      }
      if (formData.text_model) testSettings.text_model = formData.text_model;
      if (formData.image_model) testSettings.image_model = formData.image_model;
      if (formData.image_caption_model) testSettings.image_caption_model = formData.image_caption_model;
      if (formData.mineru_api_base) testSettings.mineru_api_base = formData.mineru_api_base;
      if (formData.mineru_token) testSettings.mineru_token = formData.mineru_token;
      if (formData.baidu_api_key) testSettings.baidu_api_key = formData.baidu_api_key;
      if (formData.image_resolution) testSettings.image_resolution = formData.image_resolution;

      // Per-model provider source overrides (always send, even empty, to clear saved values)
      testSettings.text_model_source = formData.text_model_source || '';
      testSettings.image_model_source = formData.image_model_source || '';
      testSettings.image_caption_model_source = formData.image_caption_model_source || '';

      // Per-model API credentials
      if (formData.text_api_key) testSettings.text_api_key = formData.text_api_key;
      if (formData.text_api_base_url) testSettings.text_api_base_url = formData.text_api_base_url;
      if (formData.image_api_key) testSettings.image_api_key = formData.image_api_key;
      if (formData.image_api_base_url) testSettings.image_api_base_url = formData.image_api_base_url;
      if (formData.image_caption_api_key) testSettings.image_caption_api_key = formData.image_caption_api_key;
      if (formData.image_caption_api_base_url) testSettings.image_caption_api_base_url = formData.image_caption_api_base_url;

      // 推理模式设置
      if (formData.enable_text_reasoning !== undefined) {
        testSettings.enable_text_reasoning = formData.enable_text_reasoning;
      }
      if (formData.text_thinking_budget !== undefined) {
        testSettings.text_thinking_budget = formData.text_thinking_budget;
      }
      if (formData.enable_image_reasoning !== undefined) {
        testSettings.enable_image_reasoning = formData.enable_image_reasoning;
      }
      if (formData.image_thinking_budget !== undefined) {
        testSettings.image_thinking_budget = formData.image_thinking_budget;
      }

      // 启动异步测试，获取任务ID
      const response = await action(testSettings);
      const taskId = response.data.task_id;

      // isActive tracks whether this test round is still pending — avoids stale closure
      let isActive = true;
      // eslint-disable-next-line prefer-const
      let pollInterval: ReturnType<typeof setInterval>;
      const finish = (nextState: ServiceTestState, toastMsg: string, toastType: 'success' | 'error') => {
        if (!isActive) return;
        isActive = false;
        clearInterval(pollInterval);
        updateServiceTest(key, nextState);
        show({ message: toastMsg, type: toastType });
      };

      // 开始轮询任务状态
      pollInterval = setInterval(async () => {
        try {
          const statusResponse = await api.getTestStatus(taskId);
          const statusData = statusResponse?.data;
          if (!statusData) {
            throw new Error(t('settings.serviceTest.testFailed'));
          }
          const taskStatus = statusData.status;

          if (taskStatus === 'COMPLETED') {
            const detail = formatDetail(statusData.result || {});
            const message = statusData.message || t('settings.messages.testSuccess');
            finish({ status: 'success', message, detail }, message, 'success');
          } else if (taskStatus === 'FAILED') {
            const errorMessage = statusData.error || t('settings.serviceTest.testFailed');
            if (statusData.openai_oauth_disconnected) {
              markOpenAIOAuthDisconnected();
            }
            finish({ status: 'error', message: errorMessage }, `${t('settings.serviceTest.testFailed')}: ${errorMessage}`, 'error');
          }
          // 如果是 PENDING 或 PROCESSING，继续轮询
        } catch (pollError: any) {
          const errorMessage = pollError?.response?.data?.error?.message || pollError?.message || t('settings.serviceTest.testFailed');
          finish({ status: 'error', message: errorMessage }, `${t('settings.serviceTest.testFailed')}: ${errorMessage}`, 'error');
        }
      }, 2000); // 每2秒轮询一次

      // 设置最大轮询时间（2分钟）
      setTimeout(() => {
        finish({ status: 'error', message: t('settings.serviceTest.testTimeout') }, t('settings.serviceTest.testTimeout'), 'error');
      }, 600000); // 10 分钟，覆盖 gpt-image-2 等慢模型的生成时间

    } catch (error: any) {
      const errorMessage = error?.response?.data?.error?.message || error?.message || t('common.unknownError');
      updateServiceTest(key, { status: 'error', message: errorMessage });
      show({ message: `${t('settings.serviceTest.testFailed')}: ${errorMessage}`, type: 'error' });
    }
  };

  const renderField = (field: SettingsFieldConfig) => {
    const value = formData[field.key] as string | number | boolean;

    if (field.type === 'buttons' && field.options) {
      return (
        <div key={field.key}>
          <label className="block text-sm font-medium text-gray-700 dark:text-foreground-secondary mb-2">
            {field.label}
          </label>
          <div className="flex flex-wrap gap-2">
            {field.options.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => handleFieldChange(field.key, option.value)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  value === option.value
                    ? option.value === 'openai'
                      ? 'bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-md'
                      : option.value === 'lazyllm'
                        ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-md'
                        : 'bg-gradient-to-r from-emerald-500 to-green-600 text-white shadow-md'
                    : 'bg-white dark:bg-background-secondary border border-gray-200 dark:border-border-primary text-gray-700 dark:text-foreground-secondary hover:bg-gray-50 dark:hover:bg-background-hover hover:border-gray-300 dark:hover:border-gray-500'
                }`}
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
        <div key={field.key}>
          <label className="block text-sm font-medium text-gray-700 dark:text-foreground-secondary mb-2">
            {field.label}
          </label>
          <select
            value={value as string}
            onChange={(e) => handleFieldChange(field.key, e.target.value)}
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

    // switch 类型 - 开关切换
    if (field.type === 'switch') {
      const isEnabled = Boolean(value);
      return (
        <div key={field.key}>
          <div className="flex items-center justify-between">
            <label className="block text-sm font-medium text-gray-700 dark:text-foreground-secondary">
              {field.label}
            </label>
            <button
              type="button"
              onClick={() => handleFieldChange(field.key, !isEnabled)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 ${
                isEnabled ? 'bg-brand-500' : 'bg-gray-200'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white dark:bg-background-secondary transition-transform ${
                  isEnabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
          {field.description && (
            <p className="mt-1 text-sm text-gray-500 dark:text-foreground-tertiary">{field.description}</p>
          )}
        </div>
      );
    }

    // text, password, number 类型
    const placeholder = field.sensitiveField && settings && field.lengthKey && (settings[field.lengthKey] as number) > 0
      ? t('settings.fields.apiKeySet', { length: settings[field.lengthKey] as string | number })
      : field.placeholder || '';

    // 判断是否禁用（思考负载字段在对应开关关闭时禁用）
    let isDisabled = false;
    if (field.key === 'text_thinking_budget') {
      isDisabled = !formData.enable_text_reasoning;
    } else if (field.key === 'image_thinking_budget') {
      isDisabled = !formData.enable_image_reasoning;
    }

    return (
      <div key={field.key} className={isDisabled ? 'opacity-50' : ''}>
        <Input
          label={field.label}
          type={field.type === 'number' ? 'number' : field.type}
          placeholder={placeholder}
          value={value as string | number}
          onChange={(e) => {
            const newValue = field.type === 'number' 
              ? parseInt(e.target.value) || (field.min ?? 0)
              : e.target.value;
            handleFieldChange(field.key, newValue);
          }}
          min={field.min}
          max={field.max}
          disabled={isDisabled}
        />
        {(field.description || field.link) && (
          <p className="mt-1 text-sm text-gray-500 dark:text-foreground-tertiary">
            {field.description}
            {field.link && (
              <a href={field.link} target="_blank" rel="noopener noreferrer" className="text-brand-500 hover:underline">{t('settings.fields.applyLink')}</a>
            )}
          </p>
        )}
      </div>
    );
  };

  // 模型配置项定义：每种模型类型的 key、source key、api key/base key、标签等
  const modelConfigItems = [
    {
      modelKey: 'text_model' as keyof SettingsFormData,
      sourceKey: 'text_model_source' as keyof SettingsFormData,
      apiKeyKey: 'text_api_key' as keyof SettingsFormData,
      apiBaseKey: 'text_api_base_url' as keyof SettingsFormData,
      apiKeyLengthKey: 'text_api_key_length' as keyof SettingsType,
      label: t('settings.fields.textModel'),
      placeholder: t('settings.fields.textModelPlaceholder'),
      description: t('settings.fields.textModelDesc'),
      sourceLabel: t('settings.fields.textModelSource'),
    },
    {
      modelKey: 'image_model' as keyof SettingsFormData,
      sourceKey: 'image_model_source' as keyof SettingsFormData,
      apiKeyKey: 'image_api_key' as keyof SettingsFormData,
      apiBaseKey: 'image_api_base_url' as keyof SettingsFormData,
      apiKeyLengthKey: 'image_api_key_length' as keyof SettingsType,
      label: t('settings.fields.imageModel'),
      placeholder: t('settings.fields.imageModelPlaceholder'),
      description: t('settings.fields.imageModelDesc'),
      sourceLabel: t('settings.fields.imageModelSource'),
    },
    {
      modelKey: 'image_caption_model' as keyof SettingsFormData,
      sourceKey: 'image_caption_model_source' as keyof SettingsFormData,
      apiKeyKey: 'image_caption_api_key' as keyof SettingsFormData,
      apiBaseKey: 'image_caption_api_base_url' as keyof SettingsFormData,
      apiKeyLengthKey: 'image_caption_api_key_length' as keyof SettingsType,
      label: t('settings.fields.imageCaptionModel'),
      placeholder: t('settings.fields.imageCaptionModelPlaceholder'),
      description: t('settings.fields.imageCaptionModelDesc'),
      sourceLabel: t('settings.fields.imageCaptionModelSource'),
    },
  ];

  // 渲染单个模型配置组（模型名 + 提供商选择 + 条件凭证）
  const renderModelConfigGroup = (item: typeof modelConfigItems[0]) => {
    const sourceValue = formData[item.sourceKey] as string;
    const isApiKeyProvider = API_KEY_PROVIDERS.has(sourceValue);
    const isLazyllm = sourceValue && isLazyllmVendor(sourceValue);
    // 'openai' in source dropdown means OpenAI format (API key provider), not lazyllm openai vendor
    // lazyllm openai vendor is handled separately

    return (
      <div key={item.modelKey} className="pb-6 border-b border-gray-200 dark:border-border-primary last:border-b-0 last:pb-0 space-y-3">
        {/* 模型名称 */}
        <Input
          label={item.label}
          type="text"
          placeholder={item.placeholder}
          value={formData[item.modelKey] as string}
          onChange={(e) => handleFieldChange(item.modelKey, e.target.value)}
        />
        {item.description && (
          <p className="-mt-1 text-sm text-gray-500 dark:text-foreground-tertiary">{item.description}</p>
        )}

        {/* 提供商选择 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-foreground-secondary mb-2">
            {item.sourceLabel}
          </label>
          <select
            value={sourceValue}
            onChange={(e) => handleFieldChange(item.sourceKey, e.target.value)}
            className="w-full h-10 px-4 rounded-lg border border-gray-200 dark:border-border-primary bg-white dark:bg-background-secondary focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
          >
            <option value="">{t('settings.fields.modelProviderPlaceholder')}</option>
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
          <p className="mt-1 text-sm text-gray-500 dark:text-foreground-tertiary">
            {t('settings.fields.modelProviderDesc')}
          </p>
        </div>

        {/* Gemini/OpenAI 提供商：显示 API Base URL + API Key */}
        {isApiKeyProvider && (
          <div className="space-y-3 pl-3 border-l-2 border-brand-300 dark:border-brand-600">
            <Input
              label={t('settings.fields.perModelApiBaseUrl')}
              type="text"
              placeholder={t('settings.fields.perModelApiBaseUrlPlaceholder')}
              value={formData[item.apiBaseKey] as string}
              onChange={(e) => handleFieldChange(item.apiBaseKey, e.target.value)}
            />
            <div>
              <Input
                label={t('settings.fields.perModelApiKey')}
                type="password"
                placeholder={
                  settings && (settings[item.apiKeyLengthKey] as number) > 0
                    ? t('settings.fields.perModelApiKeySet', { length: settings[item.apiKeyLengthKey] as number })
                    : t('settings.fields.perModelApiKeyPlaceholder')
                }
                value={formData[item.apiKeyKey] as string}
                onChange={(e) => handleFieldChange(item.apiKeyKey, e.target.value)}
              />
              <p className="mt-1 text-sm text-gray-500 dark:text-foreground-tertiary">
                {t('settings.fields.perModelApiKeyDesc')}
              </p>
            </div>
          </div>
        )}

        {/* Image API Protocol: for image model when effective provider is openai */}
        {item.sourceKey === 'image_model_source' && (sourceValue === 'openai' || (!sourceValue && formData.ai_provider_format === 'openai')) && (
          <div className="pl-3 border-l-2 border-brand-300 dark:border-brand-600">
            <label className="block text-sm font-medium text-gray-700 dark:text-foreground-secondary mb-2">
              {t('settings.fields.imageApiProtocol')}
            </label>
            <select
              value={formData.openai_image_api_protocol}
              onChange={(e) => handleFieldChange('openai_image_api_protocol', e.target.value)}
              className="w-full h-10 px-4 rounded-lg border border-gray-200 dark:border-border-primary bg-white dark:bg-background-secondary focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
            >
              <option value="auto">{t('settings.fields.imageApiProtocolAuto')}</option>
              <option value="images">{t('settings.fields.imageApiProtocolImages')}</option>
              <option value="chat">{t('settings.fields.imageApiProtocolChat')}</option>
            </select>
            <p className="mt-1 text-sm text-gray-500 dark:text-foreground-tertiary">
              {t('settings.fields.imageApiProtocolDesc')}
            </p>
          </div>
        )}

        {/* LazyLLM 厂商：显示厂商 API Key */}
        {isLazyllm && (() => {
          const vendorLabel = LAZYLLM_SOURCES.find(s => s.value === sourceValue)?.label || sourceValue.toUpperCase();
          const keyLength = settings?.lazyllm_api_keys_info?.[sourceValue] || 0;
          const placeholder = keyLength > 0
            ? t('settings.fields.vendorApiKeySet', { length: keyLength })
            : t('settings.fields.vendorApiKeyPlaceholder', { vendor: vendorLabel });
          return (
            <div className="pl-3 border-l-2 border-amber-300 dark:border-amber-600">
              <Input
                label={t('settings.fields.vendorApiKey', { vendor: vendorLabel })}
                type="password"
                placeholder={placeholder}
                value={formData.lazyllm_api_keys[sourceValue] || ''}
                onChange={(e) => {
                  setFormData(prev => ({
                    ...prev,
                    lazyllm_api_keys: { ...prev.lazyllm_api_keys, [sourceValue]: e.target.value }
                  }));
                }}
              />
              <p className="mt-1 text-sm text-gray-500 dark:text-foreground-tertiary">
                {t('settings.fields.vendorApiKeyDesc')}
              </p>
            </div>
          );
        })()}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loading message={t('common.loading')} />
      </div>
    );
  }

  return (
    <>
      <ToastContainer />
      {ConfirmDialog}
      <div className="space-y-8">
        {/* 默认 API 配置区块 */}
        <div data-testid="global-api-config-section">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-foreground-primary mb-1 flex items-center">
            <Key size={20} />
            <span className="ml-2">{t('settings.sections.apiConfig')}</span>
          </h2>
          <p className="text-sm text-gray-500 dark:text-foreground-tertiary mb-4">{t('settings.sections.apiConfigDesc')}</p>
          <div className="space-y-3">
            {/* 提供商下拉 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-foreground-secondary mb-2">
                {t('settings.fields.aiProviderFormat')}
              </label>
              <select
                value={formData.ai_provider_format}
                onChange={(e) => handleFieldChange('ai_provider_format', e.target.value)}
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

            {/* Gemini/OpenAI: API Base URL + API Key */}
            {API_KEY_PROVIDERS.has(formData.ai_provider_format) && (
              <div className="space-y-3 pl-3 border-l-2 border-brand-300 dark:border-brand-600">
                <Input
                  label={t('settings.fields.apiBaseUrl')}
                  type="text"
                  placeholder={t('settings.fields.apiBaseUrlPlaceholder')}
                  value={formData.api_base_url}
                  onChange={(e) => handleFieldChange('api_base_url', e.target.value)}
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
                    onChange={(e) => handleFieldChange('api_key', e.target.value)}
                  />
                  <p className="mt-1 text-sm text-gray-500 dark:text-foreground-tertiary">{t('settings.fields.apiKeyDesc')}</p>
                </div>
              </div>
            )}

            {/* LazyLLM 厂商: 厂商 API Key */}
            {isLazyllmVendor(formData.ai_provider_format) && (
              <GlobalVendorKeyInput vendor={formData.ai_provider_format} formData={formData} setFormData={setFormData} settings={settings} t={t} />
            )}
          </div>

          {/* AIHubmix 提示 */}
          <div className="mt-3 pl-4 border-l-4 border-blue-300 dark:border-blue-600">
            <p className="text-sm text-gray-700 dark:text-foreground-secondary">
              {t('settings.apiKeyTip.before')}
              <a href={['https://', 'aihubmix', '.com/?', 'aff=17EC'].join('')} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 underline font-medium">AIHubmix 申请 API key</a>
            </p>
          </div>

          {/* API Key 获取指南 */}
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
                    href={['https://', 'aihubmix', '.com/?', 'aff=17EC'].join('')}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800 underline font-medium"
                  >
                    点击此处访问 AIHubmix →
                  </a>
                  <button
                    onClick={() => copyToClipboard('https://aihubmix.com/?aff=17EC')}
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

        {/* 模型配置区块 */}
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-foreground-primary mb-4 flex items-center">
            <FileText size={20} />
            <span className="ml-2">{t('settings.sections.modelConfig')}</span>
          </h2>
          <div className="space-y-4">
            {modelConfigItems.map(renderModelConfigGroup)}
          </div>
        </div>

        {/* 其余配置区块（配置驱动，排除性能配置和推理模式） */}
        <div className="space-y-8">
          {settingsSections.filter((section) =>
            section.title !== t('settings.sections.performanceConfig') &&
            section.title !== t('settings.sections.textReasoning') &&
            section.title !== t('settings.sections.imageReasoning')
          ).map((section) => (
            <div key={section.title}>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-foreground-primary mb-4 flex items-center">
                {section.icon}
                <span className="ml-2">{section.title}</span>
              </h2>
              <div className="space-y-4">
                {section.fields.map((field) => renderField(field))}
              </div>
            </div>
          ))}
        </div>

        {/* 高级设置（折叠区域） */}
        <div className="border-t border-gray-200 dark:border-border-primary pt-2">
          <button
            type="button"
            onClick={() => setAdvancedOpen(!advancedOpen)}
            className="w-full flex items-center justify-between px-0 py-3 text-left hover:opacity-80 transition-opacity"
          >
            <span className="text-lg font-semibold text-gray-900 dark:text-foreground-primary">
              {t('settings.sections.advancedSettings')}
            </span>
            <ChevronDown
              size={20}
              className={`text-gray-500 dark:text-foreground-tertiary transition-transform duration-200 ${advancedOpen ? 'rotate-180' : ''}`}
            />
          </button>
          {advancedOpen && (
            <div className="pb-4 space-y-8">
              {/* OpenAI OAuth 连接区块 */}
              <div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-foreground-primary mb-1 flex items-center">
                  <Link2 size={20} />
                  <span className="ml-2">{t('settings.openaiOAuth.title')}</span>
                </h2>
                <p className="text-sm text-gray-500 dark:text-foreground-tertiary mb-4">{t('settings.openaiOAuth.description')}</p>
                <div className="p-4 border border-gray-200 dark:border-border-primary rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-2.5 h-2.5 rounded-full ${settings?.openai_oauth_connected ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`} />
                      <div>
                        <span className="text-sm font-medium text-gray-700 dark:text-foreground-secondary">
                          {settings?.openai_oauth_connected ? t('settings.openaiOAuth.connected') : t('settings.openaiOAuth.disconnected')}
                        </span>
                        {settings?.openai_oauth_connected && settings?.openai_oauth_account_id && (
                          <span className="ml-2 text-sm text-gray-500 dark:text-foreground-tertiary">
                            ({settings.openai_oauth_account_id})
                          </span>
                        )}
                      </div>
                    </div>
                    <div>
                      {settings?.openai_oauth_connected ? (
                        <button
                          onClick={handleOAuthDisconnect}
                          className="px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                        >
                          {t('settings.openaiOAuth.disconnectBtn')}
                        </button>
                      ) : (
                        <button
                          onClick={handleOAuthLogin}
                          disabled={oauthConnecting}
                          className="px-4 py-2 text-sm font-medium text-white bg-gray-900 dark:bg-white dark:text-gray-900 rounded-lg hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors disabled:opacity-50"
                        >
                          {oauthConnecting ? t('settings.openaiOAuth.connecting') : t('settings.openaiOAuth.loginBtn')}
                        </button>
                      )}
                    </div>
                  </div>
                  <p className="mt-3 text-xs text-gray-500 dark:text-foreground-tertiary">{t('settings.openaiOAuth.hint')}</p>
                  {!settings?.openai_oauth_connected && (
                    <div className="mt-3">
                      <button
                        onClick={() => setManualCallbackOpen(v => !v)}
                        className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        {t('settings.openaiOAuth.manualCallbackLabel')}
                      </button>
                      {manualCallbackOpen && (
                        <div className="mt-2 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                          <p className="text-xs text-amber-700 dark:text-amber-300 mb-2">{t('settings.openaiOAuth.manualCallbackHint')}</p>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={manualCallbackUrl}
                              onChange={(e) => setManualCallbackUrl(e.target.value)}
                              placeholder={t('settings.openaiOAuth.manualCallbackPlaceholder')}
                              className="flex-1 px-3 py-1.5 text-xs border border-gray-300 dark:border-border-primary rounded-md bg-white dark:bg-background-secondary text-gray-900 dark:text-foreground-primary placeholder-gray-400"
                            />
                            <button
                              onClick={handleManualCallback}
                              disabled={manualCallbackSubmitting || !manualCallbackUrl.trim()}
                              className="px-3 py-1.5 text-xs font-medium text-white bg-gray-900 dark:bg-white dark:text-gray-900 rounded-md hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors disabled:opacity-50"
                            >
                              {t('settings.openaiOAuth.manualCallbackSubmit')}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* 并发性能配置 + 推理模式 */}
              {settingsSections.filter((section) =>
                section.title === t('settings.sections.performanceConfig') ||
                section.title === t('settings.sections.textReasoning') ||
                section.title === t('settings.sections.imageReasoning')
              ).map((section) => (
                <div key={section.title}>
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-foreground-primary mb-4 flex items-center">
                    {section.icon}
                    <span className="ml-2">{section.title}</span>
                  </h2>
                  <div className="space-y-4">
                    {section.fields.map((field) => renderField(field))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 服务测试区 */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-foreground-primary mb-2 flex items-center">
            <FileText size={20} />
            <span className="ml-2">{t('settings.serviceTest.title')}</span>
          </h2>
          <p className="text-sm text-gray-500 dark:text-foreground-tertiary">
            {t('settings.serviceTest.description')}
          </p>
          <div className="pl-4 border-l-4 border-yellow-300 dark:border-yellow-600">
            <p className="text-sm text-gray-700 dark:text-foreground-secondary">
              💡 {t('settings.serviceTest.tip')}
            </p>
          </div>
          <div className="space-y-4">
            {[
              {
                key: 'baidu-ocr',
                titleKey: 'settings.serviceTest.tests.baiduOcr.title',
                descriptionKey: 'settings.serviceTest.tests.baiduOcr.description',
                resultKey: 'settings.serviceTest.results.recognizedText',
                action: api.testBaiduOcr,
                formatDetail: (data: any) => (data?.recognized_text ? t('settings.serviceTest.results.recognizedText', { text: data.recognized_text }) : ''),
              },
              {
                key: 'text-model',
                titleKey: 'settings.serviceTest.tests.textModel.title',
                descriptionKey: 'settings.serviceTest.tests.textModel.description',
                resultKey: 'settings.serviceTest.results.modelReply',
                action: api.testTextModel,
                formatDetail: (data: any) => (data?.reply ? t('settings.serviceTest.results.modelReply', { reply: data.reply }) : ''),
              },
              {
                key: 'caption-model',
                titleKey: 'settings.serviceTest.tests.captionModel.title',
                descriptionKey: 'settings.serviceTest.tests.captionModel.description',
                resultKey: 'settings.serviceTest.results.captionDesc',
                action: api.testCaptionModel,
                formatDetail: (data: any) => (data?.caption ? t('settings.serviceTest.results.captionDesc', { caption: data.caption }) : ''),
              },
              {
                key: 'baidu-inpaint',
                titleKey: 'settings.serviceTest.tests.baiduInpaint.title',
                descriptionKey: 'settings.serviceTest.tests.baiduInpaint.description',
                resultKey: 'settings.serviceTest.results.imageSize',
                action: api.testBaiduInpaint,
                formatDetail: (data: any) => (data?.image_size ? t('settings.serviceTest.results.imageSize', { width: data.image_size[0], height: data.image_size[1] }) : ''),
              },
              {
                key: 'image-model',
                titleKey: 'settings.serviceTest.tests.imageModel.title',
                descriptionKey: 'settings.serviceTest.tests.imageModel.description',
                resultKey: 'settings.serviceTest.results.imageSize',
                action: api.testImageModel,
                formatDetail: (data: any) => (data?.image_size ? t('settings.serviceTest.results.imageSize', { width: data.image_size[0], height: data.image_size[1] }) : ''),
              },
              {
                key: 'mineru-pdf',
                titleKey: 'settings.serviceTest.tests.mineruPdf.title',
                descriptionKey: 'settings.serviceTest.tests.mineruPdf.description',
                resultKey: 'settings.serviceTest.results.parsePreview',
                action: api.testMineruPdf,
                formatDetail: (data: any) => (data?.content_preview ? t('settings.serviceTest.results.parsePreview', { preview: data.content_preview }) : data?.message || ''),
              },
            ].map((item) => {
              const testState = serviceTestStates[item.key] || { status: 'idle' as ServiceTestStatus };
              const isLoadingTest = testState.status === 'loading';
              return (
                <div
                  key={item.key}
                  className="py-4 border-b border-gray-200 dark:border-border-primary last:border-b-0 space-y-2"
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <div className="text-base font-semibold text-gray-800 dark:text-foreground-primary">{t(item.titleKey)}</div>
                      <div className="text-sm text-gray-500 dark:text-foreground-tertiary">{t(item.descriptionKey)}</div>
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      loading={isLoadingTest}
                      onClick={() => handleServiceTest(item.key, item.action, item.formatDetail)}
                    >
                      {isLoadingTest ? t('settings.serviceTest.testing') : t('settings.serviceTest.startTest')}
                    </Button>
                  </div>
                  {testState.status === 'success' && (
                    <p className="text-sm text-green-600">
                      {testState.message}{testState.detail ? `｜${testState.detail}` : ''}
                    </p>
                  )}
                  {testState.status === 'error' && (
                    <p className="text-sm text-red-600">
                      {testState.message}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-border-primary">
          <Button
            variant="secondary"
            icon={<RotateCcw size={18} />}
            onClick={handleReset}
            disabled={isSaving}
          >
            {t('settings.actions.resetToDefault')}
          </Button>
          <Button
            variant="primary"
            icon={<Save size={18} />}
            onClick={handleSave}
            loading={isSaving}
          >
            {isSaving ? t('settings.actions.saving') : t('settings.actions.save')}
          </Button>
        </div>

        <SettingsAbout t={t} />
      </div>
    </>
  );
};

// SettingsPage 组件 - 完整页面包装
const SCROLL_SHOW_THRESHOLD = 300;

export const SettingsPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const t = useT(settingsI18n);
  const [showTop, setShowTop] = useState(false);
  const hasInAppBackHistory = typeof window !== 'undefined' && typeof window.history.state?.idx === 'number'
    ? window.history.state.idx > 0
    : false;
  const canNavigateBack = hasInAppBackHistory || Boolean((location.state as { from?: string } | null)?.from);

  const handleBack = () => {
    if (canNavigateBack) {
      navigate(-1);
      return;
    }
    navigate('/');
  };

  useEffect(() => {
    const onScroll = () => setShowTop(window.scrollY > SCROLL_SHOW_THRESHOLD);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-50 dark:from-background-primary to-yellow-50 dark:to-background-primary">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Card className="p-6 md:p-8">
          <div className="space-y-8">
            {/* 顶部标题 */}
            <div className="flex items-center justify-between pb-6 border-b border-gray-200 dark:border-border-primary">
              <div className="flex items-center">
                <Button
                  variant="secondary"
                  icon={<Home size={18} />}
                  onClick={handleBack}
                  className="mr-4"
                >
                  {t('nav.backToHome')}
                </Button>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-foreground-primary">{t('settings.title')}</h1>
                  <p className="text-sm text-gray-500 dark:text-foreground-tertiary mt-1">
                    {t('settings.subtitle')}
                  </p>
                </div>
              </div>
            </div>

            <Settings />
          </div>
        </Card>
      </div>

      {showTop && (
        <button
          data-testid="back-to-top-button"
          aria-label="Back to top"
          title="Back to top"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="fixed bottom-6 right-6 p-3 rounded-full bg-brand-500 text-white shadow-lg hover:bg-brand-600 transition-all z-50"
        >
          <ArrowUp size={20} />
        </button>
      )}
    </div>
  );
};
