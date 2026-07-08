import * as api from '@/api/endpoints';
import type { useT } from '@/hooks/useT';
import type { SettingsServiceTestItem } from '@/types/settingsPage';

type SettingsTranslator = ReturnType<typeof useT>;

export const createSettingsServiceTests = (t: SettingsTranslator): SettingsServiceTestItem[] => [
  {
    key: 'baidu-ocr',
    titleKey: 'settings.serviceTest.tests.baiduOcr.title',
    descriptionKey: 'settings.serviceTest.tests.baiduOcr.description',
    action: api.testBaiduOcr,
    formatDetail: (data: any) => (
      data?.recognized_text
        ? t('settings.serviceTest.results.recognizedText', { text: data.recognized_text })
        : ''
    ),
  },
  {
    key: 'text-model',
    titleKey: 'settings.serviceTest.tests.textModel.title',
    descriptionKey: 'settings.serviceTest.tests.textModel.description',
    action: api.testTextModel,
    formatDetail: (data: any) => (
      data?.reply ? t('settings.serviceTest.results.modelReply', { reply: data.reply }) : ''
    ),
  },
  {
    key: 'caption-model',
    titleKey: 'settings.serviceTest.tests.captionModel.title',
    descriptionKey: 'settings.serviceTest.tests.captionModel.description',
    action: api.testCaptionModel,
    formatDetail: (data: any) => (
      data?.caption ? t('settings.serviceTest.results.captionDesc', { caption: data.caption }) : ''
    ),
  },
  {
    key: 'baidu-inpaint',
    titleKey: 'settings.serviceTest.tests.baiduInpaint.title',
    descriptionKey: 'settings.serviceTest.tests.baiduInpaint.description',
    action: api.testBaiduInpaint,
    formatDetail: (data: any) => (
      data?.image_size
        ? t('settings.serviceTest.results.imageSize', { width: data.image_size[0], height: data.image_size[1] })
        : ''
    ),
  },
  {
    key: 'image-model',
    titleKey: 'settings.serviceTest.tests.imageModel.title',
    descriptionKey: 'settings.serviceTest.tests.imageModel.description',
    action: api.testImageModel,
    formatDetail: (data: any) => (
      data?.image_size
        ? t('settings.serviceTest.results.imageSize', { width: data.image_size[0], height: data.image_size[1] })
        : ''
    ),
  },
  {
    key: 'mineru-pdf',
    titleKey: 'settings.serviceTest.tests.mineruPdf.title',
    descriptionKey: 'settings.serviceTest.tests.mineruPdf.description',
    action: api.testMineruPdf,
    formatDetail: (data: any) => (
      data?.content_preview
        ? t('settings.serviceTest.results.parsePreview', { preview: data.content_preview })
        : data?.message || ''
    ),
  },
];
