import { APP_IDENTITY } from '@/shared/config/appIdentity';

const prefix = APP_IDENTITY.storagePrefix;

export const STORAGE_KEYS = {
  accessCode: `${prefix}-access-code`,
  currentProjectId: `${prefix}-current-project-id`,
  settingsSnapshot: `${prefix}-settings`,
  homeDraftContent: `${prefix}-home-draft-content`,
  homeDraftTab: `${prefix}-home-draft-tab`,
  hasSeenHelp: `${prefix}-has-seen-help`,
  renovationTaskId: `${prefix}-renovation-task-id`,
  skip1KResolutionWarning: `${prefix}-skip-1k-resolution-warning`,
  theme: `${prefix}-theme`,
  language: `${prefix}-language`,
  historyPageSize: `${prefix}-history-page-size`,
  presetCapsulesPrefix: `${prefix}-preset-capsules-`,
  githubRepoStats: `${prefix}-github-repo-stats`,
  githubRepoStatsTime: `${prefix}-github-repo-stats-time`,
  githubBadgeStats: `${prefix}-github-badge-stats`,
  availableExtraFields: `${prefix}-available-extra-fields`,
  detailLevel: `${prefix}-detail-level`,
  exportJobs: `${prefix}-export-jobs`,
} as const;

export const getPresetCapsulesStorageKey = (type: string) =>
  `${STORAGE_KEYS.presetCapsulesPrefix}${type}`;
