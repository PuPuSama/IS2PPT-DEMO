import React, { useState } from 'react';
import { useT } from '@/hooks/useT';
import { useOpenAIConnection } from '@/hooks/useOpenAIConnection';
import { useSettingsFormController } from '@/hooks/useSettingsFormController';
import { useSettingsServiceRunner } from '@/hooks/useSettingsServiceRunner';
import { settingsI18n } from '@/config/settingsI18n';
import { Loading } from '@/components/shared/Loading';
import { useConfirm } from '@/components/shared/ConfirmDialog';
import { useToast } from '@/components/shared/Toast';
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

export const SettingsWorkspace: React.FC = () => {
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
          onLinkCopied={() => show({ message: t('settings.messages.linkCopied'), type: 'success' })}
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
