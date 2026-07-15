import type { PageDto } from '@/entities/slide/api/pageDto';

export type ProjectStatusDto =
  | 'DRAFT'
  | 'OUTLINE_GENERATED'
  | 'DESCRIPTIONS_GENERATED'
  | 'COMPLETED';

export type SvgReasoningEffortDto = 'low' | 'medium' | 'high' | 'xhigh';

export interface ProjectDto {
  project_id: string;
  id?: string;
  project_title?: string;
  idea_prompt: string;
  outline_text?: string;
  description_text?: string;
  extra_requirements?: string;
  outline_requirements?: string;
  enable_web_research?: boolean;
  description_requirements?: string;
  creation_type?: string;
  template_image_url?: string;
  template_image_path?: string;
  template_style?: string;
  export_allow_partial?: boolean;
  image_aspect_ratio?: string;
  generation_mode?: 'image' | 'svg';
  svg_reasoning_effort?: SvgReasoningEffortDto;
  status: ProjectStatusDto;
  pages: PageDto[];
  created_at: string;
  updated_at: string;
}

export type ProjectUpdateDto = Partial<
  Omit<ProjectDto, 'project_id' | 'id' | 'pages' | 'created_at' | 'updated_at'>
> & {
  pages_order?: string[];
};
