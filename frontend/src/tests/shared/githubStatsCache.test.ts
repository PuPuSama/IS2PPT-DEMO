import { beforeEach, describe, expect, it } from 'vitest';

import {
  GITHUB_BADGE_CACHE_MS,
  GITHUB_REPO_CARD_CACHE_MS,
  githubStatsCache,
} from '@/shared/storage/githubStatsCache';
import { STORAGE_KEYS } from '@/shared/storage/storageKeys';

describe('githubStatsCache', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('saves and reads repo card stats', () => {
    const timestamp = Date.now();

    githubStatsCache.saveRepoCard({ stars: 10, forks: 2 }, timestamp);

    expect(githubStatsCache.readRepoCard()).toEqual({ stars: 10, forks: 2 });
  });

  it('expires stale repo card stats', () => {
    githubStatsCache.saveRepoCard(
      { stars: 10, forks: 2 },
      Date.now() - GITHUB_REPO_CARD_CACHE_MS - 1
    );

    expect(githubStatsCache.readRepoCard()).toBeNull();
  });

  it('saves and reads badge stats', () => {
    githubStatsCache.saveBadge({ stars: 8, forks: 1 }, Date.now());

    expect(githubStatsCache.readBadge()).toEqual({ stars: 8, forks: 1 });
  });

  it('expires stale badge stats', () => {
    githubStatsCache.saveBadge(
      { stars: 8, forks: 1 },
      Date.now() - GITHUB_BADGE_CACHE_MS - 1
    );

    expect(githubStatsCache.readBadge()).toBeNull();
  });

  it('ignores invalid cached stats', () => {
    localStorage.setItem(STORAGE_KEYS.githubRepoStats, JSON.stringify({ stars: 'many' }));
    localStorage.setItem(STORAGE_KEYS.githubRepoStatsTime, String(Date.now()));
    localStorage.setItem(STORAGE_KEYS.githubBadgeStats, JSON.stringify({
      data: { forks: 3 },
      timestamp: Date.now(),
    }));

    expect(githubStatsCache.readRepoCard()).toBeNull();
    expect(githubStatsCache.readBadge()).toBeNull();
  });
});
