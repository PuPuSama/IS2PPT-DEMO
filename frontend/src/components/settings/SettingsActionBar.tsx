import type { FC } from 'react';
import { RotateCcw, Save } from 'lucide-react';
import { Button } from '@/components/shared/Button';
import type { useT } from '@/hooks/useT';

type SettingsTranslator = ReturnType<typeof useT>;

interface SettingsActionBarProps {
  isSaving: boolean;
  t: SettingsTranslator;
  onReset: () => void;
  onSave: () => void;
}

export const SettingsActionBar: FC<SettingsActionBarProps> = ({
  isSaving,
  t,
  onReset,
  onSave,
}) => (
  <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-border-primary">
    <Button
      variant="secondary"
      icon={<RotateCcw size={18} />}
      onClick={onReset}
      disabled={isSaving}
    >
      {t('settings.actions.resetToDefault')}
    </Button>
    <Button
      variant="primary"
      icon={<Save size={18} />}
      onClick={onSave}
      loading={isSaving}
    >
      {isSaving ? t('settings.actions.saving') : t('settings.actions.save')}
    </Button>
  </div>
);
