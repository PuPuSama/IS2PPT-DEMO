import { useEffect } from 'react';

import { projectSession } from '@/shared/storage/projectSession';
import { useProjectStore } from '@/store/useProjectStore';

export const useResumeProjectSession = () => {
  const currentProject = useProjectStore((state) => state.currentProject);
  const syncProject = useProjectStore((state) => state.syncProject);

  useEffect(() => {
    const savedProjectId = projectSession.getActiveProjectId();
    if (savedProjectId && !currentProject) {
      syncProject();
    }
  }, [currentProject, syncProject]);
};
