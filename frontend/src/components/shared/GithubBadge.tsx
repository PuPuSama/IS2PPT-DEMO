import React, { useEffect, useState } from 'react';
import { Github, Star, GitFork } from 'lucide-react';
import { APP_IDENTITY, getRepositoryApiUrl } from '@/shared/config/appIdentity';
import { githubStatsCache, type GithubStats } from '@/shared/storage/githubStatsCache';

export const GithubBadge: React.FC = () => {
  const [stats, setStats] = useState<GithubStats>({
    stars: 0,
    forks: 0,
  });

  useEffect(() => {
    const fetchStats = async () => {
      const cachedStats = githubStatsCache.readBadge();
      if (cachedStats) {
        setStats(cachedStats);
        return;
      }

      // Fetch from API
      try {
        const res = await fetch(getRepositoryApiUrl());
        if (!res.ok) throw new Error('Failed to fetch repo info');
        const data = await res.json();

        const newStats = {
          stars: data.stargazers_count,
          forks: data.forks_count,
        };

        setStats(newStats);
        githubStatsCache.saveBadge(newStats);
      } catch (error) {
        console.error('Error fetching GitHub stats:', error);
      }
    };

    fetchStats();
  }, []);

  const formatCount = (count: number) => {
    if (count >= 1000) {
      return (count / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
    }
    return count.toString();
  };

  return (
    <a
      href={APP_IDENTITY.repositoryUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="hidden sm:flex items-center gap-2 px-2 py-1 rounded-md"
      title="View on GitHub"
    >
      {/* 左侧：GitHub Logo */}
      <div className="flex items-center justify-center text-gray-700 dark:text-gray-200">
        <Github size={36} />
      </div>

      {/* 右侧：上下结构 (Stars & Forks) */}
      <div className="flex flex-col text-[10px] leading-none gap-1 font-medium text-gray-600 dark:text-gray-400">
        {/* Stars */}
        <div className="flex items-center gap-1">
          <Star size={16} />
          <span>{formatCount(stats.stars)}</span>
        </div>
        
        {/* Forks */}
        <div className="flex items-center gap-1">
          <GitFork size={16} />
          <span>{formatCount(stats.forks)}</span>
        </div>
      </div>
    </a>
  );
};
