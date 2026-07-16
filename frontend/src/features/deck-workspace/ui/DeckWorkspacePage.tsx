import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useT } from '@/hooks/useT';
import { previewI18n } from '@/config/slidePreviewI18n';
import type { PptxTransitionEffect } from '@/config/slideExportOptions';
import { devLog } from '@/utils/logger';
import { Loading, useToast, useConfirm, ProjectSettingsModal } from '@/components/shared';
import SvgSlideEditor from '@/components/preview/SvgSlideEditor';
import { useProjectStore } from '@/store/useProjectStore';
import { useGenerationJobsStore } from '@/entities/generation/model/useGenerationJobsStore';
import { useExportJobsStore } from '@/entities/export/model/useExportJobsStore';
import type { ExportFormat } from '@/entities/export/model/types';
import { isExportJobActive } from '@/entities/export/model/types';
import { getPageImageVersions, setCurrentImageVersion } from '@/api/pagesApi';
import { updateProject, uploadTemplate } from '@/api/projectsApi';
import type { ImageVersion, Page } from '@/types';
import { normalizeErrorMessage } from '@/utils';
import {
  deckWorkspaceSnapshotFromProject,
  exportRangeFromWorkspace,
  exportSelectionFromWorkspace,
} from '../model/deckWorkspaceSnapshot';
import type { DeckStyleMode } from '../model/deckStyleSelection';
import { useGenerationQualityGate } from '../model/useGenerationQualityGate';
import { DeckExportDialogs } from './DeckExportDialogs';
import { DeckStyleDialog } from './DeckStyleDialog';
import { GenerationQualityDialog } from './GenerationQualityDialog';
import { DeckWorkspaceHeader } from './DeckWorkspaceHeader';
import { SlideEditDialog, type SlideEditCommand } from './SlideEditDialog';
import { SlideNavigator } from './SlideNavigator';
import { SlideCanvas } from './SlideCanvas';

const EMPTY_SLIDES: Page[] = [];

export const DeckWorkspacePage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const t = useT(previewI18n);
  const { projectId } = useParams<{ projectId: string }>();
  const fromHistory = (location.state as any)?.from === 'history';
  const {
    currentProject: deckSnapshot,
    syncProject,
    generatePageImage,
    generateImages,
    editPageImage,
    deletePageById,
    updatePageLocal,
    isGlobalLoading,
  } = useProjectStore();
  const {
    progress: generationProgress,
    jobsBySlideId: slideJobs,
    warning: generationWarning,
  } = useGenerationJobsStore();

  const { jobs: exportJobs, startExport, restoreActiveJobs } = useExportJobsStore();

  useEffect(() => {
    restoreActiveJobs();
  }, [restoreActiveJobs]);

  const exportJobsForDeck = useMemo(
    () => exportJobs.filter((job) => job.deckId === projectId),
    [exportJobs, projectId],
  );
  const hasActiveExportJobs = exportJobsForDeck.some(isExportJobActive);

  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [deckStyleInitialMode, setDeckStyleInitialMode] = useState<DeckStyleMode>('image');
  const [showPptxExportDialog, setShowPptxExportDialog] = useState(false);
  const [showEditablePptxDialog, setShowEditablePptxDialog] = useState(false);
  const [pptxTransitionsEnabled, setPptxTransitionsEnabled] = useState(false);
  const [pptxTransitionEffects, setPptxTransitionEffects] = useState<PptxTransitionEffect[]>(['fade']);
  // 多选导出相关状态
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [selectedSlideIds, setSelectedSlideIds] = useState<Set<string>>(new Set());
  const [svgEditorOpen, setSvgEditorOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [imageVersions, setImageVersions] = useState<ImageVersion[]>([]);
  const [showVersionMenu, setShowVersionMenu] = useState(false);
  const [extraRequirements, setExtraRequirements] = useState<string>('');
  const [isSavingRequirements, setIsSavingRequirements] = useState(false);
  const isEditingRequirements = useRef(false); // 跟踪用户是否正在编辑额外要求
  const [templateStyle, setTemplateStyle] = useState<string>('');
  const [isSavingTemplateStyle, setIsSavingTemplateStyle] = useState(false);
  const isEditingTemplateStyle = useRef(false); // 跟踪用户是否正在编辑风格描述
  const lastProjectId = useRef<string | null>(null); // 跟踪上一次的项目ID
  const [isProjectSettingsOpen, setIsProjectSettingsOpen] = useState(false);
  // 导出设置
  const [exportAllowPartial, setExportAllowPartial] = useState(false);
  const [isSavingExportSettings, setIsSavingExportSettings] = useState(false);
  // 画面比例
  const [aspectRatio, setAspectRatio] = useState('16:9');
  const [isSavingAspectRatio, setIsSavingAspectRatio] = useState(false);
  // 根据画面比例计算 CSS aspect-ratio
  const aspectRatioStyle = useMemo(() => {
    const parts = aspectRatio.split(':');
    if (parts.length === 2) {
      const w = parseInt(parts[0], 10);
      const h = parseInt(parts[1], 10);
      if (w > 0 && h > 0) return `${w}/${h}`;
    }
    return '16/9';
  }, [aspectRatio]);
  const { show, ToastContainer } = useToast();
  const { confirm, ConfirmDialog } = useConfirm();
  const {
    confirmationOpen: generationQualityConfirmationOpen,
    requestExecution: requestGenerationExecution,
    confirmExecution: confirmGenerationExecution,
    cancelExecution: cancelGenerationExecution,
  } = useGenerationQualityGate();


  const workspace = useMemo(
    () => deckWorkspaceSnapshotFromProject(deckSnapshot),
    [deckSnapshot],
  );
  const workspaceSlides = workspace?.slides ?? EMPTY_SLIDES;
  const slidesWithImages = workspace?.slidesWithImages ?? EMPTY_SLIDES;
  const hasImages = workspace?.hasImages ?? false;
  const selectedSlide = workspaceSlides[selectedIndex];

  // 加载项目数据
  useEffect(() => {
    if (projectId && (!workspace || workspace.deckId !== projectId)) {
      // 直接使用 projectId 同步项目数据
      syncProject(projectId);
    }
  }, [projectId, workspace, syncProject]);

  // 监听警告消息
  const lastWarningRef = React.useRef<string | null>(null);
  useEffect(() => {
    if (generationWarning) {
      if (generationWarning !== lastWarningRef.current) {
        lastWarningRef.current = generationWarning;
        show({ message: generationWarning, type: 'warning', duration: 6000 });
      }
    } else {
      // 警告被清空时重置 ref，以便下次能再次显示
      lastWarningRef.current = null;
    }
  }, [generationWarning, show]);

  // 当项目加载后，初始化额外要求和风格描述
  // 只在项目首次加载或项目ID变化时初始化，避免覆盖用户正在输入的内容
  useEffect(() => {
    if (workspace) {
      // 检查是否是新项目
      const isNewProject = lastProjectId.current !== workspace.deckId;

      if (isNewProject) {
        // 新项目，初始化额外要求和风格描述
        setExtraRequirements(workspace.extraRequirements);
        setTemplateStyle(workspace.templateStyle);
        // 初始化导出设置
        setExportAllowPartial(workspace.allowPartialExport);
        setAspectRatio(workspace.aspectRatio);
        lastProjectId.current = workspace.deckId || null;
        isEditingRequirements.current = false;
        isEditingTemplateStyle.current = false;
      } else {
        // 同一项目且用户未在编辑，可以更新（比如从服务器保存后同步回来）
        if (!isEditingRequirements.current) {
          setExtraRequirements(workspace.extraRequirements);
        }
        if (!isEditingTemplateStyle.current) {
          setTemplateStyle(workspace.templateStyle);
        }
        // 非文本输入的设置项，始终从服务器同步
        setAspectRatio(workspace.aspectRatio);
        setExportAllowPartial(workspace.allowPartialExport);
      }
      // 如果用户正在编辑，则不更新本地状态
    }
  }, [
    workspace?.allowPartialExport,
    workspace?.aspectRatio,
    workspace?.deckId,
    workspace?.extraRequirements,
    workspace?.templateStyle,
  ]);

  // 加载当前页面的历史版本
  useEffect(() => {
    const loadVersions = async () => {
      if (!projectId || !selectedSlide?.id) {
        setImageVersions([]);
        setShowVersionMenu(false);
        return;
      }

      try {
        const response = await getPageImageVersions(projectId, selectedSlide.id);
        if (response.data?.versions) {
          setImageVersions(response.data.versions);
        }
      } catch (error) {
        console.error('Failed to load image versions:', error);
        setImageVersions([]);
      }
    };

    loadVersions();
  }, [projectId, selectedSlide?.id]);

  const ensureImageGenerationStyleSource = useCallback(async () => {
    if (!deckSnapshot || !workspace || !projectId) return false;

    const hasTemplateImage = workspace.hasTemplateAsset;
    const savedStyle = workspace.templateStyle.trim();
    const draftStyle = templateStyle.trim();

    if (hasTemplateImage || savedStyle) {
      return true;
    }

    if (draftStyle) {
      try {
        await updateProject(projectId, { template_style: draftStyle });
        await syncProject(projectId);
        return true;
      } catch (error: any) {
        const respData = error?.response?.data;
        const errorMessage = normalizeErrorMessage(
          respData?.error?.message || respData?.message || error?.message
        );
        show({ message: errorMessage, type: 'error' });
        return false;
      }
    }

    setDeckStyleInitialMode('text');
    setIsTemplateModalOpen(true);
    show({
      message: normalizeErrorMessage('no template image or style description'),
      type: 'error',
    });
    return false;
  }, [deckSnapshot, projectId, show, syncProject, templateStyle, workspace]);

  const handleGenerateAll = async () => {
    if (!(await ensureImageGenerationStyleSource())) return;

    // 先检查分辨率，如果是1K则显示警告
    await requestGenerationExecution(async () => {
      const slideIds = selectedSlideIdsForCommand();
      const isPartialGenerate = isMultiSelectMode && selectedSlideIds.size > 0;

      // 检查要生成的页面中是否有已有图片的
      const slidesToGenerate = workspace
        ? exportSelectionFromWorkspace(workspace, selectedSlideIds, isPartialGenerate).slides
        : [];
      const selectedSlidesHaveImages = slidesToGenerate.some((slide) => slide.generated_image_path);

      const executeGenerate = async () => {
        try {
          await generateImages(slideIds);
        } catch (error: any) {
          console.error('批量生成错误:', error);
          console.error('错误响应:', error?.response?.data);

          // 提取后端返回的更具体错误信息
          let errorMessage = t('preview.generationFailed');
          const respData = error?.response?.data;

          if (respData) {
            if (respData.error?.message) {
              errorMessage = respData.error.message;
            } else if (respData.message) {
              errorMessage = respData.message;
            } else if (respData.error) {
              errorMessage =
                typeof respData.error === 'string'
                  ? respData.error
                  : respData.error.message || errorMessage;
            }
          } else if (error.message) {
            errorMessage = error.message;
          }

          devLog('提取的错误消息:', errorMessage);

          // 使用统一的错误消息规范化函数
          errorMessage = normalizeErrorMessage(errorMessage);

          devLog('规范化后的错误消息:', errorMessage);

          show({
            message: errorMessage,
            type: 'error',
          });
        }
      };

      if (selectedSlidesHaveImages) {
        const message = isPartialGenerate
          ? t('preview.confirmRegenerateSelected', { count: selectedSlideIds.size })
          : t('preview.confirmRegenerateAll');
        confirm(
          message,
          executeGenerate,
          { title: t('preview.confirmRegenerateTitle'), variant: 'warning' }
        );
      } else {
        await executeGenerate();
      }
    });
  };

  const handleRegeneratePage = useCallback(async () => {
    const slideId = selectedSlide?.id;
    if (!slideId) return;

    // 如果该页面正在生成，不重复提交
    if (slideJobs[slideId]) {
      show({ message: t('slidePreview.pageGenerating'), type: 'info' });
      return;
    }

    if (!(await ensureImageGenerationStyleSource())) return;

    // 先检查分辨率，如果是1K则显示警告
    await requestGenerationExecution(async () => {
      try {
        await generatePageImage(slideId, true);
        show({ message: t('slidePreview.generationStarted'), type: 'success' });
      } catch (error: any) {
        // 提取后端返回的更具体错误信息
        let errorMessage = '生成失败';
        const respData = error?.response?.data;

        if (respData) {
          if (respData.error?.message) {
            errorMessage = respData.error.message;
          } else if (respData.message) {
            errorMessage = respData.message;
          } else if (respData.error) {
            errorMessage =
              typeof respData.error === 'string'
                ? respData.error
                : respData.error.message || errorMessage;
          }
        } else if (error.message) {
          errorMessage = error.message;
        }

        // 使用统一的错误消息规范化函数
        errorMessage = normalizeErrorMessage(errorMessage);

        show({
          message: errorMessage,
          type: 'error',
        });
      }
    });
  }, [ensureImageGenerationStyleSource, generatePageImage, requestGenerationExecution, selectedSlide, show, slideJobs]);

  const handleSwitchVersion = async (versionId: string) => {
    if (!selectedSlide?.id || !projectId) return;

    try {
      await setCurrentImageVersion(projectId, selectedSlide.id, versionId);
      await syncProject(projectId);
      setShowVersionMenu(false);
      show({ message: t('slidePreview.versionSwitched'), type: 'success' });
    } catch (error: any) {
      show({
        message: t('slidePreview.versionSwitchFailed', { error: error.message || t('slidePreview.unknownError') }),
        type: 'error'
      });
    }
  };

  const openSlideEditor = (targetIndex = selectedIndex) => {
    setSelectedIndex(targetIndex);
    setIsEditModalOpen(true);
  };

  const handleSaveSlideMetadata = useCallback((slideId: string, updates: Partial<Page>) => {
    updatePageLocal(slideId, updates);
    show({ message: t('slidePreview.outlineSaved'), type: 'success' });
  }, [show, t, updatePageLocal]);

  const handleSubmitSlideEdit = useCallback(async ({
    slideId,
    instruction,
    references,
  }: SlideEditCommand) => {
    await editPageImage(slideId, instruction, {
      useTemplate: references.useTemplate,
      descImageUrls: references.descriptionImageUrls,
      uploadedFiles: references.uploadedFiles.length > 0
        ? references.uploadedFiles
        : undefined,
    });
  }, [editPageImage]);

  // 多选相关函数
  const toggleSlideSelection = (slideId: string) => {
    setSelectedSlideIds(prev => {
      const next = new Set(prev);
      if (next.has(slideId)) {
        next.delete(slideId);
      } else {
        next.add(slideId);
      }
      return next;
    });
  };

  const selectAllSlides = () => {
    const allSlideIds = slidesWithImages.map((slide) => slide.id!);
    setSelectedSlideIds(new Set(allSlideIds));
  };

  const clearSlideSelection = () => {
    setSelectedSlideIds(new Set());
  };

  const toggleMultiSelectMode = () => {
    setIsMultiSelectMode(prev => {
      if (prev) {
        // 退出多选模式时清空选择
        setSelectedSlideIds(new Set());
      }
      return !prev;
    });
  };

  // 获取有图片的选中页面ID列表
  const selectedSlideIdsForCommand = (): string[] | undefined => {
    if (!isMultiSelectMode || selectedSlideIds.size === 0) {
      return undefined; // 导出全部
    }
    return Array.from(selectedSlideIds);
  };

  const handleExport = async (
    format: ExportFormat,
    options?: {
      pptxTransitionEnabled?: boolean;
      pptxTransitionEffects?: PptxTransitionEffect[];
    },
  ) => {
    if (!projectId) return;

    const slideIds = selectedSlideIdsForCommand();
    try {
      const job = await startExport({
        deckId: projectId,
        format,
        slideIds,
        ...(format === 'pptx'
          ? {
              pptxOptions: {
                transitionEnabled: options?.pptxTransitionEnabled,
                transitionEffects: options?.pptxTransitionEffects,
              },
            }
          : {}),
      });

      if (job.status === 'ready' && job.downloadUrl) {
        window.open(job.downloadUrl, '_blank');
      } else if (job.status === 'running') {
        show({
          message: t('slidePreview.exportStarted'),
          type: 'success',
        });
      }
    } catch (error: any) {
      let errorMessage = t('preview.messages.exportFailed');
      const respData = error?.response?.data;

      if (respData) {
        if (respData.error?.message) {
          errorMessage = respData.error.message;
        } else if (respData.message) {
          errorMessage = respData.message;
        } else if (respData.error) {
          errorMessage =
            typeof respData.error === 'string'
              ? respData.error
              : respData.error.message || errorMessage;
        }
      } else if (error.message) {
        errorMessage = error.message;
      }

      const normalizedErrorMessage = normalizeErrorMessage(errorMessage);

      show({ message: normalizedErrorMessage, type: 'error' });
    }
  };

  const handleRefresh = useCallback(async () => {
    const targetProjectId = projectId || deckSnapshot?.id;
    if (!targetProjectId) {
      show({ message: t('slidePreview.cannotRefresh'), type: 'error' });
      return;
    }

    setIsRefreshing(true);
    try {
      await syncProject(targetProjectId);
      show({ message: t('slidePreview.refreshSuccess'), type: 'success' });
    } catch (error: any) {
      show({
        message: error.message || t('slidePreview.refreshFailed'),
        type: 'error'
      });
    } finally {
      setIsRefreshing(false);
    }
  }, [deckSnapshot?.id, projectId, show, syncProject]);

  const handleSaveExtraRequirements = useCallback(async () => {
    if (!deckSnapshot || !projectId) return;

    setIsSavingRequirements(true);
    try {
      await updateProject(projectId, { extra_requirements: extraRequirements || '' });
      // 保存成功后，标记为不在编辑状态，允许同步更新
      isEditingRequirements.current = false;
      // 更新本地项目状态
      await syncProject(projectId);
      show({ message: t('slidePreview.extraRequirementsSaved'), type: 'success' });
    } catch (error: any) {
      show({
        message: t('slidePreview.saveFailed', { error: error.message || t('slidePreview.unknownError') }),
        type: 'error'
      });
    } finally {
      setIsSavingRequirements(false);
    }
  }, [deckSnapshot, extraRequirements, projectId, show, syncProject]);

  const handleSaveTemplateStyle = useCallback(async () => {
    if (!deckSnapshot || !projectId) return;

    setIsSavingTemplateStyle(true);
    try {
      await updateProject(projectId, { template_style: templateStyle || '' });
      // 保存成功后，标记为不在编辑状态，允许同步更新
      isEditingTemplateStyle.current = false;
      // 更新本地项目状态
      await syncProject(projectId);
      show({ message: t('slidePreview.styleDescSaved'), type: 'success' });
    } catch (error: any) {
      show({
        message: t('slidePreview.saveFailed', { error: error.message || t('slidePreview.unknownError') }),
        type: 'error'
      });
    } finally {
      setIsSavingTemplateStyle(false);
    }
  }, [deckSnapshot, projectId, show, syncProject, templateStyle]);

  const handleSaveExportSettings = useCallback(async () => {
    if (!deckSnapshot || !projectId) return;

    setIsSavingExportSettings(true);
    try {
      await updateProject(projectId, {
        export_allow_partial: exportAllowPartial,
      });
      // 更新本地项目状态
      await syncProject(projectId);
      show({ message: t('slidePreview.exportSettingsSaved'), type: 'success' });
    } catch (error: any) {
      show({
        message: t('slidePreview.saveFailed', { error: error.message || t('slidePreview.unknownError') }),
        type: 'error'
      });
    } finally {
      setIsSavingExportSettings(false);
    }
  }, [deckSnapshot, exportAllowPartial, projectId, show, syncProject, t]);

  const handleSaveAspectRatio = useCallback(async () => {
    if (!deckSnapshot || !projectId) return;

    setIsSavingAspectRatio(true);
    try {
      await updateProject(projectId, { image_aspect_ratio: aspectRatio });
      await syncProject(projectId);
      show({ message: t('slidePreview.aspectRatioSaved'), type: 'success' });
    } catch (error: any) {
      show({
        message: t('slidePreview.saveFailed', { error: error.message || t('slidePreview.unknownError') }),
        type: 'error'
      });
    } finally {
      setIsSavingAspectRatio(false);
    }
  }, [aspectRatio, deckSnapshot, projectId, show, syncProject]);

  const handleApplyImageTemplate = useCallback(async (file: File) => {
    if (!projectId) return;
    await uploadTemplate(projectId, file);
    await syncProject(projectId);
  }, [projectId, syncProject]);

  const handleApplyTextStyle = useCallback(async (style: string) => {
    if (!projectId) return;
    isEditingTemplateStyle.current = true;
    setTemplateStyle(style);
    await updateProject(projectId, { template_style: style || '' });
    isEditingTemplateStyle.current = false;
    await syncProject(projectId);
  }, [projectId, syncProject]);

  if (!deckSnapshot || !workspace) {
    return <Loading fullscreen message={t('preview.messages.loadingProject')} />;
  }

  if (isGlobalLoading) {
    // 根据任务进度显示不同的消息
    let loadingMessage = t('preview.messages.processing');
    if (generationProgress?.currentStep) {
      // 使用后端提供的当前步骤信息
      const stepMap: Record<string, string> = {
        'Generating clean backgrounds': t('preview.messages.generatingBackgrounds'),
        'Creating PDF': t('preview.messages.creatingPdf'),
        'Parsing with MinerU': t('preview.messages.parsingContent'),
        'Creating editable PPTX': t('preview.messages.creatingPptx'),
        'Complete': t('preview.messages.complete')
      };
      loadingMessage = stepMap[generationProgress.currentStep] || generationProgress.currentStep;
      // 不再显示 "处理中 (X/Y)..." 格式，百分比已在进度条显示
    }

    return (
      <Loading
        fullscreen
        message={loadingMessage}
        progress={generationProgress || undefined}
      />
    );
  }

  const exportSelection = exportSelectionFromWorkspace(
    workspace,
    selectedSlideIds,
    isMultiSelectMode,
  );
  const hasAllImages = exportSelection.ready;
  const missingImageCount = exportSelection.missingImageCount;
  const exportRange = exportRangeFromWorkspace(
    workspace,
    selectedSlideIds,
    isMultiSelectMode,
  );

  return (
    <div className="h-screen bg-gray-50 dark:bg-background-primary flex flex-col overflow-hidden">
      <DeckWorkspaceHeader
        projectId={projectId}
        slides={workspaceSlides}
        renderMode={workspace.renderMode}
        activeExportJob={hasActiveExportJobs}
        exportJobCount={exportJobsForDeck.length}
        refreshing={isRefreshing}
        multiSelectEnabled={isMultiSelectMode}
        selectedSlideCount={selectedSlideIds.size}
        exportReady={hasAllImages}
        missingImageCount={missingImageCount}
        onHome={() => navigate('/')}
        onBack={() => navigate(fromHistory ? '/history' : `/project/${projectId}/detail`)}
        onPrevious={() => navigate(`/project/${projectId}/detail`)}
        onOpenSettings={() => setIsProjectSettingsOpen(true)}
        onOpenStyle={() => {
          setDeckStyleInitialMode(templateStyle.trim() ? 'text' : 'image');
          setIsTemplateModalOpen(true);
        }}
        onRefresh={handleRefresh}
        onOpenPptxExport={() => setShowPptxExportDialog(true)}
        onOpenEditablePptxExport={() => setShowEditablePptxDialog(true)}
        onExport={(format) => void handleExport(format)}
      />

      <DeckExportDialogs
        pptxOpen={showPptxExportDialog}
        editablePptxOpen={showEditablePptxDialog}
        transitionsEnabled={pptxTransitionsEnabled}
        transitionEffects={pptxTransitionEffects}
        exportRange={exportRange}
        onClosePptx={() => setShowPptxExportDialog(false)}
        onCloseEditablePptx={() => setShowEditablePptxDialog(false)}
        onTransitionsEnabledChange={setPptxTransitionsEnabled}
        onTransitionEffectsChange={setPptxTransitionEffects}
        onStartPptx={(options) => {
          setShowPptxExportDialog(false);
          void handleExport('pptx', {
            pptxTransitionEnabled: options.transitionEnabled,
            pptxTransitionEffects: options.transitionEffects,
          });
        }}
        onStartEditablePptx={() => {
          setShowEditablePptxDialog(false);
          void handleExport('editable-pptx');
        }}
      />

      {/* 主内容区 */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-w-0 min-h-0">
        <SlideNavigator
          slides={workspaceSlides}
          selectedIndex={selectedIndex}
          selectedSlideIds={selectedSlideIds}
          multiSelectEnabled={isMultiSelectMode}
          jobsBySlideId={slideJobs}
          aspectRatio={aspectRatio}
          onGenerate={handleGenerateAll}
          onToggleMultiSelect={toggleMultiSelectMode}
          onSelectAll={selectAllSlides}
          onClearSelection={clearSlideSelection}
          onToggleSlide={toggleSlideSelection}
          onSelectSlide={setSelectedIndex}
          onEditSlide={openSlideEditor}
          onDeleteSlide={deletePageById}
        />

        <SlideCanvas
          slides={workspaceSlides}
          selectedIndex={selectedIndex}
          jobsBySlideId={slideJobs}
          aspectRatioStyle={aspectRatioStyle}
          imageVersions={imageVersions}
          versionMenuOpen={showVersionMenu}
          refreshing={isRefreshing}
          onBackToPlan={() => navigate(`/project/${projectId}/outline`)}
          onSelectSlide={setSelectedIndex}
          onGenerateSlide={handleRegeneratePage}
          onOpenTemplate={() => {
            setDeckStyleInitialMode(templateStyle.trim() ? 'text' : 'image');
            setIsTemplateModalOpen(true);
          }}
          onRefresh={handleRefresh}
          onToggleVersionMenu={() => setShowVersionMenu(!showVersionMenu)}
          onSwitchVersion={handleSwitchVersion}
          onEditSlide={() => openSlideEditor()}
          onRegenerateSlide={handleRegeneratePage}
        />
      </div>

      <SlideEditDialog
        isOpen={isEditModalOpen}
        slide={selectedSlide}
        templateAssetPath={workspace.templateAssetPath}
        deckUpdatedAt={workspace.updatedAt}
        aspectRatioStyle={aspectRatioStyle}
        onClose={() => setIsEditModalOpen(false)}
        onOpenSvgEditor={() => setSvgEditorOpen(true)}
        onSaveMetadata={handleSaveSlideMetadata}
        onSubmitEdit={handleSubmitSlideEdit}
      />
      <ToastContainer />
      {ConfirmDialog}

      {projectId && (
        <DeckStyleDialog
          isOpen={isTemplateModalOpen}
          projectId={projectId}
          currentTextStyle={templateStyle}
          initialMode={deckStyleInitialMode}
          onClose={() => setIsTemplateModalOpen(false)}
          onApplyImageTemplate={handleApplyImageTemplate}
          onApplyTextStyle={handleApplyTextStyle}
        />
      )}
      {projectId && (
        <>
          {/* 项目设置模态框 */}
          <ProjectSettingsModal
            isOpen={isProjectSettingsOpen}
            onClose={() => setIsProjectSettingsOpen(false)}
            extraRequirements={extraRequirements}
            templateStyle={templateStyle}
            onExtraRequirementsChange={(value) => {
              isEditingRequirements.current = true;
              setExtraRequirements(value);
            }}
            onTemplateStyleChange={(value) => {
              isEditingTemplateStyle.current = true;
              setTemplateStyle(value);
            }}
            onSaveExtraRequirements={handleSaveExtraRequirements}
            onSaveTemplateStyle={handleSaveTemplateStyle}
            isSavingRequirements={isSavingRequirements}
            isSavingTemplateStyle={isSavingTemplateStyle}
            // 导出设置
            exportAllowPartial={exportAllowPartial}
            onExportAllowPartialChange={setExportAllowPartial}
            onSaveExportSettings={handleSaveExportSettings}
            isSavingExportSettings={isSavingExportSettings}
            // 画面比例
            aspectRatio={aspectRatio}
            onAspectRatioChange={setAspectRatio}
            onSaveAspectRatio={handleSaveAspectRatio}
            isSavingAspectRatio={isSavingAspectRatio}
            hasImages={hasImages}
          />
        </>
      )}

      <GenerationQualityDialog
        isOpen={generationQualityConfirmationOpen}
        onCancel={cancelGenerationExecution}
        onConfirm={confirmGenerationExecution}
      />

      {/* SVG 幻灯片编辑器（文字直改 + SVG 代码面板，仅 SVG 模式） */}
      {svgEditorOpen && projectId && selectedSlide?.id && (
        <SvgSlideEditor
          projectId={projectId}
          pageId={selectedSlide.id}
          onClose={() => setSvgEditorOpen(false)}
          onSaved={() => syncProject(projectId)}
        />
      )}

    </div>
  );
};
