import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Sparkles, FileText, FileEdit, Paperclip, Palette, Lightbulb, Search, Settings, HelpCircle, Sun, Moon, Globe, Monitor, ChevronDown, Upload, RefreshCw } from 'lucide-react';
import { ReferenceFileList, ReferenceFileSelector, FilePreviewModal, TextStyleSelector } from '@/components/shared';
import { Button, Card, useToast } from '@/shared/ui';
import { AppFooter } from '@/widgets/app-footer/ui/AppFooter';
import { CreationGuideDialog } from './CreationGuideDialog';
import { MarkdownTextarea, type MarkdownTextareaRef } from '@/components/shared/MarkdownTextarea';
import { listUserTemplates, type UserTemplate } from '@/api/templatesApi';
import { TemplateGallery } from '@/entities/template/ui/TemplateGallery';
import {
  templateFileFromChoice,
  templateIdFromChoice,
  templateReferenceFromChoice,
  type TemplateChoice,
} from '@/entities/template/model/templateSelection';
import { useTheme } from '@/hooks/useTheme';
import { useImagePaste } from '@/hooks/useImagePaste';
import { useT } from '@/hooks/useT';
import { ASPECT_RATIO_OPTIONS } from '@/config/aspectRatio';
import { homeI18n } from '@/config/homeI18n';
import { homeDraftStore, type HomeDraftMode } from '@/shared/storage/homeDraft';
import { uiDismissals } from '@/shared/storage/uiDismissals';
import { APP_IDENTITY } from '@/shared/config/appIdentity';
import { useCreationReferences } from '../model/useCreationReferences';
import { useDeckCreation } from '../model/useDeckCreation';
import { DeckCreationError } from '../model/types';
import {
  completedReferenceIds,
  isReferenceDocument,
  isReferenceParsing,
} from '../model/referenceDocuments';

type CreationMode = HomeDraftMode;

export const DeckCreationPage: React.FC = () => {
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const t = useT(homeI18n);
  const { theme, isDark, setTheme } = useTheme();
  const { show, ToastContainer } = useToast();

  const [creationMode, setCreationMode] = useState<CreationMode>(() => homeDraftStore.getTab());
  const [brief, setBrief] = useState(() => homeDraftStore.getContent());
  const [templateChoice, setTemplateChoice] = useState<TemplateChoice | null>(null);
  const [guideOpen, setGuideOpen] = useState(false);
  const [isThemeMenuOpen, setIsThemeMenuOpen] = useState(false);
  const [templateLibrary, setTemplateLibrary] = useState<UserTemplate[]>([]);
  const { createDeck, isCreating } = useDeckCreation(templateLibrary);

  const [useTemplateStyle, setUseTemplateStyle] = useState(false);
  const [templateStyle, setTemplateStyle] = useState('');
  const [aspectRatio, setAspectRatio] = useState('16:9');
  const [isAspectRatioOpen, setIsAspectRatioOpen] = useState(false);
  const [renovationFile, setRenovationFile] = useState<File | null>(null);
  const [keepLayout, setKeepLayout] = useState(false);
  const renovationFileInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const themeMenuRef = useRef<HTMLDivElement>(null);
  const {
    references,
    isUploading: isUploadingReference,
    isPickerOpen: isReferencePickerOpen,
    setIsPickerOpen: setReferencePickerOpen,
    previewReferenceId,
    setPreviewReferenceId,
    uploadReference,
    addDocuments,
    removeReference,
    updateReference,
    addSelectedReferences,
    handleReferenceInput,
    selectedReferenceIds,
  } = useCreationReferences({ translate: t, notify: show });

  // 持久化草稿，确保跳转设置页后返回时内容不丢失
  useEffect(() => {
    homeDraftStore.saveContent(brief);
  }, [brief]);

  useEffect(() => {
    homeDraftStore.saveTab(creationMode);
  }, [creationMode]);


  // Load the template records needed to resolve an existing library choice.
  useEffect(() => {
    const loadTemplates = async () => {
      try {
        const response = await listUserTemplates();
        if (response.data?.templates) {
          setTemplateLibrary(response.data.templates);
        }
      } catch (error) {
        console.error('加载用户模板失败:', error);
      }
    };
    loadTemplates();
  }, []);

  // 首次访问自动弹出帮助模态框
  useEffect(() => {
    if (!uiDismissals.hasSeenHomeHelp()) {
      // 延迟500ms打开，让页面先渲染完成
      const timer = setTimeout(() => {
        setGuideOpen(true);
        uiDismissals.markHomeHelpSeen();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, []);


  const textareaRef = useRef<MarkdownTextareaRef>(null);

  // Callback to insert at cursor position in the textarea
  const insertAtCursor = useCallback((markdown: string) => {
    textareaRef.current?.insertAtCursor(markdown);
  }, []);

  // 图片粘贴使用统一 hook（批量支持，不对非图片文件发出警告，由下方 handlePaste 处理文档）
  const { handlePaste: handleImagePaste, handleFiles: handleImageFiles, isUploading: isUploadingImage } = useImagePaste({
    projectId: null,
    setContent: setBrief,
    showToast: show,
    warnUnsupportedTypes: false,
    insertAtCursor,
  });

  // 检测粘贴事件，图片走 hook，文档走独立逻辑
  const handlePaste = async (e: React.ClipboardEvent<HTMLElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    // 分类：图片 vs 文档 vs 不支持
    let hasImages = false;
    const docFiles: File[] = [];
    const unsupportedExts: string[] = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.kind !== 'file') continue;
      const file = item.getAsFile();
      if (!file) continue;

      if (file.type.startsWith('image/')) {
        hasImages = true;
      } else {
        const fileExt = file.name.split('.').pop()?.toLowerCase();
        if (isReferenceDocument(file)) {
          docFiles.push(file);
        } else {
          unsupportedExts.push(fileExt || file.type);
        }
      }
    }

    // 图片交给 hook 处理（批量上传）
    if (hasImages) {
      handleImagePaste(e);
    }

    // 文档文件逐个上传
    if (docFiles.length > 0) {
      if (!hasImages) e.preventDefault();
      for (const file of docFiles) {
        await uploadReference(file);
      }
    }

    // 不支持的文件类型提示
    if (unsupportedExts.length > 0 && !hasImages && docFiles.length === 0) {
      show({ message: t('home.messages.unsupportedFileType', { type: unsupportedExts.join(', ') }), type: 'info' });
    }
  };

  const tabConfig = {
    idea: {
      icon: <Sparkles size={20} />,
      label: t('home.tabs.idea'),
      placeholder: t('home.placeholders.idea'),
      description: t('home.tabDescriptions.idea'),
      example: null as string | null,
    },
    outline: {
      icon: <FileText size={20} />,
      label: t('home.tabs.outline'),
      placeholder: t('home.placeholders.outline'),
      description: t('home.tabDescriptions.outline'),
      example: t('home.examples.outline'),
    },
    description: {
      icon: <FileEdit size={20} />,
      label: t('home.tabs.description'),
      placeholder: t('home.placeholders.description'),
      description: t('home.tabDescriptions.description'),
      example: t('home.examples.description'),
    },
    'source-deck': {
      icon: <RefreshCw size={20} />,
      label: t('home.tabs.sourceDeck'),
      placeholder: '',
      description: t('home.tabDescriptions.sourceDeck'),
      example: null as string | null,
    },
  };

  const handleSubmit = async () => {
    // Source-deck mode validates an upload instead of a text brief.
    if (creationMode === 'source-deck') {
      if (!renovationFile) {
        show({ message: t('home.renovation.uploadFile'), type: 'error' });
        return;
      }
    } else if (!brief.trim()) {
      show({ message: t('home.messages.enterContent'), type: 'error' });
      return;
    }

    // 检查是否有正在解析的文件
    const parsingFiles = references.filter(isReferenceParsing);
    if (parsingFiles.length > 0) {
      show({
        message: t('home.messages.filesParsing', { count: parsingFiles.length }),
        type: 'info'
      });
      return;
    }

    try {
      const style = templateStyle.trim() || undefined;
      const result = creationMode === 'source-deck' && renovationFile
        ? await createDeck({
            kind: 'import',
            sourceFile: renovationFile,
            keepLayout,
            style,
          })
        : await createDeck({
            kind: 'generate',
            mode: creationMode as 'idea' | 'outline' | 'description',
            brief,
            templateFile: templateFileFromChoice(templateChoice),
            templateId: templateIdFromChoice(templateChoice),
            style,
            readyReferenceIds: completedReferenceIds(references),
            additionalReferenceIds: references
              .filter((reference) => reference.parse_status !== 'completed')
              .map((reference) => reference.id),
            aspectRatio,
          });

      const destination = result.destination === 'deck-plan' ? 'outline' : 'detail';
      navigate(`/project/${result.deckId}/${destination}`);
    } catch (error: any) {
      console.error('Deck creation failed:', error);
      if (error instanceof DeckCreationError && error.code === 'template-unavailable') {
        show({ message: t('home.messages.loadTemplateFailed'), type: 'error' });
        return;
      }
      const message = error?.response?.data?.error?.message
        || error?.message
        || t('home.messages.projectCreateFailed');
      show({ message, type: 'error' });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-yellow-50 via-orange-50/30 to-pink-50/50 dark:from-background-primary dark:via-background-primary dark:to-background-primary relative overflow-hidden">
      {/* 背景装饰元素 - 仅在亮色模式显示 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none dark:hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-brand-500/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-orange-400/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-72 h-72 bg-yellow-400/5 rounded-full blur-3xl"></div>
      </div>

      {/* 导航栏 */}
      <nav className="relative z-50 h-16 md:h-18 bg-white/40 dark:bg-background-primary backdrop-blur-2xl dark:backdrop-blur-none dark:border-b dark:border-border-primary">

        <div className="max-w-7xl mx-auto px-4 md:px-6 h-full flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center">
              <img
                src="/logo.png"
                alt={`${APP_IDENTITY.displayName} Logo`}
                className="h-10 md:h-12 w-auto rounded-lg object-contain"
              />
            </div>
            <span className="text-xl md:text-2xl font-bold bg-gradient-to-r from-brand-600 via-orange-500 to-pink-500 bg-clip-text text-transparent">
              {APP_IDENTITY.displayName}
            </span>
          </div>
          <div className="flex items-center gap-2 md:gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/history')}
              className="text-xs md:text-sm hover:bg-brand-100/60 hover:shadow-sm hover:scale-105 transition-all duration-200 font-medium"
            >
              <span className="hidden sm:inline">{t('nav.history')}</span>
              <span className="sm:hidden">{t('nav.history')}</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              icon={<Settings size={16} className="md:w-[18px] md:h-[18px]" />}
              onClick={() => navigate('/settings')}
              className="text-xs md:text-sm hover:bg-brand-100/60 hover:shadow-sm hover:scale-105 transition-all duration-200 font-medium"
            >
              <span className="hidden md:inline">{t('nav.settings')}</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setGuideOpen(true)}
              className="hidden md:inline-flex hover:bg-brand-50/50"
            >
              {t('nav.help')}
            </Button>
            {/* 移动端帮助按钮 */}
            <Button
              variant="ghost"
              size="sm"
              icon={<HelpCircle size={16} />}
              onClick={() => setGuideOpen(true)}
              className="md:hidden hover:bg-brand-100/60 hover:shadow-sm hover:scale-105 transition-all duration-200"
              title={t('nav.help')}
            />
            {/* 分隔线 */}
            <div className="h-5 w-px bg-gray-300 dark:bg-border-primary mx-1" />
            {/* 语言切换按钮 */}
            <button
              onClick={() => i18n.changeLanguage(i18n.language?.startsWith('zh') ? 'en' : 'zh')}
              className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-600 dark:text-foreground-tertiary hover:text-gray-900 dark:hover:text-gray-100 hover:bg-brand-100/60 dark:hover:bg-background-hover rounded-md transition-all"
              title={t('settings.language.label')}
            >
              <Globe size={14} />
              <span>{i18n.language?.startsWith('zh') ? 'EN' : '中'}</span>
            </button>
            {/* 主题切换按钮 */}
            <div className="relative" ref={themeMenuRef}>
              <button
                onClick={() => setIsThemeMenuOpen(!isThemeMenuOpen)}
                className="flex items-center gap-1 p-1.5 text-gray-600 dark:text-foreground-tertiary hover:text-gray-900 dark:hover:text-gray-100 hover:bg-brand-100/60 dark:hover:bg-background-hover rounded-md transition-all"
                title={t('settings.theme.label')}
              >
                {theme === 'system' ? <Monitor size={16} /> : isDark ? <Moon size={16} /> : <Sun size={16} />}
                <ChevronDown size={12} className={`transition-transform ${isThemeMenuOpen ? 'rotate-180' : ''}`} />
              </button>
              {/* 主题下拉菜单 */}
              {isThemeMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsThemeMenuOpen(false)} />
                  <div className="absolute right-0 top-full mt-1 z-50 bg-white dark:bg-background-secondary border border-gray-200 dark:border-border-primary rounded-lg shadow-lg dark:shadow-none py-1 min-w-[120px]">
                    <button
                      onClick={() => { setTheme('light'); setIsThemeMenuOpen(false); }}
                      className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-background-hover transition-colors ${theme === 'light' ? 'text-brand' : 'text-gray-700 dark:text-foreground-secondary'}`}
                    >
                      <Sun size={14} />
                      <span>{t('settings.theme.light')}</span>
                    </button>
                    <button
                      onClick={() => { setTheme('dark'); setIsThemeMenuOpen(false); }}
                      className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-background-hover transition-colors ${theme === 'dark' ? 'text-brand' : 'text-gray-700 dark:text-foreground-secondary'}`}
                    >
                      <Moon size={14} />
                      <span>{t('settings.theme.dark')}</span>
                    </button>
                    <button
                      onClick={() => { setTheme('system'); setIsThemeMenuOpen(false); }}
                      className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-background-hover transition-colors ${theme === 'system' ? 'text-brand' : 'text-gray-700 dark:text-foreground-secondary'}`}
                    >
                      <Monitor size={14} />
                      <span>{t('settings.theme.system')}</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* 主内容 */}
      <main className="relative max-w-5xl mx-auto px-3 md:px-4 py-8 md:py-12">
        {/* Hero 标题区 */}
        <div className="text-center mb-10 md:mb-16 space-y-4 md:space-y-6">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/60 dark:bg-background-secondary backdrop-blur-sm rounded-full shadow-sm dark:shadow-none mb-4">
            <span className="text-2xl animate-pulse"><Sparkles size={20} className="text-orange-500 dark:text-brand" /></span>
            <span className="text-sm font-medium text-gray-700 dark:text-foreground-secondary">{t('home.tagline')}</span>
          </div>

          <h1 className="text-4xl md:text-6xl lg:text-7xl font-extrabold leading-tight">
            <span className="bg-gradient-to-r from-yellow-600 via-orange-500 to-pink-500 dark:from-brand-dark dark:via-brand dark:to-brand-light bg-clip-text text-transparent dark:italic" style={{
              backgroundSize: '200% auto',
              animation: 'gradient 3s ease infinite',
            }}>
              {APP_IDENTITY.displayName}
            </span>
          </h1>

          <p className="text-lg md:text-xl text-gray-600 dark:text-foreground-secondary max-w-2xl mx-auto font-light">
            {t('home.subtitle')}
          </p>

          {/* 特性标签 */}
          <div className="flex flex-wrap items-center justify-center gap-2 md:gap-3 pt-4">
            {[
              { icon: <Sparkles size={14} className="text-yellow-600 dark:text-brand" />, label: t('home.features.oneClick') },
              { icon: <FileEdit size={14} className="text-blue-500 dark:text-blue-400" />, label: t('home.features.naturalEdit') },
              { icon: <Search size={14} className="text-orange-500 dark:text-orange-400" />, label: t('home.features.regionEdit') },

              { icon: <Paperclip size={14} className="text-green-600 dark:text-green-400" />, label: t('home.features.export') },
            ].map((feature, idx) => (
              <span
                key={idx}
                className="inline-flex items-center gap-1 px-3 py-1.5 bg-white/70 dark:bg-background-secondary backdrop-blur-sm rounded-full text-xs md:text-sm text-gray-700 dark:text-foreground-secondary border border-gray-200/50 dark:border-border-primary shadow-sm dark:shadow-none hover:shadow-md dark:hover:border-border-hover transition-all hover:scale-105 cursor-default"
              >
                {feature.icon}
                {feature.label}
              </span>
            ))}
          </div>
        </div>

        {/* 创建卡片 */}
        <Card className="p-4 md:p-10 bg-white/90 dark:bg-background-secondary backdrop-blur-xl dark:backdrop-blur-none shadow-2xl dark:shadow-none border-0 dark:border dark:border-border-primary hover:shadow-3xl dark:hover:shadow-none transition-all duration-300 dark:rounded-2xl">
          {/* 选项卡 */}
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 mb-6 md:mb-8">
            {(Object.keys(tabConfig) as CreationMode[]).map((type) => {
              const config = tabConfig[type];
              return (
                <button
                  key={type}
                  onClick={() => setCreationMode(type)}
                  className={`flex-1 flex items-center justify-center gap-1.5 md:gap-2 px-3 md:px-6 py-2.5 md:py-3 rounded-lg dark:rounded-xl font-medium transition-all text-sm md:text-base touch-manipulation ${
                    creationMode === type
                      ? 'bg-gradient-to-r from-brand-500 to-brand-600 dark:from-brand dark:to-brand text-black shadow-yellow dark:shadow-lg dark:shadow-brand/20'
                      : 'bg-white dark:bg-background-elevated border border-gray-200 dark:border-border-primary text-gray-700 dark:text-foreground-secondary hover:bg-brand-50 dark:hover:bg-background-hover active:bg-brand-100'
                  }`}
                >
                  <span className="scale-90 md:scale-100">{config.icon}</span>
                  <span className="truncate">{config.label}</span>
                </button>
              );
            })}
          </div>

          {/* 描述 */}
          <div className="relative">
            <p className="text-sm md:text-base mb-4 md:mb-6 leading-relaxed">
              <span className="inline-flex items-center gap-2 text-gray-600 dark:text-foreground-tertiary">
                <Lightbulb size={16} className="text-brand-600 dark:text-brand flex-shrink-0" />
                <span className="font-semibold">
                  {tabConfig[creationMode].description}
                </span>
                {tabConfig[creationMode].example && (
                  <span className="relative group/tip inline-flex">
                    <HelpCircle size={15} className="text-gray-400 dark:text-foreground-tertiary hover:text-brand-600 dark:hover:text-brand cursor-help transition-colors" />
                    <span className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 hidden group-hover/tip:block z-50 w-72 md:w-80 p-3 bg-white dark:bg-background-elevated border border-gray-200 dark:border-border-primary rounded-lg shadow-xl dark:shadow-none text-xs text-gray-700 dark:text-foreground-secondary whitespace-pre-line leading-relaxed">
                      {tabConfig[creationMode].example}
                      <span className="absolute left-1/2 -translate-x-1/2 top-full -mt-px w-2 h-2 bg-white dark:bg-background-elevated border-r border-b border-gray-200 dark:border-border-primary rotate-45" />
                    </span>
                  </span>
                )}
              </span>
            </p>
          </div>

          {/* 输入区 - 带工具栏 */}
          <div className="mb-2">
            {creationMode === 'source-deck' ? (
              /* PPT 翻新：文件上传区 */
              <div className="space-y-4">
                <div
                  className="border-2 border-dashed border-gray-300 dark:border-border-primary rounded-xl p-8 text-center cursor-pointer hover:border-brand-400 dark:hover:border-brand transition-colors duration-200"
                  onClick={() => renovationFileInputRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const file = e.dataTransfer.files[0];
                    if (file && (file.name.toLowerCase().endsWith('.pdf') || file.name.toLowerCase().endsWith('.pptx') || file.name.toLowerCase().endsWith('.ppt'))) {
                      setRenovationFile(file);
                      const ext = file.name.split('.').pop()?.toLowerCase();
                      if (ext === 'ppt' || ext === 'pptx') {
                        show({ message: `💡 ${t('home.messages.pptTip')}`, type: 'info' });
                      }
                    } else {
                      show({ message: t('home.renovation.onlyPdfPptx'), type: 'error' });
                    }
                  }}
                >
                  {renovationFile ? (
                    <div className="flex items-center justify-center gap-3">
                      <FileText size={24} className="text-brand-600 dark:text-brand" />
                      <div className="text-left">
                        <p className="text-sm font-medium text-gray-900 dark:text-white">{renovationFile.name}</p>
                        <p className="text-xs text-gray-500 dark:text-foreground-tertiary">{(renovationFile.size / 1024 / 1024).toFixed(1)} MB</p>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setRenovationFile(null); }}
                        className="ml-2 text-gray-400 hover:text-red-500 transition-colors"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Upload size={32} className="mx-auto text-gray-400 dark:text-foreground-tertiary" />
                      <p className="text-sm text-gray-600 dark:text-foreground-secondary">{t('home.renovation.uploadHint')}</p>
                      <p className="text-xs text-gray-400 dark:text-foreground-tertiary">{t('home.renovation.formatHint')}</p>
                    </div>
                  )}
                </div>
                <input
                  ref={renovationFileInputRef}
                  type="file"
                  accept=".pdf,.pptx,.ppt"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setRenovationFile(file);
                      const ext = file.name.split('.').pop()?.toLowerCase();
                      if (ext === 'ppt' || ext === 'pptx') {
                        show({ message: `💡 ${t('home.messages.pptTip')}`, type: 'info' });
                      }
                    }
                    e.target.value = '';
                  }}
                  className="hidden"
                />

                {/* 保留布局 toggle */}
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer group">
                    <span className="text-sm text-gray-600 dark:text-foreground-tertiary group-hover:text-gray-900 dark:group-hover:text-white transition-colors">
                      {t('home.renovation.keepLayout')}
                    </span>
                    <div className="relative">
                      <input
                        type="checkbox"
                        checked={keepLayout}
                        onChange={(e) => setKeepLayout(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 dark:bg-background-hover peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-brand-300 dark:peer-focus:ring-brand/30 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white dark:after:bg-foreground-secondary after:border-gray-300 dark:after:border-border-hover after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand"></div>
                    </div>
                  </label>
                  <Button
                    size="sm"
                    onClick={handleSubmit}
                    loading={isCreating}
                    disabled={!renovationFile}
                    className="shadow-sm dark:shadow-background-primary/30 text-xs md:text-sm px-3 md:px-4"
                  >
                    {t('common.next')}
                  </Button>
                </div>
              </div>
            ) : (
            <MarkdownTextarea
              ref={textareaRef}
              placeholder={tabConfig[creationMode].placeholder}
              value={brief}
              onChange={setBrief}
              onPaste={handlePaste}
              onFiles={handleImageFiles}
              onDocumentFiles={addDocuments}
              rows={creationMode === 'idea' ? 4 : 8}
              className="text-sm md:text-base border-2 border-gray-200 dark:border-border-primary dark:bg-background-tertiary dark:text-white focus-within:border-brand-400 dark:focus-within:border-brand transition-colors duration-200"
              toolbarLeft={
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setReferencePickerOpen(true)}
                    className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:text-foreground-tertiary dark:hover:text-foreground-secondary dark:hover:bg-background-hover rounded transition-colors active:scale-95 touch-manipulation"
                    title={t('home.actions.selectFile')}
                  >
                    <Paperclip size={18} />
                  </button>
                  {/* 画面比例选择 */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setIsAspectRatioOpen(!isAspectRatioOpen)}
                      className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:text-foreground-tertiary dark:hover:text-foreground-secondary dark:hover:bg-background-hover rounded transition-colors"
                      title={i18n.language?.startsWith('zh') ? '画面比例' : 'Aspect Ratio'}
                    >
                      <span>{aspectRatio}</span>
                      <ChevronDown size={12} className={`transition-transform ${isAspectRatioOpen ? 'rotate-180' : ''}`} />
                    </button>
                    {isAspectRatioOpen && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setIsAspectRatioOpen(false)} />
                        <div className="absolute left-0 bottom-full mb-1 z-50 bg-white dark:bg-background-elevated border border-gray-200 dark:border-border-primary rounded-lg shadow-lg dark:shadow-none py-1 min-w-[80px]">
                          {ASPECT_RATIO_OPTIONS.map((opt) => (
                            <button
                              key={opt.value}
                              onClick={() => { setAspectRatio(opt.value); setIsAspectRatioOpen(false); }}
                              className={`w-full text-left px-3 py-1.5 text-xs hover:bg-gray-100 dark:hover:bg-background-hover transition-colors ${aspectRatio === opt.value ? 'text-brand font-semibold' : 'text-gray-700 dark:text-foreground-secondary'}`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              }
              toolbarRight={
                <Button
                  size="sm"
                  onClick={handleSubmit}
                  loading={isCreating}
                  disabled={
                    !brief.trim() ||
                    isUploadingImage ||
                    isUploadingReference ||
                    references.some(isReferenceParsing)
                  }
                  className="shadow-sm dark:shadow-background-primary/30 text-xs md:text-sm px-3 md:px-4"
                >
                  {references.some(isReferenceParsing)
                    ? t('home.actions.parsing')
                    : t('common.next')}
                </Button>
              }
            />
            )}
          </div>

          {/* 隐藏的文件输入 */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.csv,.txt,.md"
            onChange={handleReferenceInput}
            className="hidden"
          />

          <ReferenceFileList
            files={references}
            onFileClick={setPreviewReferenceId}
            onFileDelete={removeReference}
            onFileStatusChange={updateReference}
            deleteMode="remove"
            className="mb-4"
            showToast={show}
          />

          {/* 模板选择 */}
          <div className="mb-6 md:mb-8 pt-4 border-t border-gray-100 dark:border-border-primary">
            <div className="flex items-center justify-between mb-3 md:mb-4">
              <div className="flex items-center gap-2">
                <Palette size={18} className="text-orange-600 dark:text-brand flex-shrink-0" />
                <h3 className="text-base md:text-lg font-semibold text-gray-900 dark:text-white">
                  {t('home.template.title')}
                </h3>
              </div>
              {/* 无模板图模式开关 */}
              <label className="flex items-center gap-2 cursor-pointer group">
                <span className="text-sm text-gray-600 dark:text-foreground-tertiary group-hover:text-gray-900 dark:group-hover:text-white transition-colors">
                  {t('home.template.useTextStyle')}
                </span>
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={useTemplateStyle}
                    onChange={(e) => {
                      setUseTemplateStyle(e.target.checked);
                      // 切换到无模板图模式时，清空模板选择
                      if (e.target.checked) {
                        setTemplateChoice(null);
                      }
                      // 不再清空风格描述，允许用户保留已输入的内容
                    }}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 dark:bg-background-hover peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-brand-300 dark:peer-focus:ring-brand/30 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white dark:after:bg-foreground-secondary after:border-gray-300 dark:after:border-border-hover after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand"></div>
                </div>
              </label>
            </div>

            {/* 根据模式显示不同的内容 */}
            {useTemplateStyle ? (
              <TextStyleSelector
                value={templateStyle}
                onChange={setTemplateStyle}
                onToast={show}
              />
            ) : (
              <TemplateGallery
                onChoose={setTemplateChoice}
                selectedTemplate={templateReferenceFromChoice(templateChoice)}
                uploadPolicy="library"
              />
            )}
          </div>

        </Card>
      </main>
      <ToastContainer />
      {/* 参考文件选择器 */}
      {/* 在 Home 页面，始终查询全局文件，因为此时还没有项目 */}
      <ReferenceFileSelector
        projectId={null}
        isOpen={isReferencePickerOpen}
        onClose={() => setReferencePickerOpen(false)}
        onSelect={addSelectedReferences}
        multiple={true}
        initialSelectedIds={selectedReferenceIds}
      />

      <FilePreviewModal fileId={previewReferenceId} onClose={() => setPreviewReferenceId(null)} />
      {/* 帮助模态框 */}
      <CreationGuideDialog
        isOpen={guideOpen}
        onClose={() => setGuideOpen(false)}
      />
      <AppFooter />
    </div>
  );
};
