import React, { useEffect, useState } from 'react';
import { TextStyleSelector } from '@/components/shared';
import { Button, Modal, useToast } from '@/shared/ui';
import { previewI18n } from '@/config/slidePreviewI18n';
import { useT } from '@/hooks/useT';
import { loadTemplateAsset } from '@/entities/template/api/templateAssetRepository';
import { TemplateGallery } from '@/entities/template/ui/TemplateGallery';
import {
  templateFileFromChoice,
  templateIdFromChoice,
  templateReferenceFromChoice,
  type TemplateChoice,
  type TemplateReference,
} from '@/entities/template/model/templateSelection';
import { listUserTemplates, type UserTemplate } from '@/api/templatesApi';
import type { DeckStyleMode } from '../model/deckStyleMode';

interface DeckStyleDialogProps {
  isOpen: boolean;
  currentTextStyle: string;
  initialMode: DeckStyleMode;
  onClose: () => void;
  onApplyImageTemplate: (file: File) => Promise<void>;
  onApplyTextStyle: (style: string) => Promise<void>;
}

export const DeckStyleDialog: React.FC<DeckStyleDialogProps> = ({
  isOpen,
  currentTextStyle,
  initialMode,
  onClose,
  onApplyImageTemplate,
  onApplyTextStyle,
}) => {
  const t = useT(previewI18n);
  const { show, ToastContainer } = useToast();
  const [useTextStyle, setUseTextStyle] = useState(false);
  const [draftTextStyle, setDraftTextStyle] = useState('');
  const [templates, setTemplates] = useState<UserTemplate[]>([]);
  const [selection, setSelection] = useState<TemplateReference | null>(null);
  const [applyingImage, setApplyingImage] = useState(false);
  const [applyingText, setApplyingText] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setDraftTextStyle(currentTextStyle);
    setUseTextStyle(initialMode === 'text');
  }, [currentTextStyle, initialMode, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;

    const loadCatalog = async () => {
      try {
        const response = await listUserTemplates();
        if (!cancelled) {
          setTemplates(response.data?.templates ?? []);
        }
      } catch (error) {
        console.error('Failed to load the deck style catalog:', error);
      }
    };

    void loadCatalog();
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  const handleImageTemplate = async (choice: TemplateChoice) => {
    let file = templateFileFromChoice(choice);
    const templateId = templateIdFromChoice(choice);
    if (templateId && !file) {
      const resolvedFile = await loadTemplateAsset(templateId, templates);
      if (!resolvedFile) {
        show({ message: t('slidePreview.loadTemplateFailed'), type: 'error' });
        return;
      }
      file = resolvedFile;
    }
    if (!file) return;

    setApplyingImage(true);
    try {
      await onApplyImageTemplate(file);
      setSelection(templateReferenceFromChoice(choice));
      show({ message: t('slidePreview.templateChanged'), type: 'success' });
      onClose();
    } catch (error: any) {
      show({
        message: t('slidePreview.templateChangeFailed', {
          error: error.message || t('slidePreview.unknownError'),
        }),
        type: 'error',
      });
    } finally {
      setApplyingImage(false);
    }
  };

  const handleTextStyle = async () => {
    setApplyingText(true);
    try {
      await onApplyTextStyle(draftTextStyle);
      show({ message: t('slidePreview.styleDescSaved'), type: 'success' });
      onClose();
    } catch (error: any) {
      show({
        message: t('slidePreview.saveFailed', {
          error: error.message || t('slidePreview.unknownError'),
        }),
        type: 'error',
      });
    } finally {
      setApplyingText(false);
    }
  };

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={t('preview.changeTemplate')}
        size="lg"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-foreground-tertiary mb-4">
            {t('preview.templateModalDesc')}
          </p>
          <label className="flex items-center gap-2 cursor-pointer group">
            <span className="text-sm text-gray-600 dark:text-foreground-tertiary group-hover:text-gray-900 dark:group-hover:text-white transition-colors">
              {t('preview.useTextStyle')}
            </span>
            <span className="relative">
              <input
                type="checkbox"
                checked={useTextStyle}
                onChange={(event) => setUseTextStyle(event.target.checked)}
                className="sr-only peer"
              />
              <span className="block w-11 h-6 bg-gray-200 dark:bg-background-hover peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-brand-300 dark:peer-focus:ring-brand/30 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white dark:after:bg-foreground-secondary after:border-gray-300 dark:after:border-border-hover after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand" />
            </span>
          </label>

          {useTextStyle ? (
            <TextStyleSelector
              value={draftTextStyle}
              onChange={setDraftTextStyle}
              onToast={show}
            />
          ) : (
            <>
              <TemplateGallery
                onChoose={handleImageTemplate}
                selectedTemplate={selection}
                uploadPolicy="optional"
              />
              {applyingImage && (
                <div className="text-center py-2 text-sm text-gray-500 dark:text-foreground-tertiary">
                  {t('preview.uploadingTemplate')}
                </div>
              )}
            </>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t">
            {useTextStyle && (
              <Button
                variant="primary"
                loading={applyingText}
                onClick={() => void handleTextStyle()}
              >
                {t('preview.applyStyle')}
              </Button>
            )}
            <Button
              variant="ghost"
              onClick={onClose}
              disabled={applyingImage || applyingText}
            >
              {t('common.close')}
            </Button>
          </div>
        </div>
      </Modal>
      <ToastContainer />
    </>
  );
};
