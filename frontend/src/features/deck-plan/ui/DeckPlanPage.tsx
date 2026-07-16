import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { ArrowLeft, Save, ArrowRight, Plus, FileText, Sparkle, Download, Upload, PanelLeftClose, PanelLeftOpen, ChevronDown, Settings2, Presentation } from 'lucide-react';
import { useT } from '@/hooks/useT';
import { outlineI18n } from '@/config/outlineEditorI18n';
import PresetCapsules from '@/components/shared/PresetCapsules';

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button, Loading, useConfirm, useToast, AiRefineInput, FilePreviewModal, ReferenceFileList, ImportMarkdownModal } from '@/components/shared';
import { MarkdownTextarea, type MarkdownTextareaRef } from '@/components/shared/MarkdownTextarea';
import { OutlineCard } from '@/components/outline/OutlineCard';
import { useProjectStore } from '@/store/useProjectStore';
import { useGenerationJobsStore } from '@/entities/generation/model/useGenerationJobsStore';
import { useImagePaste } from '@/hooks/useImagePaste';
import { exportProjectToMarkdown, parseMarkdownPages } from '@/utils/projectUtils';
import type { Page as LegacySlide } from '@/types';
import {
  appendDeckPlanSlides,
  refineDeckPlan,
  saveDeckPlanRequirements,
  saveDeckSourceText,
} from '../api/deckPlanRepository';
import { deckPlanSnapshotFromProject } from '../model/planSource';

const EMPTY_SLIDES: LegacySlide[] = [];

// Sortable adapter for the legacy OutlineCard contract.
const SortableSlideCard: React.FC<{
  slide: LegacySlide;
  index: number;
  projectId?: string;
  showToast: (props: { message: string; type: 'success' | 'error' | 'info' | 'warning' }) => void;
  onUpdate: (data: Partial<LegacySlide>) => void;
  onDelete: () => void;
  onClick: () => void;
  isSelected: boolean;
  isAiRefining?: boolean;
}> = ({ slide, index, ...cardProps }) => {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: slide.id || `slide-${index}`,
  });

  const style = {
    // 只使用位移变换，不使用缩放，避免拖拽时元素被拉伸
    transform: transform ? CSS.Translate.toString(transform) : undefined,
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <OutlineCard page={slide} index={index} {...cardProps} dragHandleProps={listeners} />
    </div>
  );
};

export const DeckPlanPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const t = useT(outlineI18n);
  const { projectId: deckId } = useParams<{ projectId: string }>();
  const fromHistory = (location.state as any)?.from === 'history';
  const {
    currentProject: deckSnapshot,
    syncProject,
    updatePageLocal: updateSlideLocal,
    saveAllPages: saveAllSlides,
    reorderPages: reorderSlides,
    deletePageById: deleteSlide,
    addNewPage: addSlide,
    generateOutlineStream,
    isGlobalLoading,
  } = useProjectStore();
  const outlineStreamActive = useGenerationJobsStore((state) => state.outlineStreamActive);

  const [selectedSlideId, setSelectedSlideId] = useState<string | null>(null);
  const [isAiRefining, setIsAiRefining] = useState(false);
  const [previewFileId, setPreviewFileId] = useState<string | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(true);
  const [enableWebResearch, setEnableWebResearch] = useState(false);

  // Skeleton fade-out: keep it mounted briefly after streaming ends
  const [skeletonVisible, setSkeletonVisible] = useState(false);
  const [skeletonFading, setSkeletonFading] = useState(false);
  useEffect(() => {
    if (outlineStreamActive) {
      setSkeletonVisible(true);
      setSkeletonFading(false);
    } else if (skeletonVisible) {
      setSkeletonFading(true);
      const timer = setTimeout(() => {
        setSkeletonVisible(false);
        setSkeletonFading(false);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [outlineStreamActive]);

  const { confirm, ConfirmDialog } = useConfirm();
  const { show, ToastContainer } = useToast();

  // 左侧可编辑文本区域 — desktop and mobile use separate refs to avoid
  // the shared-ref bug where insertAtCursor targets the wrong (hidden) instance.
  const desktopTextareaRef = useRef<MarkdownTextareaRef>(null);
  const mobileTextareaRef = useRef<MarkdownTextareaRef>(null);
  const [fileMenuOpen, setFileMenuOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const fileMenuRef = useRef<HTMLDivElement>(null);
  const [sourceText, setSourceText] = useState('');
  const [isInputDirty, setIsInputDirty] = useState(false);
  const [planRequirements, setPlanRequirements] = useState('');
  const [isRequirementsDirty, setIsRequirementsDirty] = useState(false);
  const reqTextareaRef = useRef<MarkdownTextareaRef>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);
  const deckPlan = useMemo(
    () => deckPlanSnapshotFromProject(deckSnapshot),
    [deckSnapshot],
  );
  const planSource = deckPlan?.source ?? 'idea';
  const slides = deckPlan?.slides ?? EMPTY_SLIDES;

  // 初始化"联网调研"开关：跟随当前项目已存的设置
  useEffect(() => {
    if (deckPlan) setEnableWebResearch(deckPlan.webResearchEnabled);
  }, [deckPlan?.deckId]);

  // 点击外部关闭下拉
  useEffect(() => {
    if (!fileMenuOpen && !settingsOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (fileMenuRef.current && !fileMenuRef.current.contains(e.target as Node)) {
        setFileMenuOpen(false);
      }
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setSettingsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [fileMenuOpen, settingsOpen]);

  // 项目切换时：强制加载文本
  useEffect(() => {
    if (deckPlan) {
      setSourceText(deckPlan.sourceText);
      setIsInputDirty(false);
      setPlanRequirements(deckPlan.requirements);
      setIsRequirementsDirty(false);
    }
  }, [deckPlan?.deckId]);

  const saveInputText = useCallback(async (text: string) => {
    if (!deckId) return;
    try {
      await saveDeckSourceText(deckId, planSource, text);
      await syncProject(deckId);
      setIsInputDirty(false);
    } catch (e) {
      console.error('保存输入文本失败:', e);
      show({ message: t('outline.messages.saveFailed'), type: 'error' });
    }
  }, [deckId, planSource, show, syncProject]);

  // Debounced auto-save: save 1s after user stops typing
  useEffect(() => {
    if (!isInputDirty) return;
    const timer = setTimeout(() => {
      saveInputText(sourceText);
    }, 1000);
    return () => clearTimeout(timer);
  }, [sourceText, isInputDirty, saveInputText]);

  // Debounced auto-save for outline requirements
  useEffect(() => {
    if (!isRequirementsDirty || !deckId) return;
    const timer = setTimeout(async () => {
      try {
        await saveDeckPlanRequirements(deckId, planRequirements);
        setIsRequirementsDirty(false);
      } catch (e) {
        console.error('保存大纲要求失败:', e);
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [deckId, isRequirementsDirty, planRequirements]);

  const handleSaveInputText = useCallback(() => {
    if (!isInputDirty) return;
    saveInputText(sourceText);
  }, [sourceText, isInputDirty, saveInputText]);

  const handleInputChange = useCallback((text: string) => {
    setSourceText(text);
    setIsInputDirty(true);
  }, []);

  const insertAtCursor = useCallback((markdown: string) => {
    // Prefer the desktop ref (visible at md+), fall back to mobile
    const ref = desktopTextareaRef.current || mobileTextareaRef.current;
    ref?.insertAtCursor(markdown);
  }, []);

  const { handlePaste: handleImagePaste, handleFiles: handleImageFiles, isUploading: _isUploadingImage } = useImagePaste({
    projectId: deckId || null,
    setContent: setSourceText,
    showToast: show,
    insertAtCursor,
  });

  const insertAtReqCursor = useCallback((markdown: string) => {
    reqTextareaRef.current?.insertAtCursor(markdown);
  }, []);

  const { handlePaste: handleReqImagePaste, handleFiles: handleReqImageFiles } = useImagePaste({
    projectId: deckId || null,
    setContent: (updater) => {
      setPlanRequirements(updater);
      setIsRequirementsDirty(true);
    },
    showToast: show,
    insertAtCursor: insertAtReqCursor,
  });

  const inputLabel = useMemo(() => {
    const key = planSource === 'source-deck' ? 'sourceDeck' : planSource;
    return t(`outline.inputLabel.${key}` as any) || t('outline.contextLabels.idea');
  }, [planSource, t]);

  const inputPlaceholder = useMemo(() => {
    const key = planSource === 'source-deck' ? 'sourceDeck' : planSource;
    return t(`outline.inputPlaceholder.${key}` as any) || '';
  }, [planSource, t]);

  // 加载项目数据
  useEffect(() => {
    if (deckId && (!deckPlan || deckPlan.deckId !== deckId)) {
      syncProject(deckId);
    }
  }, [deckId, deckPlan, syncProject]);

  // 拖拽传感器配置
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id && deckSnapshot) {
      const oldIndex = slides.findIndex((slide) => slide.id === active.id);
      const newIndex = slides.findIndex((slide) => slide.id === over.id);

      const reorderedSlides = arrayMove(slides, oldIndex, newIndex);
      reorderSlides(reorderedSlides.map((slide) => slide.id).filter((id): id is string => id !== undefined));
    }
  };

  const handleGenerateOutline = async () => {
    if (!deckSnapshot) return;

    const doGenerate = async (lockPageCount?: boolean) => {
      try {
        const result = await generateOutlineStream(lockPageCount, enableWebResearch);
        const { currentProject: updatedDeckSnapshot } = useProjectStore.getState();
        const slideCount = deckPlanSnapshotFromProject(updatedDeckSnapshot)?.slides.length ?? 0;
        if (result && (!result.complete || slideCount === 0)) {
          show({ message: t('outline.messages.generateIncomplete'), type: 'warning' });
        }
      } catch (error: any) {
        console.error('生成大纲失败:', error);
        const message = error.friendlyMessage || error.message || t('outline.messages.generateFailed');
        show({ message, type: 'error' });
      }
    };

    if (slides.length > 0) {
      confirm(
        t('outline.messages.confirmRegenerate'),
        doGenerate,
        {
          title: t('outline.messages.confirmRegenerateTitle'),
          variant: 'warning',
          checkboxLabel: t('outline.messages.lockPageCount'),
          checkboxDefaultChecked: false
        }
      );
      return;
    }

    await doGenerate();
  };

  const handleAiRefineOutline = useCallback(async (requirement: string, previousRequirements: string[]) => {
    if (!deckSnapshot || !deckId) return;

    try {
      const message = await refineDeckPlan(deckId, requirement, previousRequirements);
      await syncProject(deckId);
      show({
        message: message || t('outline.messages.refineSuccess'),
        type: 'success'
      });
    } catch (error: any) {
      console.error('修改大纲失败:', error);
      const errorMessage = error?.response?.data?.error?.message
        || error?.message
        || t('outline.messages.refineFailed');
      show({ message: errorMessage, type: 'error' });
      throw error;
    }
  }, [deckId, deckSnapshot, syncProject, show]);

  // 导出大纲为 Markdown 文件
  const handleExportOutline = useCallback(() => {
    if (!deckSnapshot) return;
    exportProjectToMarkdown(deckSnapshot, { outline: true, description: false });
    show({ message: t('outline.messages.exportSuccess'), type: 'success' });
  }, [deckSnapshot, show]);

  // 导入大纲 Markdown（追加新页面）
  const handleImportOutline = useCallback(async (text: string) => {
    if (!deckSnapshot || !deckId) return;
    try {
      const parsed = parseMarkdownPages(text);
      if (parsed.length === 0) {
        show({ message: t('outline.messages.importEmpty'), type: 'error' });
        throw new Error('empty-import');
      }
      const startIndex = slides.reduce(
        (max, slide) => Math.max(max, (slide.order_index ?? 0) + 1),
        0,
      );
      await appendDeckPlanSlides(
        deckId,
        parsed.map(({ title, points, text, part, extra_fields }) => ({
          title,
          points,
          description: text || undefined,
          section: part,
          extraFields: extra_fields,
        })),
        startIndex,
      );
      await syncProject(deckId);
      show({ message: t('outline.messages.importSuccess'), type: 'success' });
    } catch (error) {
      if (error instanceof Error && error.message === 'empty-import') {
        throw error;
      }
      show({ message: t('outline.messages.importFailed'), type: 'error' });
      throw error;
    }
  }, [deckId, deckSnapshot, slides, syncProject, show, t]);


  if (!deckSnapshot) {
    return <Loading fullscreen message={t('outline.messages.loadingProject')} />;
  }

  if (isGlobalLoading && !outlineStreamActive) {
    return <Loading fullscreen message={t('outline.messages.generatingOutline')} />;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-background-primary flex flex-col">
      {/* 顶栏 */}
      <header className="bg-white dark:bg-background-secondary shadow-sm dark:shadow-background-primary/30 border-b border-gray-200 dark:border-border-primary px-3 md:px-6 py-2 md:py-3 flex-shrink-0">
        <div className="flex items-center justify-between gap-2 md:gap-4">
          {/* 左侧：Logo 和标题 */}
          <div className="flex items-center gap-2 md:gap-4 flex-shrink-0">
            <Button
              variant="ghost"
              size="sm"
              icon={<ArrowLeft size={16} className="md:w-[18px] md:h-[18px]" />}
              onClick={() => {
                if (fromHistory) {
                  navigate('/history');
                } else {
                  navigate('/');
                }
              }}
              className="flex-shrink-0"
            >
              <span className="hidden sm:inline">{t('common.back')}</span>
            </Button>
            <div className="flex items-center gap-1.5 md:gap-2">
              <Presentation size={22} className="text-brand-600" />
              <span className="text-base md:text-xl font-bold">{t('home.title')}</span>
            </div>
            <span className="text-gray-400 hidden lg:inline">|</span>
            <span className="text-sm md:text-lg font-semibold hidden lg:inline">{t('outline.title')}</span>
          </div>

          {/* 中间：AI 修改输入框 */}
          <div className="flex-1 max-w-xl mx-auto hidden md:block md:-translate-x-2 pr-10">
            <AiRefineInput
              title=""
              placeholder={t('outline.aiPlaceholder')}
              onSubmit={handleAiRefineOutline}
              disabled={false}
              className="!p-0 !bg-transparent !border-0"
              onStatusChange={setIsAiRefining}
            />
          </div>

          {/* 右侧：操作按钮 */}
          <div className="flex items-center gap-1.5 md:gap-2 flex-shrink-0">
            <Button
              variant="primary"
              size="sm"
              icon={<ArrowRight size={16} className="md:w-[18px] md:h-[18px]" />}
              onClick={async () => {
                if (isInputDirty) await saveInputText(sourceText);
                navigate(`/project/${deckId}/detail`);
              }}
              className="text-xs md:text-sm"
            >
              <span className="hidden sm:inline">{t('common.next')}</span>
            </Button>
          </div>
        </div>

        {/* 移动端：AI 输入框 */}
        <div className="mt-2 md:hidden">
            <AiRefineInput
            title=""
            placeholder={t('outline.aiPlaceholderShort')}
            onSubmit={handleAiRefineOutline}
            disabled={false}
            className="!p-0 !bg-transparent !border-0"
            onStatusChange={setIsAiRefining}
          />
        </div>
      </header>

      {/* 操作栏 - 与 DetailEditor 风格一致 */}
      <div className="bg-white dark:bg-background-secondary border-b border-gray-200 dark:border-border-primary px-3 md:px-6 py-3 md:py-4 flex-shrink-0">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 sm:gap-3">
          <div className="flex items-center gap-2 sm:gap-3 flex-1">
            <Button
              variant="primary"
              icon={<Plus size={16} className="md:w-[18px] md:h-[18px]" />}
              onClick={addSlide}
              className="flex-1 sm:flex-initial text-sm md:text-base"
            >
              {t('outline.addPage')}
            </Button>
            <label
              className="flex items-center gap-1.5 text-sm md:text-base cursor-pointer select-none px-1.5"
              title={t('outline.webResearch')}
            >
              <input
                type="checkbox"
                checked={enableWebResearch}
                onChange={(e) => setEnableWebResearch(e.target.checked)}
                disabled={outlineStreamActive}
                className="cursor-pointer accent-yellow-500"
              />
              <span>🌐 {t('outline.webResearch')}</span>
            </label>
            {slides.length === 0 && !outlineStreamActive ? (
              <Button
                variant="secondary"
                onClick={handleGenerateOutline}
                disabled={outlineStreamActive}
                className="flex-1 sm:flex-initial text-sm md:text-base"
              >
                {planSource === 'outline' ? t('outline.parseOutline') : t('outline.autoGenerate')}
              </Button>
            ) : (
              <Button
                variant="secondary"
                onClick={handleGenerateOutline}
                disabled={outlineStreamActive}
                className="flex-1 sm:flex-initial text-sm md:text-base"
              >
                {outlineStreamActive
                  ? t('outline.generating')
                  : planSource === 'outline' ? t('outline.reParseOutline') : t('outline.reGenerate')}
              </Button>
            )}
            {/* 设置 popover */}
            <div className="relative" ref={settingsRef}>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSettingsOpen(!settingsOpen)}
                icon={<span className="relative"><Settings2 size={16} className="md:w-[18px] md:h-[18px]" />{planRequirements && <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-brand-400" />}</span>}
                title={t('outline.outlineRequirements')}
              />
              {settingsOpen && (
                <div className="absolute top-full left-0 mt-1 z-50 w-80 rounded-xl border border-gray-200 dark:border-border-primary bg-white dark:bg-background-secondary shadow-lg dark:shadow-none p-4 space-y-3">
                  <label className="flex items-center gap-1 text-xs font-medium text-gray-600 dark:text-foreground-tertiary">
                    {t('outline.outlineRequirements')}
                  </label>
                  <div data-testid="outline-requirements-textarea">
                    <MarkdownTextarea
                      ref={reqTextareaRef}
                      value={planRequirements}
                      onChange={(val) => { setPlanRequirements(val); setIsRequirementsDirty(true); }}
                      onPaste={handleReqImagePaste}
                      onFiles={handleReqImageFiles}
                      placeholder={t('outline.outlineRequirementsPlaceholder')}
                      className="ring-inset"
                      rows={2}
                      showImagePreview={false}
                    />
                  </div>
                  <PresetCapsules
                    type="outline"
                    onAppend={(text) => {
                      setPlanRequirements((prev) => prev ? `${prev}\n${text}` : text);
                      setIsRequirementsDirty(true);
                    }}
                  />
                </div>
              )}
            </div>
            {/* 导入导出下拉菜单 */}
            <div className="relative" ref={fileMenuRef}>
              <Button
                variant="secondary"
                onClick={() => setFileMenuOpen(!fileMenuOpen)}
                icon={<FileText size={16} className="md:w-[18px] md:h-[18px]" />}
                className="flex-1 sm:flex-initial text-sm md:text-base"
              >
                {t('outline.importExport')}
                <ChevronDown size={14} className={`ml-1 transition-transform duration-200 ${fileMenuOpen ? 'rotate-180' : ''}`} />
              </Button>
              {fileMenuOpen && (
                <div className="absolute top-full left-0 mt-1 z-50 w-full rounded-lg border border-gray-200 dark:border-border-primary bg-white dark:bg-background-secondary shadow-lg dark:shadow-none overflow-hidden">
                  <button
                    type="button"
                    onClick={() => { handleExportOutline(); setFileMenuOpen(false); }}
                    disabled={slides.length === 0}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-gray-600 dark:text-foreground-tertiary hover:bg-gray-50 dark:hover:bg-background-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-150"
                  >
                    <Download size={14} />
                    {t('outline.export')}
                  </button>
                  <div className="border-t border-gray-100 dark:border-border-primary" />
                  <button
                    type="button"
                    onClick={() => { setIsImportModalOpen(true); setFileMenuOpen(false); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-gray-600 dark:text-foreground-tertiary hover:bg-gray-50 dark:hover:bg-background-hover transition-colors duration-150"
                  >
                    <Upload size={14} />
                    {t('outline.import')}
                  </button>
                </div>
              )}
            </div>
            {/* 手机端：保存按钮 */}
            <Button
              variant="secondary"
              icon={<Save size={16} className="md:w-[18px] md:h-[18px]" />}
              onClick={async () => await saveAllSlides()}
              className="md:hidden flex-1 sm:flex-initial text-sm md:text-base"
            >
              {t('common.save')}
            </Button>
            <span className="text-xs md:text-sm text-gray-500 dark:text-foreground-tertiary whitespace-nowrap">
              {t('outline.pageCount', { count: String(slides.length) })}
            </span>
          </div>
        </div>
      </div>

      {/* 主内容区 */}
      <main className="flex-1 flex flex-col md:flex-row gap-3 md:gap-6 p-3 md:p-6 overflow-y-auto min-h-0 relative">
        {/* 左侧：可编辑文本区域（可收起） */}
        <div
          className="flex-shrink-0 transition-[width] duration-300 ease-in-out hidden md:block"
          style={{ width: isPanelOpen ? undefined : 0 }}
        >
          <div
            className="w-[320px] lg:w-[360px] xl:w-[400px] transition-[opacity,transform] duration-300 ease-in-out md:sticky md:top-0"
            style={{
              opacity: isPanelOpen ? 1 : 0,
              transform: isPanelOpen ? 'translateX(0)' : 'translateX(-16px)',
              pointerEvents: isPanelOpen ? 'auto' : 'none',
            }}
          >
            <div className="bg-white dark:bg-background-secondary rounded-card shadow-md border border-gray-100 dark:border-border-primary overflow-hidden">
              <div className="px-4 py-2.5 flex items-center gap-2 border-b border-gray-100 dark:border-border-secondary">
                {planSource === 'idea'
                  ? <Sparkle size={14} className="text-brand-500 flex-shrink-0" />
                  : <FileText size={14} className="text-brand-500 flex-shrink-0" />}
                <span className="text-xs font-medium text-gray-500 dark:text-foreground-tertiary">{inputLabel}</span>
                <div className="ml-auto flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setIsPanelOpen(false)}
                    className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-foreground-secondary rounded hover:bg-gray-100 dark:hover:bg-background-hover transition-colors"
                  >
                    <PanelLeftClose size={14} />
                  </button>
                </div>
              </div>
              <MarkdownTextarea
                ref={desktopTextareaRef}
                value={sourceText}
                onChange={handleInputChange}
                onBlur={handleSaveInputText}
                onPaste={handleImagePaste}
                onFiles={handleImageFiles}
                placeholder={inputPlaceholder}
                rows={12}
                className="border-0 rounded-none shadow-none"
              />
            </div>
            <ReferenceFileList
              projectId={deckId}
              onFileClick={setPreviewFileId}
              className="mt-3"
              showToast={show}
            />
          </div>
        </div>

        {/* 收起时的把手 - 绝对定位贴左边缘 */}
        {!isPanelOpen && (
          <button
            type="button"
            onClick={() => setIsPanelOpen(true)}
            className="hidden md:flex absolute left-0 top-6 z-10 items-center justify-center w-6 h-14 bg-white dark:bg-background-secondary border border-l-0 border-gray-200 dark:border-border-primary rounded-r-lg shadow-md text-gray-400 hover:text-brand-500 hover:border-brand-300 dark:hover:border-brand-500/40 hover:shadow-lg transition-all"
          >
            <PanelLeftOpen size={14} />
          </button>
        )}

        {/* 移动端：始终显示卡片 */}
        <div className="md:hidden w-full flex-shrink-0">
          <div className="bg-white dark:bg-background-secondary rounded-card shadow-md border border-gray-100 dark:border-border-primary overflow-hidden">
            <div className="px-4 py-2.5 flex items-center gap-2 border-b border-gray-100 dark:border-border-secondary">
              {planSource === 'idea'
                ? <Sparkle size={14} className="text-brand-500 flex-shrink-0" />
                : <FileText size={14} className="text-brand-500 flex-shrink-0" />}
              <span className="text-xs font-medium text-gray-500 dark:text-foreground-tertiary">{inputLabel}</span>
            </div>
            <MarkdownTextarea
              ref={mobileTextareaRef}
              value={sourceText}
              onChange={handleInputChange}
              onBlur={handleSaveInputText}
              onPaste={handleImagePaste}
              onFiles={handleImageFiles}
              placeholder={inputPlaceholder}
              rows={6}
              className="border-0 rounded-none shadow-none"
            />
          </div>
          <ReferenceFileList
            projectId={deckId}
            onFileClick={setPreviewFileId}
            className="mt-3"
            showToast={show}
          />
        </div>

        {/* 右侧：大纲列表 */}
        <div className="flex-1 min-w-0">
          {slides.length === 0 && !outlineStreamActive ? (
            <div className="text-center py-12 md:py-20">
              <div className="flex justify-center mb-4">
                <FileText size={48} className="text-gray-300" />
              </div>
              <h3 className="text-lg font-semibold text-gray-800 dark:text-foreground-primary mb-2">
                {t('outline.noPages')}
              </h3>
              <p className="text-gray-500 dark:text-foreground-tertiary mb-6">
                {t('outline.noPagesHint')}
              </p>
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={slides.map((slide, index) => slide.id || `slide-${index}`)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-3 md:space-y-4">
                  {slides.map((slide, index) => (
                    <div
                      key={slide.id || `slide-${index}`}
                      className={outlineStreamActive ? 'animate-slide-in-up' : ''}
                      style={outlineStreamActive ? { animationDelay: `${index * 60}ms` } : undefined}
                    >
                      <SortableSlideCard
                        slide={slide}
                        index={index}
                        projectId={deckId}
                        showToast={show}
                        onUpdate={(data) => slide.id && updateSlideLocal(slide.id, data)}
                        onDelete={() => slide.id && deleteSlide(slide.id)}
                        onClick={() => setSelectedSlideId(slide.id || null)}
                        isSelected={selectedSlideId === slide.id}
                        isAiRefining={isAiRefining}
                      />
                    </div>
                  ))}
                  {skeletonVisible && (
                    <div
                      className="transition-opacity duration-1000"
                      style={{ opacity: skeletonFading ? 0 : 1 }}
                    >
                      <div className="animate-pulse">
                        <div className="bg-white dark:bg-background-secondary rounded-xl shadow-sm border border-gray-100 dark:border-border-primary p-4">
                        <div className="flex items-start gap-3">
                          <div className="w-5 h-5 bg-gray-200 dark:bg-gray-700 rounded mt-1" />
                          <div className="flex-1 space-y-3">
                            <div className="flex items-center gap-2">
                              <div className="h-4 w-12 bg-gray-200 dark:bg-gray-700 rounded" />
                              <div className="h-4 w-16 bg-brand-100 dark:bg-brand-900/30 rounded" />
                            </div>
                            <div className="h-5 w-2/3 bg-gray-200 dark:bg-gray-700 rounded" />
                            <div className="space-y-2">
                              <div className="h-3.5 w-full bg-gray-100 dark:bg-gray-800 rounded" />
                              <div className="h-3.5 w-4/5 bg-gray-100 dark:bg-gray-800 rounded" />
                              <div className="h-3.5 w-3/5 bg-gray-100 dark:bg-gray-800 rounded" />
                            </div>
                          </div>
                        </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </div>
      </main>
      {ConfirmDialog}
      <ToastContainer />
      <FilePreviewModal fileId={previewFileId} onClose={() => setPreviewFileId(null)} />
      <ImportMarkdownModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImport={handleImportOutline}
        title={t('outline.importModalTitle')}
        description={t('outline.importModalDesc')}
        pasteLabel={t('outline.importPasteLabel')}
        pastePlaceholder={t('outline.importPastePlaceholder')}
        uploadLabel={t('outline.importUploadLabel')}
        uploadHint={t('outline.importUploadHint')}
        uploadFormatsHint={t('outline.importUploadFormatsHint')}
        importButtonLabel={t('outline.importConfirm')}
        cancelButtonLabel={t('outline.importCancel')}
        emptyError={t('outline.messages.importContentEmpty')}
        readFileError={t('outline.messages.importReadFailed')}
      />
    </div>
  );
};
