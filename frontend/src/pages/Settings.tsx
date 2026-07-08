import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Home, ArrowUp } from 'lucide-react';
import { useT } from '@/hooks/useT';
import { useOpenAIConnection } from '@/hooks/useOpenAIConnection';
import { useSettingsFormController } from '@/hooks/useSettingsFormController';
import { useSettingsServiceRunner } from '@/hooks/useSettingsServiceRunner';
import { settingsI18n } from '@/config/settingsI18n';
import { Button, Card, Loading, useToast, useConfirm } from '@/components/shared';
import { createSettingsModelItems } from '@/config/settingsModelItems';
import { createSettingsSections } from '@/config/settingsSections';
import { createSettingsServiceTests } from '@/config/settingsServiceTests';
import { SettingsAdvancedPanel } from '@/components/settings/SettingsAdvancedPanel';
import { SettingsActionBar } from '@/components/settings/SettingsActionBar';
import { SettingsAbout } from '@/components/settings/SettingsAbout';
import { SettingsGlobalApiSection } from '@/components/settings/SettingsGlobalApiSection';
import { SettingsModelConfigSection } from '@/components/settings/SettingsModelConfigSection';
import { SettingsSectionList } from '@/components/settings/SettingsSectionList';
import { SettingsServiceTestPanel } from '@/components/settings/SettingsServiceTestPanel';

// Settings 组件 - 纯嵌入模式（可复用）
export const Settings: React.FC = () => {
  const t = useT(settingsI18n);
  const { show, ToastContainer } = useToast();
  const { confirm, ConfirmDialog } = useConfirm();

  const [advancedOpen, setAdvancedOpen] = useState(false);
  const {
    settings,
    setSettings,
    isLoading,
    isSaving,
    formData,
    handleSave,
    handleReset,
    handleFieldChange,
    handleVendorApiKeyChange,
  } = useSettingsFormController({
    t,
    confirm,
    notify: (message, type) => show({ message, type }),
  });

  const {
    oauthConnecting,
    manualCallbackUrl,
    manualCallbackOpen,
    manualCallbackSubmitting,
    setManualCallbackUrl,
    handleOAuthLogin,
    handleOAuthDisconnect,
    handleManualCallback,
    markOpenAIOAuthDisconnected,
    toggleManualCallback,
  } = useOpenAIConnection({
    t,
    setSettings,
    notify: (message, type) => show({ message, type }),
  });
  const {
    serviceTestStates,
    runServiceTest,
  } = useSettingsServiceRunner({
    formData,
    t,
    notify: (message, type) => show({ message, type }),
    onOpenAIDisconnected: markOpenAIOAuthDisconnected,
  });

  const settingsSections = createSettingsSections(t);
  const serviceTestItems = createSettingsServiceTests(t);

  const modelConfigItems = createSettingsModelItems(t);
  const advancedSectionTitles = new Set([
    t('settings.sections.performanceConfig'),
    t('settings.sections.textReasoning'),
    t('settings.sections.imageReasoning'),
  ]);
  const mainSections = settingsSections.filter((section) => !advancedSectionTitles.has(section.title));
  const advancedSections = settingsSections.filter((section) => advancedSectionTitles.has(section.title));

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

        <SettingsModelConfigSection
          items={modelConfigItems}
          formData={formData}
          settings={settings}
          t={t}
          onFieldChange={handleFieldChange}
          onVendorKeyChange={handleVendorApiKeyChange}
        />

        <SettingsSectionList
          sections={mainSections}
          formData={formData}
          settings={settings}
          t={t}
          onChange={handleFieldChange}
        />

        <SettingsAdvancedPanel
          open={advancedOpen}
          settings={settings}
          oauthConnecting={oauthConnecting}
          manualCallbackOpen={manualCallbackOpen}
          manualCallbackUrl={manualCallbackUrl}
          manualCallbackSubmitting={manualCallbackSubmitting}
          sections={advancedSections}
          formData={formData}
          t={t}
          onToggle={() => setAdvancedOpen((value) => !value)}
          onOAuthLogin={handleOAuthLogin}
          onOAuthDisconnect={handleOAuthDisconnect}
          onManualCallbackToggle={toggleManualCallback}
          onManualCallbackUrlChange={setManualCallbackUrl}
          onManualCallbackSubmit={handleManualCallback}
          onFieldChange={handleFieldChange}
        />

        <SettingsServiceTestPanel
          items={serviceTestItems}
          states={serviceTestStates}
          t={t}
          onRun={runServiceTest}
        />

        <SettingsActionBar
          isSaving={isSaving}
          t={t}
          onReset={handleReset}
          onSave={handleSave}
        />

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
