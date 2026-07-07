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
} as const;

export const LEGACY_STORAGE_KEYS = {
  accessCode: 'banana-access-code',
  currentProjectId: 'currentProjectId',
  settingsSnapshot: 'banana-settings',
  homeDraftContent: 'home-draft-content',
  homeDraftTab: 'home-draft-tab',
  hasSeenHelp: 'hasSeenHelpModal',
  renovationTaskId: 'renovationTaskId',
  skip1KResolutionWarning: 'skip1KResolutionWarning',
  theme: 'banana-slides-theme',
  language: 'banana-slides-language',
  historyPageSize: 'history_page_size',
  presetCapsulesPrefix: 'presetCapsules_',
  githubRepoStats: 'github_repo_stats',
  githubRepoStatsTime: 'github_repo_stats_time',
  availableExtraFields: 'banana-available-extra-fields',
  detailLevel: 'banana-detail-level',
} as const;

export const STORAGE_KEY_MIGRATIONS = {
  localStorage: [
    [LEGACY_STORAGE_KEYS.accessCode, STORAGE_KEYS.accessCode],
    [LEGACY_STORAGE_KEYS.currentProjectId, STORAGE_KEYS.currentProjectId],
    [LEGACY_STORAGE_KEYS.hasSeenHelp, STORAGE_KEYS.hasSeenHelp],
    [LEGACY_STORAGE_KEYS.renovationTaskId, STORAGE_KEYS.renovationTaskId],
    [LEGACY_STORAGE_KEYS.skip1KResolutionWarning, STORAGE_KEYS.skip1KResolutionWarning],
    [LEGACY_STORAGE_KEYS.theme, STORAGE_KEYS.theme],
    [LEGACY_STORAGE_KEYS.language, STORAGE_KEYS.language],
    [LEGACY_STORAGE_KEYS.historyPageSize, STORAGE_KEYS.historyPageSize],
    [LEGACY_STORAGE_KEYS.githubRepoStats, STORAGE_KEYS.githubRepoStats],
    [LEGACY_STORAGE_KEYS.githubRepoStatsTime, STORAGE_KEYS.githubRepoStatsTime],
    [LEGACY_STORAGE_KEYS.availableExtraFields, STORAGE_KEYS.availableExtraFields],
  ],
  sessionStorage: [
    [LEGACY_STORAGE_KEYS.settingsSnapshot, STORAGE_KEYS.settingsSnapshot],
    [LEGACY_STORAGE_KEYS.homeDraftContent, STORAGE_KEYS.homeDraftContent],
    [LEGACY_STORAGE_KEYS.homeDraftTab, STORAGE_KEYS.homeDraftTab],
    [LEGACY_STORAGE_KEYS.detailLevel, STORAGE_KEYS.detailLevel],
  ],
  localStoragePrefixes: [
    [LEGACY_STORAGE_KEYS.presetCapsulesPrefix, STORAGE_KEYS.presetCapsulesPrefix],
  ],
} as const;

export const getPresetCapsulesStorageKey = (type: string) =>
  `${STORAGE_KEYS.presetCapsulesPrefix}${type}`;
