import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Home, ArrowUp } from 'lucide-react';
import { useT } from '@/hooks/useT';
import { settingsI18n } from '@/config/settingsI18n';
import { Button } from '@/components/shared/Button';
import { Card } from '@/components/shared/Card';
import { SettingsWorkspace } from '@/components/settings/SettingsWorkspace';

const SCROLL_SHOW_THRESHOLD = 300;

export const SettingsPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const t = useT(settingsI18n);
  const [showTop, setShowTop] = useState(false);
  const hasInAppBackHistory = typeof window !== 'undefined' && typeof window.history.state?.idx === 'number'
    ? window.history.state.idx > 0
    : false;
  const canNavigateBack = hasInAppBackHistory || Boolean((location.state as { from?: string } | null)?.from);

  const handleBack = () => {
    if (canNavigateBack) {
      navigate(-1);
      return;
    }
    navigate('/');
  };

  useEffect(() => {
    const onScroll = () => setShowTop(window.scrollY > SCROLL_SHOW_THRESHOLD);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-50 dark:from-background-primary to-yellow-50 dark:to-background-primary">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Card className="p-6 md:p-8">
          <div className="space-y-8">
            <div className="flex items-center justify-between pb-6 border-b border-gray-200 dark:border-border-primary">
              <div className="flex items-center">
                <Button
                  variant="secondary"
                  icon={<Home size={18} />}
                  onClick={handleBack}
                  className="mr-4"
                >
                  {t('nav.backToHome')}
                </Button>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-foreground-primary">{t('settings.title')}</h1>
                  <p className="text-sm text-gray-500 dark:text-foreground-tertiary mt-1">
                    {t('settings.subtitle')}
                  </p>
                </div>
              </div>
            </div>

            <SettingsWorkspace />
          </div>
        </Card>
      </div>

      {showTop && (
        <button
          data-testid="back-to-top-button"
          aria-label="Back to top"
          title="Back to top"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="fixed bottom-6 right-6 p-3 rounded-full bg-brand-500 text-white shadow-lg hover:bg-brand-600 transition-all z-50"
        >
          <ArrowUp size={20} />
        </button>
      )}
    </div>
  );
};
