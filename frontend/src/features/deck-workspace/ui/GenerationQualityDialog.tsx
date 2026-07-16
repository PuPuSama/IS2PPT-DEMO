import React, { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button, Modal } from '@/components/shared';
import { previewI18n } from '@/config/slidePreviewI18n';
import { useT } from '@/hooks/useT';

interface GenerationQualityDialogProps {
  isOpen: boolean;
  onCancel: () => void;
  onConfirm: (dismissFutureWarnings: boolean) => Promise<void>;
}

export const GenerationQualityDialog: React.FC<GenerationQualityDialogProps> = ({
  isOpen,
  onCancel,
  onConfirm,
}) => {
  const t = useT(previewI18n);
  const [dismissFutureWarnings, setDismissFutureWarnings] = useState(false);

  useEffect(() => {
    if (isOpen) setDismissFutureWarnings(false);
  }, [isOpen]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onCancel}
      title={t('preview.resolution1KWarning')}
      size="sm"
    >
      <div className="space-y-4">
        <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <AlertTriangle
            size={24}
            className="mt-0.5 flex-shrink-0 text-amber-700"
            aria-hidden="true"
          />
          <div className="flex-1">
            <p className="text-sm text-amber-800">
              {t('preview.resolution1KWarningText')}
            </p>
            <p className="text-sm text-amber-700 mt-2">
              {t('preview.resolution1KWarningHint')}
            </p>
          </div>
        </div>

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={dismissFutureWarnings}
            onChange={(event) => setDismissFutureWarnings(event.target.checked)}
            className="w-4 h-4 text-brand-600 rounded focus:ring-brand-500"
          />
          <span className="text-sm text-gray-600 dark:text-foreground-tertiary">
            {t('preview.dontShowAgain')}
          </span>
        </label>

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="ghost" onClick={onCancel}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="primary"
            onClick={() => void onConfirm(dismissFutureWarnings)}
          >
            {t('preview.generateAnyway')}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
