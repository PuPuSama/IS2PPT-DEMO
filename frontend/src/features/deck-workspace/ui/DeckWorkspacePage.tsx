import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useT } from '@/hooks/useT';
import { previewI18n } from '@/config/slidePreviewI18n';
import type { PptxTransitionEffect } from '@/config/slideExportOptions';
import { devLog } from '@/utils/logger';
import {
  Home,
  ArrowLeft,
  Download,
  RefreshCw,
  Upload,
  Settings,
  FileText,
  Loader2,
  Presentation,
} from 'lucide-react';
import { Button, Loading, Modal, useToast, useConfirm, ProjectSettingsModal, ExportJobsPanel, TextStyleSelector } from '@/components/shared';
import { TemplateSelector } from '@/components/shared/TemplateSelector';
import { loadTemplateAsset } from '@/entities/template/api/templateAssetRepository';
import { listUserTemplates, type UserTemplate } from '@/api/templatesApi';
import SvgSlideEditor from '@/components/preview/SvgSlideEditor';
import { useProjectStore } from '@/store/useProjectStore';
import { useGenerationJobsStore } from '@/entities/generation/model/useGenerationJobsStore';
import { useExportJobsStore } from '@/entities/export/model/useExportJobsStore';
import type { ExportFormat } from '@/entities/export/model/types';
import { isExportJobActive } from '@/entities/export/model/types';
import { getPageImageVersions, setCurrentImageVersion } from '@/api/pagesApi';
import { updateProject, uploadTemplate } from '@/api/projectsApi';
import { getSettings } from '@/api/settingsApi';
import type { ImageVersion, Page } from '@/types';
import { normalizeErrorMessage } from '@/utils';
import { uiDismissals } from '@/shared/storage/uiDismissals';
import {
  deckWorkspaceSnapshotFromProject,
  exportRangeFromWorkspace,
  exportSelectionFromWorkspace,
} from '../model/deckWorkspaceSnapshot';
import { DeckExportDialogs } from './DeckExportDialogs';
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
  const [useTextStyleMode, setUseTextStyleMode] = useState(false);
  const [draftTemplateStyle, setDraftTemplateStyle] = useState('');
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showExportJobsPanel, setShowExportJobsPanel] = useState(false);
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
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [selectedPresetTemplateId, setSelectedPresetTemplateId] = useState<string | null>(null);
  const [isUploadingTemplate, setIsUploadingTemplate] = useState(false);
  const [extraRequirements, setExtraRequirements] = useState<string>('');
  const [isSavingRequirements, setIsSavingRequirements] = useState(false);
  const isEditingRequirements = useRef(false); // 跟踪用户是否正在编辑额外要求
  const [templateStyle, setTemplateStyle] = useState<string>('');
  const [isSavingTemplateStyle, setIsSavingTemplateStyle] = useState(false);
  const isEditingTemplateStyle = useRef(false); // 跟踪用户是否正在编辑风格描述
  const lastProjectId = useRef<string | null>(null); // 跟踪上一次的项目ID
  const [isProjectSettingsOpen, setIsProjectSettingsOpen] = useState(false);
  const [userTemplates, setUserTemplates] = useState<UserTemplate[]>([]);
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
  // 1K分辨率警告对话框状态
  const [show1KWarningDialog, setShow1KWarningDialog] = useState(false);
  const [skip1KWarningChecked, setSkip1KWarningChecked] = useState(false);
  const [pending1KAction, setPending1KAction] = useState<(() => Promise<void>) | null>(null);
  const { show, ToastContainer } = useToast();
  const { confirm, ConfirmDialog } = useConfirm();


  const workspace = useMemo(
    () => deckWorkspaceSnapshotFromProject(deckSnapshot),
    [deckSnapshot],
  );
  const workspaceSlides = workspace?.slides ?? EMPTY_SLIDES;
  const slidesWithImages = workspace?.slidesWithImages ?? EMPTY_SLIDES;
  const hasImages = workspace?.hasImages ?? false;
  const selectedSlide = workspaceSlides[selectedIndex];

  // 加载项目数据 & 用户模板
  useEffect(() => {
    if (projectId && (!workspace || workspace.deckId !== projectId)) {
      // 直接使用 projectId 同步项目数据
      syncProject(projectId);
    }

    // 加载用户模板列表（用于按需获取File）
    const loadTemplates = async () => {
      try {
        const response = await listUserTemplates();
        if (response.data?.templates) {
          setUserTemplates(response.data.templates);
        }
      } catch (error) {
        console.error('Failed to load user templates:', error);
      }
    };
    loadTemplates();
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

  // 检查是否需要显示1K分辨率警告
  const checkResolutionAndExecute = useCallback(async (action: () => Promise<void>) => {
    if (uiDismissals.shouldSkipLowResolutionWarning()) {
      await action();
      return;
    }

    try {
      const response = await getSettings();
      const resolution = response.data?.image_resolution;

      // 如果是1K分辨率，显示警告对话框
      if (resolution === '1K') {
        setPending1KAction(() => action);
        setSkip1KWarningChecked(false);
        setShow1KWarningDialog(true);
      } else {
        // 不是1K分辨率，直接执行
        await action();
      }
    } catch (error) {
      console.error('获取设置失败:', error);
      // 获取设置失败时，直接执行（不阻塞用户）
      await action();
    }
  }, []);

  // 确认1K分辨率警告后执行
  const handleConfirm1KWarning = useCallback(async () => {
    if (skip1KWarningChecked) {
      uiDismissals.skipLowResolutionWarning();
    }

    setShow1KWarningDialog(false);

    // 执行待处理的操作
    if (pending1KAction) {
      await pending1KAction();
      setPending1KAction(null);
    }
  }, [skip1KWarningChecked, pending1KAction]);

  // 取消1K分辨率警告
  const handleCancel1KWarning = useCallback(() => {
    setShow1KWarningDialog(false);
    setPending1KAction(null);
  }, []);

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

    setDraftTemplateStyle(savedStyle || draftStyle);
    setUseTextStyleMode(true);
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
    await checkResolutionAndExecute(async () => {
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
    await checkResolutionAndExecute(async () => {
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
  }, [checkResolutionAndExecute, ensureImageGenerationStyleSource, generatePageImage, selectedSlide, show, slideJobs]);

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
    setShowExportMenu(false);
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

  const handleTemplateSelect = async (templateFile: File | null, templateId?: string) => {
    if (!projectId) return;

    // 如果有templateId，按需加载File
    let file = templateFile;
    if (templateId && !file) {
      file = await loadTemplateAsset(templateId, userTemplates);
      if (!file) {
        show({ message: t('slidePreview.loadTemplateFailed'), type: 'error' });
        return;
      }
    }

    if (!file) {
      // 如果没有文件也没有 ID，可能是取消选择
      return;
    }

    setIsUploadingTemplate(true);
    try {
      await uploadTemplate(projectId, file);
      await syncProject(projectId);
      setIsTemplateModalOpen(false);
      show({ message: t('slidePreview.templateChanged'), type: 'success' });

      // 更新选择状态
      if (templateId) {
        // 判断是用户模板还是预设模板（短ID通常是预设模板）
        if (templateId.length <= 3 && /^\d+$/.test(templateId)) {
          setSelectedPresetTemplateId(templateId);
          setSelectedTemplateId(null);
        } else {
          setSelectedTemplateId(templateId);
          setSelectedPresetTemplateId(null);
        }
      }
    } catch (error: any) {
      show({
        message: t('slidePreview.templateChangeFailed', { error: error.message || t('slidePreview.unknownError') }),
        type: 'error'
      });
    } finally {
      setIsUploadingTemplate(false);
    }
  };

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
      {/* 顶栏 */}
      <header className="h-14 md:h-16 bg-white dark:bg-background-secondary shadow-sm dark:shadow-background-primary/30 border-b border-gray-200 dark:border-border-primary flex items-center justify-between px-3 md:px-6 flex-shrink-0">
        <div className="flex items-center gap-2 md:gap-4 min-w-0 flex-1">
          <Button
            variant="ghost"
            size="sm"
            icon={<Home size={16} className="md:w-[18px] md:h-[18px]" />}
            onClick={() => navigate('/')}
            className="hidden sm:inline-flex flex-shrink-0"
            >
              <span className="hidden md:inline">{t('nav.home')}</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              icon={<ArrowLeft size={16} className="md:w-[18px] md:h-[18px]" />}
              onClick={() => {
                if (fromHistory) {
                  navigate('/history');
                } else {
                  navigate(`/project/${projectId}/detail`);
                }
              }}
              className="flex-shrink-0"
            >
              <span className="hidden sm:inline">{t('common.back')}</span>
            </Button>
            <div className="flex items-center gap-1.5 md:gap-2 min-w-0">
              <Presentation size={22} className="text-brand-600" />
              <span className="text-base md:text-xl font-bold truncate">{t('home.title')}</span>
            </div>
            <span className="text-gray-400 hidden md:inline">|</span>
            <span className="text-sm md:text-lg font-semibold truncate hidden sm:inline">{t('preview.title')}</span>
            {/* 当前生成路线徽标：SVG 矢量 / 生图，让用户一眼知道走哪条线 */}
            {workspace.renderMode === 'svg' ? (
                <span
                  title="当前生成路线：SVG 矢量（便当版面，可在幻灯片上直接编辑）"
                  className="hidden md:inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300"
                >
                  SVG 矢量
                </span>
              ) : (
                <span
                  title="当前生成路线：生图（位图）"
                  className="hidden md:inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400"
                >
                  生图
                </span>
              )}
        </div>
        <div className="flex items-center gap-1 md:gap-3 flex-shrink-0">
            <Button
              variant="ghost"
              size="sm"
              icon={<Settings size={16} className="md:w-[18px] md:h-[18px]" />}
              onClick={() => setIsProjectSettingsOpen(true)}
              className="hidden lg:inline-flex"
            >
              <span className="hidden xl:inline">{t('preview.projectSettings')}</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              icon={<Upload size={16} className="md:w-[18px] md:h-[18px]" />}
              onClick={() => { setDraftTemplateStyle(templateStyle); setUseTextStyleMode(!!templateStyle.trim()); setIsTemplateModalOpen(true); }}
              className="hidden lg:inline-flex"
            >
              <span className="hidden xl:inline">{t('preview.changeTemplate')}</span>
            </Button>
            <Button
              variant="secondary"
              size="sm"
              icon={<ArrowLeft size={16} className="md:w-[18px] md:h-[18px]" />}
              onClick={() => navigate(`/project/${projectId}/detail`)}
              className="hidden sm:inline-flex"
            >
              <span className="hidden md:inline">{t('common.previous')}</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              icon={<RefreshCw size={16} className={`md:w-[18px] md:h-[18px] ${isRefreshing ? 'animate-spin' : ''}`} />}
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="hidden md:inline-flex"
            >
              <span className="hidden lg:inline">{t('preview.refresh')}</span>
            </Button>

          {/* 导出任务按钮 — 始终显示，面板内部决定是否有内容 */}
          <div className="relative">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowExportJobsPanel(!showExportJobsPanel);
                  setShowExportMenu(false);
                }}
                className="relative"
              >
                {hasActiveExportJobs ? (
                  <Loader2 size={16} className="animate-spin text-brand-500" />
                ) : (
                  <FileText size={16} />
                )}
                {exportJobsForDeck.length > 0 && (
                  <span className="ml-1 text-xs">
                    {exportJobsForDeck.length}
                  </span>
                )}
              </Button>
              {showExportJobsPanel && (
                <div className="absolute right-0 mt-2 z-20">
                  <ExportJobsPanel
                    deckId={projectId}
                    pages={workspaceSlides}
                    className="w-96 max-h-[28rem] shadow-lg"
                  />
                </div>
              )}
            </div>

          <div className="relative">
            <Button
              variant="primary"
              size="sm"
              icon={<Download size={16} className="md:w-[18px] md:h-[18px]" />}
              onClick={() => {
                setShowExportMenu(!showExportMenu);
                setShowExportJobsPanel(false);
              }}
              disabled={isMultiSelectMode && selectedSlideIds.size === 0}
              title={!isMultiSelectMode && !hasAllImages ? t('preview.disabledExportTip', { count: missingImageCount }) : undefined}
              className="text-xs md:text-sm"
            >
              <span className="hidden sm:inline">
                {isMultiSelectMode && selectedSlideIds.size > 0
                  ? `${t('preview.export')} (${selectedSlideIds.size})`
                  : t('preview.export')}
              </span>
              <span className="sm:hidden">
                {isMultiSelectMode && selectedSlideIds.size > 0
                  ? `(${selectedSlideIds.size})`
                  : t('preview.export')}
              </span>
            </Button>
            {showExportMenu && (
              <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-background-secondary rounded-lg shadow-lg border border-gray-200 dark:border-border-primary py-2 z-10">
                {isMultiSelectMode && selectedSlideIds.size > 0 && (
                  <div className="px-4 py-2 text-xs text-gray-500 dark:text-foreground-tertiary border-b border-gray-100 dark:border-border-primary">
                    {t('preview.exportSelectedPages', { count: selectedSlideIds.size })}
                  </div>
                )}
                <button
                  onClick={() => {
                    setShowExportMenu(false);
                    setShowPptxExportDialog(true);
                  }}
                  disabled={!hasAllImages}
                  className="w-full px-4 py-2 text-left hover:bg-gray-50 dark:hover:bg-background-hover transition-colors text-sm disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {t('preview.exportPptx')}
                </button>
                <button
                  onClick={() => {
                    setShowExportMenu(false);
                    setShowEditablePptxDialog(true);
                  }}
                  disabled={!hasAllImages}
                  className="w-full px-4 py-2 text-left hover:bg-gray-50 dark:hover:bg-background-hover transition-colors text-sm disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {t('preview.exportEditablePptx')}
                </button>
                <button
                  onClick={() => handleExport('pdf')}
                  disabled={!hasAllImages}
                  className="w-full px-4 py-2 text-left hover:bg-gray-50 dark:hover:bg-background-hover transition-colors text-sm disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {t('preview.exportPdf')}
                </button>
                <button
                  onClick={() => handleExport('images')}
                  disabled={!hasAllImages}
                  className="w-full px-4 py-2 text-left hover:bg-gray-50 dark:hover:bg-background-hover transition-colors text-sm disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {t('preview.exportImages')}
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

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
            setDraftTemplateStyle(templateStyle);
            setUseTextStyleMode(Boolean(templateStyle.trim()));
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

      {/* 模板选择 Modal */}
      <Modal
        isOpen={isTemplateModalOpen}
        onClose={() => setIsTemplateModalOpen(false)}
        title={t('preview.changeTemplate')}
        size="lg"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-foreground-tertiary mb-4">
            {t('preview.templateModalDesc')}
          </p>
          {/* 图片模板 / 文字风格 切换 */}
          <label className="flex items-center gap-2 cursor-pointer group">
            <span className="text-sm text-gray-600 dark:text-foreground-tertiary group-hover:text-gray-900 dark:group-hover:text-white transition-colors">
              {t('preview.useTextStyle')}
            </span>
            <div className="relative">
              <input
                type="checkbox"
                checked={useTextStyleMode}
                onChange={(e) => setUseTextStyleMode(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 dark:bg-background-hover peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-brand-300 dark:peer-focus:ring-brand/30 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white dark:after:bg-foreground-secondary after:border-gray-300 dark:after:border-border-hover after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand"></div>
            </div>
          </label>
          {useTextStyleMode ? (
            <TextStyleSelector
              value={draftTemplateStyle}
              onChange={setDraftTemplateStyle}
              onToast={show}
            />
          ) : (
            <>
              <TemplateSelector
                onSelect={handleTemplateSelect}
                selectedTemplateId={selectedTemplateId}
                selectedPresetTemplateId={selectedPresetTemplateId}
                showUpload={false}
                projectId={projectId || null}
              />
              {isUploadingTemplate && (
                <div className="text-center py-2 text-sm text-gray-500 dark:text-foreground-tertiary">
                  {t('preview.uploadingTemplate')}
                </div>
              )}
            </>
          )}
          <div className="flex justify-end gap-3 pt-4 border-t">
            {useTextStyleMode && (
              <Button
                variant="primary"
                loading={isSavingTemplateStyle}
                onClick={async () => {
                  isEditingTemplateStyle.current = true;
                  setTemplateStyle(draftTemplateStyle);
                  setIsSavingTemplateStyle(true);
                  try {
                    await updateProject(projectId!, { template_style: draftTemplateStyle || '' });
                    isEditingTemplateStyle.current = false;
                    await syncProject(projectId!);
                    show({ message: t('slidePreview.styleDescSaved'), type: 'success' });
                    setIsTemplateModalOpen(false);
                  } catch (error: any) {
                    show({ message: t('slidePreview.saveFailed', { error: error.message || t('slidePreview.unknownError') }), type: 'error' });
                  } finally {
                    setIsSavingTemplateStyle(false);
                  }
                }}
              >
                {t('preview.applyStyle')}
              </Button>
            )}
            <Button
              variant="ghost"
              onClick={() => setIsTemplateModalOpen(false)}
              disabled={isUploadingTemplate || isSavingTemplateStyle}
            >
              {t('common.close')}
            </Button>
          </div>
        </div>
      </Modal>
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

      {/* 1K分辨率警告对话框 */}
      <Modal
        isOpen={show1KWarningDialog}
        onClose={handleCancel1KWarning}
        title={t('preview.resolution1KWarning')}
        size="sm"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="text-2xl">⚠️</div>
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
              checked={skip1KWarningChecked}
              onChange={(e) => setSkip1KWarningChecked(e.target.checked)}
              className="w-4 h-4 text-brand-600 rounded focus:ring-brand-500"
            />
            <span className="text-sm text-gray-600 dark:text-foreground-tertiary">{t('preview.dontShowAgain')}</span>
          </label>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={handleCancel1KWarning}>
              {t('common.cancel')}
            </Button>
            <Button variant="primary" onClick={handleConfirm1KWarning}>
              {t('preview.generateAnyway')}
            </Button>
          </div>
        </div>
      </Modal>

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
