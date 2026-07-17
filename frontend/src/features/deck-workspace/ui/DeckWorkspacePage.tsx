import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useT } from '@/hooks/useT';
import { previewI18n } from '@/config/slidePreviewI18n';
import type { PptxTransitionEffect } from '@/config/slideExportOptions';
import { Loading, useToast, useConfirm } from '@/shared/ui';
import SvgSlideEditor from '@/components/preview/SvgSlideEditor';
import type { Page } from '@/types';
import { normalizeErrorMessage } from '@/utils';
import {
  deckWorkspaceSnapshotFromProject,
  exportRangeFromWorkspace,
  exportSelectionFromWorkspace,
} from '../model/deckWorkspaceSnapshot';
import { deckWorkspaceErrorMessage } from '../model/deckWorkspaceError';
import type { DeckStyleMode } from '../model/deckStyleMode';
import { useDeckWorkspaceExport } from '../model/useDeckWorkspaceExport';
import { useDeckWorkspaceJobs } from '../model/useDeckWorkspaceJobs';
import {
  useDeckWorkspacePreferences,
  type DeckPreferenceKey,
} from '../model/useDeckWorkspacePreferences';
import { useDeckWorkspaceProject } from '../model/useDeckWorkspaceProject';
import {
  useDeckWorkspaceRendering,
  type DeckOverwriteRequest,
} from '../model/useDeckWorkspaceRendering';
import { useDeckWorkspaceSlides } from '../model/useDeckWorkspaceSlides';
import { useGenerationQualityGate } from '../model/useGenerationQualityGate';
import { DeckExportDialogs } from './DeckExportDialogs';
import { DeckSettingsDialog } from './DeckSettingsDialog';
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
  const [settingsOpen, setSettingsOpen] = useState(false);
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
      } catch (error) {
        show({
          message: deckWorkspaceErrorMessage(error, t('preview.generationFailed')),
          type: 'error',
        });
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
  }, [applyTemplateStyle, deckSource, projectId, show, t, templateStyle, workspace]);

  const handleOverwriteRequired = useCallback((request: DeckOverwriteRequest) => {
    const message = request.target === 'selection'
      ? t('preview.confirmRegenerateSelected', { count: request.selectedCount })
      : t('preview.confirmRegenerateAll');
    confirm(
      message,
      () => void request.execute(),
      { title: t('preview.confirmRegenerateTitle'), variant: 'warning' },
    );
  }, [confirm, t]);
  const handleSlideBusy = useCallback(() => {
    show({ message: t('slidePreview.pageGenerating'), type: 'info' });
  }, [show, t]);
  const handleSlideRenderStarted = useCallback(() => {
    show({ message: t('slidePreview.generationStarted'), type: 'success' });
  }, [show, t]);
  const handleRenderError = useCallback((error: unknown) => {
    show({
      message: deckWorkspaceErrorMessage(error, t('preview.generationFailed')),
      type: 'error',
    });
  }, [show, t]);
  const {
    renderDeck: handleGenerateAll,
    renderCurrentSlide: handleRegeneratePage,
  } = useDeckWorkspaceRendering({
    workspace,
    selectedSlide,
    selectedSlideIds,
    multiSelectEnabled: isMultiSelectMode,
    jobsBySlideId: slideJobs,
    ensureStyleSource: ensureImageGenerationStyleSource,
    requestExecution: requestGenerationExecution,
    renderSlides,
    renderSlide,
    onOverwriteRequired: handleOverwriteRequired,
    onSlideBusy: handleSlideBusy,
    onSlideRenderStarted: handleSlideRenderStarted,
    onRenderError: handleRenderError,
  });

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

  const handleExportDownload = useCallback((url: string) => {
    window.open(url, '_blank');
  }, []);
  const handleExportStarted = useCallback(() => {
    show({ message: t('slidePreview.exportStarted'), type: 'success' });
  }, [show, t]);
  const handleExportError = useCallback((error: unknown) => {
    show({
      message: deckWorkspaceErrorMessage(error, t('preview.messages.exportFailed')),
      type: 'error',
    });
  }, [show, t]);
  const { exportDeck: handleExport } = useDeckWorkspaceExport({
    deckId: projectId,
    selectedSlideIds,
    multiSelectEnabled: isMultiSelectMode,
    startDeckExport,
    onDownloadReady: handleExportDownload,
    onExportStarted: handleExportStarted,
    onExportError: handleExportError,
  });

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
        onOpenSettings={() => setSettingsOpen(true)}
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
            transitionEnabled: options.transitionEnabled,
            transitionEffects: options.transitionEffects,
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
          currentStylePrompt={templateStyle}
          initialMode={deckStyleInitialMode}
          onClose={() => setIsTemplateModalOpen(false)}
          onApplyImageTemplate={handleApplyImageTemplate}
          onApplyStylePrompt={applyTemplateStyle}
        />
      )}
      {projectId && (
        <DeckSettingsDialog
          isOpen={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          extraRequirements={extraRequirements}
          templateStyle={templateStyle}
          onExtraRequirementsChange={setExtraRequirements}
          onTemplateStyleChange={setTemplateStyle}
          onSaveExtraRequirements={handleSaveExtraRequirements}
          onSaveTemplateStyle={handleSaveTemplateStyle}
          isSavingRequirements={isSavingRequirements}
          isSavingTemplateStyle={isSavingTemplateStyle}
          exportAllowPartial={exportAllowPartial}
          onExportAllowPartialChange={setExportAllowPartial}
          onSaveExportSettings={handleSaveExportSettings}
          isSavingExportSettings={isSavingExportSettings}
          aspectRatio={aspectRatio}
          onAspectRatioChange={setAspectRatio}
          onSaveAspectRatio={handleSaveAspectRatio}
          isSavingAspectRatio={isSavingAspectRatio}
          hasImages={hasImages}
        />
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
