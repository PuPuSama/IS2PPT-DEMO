import type { FC } from 'react';
import { FileText } from 'lucide-react';
import { Button } from '@/shared/ui';
import type { useT } from '@/hooks/useT';
import type { ServiceTestState, SettingsServiceTestItem } from '@/types/settingsPage';

type SettingsTranslator = ReturnType<typeof useT>;

interface SettingsServiceTestPanelProps {
  items: SettingsServiceTestItem[];
  states: Record<string, ServiceTestState>;
  t: SettingsTranslator;
  onRun: (item: SettingsServiceTestItem) => void;
}

const idleState: ServiceTestState = { status: 'idle' };

export const SettingsServiceTestPanel: FC<SettingsServiceTestPanelProps> = ({
  items,
  states,
  t,
  onRun,
}) => (
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
      {items.map((item) => {
        const testState = states[item.key] || idleState;
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
                onClick={() => onRun(item)}
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
);
