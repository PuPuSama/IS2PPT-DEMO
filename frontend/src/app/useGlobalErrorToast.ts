import { useEffect } from 'react';

import { useToast } from '@/components/shared';
import { useProjectStore } from '@/store/useProjectStore';

type ShowToast = ReturnType<typeof useToast>['show'];

export const useGlobalErrorToast = (show: ShowToast) => {
  const error = useProjectStore((state) => state.error);
  const setError = useProjectStore((state) => state.setError);

  useEffect(() => {
    if (!error) return;

    show({ message: error, type: 'error' });
    setError(null);
  }, [error, setError, show]);
};