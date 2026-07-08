import { apiClient } from './client';
import type { ApiResponse, Material } from '@/types';
import { getStoredOutputLanguage, type OutputLanguage } from './settingsApi';

export type { Material };
export { checkAccessCode, verifyAccessCode } from './accessCodeApi';
export {
  createProject,
  uploadTemplate,
  listProjects,
  getProject,
  deleteProject,
  updateProject,
  updatePagesOrder,
} from './projectsApi';
export {
  exportPPTX,
  exportPDF,
  exportImages,
  exportEditablePPTX,
  listExports,
} from './exportsApi';
export {
  uploadReferenceFile,
  getReferenceFile,
  listProjectReferenceFiles,
  deleteReferenceFile,
  triggerFileParse,
  associateFileToProject,
  dissociateFileFromProject,
} from './referenceFilesApi';
export type { ReferenceFile } from './referenceFilesApi';
export {
  uploadUserTemplate,
  listUserTemplates,
  deleteUserTemplate,
  createUserStyleTemplate,
  listUserStyleTemplates,
  deleteUserStyleTemplate,
  extractStyleFromImage,
} from './templatesApi';
export type { UserTemplate, UserStyleTemplate } from './templatesApi';
export {
  uploadMaterial,
  getMaterialCaption,
  getMaterialByUrl,
} from './materialsApi';
export { createPptRenovationProject } from './renovationApi';
export {
  getPageImageVersions,
  setCurrentImageVersion,
  updatePage,
  getPageSvg,
  savePageSvg,
  updatePageDescription,
  updatePageOutline,
  deletePage,
  addPage,
} from './pagesApi';
export { getTaskStatus } from './tasksApi';
export {
  generateOutline,
  generateOutlineStream,
  refineOutline,
} from './outlineApi';
export type {
  OutlineStreamPage,
  OutlineStreamCallbacks,
} from './outlineApi';
export {
  generateFromDescription,
  generateDescriptions,
  generateDescriptionsStream,
  generatePageDescription,
  refineDescriptions,
} from './descriptionApi';
export type {
  DescriptionStreamEvent,
  DescriptionStreamCallbacks,
} from './descriptionApi';
export {
  OUTPUT_LANGUAGE_OPTIONS,
  getDefaultOutputLanguage,
  getStoredOutputLanguage,
  getSettings,
  updateSettings,
  resetSettings,
  getOpenAIOAuthUrl,
  disconnectOpenAIOAuth,
  getOpenAIOAuthStatus,
  getOpenAIOAuthModels,
  submitOAuthManualCallback,
  verifyApiKey,
  testBaiduOcr,
  testTextModel,
  testCaptionModel,
  testBaiduInpaint,
  testImageModel,
  testMineruPdf,
  getTestStatus,
  checkForUpdates,
} from './settingsApi';
export type {
  OutputLanguage,
  OutputLanguageOption,
  TestSettingsOverride,
  UpdateCheckInfo,
} from './settingsApi';

/**
 * 重新生成 PPT 翻新项目的单页（重新解析原 PDF 并提取内容）
 */
export const regenerateRenovationPage = async (
  projectId: string,
  pageId: string,
  keepLayout: boolean = false,
  language?: OutputLanguage
): Promise<ApiResponse> => {
  const lang = language || await getStoredOutputLanguage();
  const response = await apiClient.post<ApiResponse>(
    `/api/projects/${projectId}/pages/${pageId}/regenerate-renovation`,
    { keep_layout: keepLayout, language: lang }
  );
  return response.data;
};

// ===== 图片生成 =====

/**
 * 批量生成图片
 * @param projectId 项目ID
 * @param language 输出语言（可选，默认从 sessionStorage 获取）
 * @param pageIds 可选的页面ID列表，如果不提供则生成所有页面
 */
export const generateImages = async (projectId: string, language?: OutputLanguage, pageIds?: string[]): Promise<ApiResponse> => {
  const lang = language || await getStoredOutputLanguage();
  const response = await apiClient.post<ApiResponse>(
    `/api/projects/${projectId}/generate/images`,
    { language: lang, page_ids: pageIds }
  );
  return response.data;
};

/**
 * 生成单页图片
 */
export const generatePageImage = async (
  projectId: string,
  pageId: string,
  forceRegenerate: boolean = false,
  language?: OutputLanguage
): Promise<ApiResponse> => {
  const lang = language || await getStoredOutputLanguage();
  const response = await apiClient.post<ApiResponse>(
    `/api/projects/${projectId}/pages/${pageId}/generate/image`,
    { force_regenerate: forceRegenerate, language: lang }
  );
  return response.data;
};

/**
 * 编辑图片（自然语言修改）
 */
export const editPageImage = async (
  projectId: string,
  pageId: string,
  editPrompt: string,
  contextImages?: {
    useTemplate?: boolean;
    descImageUrls?: string[];
    uploadedFiles?: File[];
  }
): Promise<ApiResponse> => {
  // 如果有上传的文件，使用 multipart/form-data
  if (contextImages?.uploadedFiles && contextImages.uploadedFiles.length > 0) {
    const formData = new FormData();
    formData.append('edit_instruction', editPrompt);
    formData.append('use_template', String(contextImages.useTemplate || false));
    if (contextImages.descImageUrls && contextImages.descImageUrls.length > 0) {
      formData.append('desc_image_urls', JSON.stringify(contextImages.descImageUrls));
    }
    // 添加上传的文件
    contextImages.uploadedFiles.forEach((file) => {
      formData.append('context_images', file);
    });

    const response = await apiClient.post<ApiResponse>(
      `/api/projects/${projectId}/pages/${pageId}/edit/image`,
      formData
    );
    return response.data;
  } else {
    // 使用 JSON
    const response = await apiClient.post<ApiResponse>(
      `/api/projects/${projectId}/pages/${pageId}/edit/image`,
      {
        edit_instruction: editPrompt,
        context_images: {
          use_template: contextImages?.useTemplate || false,
          desc_image_urls: contextImages?.descImageUrls || [],
        },
      }
    );
    return response.data;
  }
};
