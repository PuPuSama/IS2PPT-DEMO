import { BrowserRouter } from 'react-router-dom';

import { useToast } from '@/shared/ui';

import { AccessGate } from './AccessGate';
import { AppRoutes } from './routes';
import { useGlobalErrorToast } from './useGlobalErrorToast';
import { useResumeProjectSession } from './useResumeProjectSession';

export const AppShell = () => {
  const { show, ToastContainer } = useToast();

  useResumeProjectSession();
  useGlobalErrorToast(show);

  return (
    <AccessGate>
      <BrowserRouter>
        <AppRoutes />
        <ToastContainer />
      </BrowserRouter>
    </AccessGate>
  );
};
