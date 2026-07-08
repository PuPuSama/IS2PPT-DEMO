export type { Material } from '@/types';
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
export {
  createPptRenovationProject,
  regenerateRenovationPage,
} from './renovationApi';
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
