import type { Page } from '@/types';
import type { PageDto } from '../api/pageDto';

export const pageDtoToLegacyPage = (page: PageDto): Page => ({
  ...page,
  id: page.page_id || page.id,
  generated_image_path: page.generated_image_url || page.generated_image_path,
});
