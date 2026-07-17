import {
  getSlideStatusView,
  type SlideStatusScope,
  type SlideStatusSource,
} from '../model/slideStatus';
import { useT } from '@/hooks/useT';
import { SlideStatusBadge } from './SlideStatusBadge';
import { slideStatusI18n } from './slideStatusI18n';

type ContextualSlideStatusBadgeProps = {
  showDescription?: boolean;
} & (
  | {
      slide: SlideStatusSource;
      scope?: SlideStatusScope;
      page?: never;
      context?: never;
    }
  | {
      page: SlideStatusSource;
      context?: SlideStatusScope;
      slide?: never;
      scope?: never;
    }
);

export const ContextualSlideStatusBadge = (props: ContextualSlideStatusBadgeProps) => {
  const t = useT(slideStatusI18n);
  const source = props.slide ?? props.page;
  if (!source) return null;

  const scope = ('slide' in props ? props.scope : props.context) ?? 'full';
  const view = getSlideStatusView(source, scope);

  return (
    <SlideStatusBadge
      status={view.status}
      labelKey={view.labelKey}
      description={props.showDescription !== false ? t(view.descriptionKey) : undefined}
    />
  );
};
