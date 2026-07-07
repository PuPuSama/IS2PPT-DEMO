import { BrowserRouter } from 'react-router-dom';

import { AccessCodeGuard, useToast } from '@/components/shared';

import { AppRoutes } from './routes';
import { useGlobalErrorToast } from './useGlobalErrorToast';
import { useResumeProjectSession } from './useResumeProjectSession';

export const AppShell = () => {
  const { show, ToastContainer } = useToast();

  useResumeProjectSession();
  useGlobalErrorToast(show);

  return (
    <AccessCodeGuard>
      <BrowserRouter>
        <AppRoutes />
        <ToastContainer />
      </BrowserRouter>
    </AccessCodeGuard>
  );
};