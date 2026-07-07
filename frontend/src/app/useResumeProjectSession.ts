import { useEffect } from 'react';

import { STORAGE_KEYS } from '@/shared/storage/storageKeys';
import { useProjectStore } from '@/store/useProjectStore';

export const useResumeProjectSession = () => {
  const currentProject = useProjectStore((state) => state.currentProject);
  const syncProject = useProjectStore((state) => state.syncProject);

  useEffect(() => {
    const savedProjectId = localStorage.getItem(STORAGE_KEYS.currentProjectId);
    if (savedProjectId && !currentProject) {
      syncProject();
    }
  }, [currentProject, syncProject]);
};