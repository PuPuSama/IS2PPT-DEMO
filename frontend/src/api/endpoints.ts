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
  generateImages,
  generatePageImage,
  editPageImage,
} from './imageGenerationApi';
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
