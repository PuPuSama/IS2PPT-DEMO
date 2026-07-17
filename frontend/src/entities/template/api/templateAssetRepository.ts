import { getImageUrl } from '@/api/client';
import type { UserTemplate } from '@/api/templatesApi';
import { findPresetTemplate } from '../model/templateCatalog';

const fetchImageAsset = async (url: string, filename: string): Promise<File> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load template image (${response.status})`);
  }

  const blob = await response.blob();
  const contentType = response.headers.get('content-type') || blob.type;
  if (contentType && !contentType.toLowerCase().startsWith('image/')) {
    throw new Error(`Template response is not an image (${contentType})`);
  }
  if (blob.size === 0) throw new Error('Template image is empty');

  return new File([blob], filename, {
    type: blob.type || contentType || 'image/png',
  });
};

export const loadTemplateAsset = async (
  templateId: string,
  userTemplates: UserTemplate[],
): Promise<File | null> => {
  const presetTemplate = findPresetTemplate(templateId);
  if (presetTemplate) {
    try {
      return await fetchImageAsset(
        presetTemplate.imageUrl,
        presetTemplate.imageUrl.split('/').pop() || 'template.png',
      );
    } catch (error) {
      console.error('Failed to load preset template:', error);
      return null;
    }
  }

  const userTemplate = userTemplates.find((template) =>
    template.template_id === templateId
  );
  if (!userTemplate) return null;

  try {
    return await fetchImageAsset(
      getImageUrl(userTemplate.template_image_url),
      'template.png',
    );
  } catch (error) {
    console.error('Failed to load user template:', error);
    return null;
  }
};
