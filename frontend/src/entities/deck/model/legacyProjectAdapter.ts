import type { Project } from '@/types';
import type { ProjectDto } from '../api/projectDto';
import { pageDtoToLegacyPage } from '@/entities/slide/model/legacyPageAdapter';

export const projectDtoToLegacyProject = (project: ProjectDto): Project => ({
  ...project,
  id: project.project_id || project.id,
  template_image_path: project.template_image_url || project.template_image_path,
  pages: (project.pages || []).map(pageDtoToLegacyPage),
});
