export type PageStatusDto =
  | 'DRAFT'
  | 'GENERATING_DESCRIPTION'
  | 'DESCRIPTION_GENERATED'
  | 'QUEUED'
  | 'GENERATING'
  | 'COMPLETED'
  | 'FAILED';

export interface OutlineContentDto {
  title: string;
  points: string[];
}

export type DescriptionContentDto =
  | {
      text: string;
      extra_fields?: Record<string, string>;
      layout_suggestion?: string;
    }
  | {
      title: string;
      text_content: string[];
      extra_fields?: Record<string, string>;
      layout_suggestion?: string;
    };

export interface ImageVersionDto {
  version_id: string;
  page_id: string;
  image_path: string;
  image_url?: string;
  version_number: number;
  is_current: boolean;
  created_at?: string;
}

export interface PageDto {
  page_id: string;
  id?: string;
  order_index: number;
  part?: string;
  outline_content: OutlineContentDto | null;
  description_content?: DescriptionContentDto;
  generated_image_url?: string;
  generated_image_path?: string;
  generated_svg_url?: string;
  status: PageStatusDto;
  created_at?: string;
  updated_at?: string;
  image_versions?: ImageVersionDto[];
}

export type PageUpdateDto = Partial<
  Omit<PageDto, 'page_id' | 'id' | 'created_at' | 'updated_at'>
>;
