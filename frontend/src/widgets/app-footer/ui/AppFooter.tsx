import { Github } from 'lucide-react';
import { APP_IDENTITY } from '@/shared/config/appIdentity';

export const AppFooter = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="relative mt-auto w-full px-4 py-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-6 text-sm text-gray-500 dark:text-foreground-tertiary">
          <div className="flex items-center gap-1.5">
            <span>© {currentYear}</span>
            <span className="font-semibold text-gray-700 dark:text-foreground-secondary">
              {APP_IDENTITY.displayName}
            </span>
          </div>

          <span className="hidden sm:inline text-gray-300 dark:text-border-primary">·</span>

          <a
            href={APP_IDENTITY.repositoryUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 hover:text-gray-700 dark:hover:text-foreground-secondary"
          >
            <Github size={16} />
            <span>GitHub</span>
          </a>
        </div>
      </div>
    </footer>
  );
};
