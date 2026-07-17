import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { checkAccessCode, verifyAccessCode } from '@/api/accessCodeApi';
import { useT } from '@/hooks/useT';
import { accessCodeSession } from '@/shared/auth/accessCodeSession';
import { Button, Input } from '@/shared/ui';

const accessGateI18n = {
  zh: {
    title: '请输入访问口令',
    placeholder: '输入口令',
    submit: '确认',
    error: '口令错误，请重试',
    networkError: '网络错误，请稍后重试',
    connectError: '无法连接到后端服务',
    connectHint: '请检查后端服务是否正常运行',
    retry: '重试',
  },
  en: {
    title: 'Enter Access Code',
    placeholder: 'Enter code',
    submit: 'Submit',
    error: 'Invalid code, please try again',
    networkError: 'Network error, please try later',
    connectError: 'Cannot connect to backend service',
    connectHint: 'Please check if the backend service is running',
    retry: 'Retry',
  },
};

type AccessGateState = 'checking' | 'challenge' | 'granted' | 'offline';

export function AccessGate({ children }: { children: ReactNode }) {
  const t = useT(accessGateI18n);
  const [gateState, setGateState] = useState<AccessGateState>('checking');
  const [candidateCode, setCandidateCode] = useState('');
  const [feedback, setFeedback] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const resolveAccess = useCallback(async () => {
    setGateState('checking');
    try {
      const policy = await checkAccessCode();
      if (policy.data?.enabled !== true) {
        setGateState('granted');
        return;
      }

      const savedCode = accessCodeSession.get();
      if (savedCode) {
        const verification = await verifyAccessCode(savedCode);
        if (verification.data?.valid) {
          setGateState('granted');
          return;
        }
        accessCodeSession.clear();
      }

      setGateState('challenge');
    } catch {
      accessCodeSession.clear();
      setGateState('offline');
    }
  }, []);

  useEffect(() => {
    void resolveAccess();
  }, [resolveAccess]);

  const submitCode = async () => {
    const normalizedCode = candidateCode.trim();
    if (!normalizedCode) return;

    setSubmitting(true);
    setFeedback('');
    try {
      const verification = await verifyAccessCode(normalizedCode);
      if (verification.data?.valid) {
        accessCodeSession.save(normalizedCode);
        setGateState('granted');
      } else {
        setFeedback(t('error'));
      }
    } catch (error: unknown) {
      const responseStatus = (error as { response?: { status?: number } })?.response?.status;
      setFeedback(responseStatus === 403 ? t('error') : t('networkError'));
    } finally {
      setSubmitting(false);
    }
  };

  if (gateState === 'checking') return null;
  if (gateState === 'granted') return <>{children}</>;

  if (gateState === 'offline') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background-primary">
        <div className="w-80 p-6 rounded-lg bg-white dark:bg-background-secondary shadow-lg border border-gray-200 dark:border-border-primary text-center">
          <p className="text-gray-600 dark:text-foreground-secondary mb-1">{t('connectError')}</p>
          <p className="text-sm text-gray-400 dark:text-foreground-tertiary mb-4">{t('connectHint')}</p>
          <Button className="w-full" onClick={() => void resolveAccess()}>{t('retry')}</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background-primary">
      <div className="w-80 p-6 rounded-lg bg-white dark:bg-background-secondary shadow-lg border border-gray-200 dark:border-border-primary">
        <h2 className="text-lg font-semibold text-center mb-4 text-gray-900 dark:text-foreground-primary">
          {t('title')}
        </h2>
        <form onSubmit={(event) => { event.preventDefault(); void submitCode(); }} className="space-y-4">
          <Input
            type="password"
            placeholder={t('placeholder')}
            value={candidateCode}
            onChange={(event) => setCandidateCode(event.target.value)}
            error={feedback}
            autoFocus
          />
          <Button type="submit" className="w-full" loading={submitting}>
            {t('submit')}
          </Button>
        </form>
      </div>
    </div>
  );
}
