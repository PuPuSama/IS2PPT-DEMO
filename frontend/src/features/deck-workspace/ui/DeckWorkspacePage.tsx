import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useT } from '@/hooks/useT';
import { previewI18n } from '@/config/slidePreviewI18n';
import type { PptxTransitionEffect } from '@/config/slideExportOptions';
import { devLog } from '@/utils/logger';
import { Loading, useToast, useConfirm, ProjectSettingsModal } from '@/components/shared';
import SvgSlideEditor from '@/components/preview/SvgSlideEditor';
import type { Page } from '@/types';
import { normalizeErrorMessage } from '@/utils';
import {
  deckWorkspaceSnapshotFromProject,
  exportRangeFromWorkspace,
  exportSelectionFromWorkspace,
} from '../model/deckWorkspaceSnapshot';
import type { DeckStyleMode } from '../model/deckStyleSelection';
import {
  useDeckWorkspaceJobs,
  type DeckExportFormat,
} from '../model/useDeckWorkspaceJobs';
import {
  useDeckWorkspacePreferences,
  type DeckPreferenceKey,
} from '../model/useDeckWorkspacePreferences';
import { useDeckWorkspaceProject } from '../model/useDeckWorkspaceProject';
import { useDeckWorkspaceSlides } from '../model/useDeckWorkspaceSlides';
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
    deckSource,
    busy: deckBusy,
    reloadDeck,
    renderSlide,
    renderSlides,
    reviseSlide,
    removeSlide,
    patchSlide,
    saveDeckSettings,
    replaceDeckTemplate,
    listSlideVersions,
    selectSlideVersion,
  } = useDeckWorkspaceProject();
  const {
    renderProgress: generationProgress,
    slideRenderJobs: slideJobs,
    renderWarning: generationWarning,
    deckExportJobs: exportJobsForDeck,
    activeDeckExport: hasActiveExportJobs,
    startDeckExport,
  } = useDeckWorkspaceJobs(projectId);

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [deckStyleInitialMode, setDeckStyleInitialMode] = useState<DeckStyleMode>('image');
  const [showPptxExportDialog, setShowPptxExportDialog] = useState(false);
  const [showEditablePptxDialog, setShowEditablePptxDialog] = useState(false);
  const [pptxTransitionsEnabled, setPptxTransitionsEnabled] = useState(false);
  const [pptxTransitionEffects, setPptxTransitionEffects] = useState<PptxTransitionEffect[]>(['fade']);
  const [svgEditorOpen, setSvgEditorOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isProjectSettingsOpen, setIsProjectSettingsOpen] = useState(false);
  const { show, ToastContainer } = useToast();
  const { confirm, ConfirmDialog } = useConfirm();
  const {
    confirmationOpen: generationQualityConfirmationOpen,
    requestExecution: requestGenerationExecution,
    confirmExecution: confirmGenerationExecution,
    cancelExecution: cancelGenerationExecution,
  } = useGenerationQualityGate();


  const workspace = useMemo(
    () => deckWorkspaceSnapshotFromProject(deckSource),
    [deckSource],
  );
  const handlePreferenceSaved = useCallback((preference: DeckPreferenceKey) => {
    const messageKeys: Record<DeckPreferenceKey, string> = {
      extraRequirements: 'slidePreview.extraRequirementsSaved',
      templateStyle: 'slidePreview.styleDescSaved',
      partialExport: 'slidePreview.exportSettingsSaved',
      aspectRatio: 'slidePreview.aspectRatioSaved',
    };
    show({ message: t(messageKeys[preference]), type: 'success' });
  }, [show, t]);
  const handlePreferenceSaveError = useCallback((
    _preference: DeckPreferenceKey,
    error: unknown,
  ) => {
    const errorMessage = (error as { message?: string })?.message
      || t('slidePreview.unknownError');
    show({
      message: t('slidePreview.saveFailed', { error: errorMessage }),
      type: 'error',
    });
  }, [show, t]);
  const {
    extraRequirements,
    setExtraRequirements,
    templateStyle,
    setTemplateStyle,
    partialExport: exportAllowPartial,
    setPartialExport: setExportAllowPartial,
    aspectRatio,
    setAspectRatio,
    aspectRatioStyle,
    savingExtraRequirements: isSavingRequirements,
    savingTemplateStyle: isSavingTemplateStyle,
    savingPartialExport: isSavingExportSettings,
    savingAspectRatio: isSavingAspectRatio,
    saveExtraRequirements: handleSaveExtraRequirements,
    saveTemplateStyle: handleSaveTemplateStyle,
    applyTemplateStyle,
    savePartialExport: handleSaveExportSettings,
    saveAspectRatio: handleSaveAspectRatio,
  } = useDeckWorkspacePreferences({
    deckId: projectId,
    workspace,
    saveDeckSettings,
    onSaved: handlePreferenceSaved,
    onSaveError: handlePreferenceSaveError,
  });
  const workspaceSlides = workspace?.slides ?? EMPTY_SLIDES;
  const slidesWithImages = workspace?.slidesWithImages ?? EMPTY_SLIDES;
  const hasImages = workspace?.hasImages ?? false;
  const handleVersionSelected = useCallback(() => {
    show({ message: t('slidePreview.versionSwitched'), type: 'success' });
  }, [show, t]);
  const handleVersionSelectError = useCallback((error: unknown) => {
    const errorMessage = (error as { message?: string })?.message
      || t('slidePreview.unknownError');
    show({
      message: t('slidePreview.versionSwitchFailed', { error: errorMessage }),
      type: 'error',
    });
  }, [show, t]);
  const {
    selectedIndex,
    selectedSlide,
    selectSlide,
    multiSelectEnabled: isMultiSelectMode,
    selectedSlideIds,
    toggleMultiSelect: toggleMultiSelectMode,
    toggleSlideSelection,
    selectAllSlides,
    clearSlideSelection,
    selectedSlideIdsForCommand,
    imageVersions,
    versionMenuOpen: showVersionMenu,
    toggleVersionMenu,
    switchVersion: handleSwitchVersion,
  } = useDeckWorkspaceSlides({
    deckId: projectId,
    slides: workspaceSlides,
    slidesWithImages,
    listSlideVersions,
    selectSlideVersion,
    onVersionSelected: handleVersionSelected,
    onVersionSelectError: handleVersionSelectError,
  });

  // 加载项目数据
  useEffect(() => {
    if (projectId && (!workspace || workspace.deckId !== projectId)) {
      // 直接使用 projectId 同步项目数据
      reloadDeck(projectId);
    }
  }, [projectId, reloadDeck, workspace]);

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

  const ensureImageGenerationStyleSource = useCallback(async () => {
    if (!deckSource || !workspace || !projectId) return false;

    const hasTemplateImage = workspace.hasTemplateAsset;
    const savedStyle = workspace.templateStyle.trim();
    const draftStyle = templateStyle.trim();

    if (hasTemplateImage || savedStyle) {
      return true;
    }

    if (draftStyle) {
      try {
        await applyTemplateStyle(draftStyle);
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
  }, [applyTemplateStyle, deckSource, projectId, show, templateStyle, workspace]);

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
          await renderSlides(slideIds);
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
        await renderSlide(slideId, true);
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
  }, [ensureImageGenerationStyleSource, renderSlide, requestGenerationExecution, selectedSlide, show, slideJobs]);

  const openSlideEditor = (targetIndex = selectedIndex) => {
    selectSlide(targetIndex);
    setIsEditModalOpen(true);
  };

  const handleSaveSlideMetadata = useCallback((slideId: string, updates: Partial<Page>) => {
    patchSlide(slideId, updates);
    show({ message: t('slidePreview.outlineSaved'), type: 'success' });
  }, [patchSlide, show, t]);

  const handleSubmitSlideEdit = useCallback(async ({
    slideId,
    instruction,
    references,
  }: SlideEditCommand) => {
    await reviseSlide({
      slideId,
      instruction,
      includeTemplate: references.useTemplate,
      descriptionImageUrls: references.descriptionImageUrls,
      uploadedFiles: references.uploadedFiles.length > 0
        ? references.uploadedFiles
        : undefined,
    });
  }, [reviseSlide]);

  const handleExport = async (
    format: DeckExportFormat,
    options?: {
      pptxTransitionEnabled?: boolean;
      pptxTransitionEffects?: PptxTransitionEffect[];
    },
  ) => {
    if (!projectId) return;

    const slideIds = selectedSlideIdsForCommand();
    try {
      const job = await startDeckExport({
        deckId: projectId,
        format,
        slideIds,
        transitionEnabled: options?.pptxTransitionEnabled,
        transitionEffects: options?.pptxTransitionEffects,
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
    const targetProjectId = projectId || deckSource?.id;
    if (!targetProjectId) {
      show({ message: t('slidePreview.cannotRefresh'), type: 'error' });
      return;
    }

    setIsRefreshing(true);
    try {
      await reloadDeck(targetProjectId);
      show({ message: t('slidePreview.refreshSuccess'), type: 'success' });
    } catch (error: any) {
      show({
        message: error.message || t('slidePreview.refreshFailed'),
        type: 'error'
      });
    } finally {
      setIsRefreshing(false);
    }
  }, [deckSource?.id, projectId, reloadDeck, show, t]);

  const handleApplyImageTemplate = useCallback(async (file: File) => {
    if (!projectId) return;
    await replaceDeckTemplate(projectId, file);
  }, [projectId, replaceDeckTemplate]);

  if (!deckSource || !workspace) {
    return <Loading fullscreen message={t('preview.messages.loadingProject')} />;
  }

  if (deckBusy) {
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
          onSelectSlide={selectSlide}
          onEditSlide={openSlideEditor}
          onDeleteSlide={removeSlide}
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
          onSelectSlide={selectSlide}
          onGenerateSlide={handleRegeneratePage}
          onOpenTemplate={() => {
            setDeckStyleInitialMode(templateStyle.trim() ? 'text' : 'image');
            setIsTemplateModalOpen(true);
          }}
          onRefresh={handleRefresh}
          onToggleVersionMenu={toggleVersionMenu}
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
          onApplyTextStyle={applyTemplateStyle}
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
            onExtraRequirementsChange={setExtraRequirements}
            onTemplateStyleChange={setTemplateStyle}
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
          onSaved={() => reloadDeck(projectId)}
        />
      )}

    </div>
  );
};
