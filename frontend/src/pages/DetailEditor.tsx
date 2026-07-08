import React, { useEffect, useCallback, useState, useRef } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { ArrowLeft, ArrowRight, FileText, Sparkles, Download, Upload, ChevronDown, Settings2, X, Plus, HelpCircle, ImageIcon } from 'lucide-react';
import { useT } from '@/hooks/useT';
import { detailI18n } from '@/config/detailEditorI18n';
import { MarkdownTextarea, type MarkdownTextareaRef } from '@/components/shared/MarkdownTextarea';
import PresetCapsules from '@/components/shared/PresetCapsules';
import { useImagePaste } from '@/hooks/useImagePaste';
import type { SvgReasoningEffort } from '@/types';
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove, SortableContext, useSortable, rectSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import { Button, Loading, useToast, useConfirm, AiRefineInput, FilePreviewModal, ReferenceFileList, ImportMarkdownModal } from '@/components/shared';
import { DescriptionCard } from '@/components/preview/DescriptionCard';
import { useProjectStore } from '@/store/useProjectStore';
import { refineDescriptions, getTaskStatus, addPage, updateProject } from '@/api/endpoints';
import { getSettings, updateSettings } from '@/api/settingsApi';
import { exportProjectToMarkdown, parseMarkdownPages } from '@/utils/projectUtils';
import { detailGenerationPreferences } from '@/shared/storage/detailGenerationPreferences';
import { DEFAULT_DESCRIPTION_FIELDS, extraFieldCatalog, getDefaultDescriptionFields, getDefaultImagePromptFields } from '@/shared/storage/extraFieldCatalog';
import { projectSession } from '@/shared/storage/projectSession';
import { renovationTaskSession } from '@/shared/storage/renovationTaskSession';

// 详细程度图标 — 暂时屏蔽，效果不够理想
// const DETAIL_LEVEL_LINES: Record<string, number[]> = {
//   concise:  [5, 8],
//   default:  [4, 7, 10],
//   detailed: [3.5, 5.5, 7.5, 9.5, 11.5],
// };
// const DetailLevelIcon: React.FC<{ level: string }> = ({ level }) => ( ... );

const PRESET_EXTRA_FIELDS = new Set<string>(DEFAULT_DESCRIPTION_FIELDS);

// 可拖拽排序的额外字段胶囊
const SortableFieldPill: React.FC<{
  name: string;
  active: boolean;
  removable?: boolean;
  inImagePrompt?: boolean;
  imagePromptTooltip?: string;
  onToggle: () => void;
  onRemove: () => void;
  onToggleImagePrompt?: () => void;
}> = ({ name, active, onToggle, onRemove, removable = true, inImagePrompt, imagePromptTooltip, onToggleImagePrompt }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: name });
  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition: isDragging ? undefined : transition,
    opacity: isDragging ? 0.5 : undefined,
    zIndex: isDragging ? 10 : undefined,
  };
  return (
    <button
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      type="button"
      className={`group inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full border cursor-grab active:cursor-grabbing ${
        isDragging ? '' : 'transition-colors duration-150 '
      }${
        active
          ? 'bg-brand-50 dark:bg-brand-900/20 border-brand-300 dark:border-brand-700 text-brand-700 dark:text-brand-400'
          : 'bg-gray-50 dark:bg-background-hover border-gray-200 dark:border-border-primary text-gray-400 dark:text-foreground-tertiary line-through'
      }`}
      onClick={onToggle}
    >
      {name}
      {active && onToggleImagePrompt && (
        <span
          role="button"
          className={`relative group/img ml-0.5 transition-colors ${inImagePrompt ? 'text-brand-500' : 'text-gray-300 dark:text-gray-600'}`}
          onClick={e => { e.stopPropagation(); onToggleImagePrompt(); }}
        >
          <ImageIcon size={10} />
          {imagePromptTooltip && (
            <span className="absolute left-1/2 -translate-x-1/2 bottom-full mb-1.5 w-40 px-2 py-1 text-[10px] leading-snug text-gray-600 dark:text-foreground-secondary bg-white dark:bg-background-primary border border-gray-200 dark:border-border-primary rounded-md shadow-md opacity-0 pointer-events-none group-hover/img:opacity-100 transition-opacity z-50">
              {imagePromptTooltip}
            </span>
          )}
        </span>
      )}
      {!active && removable && (
        <span
          role="button"
          className="opacity-0 group-hover:opacity-100 ml-0.5 text-gray-400 hover:text-red-500 transition-all"
          onClick={e => { e.stopPropagation(); onRemove(); }}
        >
          <X size={10} />
        </span>
      )}
    </button>
  );
};

export const DetailEditor: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const t = useT(detailI18n);
  const { projectId } = useParams<{ projectId: string }>();
  const fromHistory = (location.state as any)?.from === 'history';
  const {
    currentProject,
    syncProject,
    updatePageLocal,
    generateDescriptions,
    generatePageDescription,
    regenerateRenovationPage,
  } = useProjectStore();
  const { show, ToastContainer } = useToast();
  const { confirm, ConfirmDialog } = useConfirm();
  const [isAiRefining, setIsAiRefining] = React.useState(false);
  const [previewFileId, setPreviewFileId] = useState<string | null>(null);
  const [isRenovationProcessing, setIsRenovationProcessing] = useState(false);
  const [renovationProgress, setRenovationProgress] = useState<{ total: number; completed: number } | null>(null);
  const [detailLevel, setDetailLevel] = useState<string>('default');
  const [generationMode, setGenerationMode] = useState<'streaming' | 'parallel'>('streaming');
  const [pageGenMode, setPageGenMode] = useState<'image' | 'svg'>('image');
  const [svgEffort, setSvgEffort] = useState<SvgReasoningEffort>('high');
  const [enableWebResearch, setEnableWebResearch] = useState(false);
  const [extraFieldNames, setExtraFieldNames] = useState<string[]>(() => getDefaultDescriptionFields());
  const [imagePromptFields, setImagePromptFields] = useState<string[]>(() => getDefaultImagePromptFields());
  const [availableFields, setAvailableFields] = useState<string[]>(() => extraFieldCatalog.read());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);
  const [newFieldName, setNewFieldName] = useState('');
  const [fileMenuOpen, setFileMenuOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const fileMenuRef = useRef<HTMLDivElement>(null);
  const settingsSaveTimerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (currentProject) setEnableWebResearch(!!currentProject.enable_web_research);
    if (currentProject?.generation_mode === 'svg' || currentProject?.generation_mode === 'image') {
      setPageGenMode(currentProject.generation_mode);
    }
    if (currentProject?.svg_reasoning_effort) {
      setSvgEffort(currentProject.svg_reasoning_effort);
    }
  }, [currentProject?.id]);

  // Load settings from DB on mount
  useEffect(() => {
    (async () => {
      try {
        const res = await getSettings();
        const s = res.data;
        if (!s) return;
        setDetailLevel('default');
        // detail level from session storage (backwards compat, then from DB if we add it later)
        const storedLevel = detailGenerationPreferences.readDetailLevel();
        if (storedLevel) setDetailLevel(storedLevel);
        setGenerationMode(s.description_generation_mode || 'streaming');
        const activeFields = s.description_extra_fields || getDefaultDescriptionFields();
        setExtraFieldNames(activeFields);
        if (s.image_prompt_extra_fields) setImagePromptFields(s.image_prompt_extra_fields);
        setAvailableFields(prev => extraFieldCatalog.mergeAndSave(prev, activeFields));
        projectSession.saveSettingsSnapshot(s);
      } catch { /* ignore */ }
    })();
  }, []);

  // Debounced save settings to DB
  const saveSettingsDebounced = useCallback((updates: Record<string, unknown>) => {
    if (settingsSaveTimerRef.current) clearTimeout(settingsSaveTimerRef.current);
    settingsSaveTimerRef.current = setTimeout(async () => {
      try {
        const res = await updateSettings(updates as any);
        if (res.data) {
          projectSession.saveSettingsSnapshot(res.data);
        }
      } catch (e) {
        console.error('Failed to save settings:', e);
      }
    }, 800);
  }, []);

  // 额外字段拖拽排序
  const fieldSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const handleFieldDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = availableFields.indexOf(active.id as string);
    const newIdx = availableFields.indexOf(over.id as string);
    if (oldIdx === -1 || newIdx === -1) return;
    const nextPool = arrayMove(availableFields, oldIdx, newIdx);
    setAvailableFields(nextPool);
    extraFieldCatalog.save(nextPool);
    // 激活字段按新池顺序重排
    const activeSet = new Set(extraFieldNames);
    const nextActive = nextPool.filter(f => activeSet.has(f));
    setExtraFieldNames(nextActive);
    saveSettingsDebounced({ description_extra_fields: nextActive });
  }, [availableFields, extraFieldNames, saveSettingsDebounced]);

  const [descRequirements, setDescRequirements] = useState('');
  const [isDescReqDirty, setIsDescReqDirty] = useState(false);
  const reqTextareaRef = useRef<MarkdownTextareaRef>(null);

  // 点击外部关闭下拉
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setSettingsOpen(false);
      }
      if (fileMenuRef.current && !fileMenuRef.current.contains(e.target as Node)) {
        setFileMenuOpen(false);
      }
    };
    if (settingsOpen || fileMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [settingsOpen, fileMenuOpen]);

  // PPT 翻新：异步任务轮询
  useEffect(() => {
    if (!projectId) return;
    const taskId = renovationTaskSession.getTaskId();
    if (!taskId) return;

    setIsRenovationProcessing(true);
    let cancelled = false;
    let pollFailCount = 0;

    const poll = async () => {
      try {
        const response = await getTaskStatus(projectId, taskId);
        if (cancelled) return;
        const task = response.data;
        if (!task) return;
        pollFailCount = 0; // reset on success

        if (task.progress) {
          setRenovationProgress({
            total: task.progress.total || 0,
            completed: task.progress.completed || 0,
          });
        }

        // Sync project to get latest page data (incremental updates)
        await syncProject(projectId);

        if (task.status === 'COMPLETED') {
          renovationTaskSession.clearTask();
          setIsRenovationProcessing(false);
          setRenovationProgress(null);
          await syncProject(projectId);
          return;
        }

        if (task.status === 'FAILED') {
          renovationTaskSession.clearTask();
          setIsRenovationProcessing(false);
          setRenovationProgress(null);
          show({ message: task.error_message || t('detail.renovationFailed'), type: 'error' });
          return;
        }

        // Still processing — poll again
        setTimeout(poll, 2000);
      } catch (err) {
        if (cancelled) return;
        pollFailCount++;
        console.error('Renovation task poll error:', err);
        if (pollFailCount >= 5) {
          renovationTaskSession.clearTask();
          setIsRenovationProcessing(false);
          setRenovationProgress(null);
          show({ message: t('detail.renovationPollFailed'), type: 'error' });
          return;
        }
        setTimeout(poll, 3000);
      }
    };

    poll();
    return () => { cancelled = true; };
  }, [projectId]);

  // 加载项目数据
  useEffect(() => {
    if (projectId && (!currentProject || currentProject.id !== projectId)) {
      // 直接使用 projectId 同步项目数据
      syncProject(projectId);
    } else if (projectId && currentProject && currentProject.id === projectId) {
      // 如果项目已存在，也同步一次以确保数据是最新的（特别是从描述生成后）
      // 但只在首次加载时同步，避免频繁请求
      const shouldSync = !currentProject.pages.some(p => p.description_content);
      if (shouldSync) {
        syncProject(projectId);
      }
    }
  }, [projectId, currentProject?.id]); // 只在 projectId 或项目ID变化时更新

  // 同步描述生成要求
  useEffect(() => {
    if (currentProject) {
      setDescRequirements(currentProject.description_requirements || '');
      setIsDescReqDirty(false);
    }
  }, [currentProject?.id]);

  // Debounced auto-save for description requirements
  useEffect(() => {
    if (!isDescReqDirty || !projectId) return;
    const timer = setTimeout(async () => {
      try {
        await updateProject(projectId, { description_requirements: descRequirements });
        setIsDescReqDirty(false);
      } catch (e) {
        console.error('保存描述要求失败:', e);
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [descRequirements, isDescReqDirty, projectId]);

  const insertAtReqCursor = useCallback((markdown: string) => {
    reqTextareaRef.current?.insertAtCursor(markdown);
  }, []);

  const { handlePaste: handleReqImagePaste, handleFiles: handleReqImageFiles } = useImagePaste({
    projectId: projectId || null,
    setContent: (updater) => {
      setDescRequirements(updater);
      setIsDescReqDirty(true);
    },
    showToast: show,
    insertAtCursor: insertAtReqCursor,
  });

  const handleGenerateAll = async () => {
    const hasDescriptions = currentProject?.pages.some(
      (p) => p.description_content
    );
    
    const executeGenerate = async () => {
      await generateDescriptions(detailLevel, enableWebResearch, pageGenMode, svgEffort);
    };
    
    if (hasDescriptions) {
      confirm(
        t('detail.messages.confirmRegenerate'),
        executeGenerate,
        { title: t('detail.messages.confirmRegenerateTitle'), variant: 'warning' }
      );
    } else {
      await executeGenerate();
    }
  };

  const handleRegeneratePage = async (pageId: string) => {
    if (!currentProject) return;

    const page = currentProject.pages.find((p) => p.id === pageId);
    if (!page) return;

    // 判断是否是 PPT 翻新模式
    const isRenovation = currentProject.creation_type === 'ppt_renovation';

    const executeRegenerate = async () => {
      try {
        if (isRenovation) {
          await regenerateRenovationPage(pageId);
        } else {
          await generatePageDescription(pageId, detailLevel, enableWebResearch);
        }
        show({ message: t('detail.messages.generateSuccess'), type: 'success' });
      } catch (error: any) {
        show({
          message: `${t('detail.messages.generateFailed')}: ${error.message || t('common.unknownError')}`,
          type: 'error'
        });
      }
    };

    // PPT 翻新模式 或 已有描述时，需要确认
    if (isRenovation) {
      confirm(
        t('detail.messages.confirmRenovationRegenerate'),
        executeRegenerate,
        { title: t('detail.messages.confirmRenovationRegenerateTitle'), variant: 'warning' }
      );
    } else if (page.description_content) {
      confirm(
        t('detail.messages.confirmRegeneratePage'),
        executeRegenerate,
        { title: t('detail.messages.confirmRegenerateTitle'), variant: 'warning' }
      );
    } else {
      await executeRegenerate();
    }
  };

  // Stable ref for handleRegeneratePage to avoid stale closures in memoized DescriptionCard
  const handleRegeneratePageRef = useRef(handleRegeneratePage);
  handleRegeneratePageRef.current = handleRegeneratePage;
  const stableHandleRegeneratePage = useCallback((pageId: string) => {
    handleRegeneratePageRef.current(pageId);
  }, []);

  const handleAiRefineDescriptions = useCallback(async (requirement: string, previousRequirements: string[]) => {
    if (!currentProject || !projectId) return;
    
    try {
      const response = await refineDescriptions(projectId, requirement, previousRequirements);
      await syncProject(projectId);
      show({ 
        message: response.data?.message || t('detail.messages.refineSuccess'), 
        type: 'success' 
      });
    } catch (error: any) {
      console.error('修改页面描述失败:', error);
      const errorMessage = error?.response?.data?.error?.message 
        || error?.message 
        || t('detail.messages.refineFailed');
      show({ message: errorMessage, type: 'error' });
      throw error; // 抛出错误让组件知道失败了
    }
  }, [currentProject, projectId, syncProject, show, t]);

  // 导出页面描述为 Markdown 文件
  const handleExportDescriptions = useCallback(() => {
    if (!currentProject) return;
    exportProjectToMarkdown(currentProject, { outline: false, description: true });
    show({ message: t('detail.messages.exportSuccess'), type: 'success' });
  }, [currentProject, show, t]);

  // 导出大纲+描述
  const handleExportFull = useCallback(() => {
    if (!currentProject) return;
    exportProjectToMarkdown(currentProject);
    show({ message: t('detail.messages.exportSuccess'), type: 'success' });
  }, [currentProject, show, t]);

  // 导入描述 Markdown（追加新页面）
  const handleImportDescriptions = useCallback(async (text: string) => {
    if (!currentProject || !projectId) return;
    try {
      const parsed = parseMarkdownPages(text);
      if (parsed.length === 0) {
        show({ message: t('detail.messages.importEmpty'), type: 'error' });
        throw new Error('empty-import');
      }
      const startIndex = currentProject.pages.reduce((max, p) => Math.max(max, (p.order_index ?? 0) + 1), 0);
      await Promise.all(parsed.map(({ title, points, text: desc, part, extra_fields }, i) =>
        addPage(projectId, {
          outline_content: { title, points },
          description_content: desc ? { text: desc, ...(extra_fields ? { extra_fields } : {}) } : undefined,
          part,
          order_index: startIndex + i,
        })
      ));
      await syncProject(projectId);
      show({ message: t('detail.messages.importSuccess'), type: 'success' });
    } catch (error) {
      if (error instanceof Error && error.message === 'empty-import') {
        throw error;
      }
      show({ message: t('detail.messages.importFailed'), type: 'error' });
      throw error;
    }
  }, [currentProject, projectId, syncProject, show, t]);

  if (!currentProject) {
    return <Loading fullscreen message={t('detail.messages.loadingProject')} />;
  }

  const hasAllDescriptions = currentProject.pages.every(
    (p) => p.description_content
  );
  const missingDescCount = currentProject.pages.filter(p => !p.description_content).length;

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
                  navigate(`/project/${projectId}/outline`);
                }
              }}
              disabled={isRenovationProcessing}
              className="flex-shrink-0"
            >
              <span className="hidden sm:inline">{t('common.back')}</span>
            </Button>
            <div className="flex items-center gap-1.5 md:gap-2">
              <span className="text-xl md:text-2xl">🍌</span>
              <span className="text-base md:text-xl font-bold">{t('home.title')}</span>
            </div>
            <span className="text-gray-400 hidden lg:inline">|</span>
            <span className="text-sm md:text-lg font-semibold hidden lg:inline">{t('detail.title')}</span>
          </div>
          
          {/* 中间：AI 修改输入框 */}
          <div className="flex-1 max-w-xl mx-auto hidden md:block md:-translate-x-3 pr-10">
            <AiRefineInput
              title=""
              placeholder={t('detail.aiPlaceholder')}
              onSubmit={handleAiRefineDescriptions}
              disabled={isRenovationProcessing}
              className="!p-0 !bg-transparent !border-0"
              onStatusChange={setIsAiRefining}
            />
          </div>

          {/* 右侧：操作按钮 */}
          <div className="flex items-center gap-1.5 md:gap-2 flex-shrink-0">
            <Button
              variant="secondary"
              size="sm"
              icon={<ArrowLeft size={16} className="md:w-[18px] md:h-[18px]" />}
              onClick={() => navigate(`/project/${projectId}/outline`)}
              disabled={isRenovationProcessing}
              className="hidden md:inline-flex"
            >
              <span className="hidden lg:inline">{t('common.previous')}</span>
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={<ArrowRight size={16} className="md:w-[18px] md:h-[18px]" />}
              onClick={() => navigate(`/project/${projectId}/preview`)}
              disabled={!hasAllDescriptions || isRenovationProcessing}
              title={!hasAllDescriptions && !isRenovationProcessing ? t('detail.disabledNextTip', { count: missingDescCount }) : undefined}
              className="text-xs md:text-sm"
            >
              <span className="hidden sm:inline">{t('detail.generateImages')}</span>
            </Button>
          </div>
        </div>
        
        {/* 移动端：AI 输入框 */}
        <div className="mt-2 md:hidden">
            <AiRefineInput
            title=""
            placeholder={t('detail.aiPlaceholderShort')}
            onSubmit={handleAiRefineDescriptions}
            disabled={isRenovationProcessing}
            className="!p-0 !bg-transparent !border-0"
            onStatusChange={setIsAiRefining}
          />
        </div>
      </header>

      {/* 操作栏 */}
      <div className="bg-white dark:bg-background-secondary border-b border-gray-200 dark:border-border-primary px-3 md:px-6 py-3 md:py-4 flex-shrink-0">
        {isRenovationProcessing ? (
          <div className="max-w-xl mx-auto">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-sm font-medium text-gray-700 dark:text-foreground-secondary">
                {t('detail.renovationProcessing')}
              </span>
              {renovationProgress && renovationProgress.total > 0 && (
                <span className="text-sm font-medium text-brand-600 dark:text-brand">
                  {t('detail.renovationProgress', { completed: String(renovationProgress.completed), total: String(renovationProgress.total) })}
                </span>
              )}
            </div>
            <div className="w-full h-2.5 bg-gray-200 dark:bg-background-hover rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-brand-400 to-brand-500 rounded-full transition-all duration-500 ease-out"
                style={{
                  width: renovationProgress && renovationProgress.total > 0
                    ? `${Math.round((renovationProgress.completed / renovationProgress.total) * 100)}%`
                    : '0%',
                  animation: !renovationProgress || renovationProgress.total === 0
                    ? 'pulse 1.5s ease-in-out infinite'
                    : undefined,
                  minWidth: !renovationProgress || renovationProgress.completed === 0 ? '10%' : undefined,
                }}
              />
            </div>
          </div>
        ) : (
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 sm:gap-3">
          <div className="flex items-center gap-2 sm:gap-3 flex-1">
            <Button
              variant="primary"
              icon={<Sparkles size={16} className="md:w-[18px] md:h-[18px]" />}
              onClick={handleGenerateAll}
              className="flex-1 sm:flex-initial text-sm md:text-base"
            >
              {t('detail.batchGenerate')}
            </Button>
            {/* 页面生成方式：位图 / SVG —— 在“生成描述”这一步选定，两条路线从这里分叉 */}
            <div
              className="flex items-center gap-0.5 p-0.5 rounded-lg bg-gray-100 dark:bg-background-hover flex-shrink-0"
              title={t('detail.pageGenModeHint')}
            >
              {(['image', 'svg'] as const).map(m => (
                <button
                  key={m}
                  type="button"
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                    pageGenMode === m
                      ? 'bg-white dark:bg-background-primary text-brand-600 dark:text-brand shadow-sm'
                      : 'text-gray-500 dark:text-foreground-tertiary hover:text-gray-700 dark:hover:text-foreground-secondary'
                  }`}
                  onClick={() => setPageGenMode(m)}
                >
                  {t(m === 'image' ? 'detail.pageImage' : 'detail.pageSvg')}
                </button>
              ))}
            </div>
            {/* SVG reasoning 档位：仅 SVG 模式显示。档位越高排版/结构越好但越慢（xhigh 实测 ~327s/页）。 */}
            {pageGenMode === 'svg' && (
              <div
                className="flex items-center gap-0.5 p-0.5 rounded-lg bg-gray-100 dark:bg-background-hover flex-shrink-0"
                title={t('detail.svgEffortHint')}
              >
                {(['low', 'medium', 'high', 'xhigh'] as const).map(e => (
                  <button
                    key={e}
                    type="button"
                    className={`px-2 py-1 text-xs font-medium rounded-md transition-colors ${
                      svgEffort === e
                        ? 'bg-white dark:bg-background-primary text-brand-600 dark:text-brand shadow-sm'
                        : 'text-gray-500 dark:text-foreground-tertiary hover:text-gray-700 dark:hover:text-foreground-secondary'
                    }`}
                    onClick={() => setSvgEffort(e)}
                  >
                    {t(`detail.svgEffort_${e}`)}
                  </button>
                ))}
              </div>
            )}
            <label
              className="flex items-center gap-1.5 text-sm md:text-base cursor-pointer select-none px-1.5"
              title={t('detail.webResearch')}
            >
              <input
                type="checkbox"
                checked={enableWebResearch}
                onChange={(e) => setEnableWebResearch(e.target.checked)}
                disabled={isRenovationProcessing}
                className="cursor-pointer accent-yellow-500"
              />
              <span>🌐 {t('detail.webResearch')}</span>
            </label>

            {/* 描述设置面板 */}
            <div className="relative" ref={settingsRef}>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSettingsOpen(!settingsOpen)}
                icon={<span className="relative"><Settings2 size={16} />{descRequirements && <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-brand-400" />}</span>}
                title={t('detail.descSettings')}
              />
              {settingsOpen && (
                <div className="absolute top-full left-0 mt-1 z-50 w-80 rounded-xl border border-gray-200 dark:border-border-primary bg-white dark:bg-background-secondary shadow-lg dark:shadow-none p-4 space-y-4">
                  {/* 生成模式 */}
                  <div>
                    <label className="flex items-center gap-1 text-xs font-medium text-gray-600 dark:text-foreground-tertiary mb-1.5">
                      {t('detail.generationMode')}
                      <span className="relative group">
                        <HelpCircle size={12} className="text-gray-400 cursor-help" />
                        <span className="absolute left-1/2 -translate-x-1/2 bottom-full mb-1.5 w-52 px-2.5 py-1.5 text-[11px] leading-relaxed text-gray-600 dark:text-foreground-secondary bg-white dark:bg-background-primary border border-gray-200 dark:border-border-primary rounded-md shadow-md opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity z-50">{t('detail.generationModeHint')}</span>
                      </span>
                    </label>
                    <div className="flex gap-1">
                      {(['streaming', 'parallel'] as const).map(mode => (
                        <button
                          key={mode}
                          type="button"
                          className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                            generationMode === mode
                              ? 'bg-brand-500 text-white'
                              : 'bg-gray-100 dark:bg-background-hover text-gray-600 dark:text-foreground-tertiary hover:bg-gray-200 dark:hover:bg-background-primary'
                          }`}
                          onClick={() => {
                            setGenerationMode(mode);
                            saveSettingsDebounced({ description_generation_mode: mode });
                          }}
                        >
                          {t(`detail.${mode}`)}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 详细程度 — 暂时屏蔽，效果不够理想，始终使用默认值 */}

                  {/* 额外字段 */}
                  <div>
                    <label className="flex items-center gap-1 text-xs font-medium text-gray-600 dark:text-foreground-tertiary mb-1.5">
                      {t('detail.extraFields')}
                      <span className="relative group">
                        <HelpCircle size={12} className="text-gray-400 cursor-help" />
                        <span className="absolute left-1/2 -translate-x-1/2 bottom-full mb-1.5 w-52 px-2.5 py-1.5 text-[11px] leading-relaxed text-gray-600 dark:text-foreground-secondary bg-white dark:bg-background-primary border border-gray-200 dark:border-border-primary rounded-md shadow-md opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity z-50">{t('detail.extraFieldsHint')}</span>
                      </span>
                    </label>
                    <DndContext sensors={fieldSensors} collisionDetection={closestCenter} onDragEnd={handleFieldDragEnd}>
                      <SortableContext items={availableFields} strategy={rectSortingStrategy}>
                        <div className="flex flex-wrap gap-1.5 mb-2">
                          {availableFields.map(name => {
                            const active = extraFieldNames.includes(name);
                            return (
                              <SortableFieldPill
                                key={name}
                                name={name}
                                active={active}
                                removable={!PRESET_EXTRA_FIELDS.has(name)}
                                onToggle={() => {
                                  const next = active
                                    ? extraFieldNames.filter(f => f !== name)
                                    : [...extraFieldNames, name];
                                  setExtraFieldNames(next);
                                  saveSettingsDebounced({ description_extra_fields: next.length > 0 ? next : getDefaultDescriptionFields() });
                                }}
                                inImagePrompt={imagePromptFields.includes(name)}
                                imagePromptTooltip={imagePromptFields.includes(name) ? t('detail.imagePromptOn') : t('detail.imagePromptOff')}
                                onToggleImagePrompt={() => {
                                  const next = imagePromptFields.includes(name)
                                    ? imagePromptFields.filter(f => f !== name)
                                    : [...imagePromptFields, name];
                                  setImagePromptFields(next);
                                  saveSettingsDebounced({ image_prompt_extra_fields: next });
                                }}
                                onRemove={() => {
                                  const nextPool = availableFields.filter(f => f !== name);
                                  setAvailableFields(nextPool);
                                  extraFieldCatalog.save(nextPool);
                                }}
                              />
                            );
                          })}
                        </div>
                      </SortableContext>
                    </DndContext>
                    <div className="flex gap-1">
                      <input
                        type="text"
                        className="flex-1 min-w-0 px-2 py-1 text-xs rounded-md border border-gray-200 dark:border-border-primary bg-white dark:bg-background-primary text-gray-700 dark:text-foreground-secondary focus:outline-none focus:ring-1 focus:ring-brand-500/30"
                        placeholder={t('detail.addField')}
                        value={newFieldName}
                        onChange={e => setNewFieldName(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter' && newFieldName.trim()) {
                            e.preventDefault();
                            const trimmed = newFieldName.trim();
                            if (!availableFields.includes(trimmed) && availableFields.length < 10) {
                              const nextPool = [...availableFields, trimmed];
                              setAvailableFields(nextPool);
                              extraFieldCatalog.save(nextPool);
                              // 新增字段默认勾选
                              const nextActive = [...extraFieldNames, trimmed];
                              setExtraFieldNames(nextActive);
                              saveSettingsDebounced({ description_extra_fields: nextActive });
                              setNewFieldName('');
                            }
                          }
                        }}
                      />
                      <button
                        type="button"
                        className="p-1 rounded-md text-gray-400 hover:text-brand-500 hover:bg-gray-100 dark:hover:bg-background-hover transition-colors disabled:opacity-40"
                        disabled={!newFieldName.trim() || availableFields.includes(newFieldName.trim()) || availableFields.length >= 10}
                        onClick={() => {
                          const trimmed = newFieldName.trim();
                          if (trimmed && !availableFields.includes(trimmed) && availableFields.length < 10) {
                            const nextPool = [...availableFields, trimmed];
                            setAvailableFields(nextPool);
                            extraFieldCatalog.save(nextPool);
                            const nextActive = [...extraFieldNames, trimmed];
                            setExtraFieldNames(nextActive);
                            saveSettingsDebounced({ description_extra_fields: nextActive });
                            setNewFieldName('');
                          }
                        }}
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                  </div>

                  {/* 生成要求 */}
                  <div className="border-t border-gray-100 dark:border-border-primary pt-3">
                    <label className="flex items-center gap-1 text-xs font-medium text-gray-600 dark:text-foreground-tertiary mb-1.5">
                      {t('detail.descRequirements')}
                    </label>
                    <div data-testid="desc-requirements-textarea">
                      <MarkdownTextarea
                        ref={reqTextareaRef}
                        value={descRequirements}
                        onChange={(val) => { setDescRequirements(val); setIsDescReqDirty(true); }}
                        onPaste={handleReqImagePaste}
                        onFiles={handleReqImageFiles}
                        placeholder={t('detail.descRequirementsPlaceholder')}
                        className="ring-inset"
                        rows={2}
                        showImagePreview={false}
                      />
                    </div>
                    <PresetCapsules
                      type="description"
                      onAppend={(text) => {
                        setDescRequirements((prev) => prev ? `${prev}\n${text}` : text);
                        setIsDescReqDirty(true);
                      }}
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="w-px h-6 bg-gray-200 dark:bg-border-primary flex-shrink-0" />
            {/* 导入导出下拉菜单 */}
            <div className="relative" ref={fileMenuRef}>
              <Button
                variant="secondary"
                onClick={() => setFileMenuOpen(!fileMenuOpen)}
                icon={<FileText size={16} className="md:w-[18px] md:h-[18px]" />}
                className="text-sm md:text-base"
              >
                {t('detail.importExport')}
                <ChevronDown size={14} className={`ml-1 transition-transform duration-200 ${fileMenuOpen ? 'rotate-180' : ''}`} />
              </Button>
              {fileMenuOpen && (
                <div className="absolute top-full right-0 mt-1 z-50 min-w-[160px] rounded-lg border border-gray-200 dark:border-border-primary bg-white dark:bg-background-secondary shadow-lg dark:shadow-none overflow-hidden">
                  <button
                    type="button"
                    onClick={() => { handleExportDescriptions(); setFileMenuOpen(false); }}
                    disabled={!currentProject.pages.some(p => p.description_content)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-gray-600 dark:text-foreground-tertiary hover:bg-gray-50 dark:hover:bg-background-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-150"
                  >
                    <Download size={14} />
                    {t('detail.export')}
                  </button>
                  <button
                    type="button"
                    onClick={() => { handleExportFull(); setFileMenuOpen(false); }}
                    disabled={!currentProject.pages.some(p => p.description_content)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-gray-600 dark:text-foreground-tertiary hover:bg-gray-50 dark:hover:bg-background-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-150"
                  >
                    <Download size={14} />
                    {t('detail.exportFull')}
                  </button>
                  <div className="border-t border-gray-100 dark:border-border-primary" />
                  <button
                    type="button"
                    onClick={() => { setIsImportModalOpen(true); setFileMenuOpen(false); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-gray-600 dark:text-foreground-tertiary hover:bg-gray-50 dark:hover:bg-background-hover transition-colors duration-150"
                  >
                    <Upload size={14} />
                    {t('detail.import')}
                  </button>
                </div>
              )}
            </div>
            <span className="text-xs md:text-sm text-gray-500 dark:text-foreground-tertiary whitespace-nowrap">
              {currentProject.pages.filter((p) => p.description_content).length} /{' '}
              {currentProject.pages.length} {t('detail.pagesCompleted')}
            </span>
          </div>
        </div>
        )}
      </div>

      {/* 主内容区 */}
      <main className="flex-1 p-3 md:p-6 overflow-y-auto min-h-0">
        <div className="max-w-7xl mx-auto">
          <ReferenceFileList
            projectId={projectId}
            onFileClick={setPreviewFileId}
            className="mb-4"
            showToast={show}
          />
          {currentProject.pages.length === 0 && !isRenovationProcessing ? (
            <div className="text-center py-12 md:py-20">
              <div className="flex justify-center mb-4"><FileText size={48} className="text-gray-300" /></div>
              <h3 className="text-lg md:text-xl font-semibold text-gray-700 dark:text-foreground-secondary mb-2">
                {t('detail.noPages')}
              </h3>
              <p className="text-sm md:text-base text-gray-500 dark:text-foreground-tertiary mb-6">
                {t('detail.noPagesHint')}
              </p>
              <Button
                variant="primary"
                onClick={() => navigate(`/project/${projectId}/outline`)}
                className="text-sm md:text-base"
              >
                {t('detail.backToOutline')}
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-6">
              {isRenovationProcessing && currentProject.pages.length === 0 ? (
                /* Placeholder skeleton cards while renovation creates pages */
                Array.from({ length: renovationProgress?.total || 6 }).map((_, index) => (
                  <DescriptionCard
                    key={`skeleton-${index}`}
                    page={{ id: `skeleton-${index}`, title: '', sort_order: index, status: 'GENERATING_DESCRIPTION' } as any}
                    index={index}
                    projectId={currentProject.id}
                    extraFieldNames={extraFieldNames}
                    imagePromptFields={imagePromptFields}
                    showToast={show}
                    onUpdate={() => {}}
                    onRegenerate={() => {}}
                  />
                ))
              ) : (
                currentProject.pages.map((page, index) => {
                const pageId = page.id || page.page_id;
                // Renovation processing: treat pages without description as generating
                const hasDescription = page.description_content && (
                  (typeof page.description_content === 'object' && 'text' in page.description_content && page.description_content.text?.trim())
                );
                const effectivePage = (isRenovationProcessing && !hasDescription)
                  ? { ...page, status: 'GENERATING_DESCRIPTION' as const }
                  : page;
                return (
                  <DescriptionCard
                    key={pageId}
                    page={effectivePage}
                    index={index}
                    projectId={currentProject.id}
                    extraFieldNames={extraFieldNames}
                    imagePromptFields={imagePromptFields}
                    showToast={show}
                    onUpdate={(data) => updatePageLocal(pageId, data)}
                    onRegenerate={() => stableHandleRegeneratePage(pageId)}
                    isAiRefining={isAiRefining}
                  />
                );
              })
              )}
            </div>
          )}
        </div>
      </main>
      <ToastContainer />
      {ConfirmDialog}
      <FilePreviewModal fileId={previewFileId} onClose={() => setPreviewFileId(null)} />
      <ImportMarkdownModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImport={handleImportDescriptions}
        title={t('detail.importModalTitle')}
        description={t('detail.importModalDesc')}
        pasteLabel={t('detail.importPasteLabel')}
        pastePlaceholder={t('detail.importPastePlaceholder')}
        uploadLabel={t('detail.importUploadLabel')}
        uploadHint={t('detail.importUploadHint')}
        uploadFormatsHint={t('detail.importUploadFormatsHint')}
        importButtonLabel={t('detail.importConfirm')}
        cancelButtonLabel={t('detail.importCancel')}
        emptyError={t('detail.messages.importContentEmpty')}
        readFileError={t('detail.messages.importReadFailed')}
      />
    </div>
  );
};
