import { useEffect, useState, type ChangeEvent, type MouseEvent } from 'react';
import { Loader2, Trash2, Upload } from 'lucide-react';
import { getImageUrl } from '@/api/client';
import {
  deleteUserTemplate,
  listUserTemplates,
  uploadUserTemplate,
  type UserTemplate,
} from '@/api/templatesApi';
import { useT } from '@/hooks/useT';
import { useToast } from '@/shared/ui';
import { PRESET_TEMPLATE_CATALOG } from '../model/templateCatalog';
import type { TemplateChoice, TemplateReference } from '../model/templateSelection';

const templateGalleryI18n = {
  zh: {
    template: {
      myTemplates: '我的模板',
      presetTemplates: '预设模板',
      uploadTemplate: '上传模板',
      deleteTemplate: '删除模板',
      templateSelected: '已选择',
      saveToLibraryOnUpload: '上传模板时同时保存到我的模板库',
      cannotDeleteInUse: '当前使用中的模板不能删除，请先切换模板',
      unknownError: '未知错误',
      presets: {
        retroScroll: '复古卷轴',
        vectorIllustration: '矢量插画',
        glassEffect: '拟物玻璃',
      },
      messages: {
        uploadSuccess: '模板上传成功',
        uploadFailed: '模板上传失败',
        deleteSuccess: '模板已删除',
        deleteFailed: '删除模板失败',
      },
    },
  },
  en: {
    template: {
      myTemplates: 'My templates',
      presetTemplates: 'Preset templates',
      uploadTemplate: 'Upload template',
      deleteTemplate: 'Delete template',
      templateSelected: 'Selected',
      saveToLibraryOnUpload: 'Also save uploads to my template library',
      cannotDeleteInUse: 'Switch templates before deleting the active template',
      unknownError: 'Unknown error',
      presets: {
        retroScroll: 'Retro Scroll',
        vectorIllustration: 'Vector Illustration',
        glassEffect: 'Glass Effect',
      },
      messages: {
        uploadSuccess: 'Template uploaded',
        uploadFailed: 'Template upload failed',
        deleteSuccess: 'Template deleted',
        deleteFailed: 'Template deletion failed',
      },
    },
  },
};

interface TemplateGalleryProps {
  selectedTemplate?: TemplateReference | null;
  uploadPolicy?: 'library' | 'optional';
  onChoose: (choice: TemplateChoice) => void | Promise<void>;
}

const errorText = (error: unknown, fallback: string) => (
  error instanceof Error && error.message ? error.message : fallback
);

export function TemplateGallery({
  selectedTemplate = null,
  uploadPolicy = 'library',
  onChoose,
}: TemplateGalleryProps) {
  const t = useT(templateGalleryI18n);
  const { show, ToastContainer } = useToast();
  const [libraryTemplates, setLibraryTemplates] = useState<UserTemplate[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [saveUpload, setSaveUpload] = useState(true);

  useEffect(() => {
    let active = true;

    void listUserTemplates()
      .then((response) => {
        if (active) setLibraryTemplates(response.data?.templates ?? []);
      })
      .catch((error) => {
        console.error('Failed to load the template library:', error);
      });

    return () => {
      active = false;
    };
  }, []);

  const handleUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    const shouldPersist = uploadPolicy === 'library' || saveUpload;
    if (!shouldPersist) {
      await onChoose({ kind: 'upload', file });
      return;
    }

    setIsUploading(true);
    try {
      const response = await uploadUserTemplate(file);
      if (!response.data) throw new Error(t('template.unknownError'));

      setLibraryTemplates((current) => [response.data!, ...current]);
      await onChoose({
        kind: 'library',
        templateId: response.data.template_id,
        file,
      });
      show({ message: t('template.messages.uploadSuccess'), type: 'success' });
    } catch (error) {
      show({
        message: `${t('template.messages.uploadFailed')}: ${errorText(error, t('template.unknownError'))}`,
        type: 'error',
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (template: UserTemplate, event: MouseEvent) => {
    event.stopPropagation();
    if (
      selectedTemplate?.kind === 'library'
      && selectedTemplate.templateId === template.template_id
    ) {
      show({ message: t('template.cannotDeleteInUse'), type: 'info' });
      return;
    }

    setDeletingId(template.template_id);
    try {
      await deleteUserTemplate(template.template_id);
      setLibraryTemplates((current) => (
        current.filter((entry) => entry.template_id !== template.template_id)
      ));
      show({ message: t('template.messages.deleteSuccess'), type: 'success' });
    } catch (error) {
      show({
        message: `${t('template.messages.deleteFailed')}: ${errorText(error, t('template.unknownError'))}`,
        type: 'error',
      });
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <>
      <div className="space-y-5">
        {libraryTemplates.length > 0 && (
          <section aria-labelledby="template-library-title">
            <h4
              id="template-library-title"
              className="mb-2 text-sm font-medium text-gray-700 dark:text-foreground-secondary"
            >
              {t('template.myTemplates')}
            </h4>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {libraryTemplates.map((template) => {
                const isSelected = selectedTemplate?.kind === 'library'
                  && selectedTemplate.templateId === template.template_id;
                const label = template.name || t('template.myTemplates');

                return (
                  <div
                    key={template.template_id}
                    className={`group relative aspect-[4/3] overflow-hidden rounded-md border-2 bg-gray-100 transition-colors dark:bg-background-secondary ${
                      isSelected
                        ? 'border-brand-500 ring-2 ring-brand-200'
                        : 'border-gray-200 hover:border-brand-400 dark:border-border-primary'
                    }`}
                  >
                    <button
                      type="button"
                      aria-label={label}
                      className="absolute inset-0 h-full w-full"
                      onClick={() => void onChoose({
                        kind: 'library',
                        templateId: template.template_id,
                      })}
                    >
                      <img
                        src={getImageUrl(template.thumb_url || template.template_image_url)}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                      {isSelected && (
                        <span className="absolute inset-0 flex items-center justify-center bg-brand-500/25 text-sm font-semibold text-white">
                          {t('template.templateSelected')}
                        </span>
                      )}
                    </button>
                    {!isSelected && (
                      <button
                        type="button"
                        aria-label={`${t('template.deleteTemplate')}: ${label}`}
                        title={t('template.deleteTemplate')}
                        disabled={deletingId === template.template_id}
                        onClick={(event) => void handleDelete(template, event)}
                        className="absolute right-1.5 top-1.5 z-10 grid h-7 w-7 place-items-center rounded-md bg-red-600 text-white opacity-0 shadow-sm transition-opacity hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60 group-hover:opacity-100 group-focus-within:opacity-100"
                      >
                        {deletingId === template.template_id
                          ? <Loader2 size={14} className="animate-spin" />
                          : <Trash2 size={14} />}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        <section aria-labelledby="preset-template-title">
          <h4
            id="preset-template-title"
            className="mb-2 text-sm font-medium text-gray-700 dark:text-foreground-secondary"
          >
            {t('template.presetTemplates')}
          </h4>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {PRESET_TEMPLATE_CATALOG.map((template) => {
              const isSelected = selectedTemplate?.kind === 'preset'
                && selectedTemplate.templateId === template.id;

              return (
                <button
                  key={template.id}
                  type="button"
                  aria-label={t(template.nameKey)}
                  onClick={() => void onChoose({ kind: 'preset', templateId: template.id })}
                  className={`relative aspect-[4/3] overflow-hidden rounded-md border-2 bg-gray-100 transition-colors dark:bg-background-secondary ${
                    isSelected
                      ? 'border-brand-500 ring-2 ring-brand-200'
                      : 'border-gray-200 hover:border-brand-400 dark:border-border-primary'
                  }`}
                >
                  <img
                    src={template.thumbnailUrl}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                  {isSelected && (
                    <span className="absolute inset-0 flex items-center justify-center bg-brand-500/25 text-sm font-semibold text-white">
                      {t('template.templateSelected')}
                    </span>
                  )}
                </button>
              );
            })}

            <label className="relative flex aspect-[4/3] cursor-pointer flex-col items-center justify-center gap-2 overflow-hidden rounded-md border-2 border-dashed border-gray-300 text-gray-500 transition-colors hover:border-brand-500 hover:text-brand-600 dark:border-border-primary dark:text-foreground-tertiary">
              {isUploading
                ? <Loader2 size={22} className="animate-spin" />
                : <Upload size={22} />}
              <span className="text-sm">{t('template.uploadTemplate')}</span>
              <input
                type="file"
                accept="image/*"
                aria-label={t('template.uploadTemplate')}
                onChange={(event) => void handleUpload(event)}
                className="hidden"
                disabled={isUploading}
              />
            </label>
          </div>

          {uploadPolicy === 'optional' && (
            <label className="mt-3 flex cursor-pointer items-center gap-2 rounded-md border border-blue-200 bg-blue-50 p-3 dark:border-blue-700 dark:bg-blue-900/30">
              <input
                type="checkbox"
                checked={saveUpload}
                onChange={(event) => setSaveUpload(event.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-brand-500 focus:ring-brand-500 dark:border-border-primary"
              />
              <span className="text-sm text-gray-700 dark:text-foreground-secondary">
                {t('template.saveToLibraryOnUpload')}
              </span>
            </label>
          )}
        </section>
      </div>
      <ToastContainer />
    </>
  );
}
