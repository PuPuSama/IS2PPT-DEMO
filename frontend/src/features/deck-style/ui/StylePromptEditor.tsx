import { useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { Loader2, Save, X } from 'lucide-react';
import { extractStyleFromImage } from '@/api/templatesApi';
import { presetStylesI18n } from '@/config/presetStylesI18n';
import { useT } from '@/hooks/useT';
import { Textarea } from '@/shared/ui';
import { STYLE_ACCENT_PALETTE, styleAccentFor } from '../model/styleAccent';
import { useStyleLibrary } from '../model/useStyleLibrary';
import { StyleChoiceGrid } from './StyleChoiceGrid';

const stylePromptI18n = {
  zh: {
    presetStyles: presetStylesI18n.zh,
    stylePlaceholder: '描述演示文稿的视觉语言、配色、字体和版式要求...',
    presetStylesLabel: '预设风格',
    myStylesLabel: '我的风格',
    extractFromImage: '从图片提取',
    extracting: '提取中',
    extractSuccess: '已提取图片风格',
    extractFailed: '图片风格提取失败',
    saveAsTemplate: '保存风格',
    saveStyle: '保存',
    cancel: '取消',
    deleteStyle: '删除风格',
    styleName: '风格名称',
    accentColor: '标记颜色',
    styleNamePlaceholder: '输入风格名称',
    saveSuccess: '风格已保存',
    saveFailed: '风格保存失败',
    deleteSuccess: '风格已删除',
    deleteFailed: '风格删除失败',
    noContent: '请先输入风格描述',
    emptyExtraction: '未能从图片中提取风格描述',
  },
  en: {
    presetStyles: presetStylesI18n.en,
    stylePlaceholder: 'Describe the visual language, palette, typography, and layout...',
    presetStylesLabel: 'Preset styles',
    myStylesLabel: 'My styles',
    extractFromImage: 'Extract from image',
    extracting: 'Extracting',
    extractSuccess: 'Image style extracted',
    extractFailed: 'Style extraction failed',
    saveAsTemplate: 'Save style',
    saveStyle: 'Save',
    cancel: 'Cancel',
    deleteStyle: 'Delete style',
    styleName: 'Style name',
    accentColor: 'Accent color',
    styleNamePlaceholder: 'Enter a style name',
    saveSuccess: 'Style saved',
    saveFailed: 'Style save failed',
    deleteSuccess: 'Style deleted',
    deleteFailed: 'Style deletion failed',
    noContent: 'Enter a style description first',
    emptyExtraction: 'No style description could be extracted',
  },
};

export interface StylePromptNotice {
  message: string;
  type: 'success' | 'error';
}

interface StylePromptEditorProps {
  description: string;
  onDescriptionChange: (description: string) => void;
  onNotify?: (notice: StylePromptNotice) => void;
}

const errorMessage = (error: unknown) => (
  error instanceof Error && error.message ? `: ${error.message}` : ''
);

export function StylePromptEditor({
  description,
  onDescriptionChange,
  onNotify,
}: StylePromptEditorProps) {
  const t = useT(stylePromptI18n);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const { styles, createStyle, removeStyle } = useStyleLibrary();
  const [saveFormOpen, setSaveFormOpen] = useState(false);
  const [styleName, setStyleName] = useState('');
  const [accentColor, setAccentColor] = useState<string>(STYLE_ACCENT_PALETTE[0]);
  const [saving, setSaving] = useState(false);
  const [deletingStyleId, setDeletingStyleId] = useState<string | null>(null);
  const [extracting, setExtracting] = useState(false);

  const openSaveForm = () => {
    if (!description.trim()) {
      onNotify?.({ message: t('noContent'), type: 'error' });
      return;
    }
    setAccentColor(styleAccentFor(description));
    setSaveFormOpen(true);
  };

  const closeSaveForm = () => {
    setSaveFormOpen(false);
    setStyleName('');
  };

  const handleSave = async (event: FormEvent) => {
    event.preventDefault();
    const name = styleName.trim();
    const content = description.trim();
    if (!name || !content) return;

    setSaving(true);
    try {
      await createStyle({ name, description: content, color: accentColor });
      onNotify?.({ message: t('saveSuccess'), type: 'success' });
      closeSaveForm();
    } catch (error) {
      onNotify?.({ message: `${t('saveFailed')}${errorMessage(error)}`, type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (styleId: string) => {
    setDeletingStyleId(styleId);
    try {
      await removeStyle(styleId);
      onNotify?.({ message: t('deleteSuccess'), type: 'success' });
    } catch (error) {
      onNotify?.({ message: `${t('deleteFailed')}${errorMessage(error)}`, type: 'error' });
    } finally {
      setDeletingStyleId(null);
    }
  };

  const handleImage = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setExtracting(true);
    try {
      const response = await extractStyleFromImage(file);
      const extracted = response.data?.style_description?.trim();
      if (!extracted) throw new Error(t('emptyExtraction'));
      onDescriptionChange(extracted);
      onNotify?.({ message: t('extractSuccess'), type: 'success' });
    } catch (error) {
      onNotify?.({ message: `${t('extractFailed')}${errorMessage(error)}`, type: 'error' });
    } finally {
      setExtracting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="relative">
        <Textarea
          placeholder={t('stylePlaceholder')}
          value={description}
          onChange={(event) => onDescriptionChange(event.target.value)}
          rows={4}
          className="border-2 border-gray-200 pr-28 text-sm transition-colors focus:border-brand-400 dark:border-border-primary dark:bg-background-tertiary dark:text-white dark:placeholder-foreground-tertiary dark:focus:border-brand"
        />
        <button
          type="button"
          onClick={openSaveForm}
          className="absolute right-2 top-2 flex h-7 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-gray-500 transition-colors hover:bg-brand-50 hover:text-brand-600 dark:text-foreground-tertiary dark:hover:bg-background-hover dark:hover:text-brand"
        >
          <Save size={13} />
          {t('saveAsTemplate')}
        </button>
      </div>

      {saveFormOpen && (
        <form
          onSubmit={(event) => void handleSave(event)}
          className="flex flex-wrap items-center gap-2 border-y border-gray-200 py-3 dark:border-border-primary"
        >
          <input
            type="text"
            value={styleName}
            onChange={(event) => setStyleName(event.target.value)}
            aria-label={t('styleName')}
            placeholder={t('styleNamePlaceholder')}
            autoFocus
            className="h-8 min-w-44 flex-1 rounded-md border border-gray-200 bg-white px-2 text-sm focus:border-brand-400 focus:outline-none dark:border-border-primary dark:bg-background-secondary dark:text-white dark:focus:border-brand"
          />
          <div
            role="group"
            className="flex gap-1.5"
            aria-label={t('accentColor')}
          >
            {STYLE_ACCENT_PALETTE.map((color) => (
              <button
                key={color}
                type="button"
                title={color}
                aria-label={color}
                aria-pressed={accentColor === color}
                onClick={() => setAccentColor(color)}
                className={`h-5 w-5 rounded-full ring-1 ring-black/10 transition-transform ${
                  accentColor === color ? 'scale-125 ring-2 ring-brand-500' : ''
                }`}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
          <button
            type="submit"
            disabled={saving || !styleName.trim()}
            className="grid h-8 min-w-16 place-items-center rounded-md bg-brand-500 px-3 text-xs font-medium text-white transition-colors hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? <Loader2 size={13} className="animate-spin" /> : t('saveStyle')}
          </button>
          <button
            type="button"
            title={t('cancel')}
            aria-label={t('cancel')}
            onClick={closeSaveForm}
            className="grid h-8 w-8 place-items-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-background-hover dark:hover:text-foreground-secondary"
          >
            <X size={15} />
          </button>
        </form>
      )}

      <StyleChoiceGrid
        styles={styles}
        deletingStyleId={deletingStyleId}
        extracting={extracting}
        translate={t}
        onChoose={onDescriptionChange}
        onDelete={(styleId) => void handleDelete(styleId)}
        onExtractRequest={() => imageInputRef.current?.click()}
      />
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        aria-label={t('extractFromImage')}
        onChange={(event) => void handleImage(event)}
        className="hidden"
      />
    </div>
  );
}
