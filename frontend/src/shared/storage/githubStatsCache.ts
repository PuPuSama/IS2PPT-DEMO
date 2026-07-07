import { STORAGE_KEYS } from './storageKeys';

export interface GithubStats {
  stars: number;
  forks: number;
}

export const GITHUB_REPO_CARD_CACHE_MS = 10 * 60 * 1000;
export const GITHUB_BADGE_CACHE_MS = 60 * 60 * 1000;

const isGithubStats = (value: unknown): value is GithubStats => {
  if (!value || typeof value !== 'object') return false;

  const stats = value as Record<string, unknown>;
  return typeof stats.stars === 'number' && typeof stats.forks === 'number';
};

export const githubStatsCache = {
  readRepoCard: () => {
    try {
      const cached = localStorage.getItem(STORAGE_KEYS.githubRepoStats);
      const cacheTime = Number(localStorage.getItem(STORAGE_KEYS.githubRepoStatsTime));
      if (!cached || !Number.isFinite(cacheTime)) return null;
      if (Date.now() - cacheTime >= GITHUB_REPO_CARD_CACHE_MS) return null;

      const parsed = JSON.parse(cached);
      return isGithubStats(parsed) ? parsed : null;
    } catch {
      return null;
    }
  },

  saveRepoCard: (stats: GithubStats, timestamp = Date.now()) => {
    localStorage.setItem(STORAGE_KEYS.githubRepoStats, JSON.stringify(stats));
    localStorage.setItem(STORAGE_KEYS.githubRepoStatsTime, String(timestamp));
  },

  readBadge: () => {
    try {
      const cached = localStorage.getItem(STORAGE_KEYS.githubBadgeStats);
      if (!cached) return null;

      const parsed = JSON.parse(cached);
      if (!parsed || typeof parsed !== 'object') return null;

      const { data, timestamp } = parsed as { data?: unknown; timestamp?: unknown };
      if (typeof timestamp !== 'number') return null;
      if (Date.now() - timestamp >= GITHUB_BADGE_CACHE_MS) return null;

      return isGithubStats(data) ? data : null;
    } catch {
      return null;
    }
  },

  saveBadge: (stats: GithubStats, timestamp = Date.now()) => {
    localStorage.setItem(STORAGE_KEYS.githubBadgeStats, JSON.stringify({
      data: stats,
      timestamp,
    }));
  },
};
