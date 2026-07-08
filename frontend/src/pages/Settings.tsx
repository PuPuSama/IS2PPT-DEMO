import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Home, Save, RotateCcw, FileText, ArrowUp, ChevronDown } from 'lucide-react';
import { useT } from '@/hooks/useT';
import { settingsI18n } from '@/config/settingsI18n';
import { Button, Card, Loading, useToast, useConfirm } from '@/components/shared';
import * as api from '@/api/endpoints';
import type { Settings as SettingsType } from '@/types';
import { projectSession } from '@/shared/storage/projectSession';
import { createSettingsModelItems } from '@/config/settingsModelItems';
import { createSettingsSections } from '@/config/settingsSections';
import { createSettingsServiceTests } from '@/config/settingsServiceTests';
import { buildSettingsTestPayload } from '@/config/settingsTestPayload';
import {
  formDataFromSettings,
  initialSettingsFormData,
} from '@/config/settingsFormData';
import { SettingsAbout } from '@/components/settings/SettingsAbout';
import { SettingsFieldControl } from '@/components/settings/SettingsFieldControl';
import { SettingsGlobalApiSection } from '@/components/settings/SettingsGlobalApiSection';
import { SettingsModelConfigGroup } from '@/components/settings/SettingsModelConfigGroup';
import { SettingsOAuthPanel } from '@/components/settings/SettingsOAuthPanel';
import { SettingsServiceTestPanel } from '@/components/settings/SettingsServiceTestPanel';
import type {
  ServiceTestState,
} from '@/types/settingsPage';

// Settings 组件 - 纯嵌入模式（可复用）
export const Settings: React.FC = () => {
  const t = useT(settingsI18n);
  const { show, ToastContainer } = useToast();
  const { confirm, ConfirmDialog } = useConfirm();

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
  const serviceTestItems = createSettingsServiceTests(t);

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

  const handleVendorApiKeyChange = (vendor: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      lazyllm_api_keys: { ...prev.lazyllm_api_keys, [vendor]: value },
    }));
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
      const testSettings = buildSettingsTestPayload(formData);

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

  const modelConfigItems = createSettingsModelItems(t);

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
        <SettingsGlobalApiSection
          formData={formData}
          settings={settings}
          t={t}
          onFieldChange={handleFieldChange}
          onVendorKeyChange={handleVendorApiKeyChange}
          onLinkCopied={() => show({ message: '链接已复制到剪贴板', type: 'success' })}
        />

        {/* 模型配置区块 */}
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-foreground-primary mb-4 flex items-center">
            <FileText size={20} />
            <span className="ml-2">{t('settings.sections.modelConfig')}</span>
          </h2>
          <div className="space-y-4">
            {modelConfigItems.map((item) => (
              <SettingsModelConfigGroup
                key={item.modelKey}
                item={item}
                formData={formData}
                settings={settings}
                t={t}
                onFieldChange={handleFieldChange}
                onVendorKeyChange={handleVendorApiKeyChange}
              />
            ))}
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
                {section.fields.map((field) => (
                  <SettingsFieldControl
                    key={field.key}
                    field={field}
                    formData={formData}
                    settings={settings}
                    t={t}
                    onChange={handleFieldChange}
                  />
                ))}
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
              <SettingsOAuthPanel
                settings={settings}
                oauthConnecting={oauthConnecting}
                manualCallbackOpen={manualCallbackOpen}
                manualCallbackUrl={manualCallbackUrl}
                manualCallbackSubmitting={manualCallbackSubmitting}
                t={t}
                onLogin={handleOAuthLogin}
                onDisconnect={handleOAuthDisconnect}
                onManualCallbackToggle={() => setManualCallbackOpen((value) => !value)}
                onManualCallbackUrlChange={setManualCallbackUrl}
                onManualCallbackSubmit={handleManualCallback}
              />

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
                    {section.fields.map((field) => (
                      <SettingsFieldControl
                        key={field.key}
                        field={field}
                        formData={formData}
                        settings={settings}
                        t={t}
                        onChange={handleFieldChange}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <SettingsServiceTestPanel
          items={serviceTestItems}
          states={serviceTestStates}
          t={t}
          onRun={(item) => handleServiceTest(item.key, item.action, item.formatDetail)}
        />

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
