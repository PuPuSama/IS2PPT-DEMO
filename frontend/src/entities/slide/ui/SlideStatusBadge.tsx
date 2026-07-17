import type { PageStatusDto } from '../api/pageDto';
import { useT } from '@/hooks/useT';
import { cn } from '@/utils';
import { slideStatusI18n } from './slideStatusI18n';

interface SlideStatusBadgeProps {
  status: PageStatusDto;
  labelKey?: string;
  description?: string;
}

const badgeTone: Record<PageStatusDto, string> = {
  DRAFT: 'bg-gray-100 dark:bg-background-secondary text-gray-600 dark:text-foreground-tertiary',
  GENERATING_DESCRIPTION: 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 animate-pulse',
  DESCRIPTION_GENERATED: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
  QUEUED: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 animate-pulse',
  GENERATING: 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 animate-pulse',
  COMPLETED: 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400',
  FAILED: 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400',
};

const defaultLabelKey: Record<PageStatusDto, string> = {
  DRAFT: 'status.draft',
  GENERATING_DESCRIPTION: 'status.generatingDescription',
  DESCRIPTION_GENERATED: 'status.descriptionGenerated',
  QUEUED: 'status.queued',
  GENERATING: 'status.generating',
  COMPLETED: 'status.completed',
  FAILED: 'status.failed',
};

export const SlideStatusBadge = ({
  status,
  labelKey = defaultLabelKey[status],
  description,
}: SlideStatusBadgeProps) => {
  const t = useT(slideStatusI18n);

  return (
    <span
      data-testid="status-badge"
      data-status={status}
      className={cn(
        'inline-flex items-center rounded px-2.5 py-0.5 text-xs font-medium',
        badgeTone[status],
      )}
      title={description}
    >
      {t(labelKey)}
    </span>
  );
};
