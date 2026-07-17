import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  Palette,
  Settings,
  Sparkles,
} from 'lucide-react';
import { Button, Modal } from '@/shared/ui';
import { APP_IDENTITY } from '@/shared/config/appIdentity';
import { useT } from '@/hooks/useT';

const creationGuideI18n = {
  zh: {
    guide: {
      setupTitle: '开始前的配置',
      setupSubtitle: '确认模型服务可用，再进入创作流程',
      workflowTitle: '从内容到演示文稿',
      workflowSubtitle: '按你的素材完整度选择合适的起点',
      providerTitle: '连接 AI 服务',
      providerBody: '在设置中填写文本与图像模型的服务地址、密钥和模型名称。',
      verifyTitle: '验证服务状态',
      verifyBody: '保存配置后运行连接测试，避免在长任务中途发现服务不可用。',
      readyTitle: '开始创建',
      readyBody: '返回创建页，输入主题、已有大纲或逐页描述。',
      ideaTitle: '只有一个主题',
      ideaBody: '从一句话生成演示结构，再逐步完善每页内容。',
      outlineTitle: '已经有大纲',
      outlineBody: '保留已有章节结构，让 AI 补齐每页描述和视觉建议。',
      sourceTitle: '已有文档或 PPT',
      sourceBody: '上传参考资料或源演示文稿，提取内容后重新组织。',
      finishTitle: '生成、调整与导出',
      finishBody: '逐页检查结果，按需重绘，然后导出 PPTX、PDF 或图片。',
      settingsAction: '打开设置',
      previous: '上一步',
      next: '下一步',
    },
  },
  en: {
    guide: {
      setupTitle: 'Configure Before Creating',
      setupSubtitle: 'Verify model services before starting a generation run',
      workflowTitle: 'From Content to Presentation',
      workflowSubtitle: 'Choose the right starting point for the material you have',
      providerTitle: 'Connect AI Services',
      providerBody: 'Configure endpoints, credentials, and model names for text and image generation.',
      verifyTitle: 'Verify Service Health',
      verifyBody: 'Save settings and run connection tests before starting a long task.',
      readyTitle: 'Start Creating',
      readyBody: 'Return to creation and provide a topic, an outline, or slide-by-slide descriptions.',
      ideaTitle: 'Start with a Topic',
      ideaBody: 'Generate a presentation structure from one sentence, then refine each slide.',
      outlineTitle: 'Bring an Outline',
      outlineBody: 'Keep your section structure while AI fills in slide descriptions and visual direction.',
      sourceTitle: 'Bring Documents or a Deck',
      sourceBody: 'Upload references or a source presentation, extract its content, and reorganize it.',
      finishTitle: 'Generate, Refine, Export',
      finishBody: 'Review each slide, rerender where needed, then export PPTX, PDF, or images.',
      settingsAction: 'Open Settings',
      previous: 'Previous',
      next: 'Next',
    },
  },
};

interface CreationGuideDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

interface GuideItem {
  icon: ReactNode;
  titleKey: string;
  bodyKey: string;
}

const setupItems: GuideItem[] = [
  { icon: <Settings size={20} />, titleKey: 'guide.providerTitle', bodyKey: 'guide.providerBody' },
  { icon: <CheckCircle size={20} />, titleKey: 'guide.verifyTitle', bodyKey: 'guide.verifyBody' },
  { icon: <Sparkles size={20} />, titleKey: 'guide.readyTitle', bodyKey: 'guide.readyBody' },
];

const workflowItems: GuideItem[] = [
  { icon: <Sparkles size={20} />, titleKey: 'guide.ideaTitle', bodyKey: 'guide.ideaBody' },
  { icon: <FileText size={20} />, titleKey: 'guide.outlineTitle', bodyKey: 'guide.outlineBody' },
  { icon: <Palette size={20} />, titleKey: 'guide.sourceTitle', bodyKey: 'guide.sourceBody' },
  { icon: <Download size={20} />, titleKey: 'guide.finishTitle', bodyKey: 'guide.finishBody' },
];

export const CreationGuideDialog = ({ isOpen, onClose }: CreationGuideDialogProps) => {
  const t = useT(creationGuideI18n);
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const workflowStep = step === 1;
  const items = workflowStep ? workflowItems : setupItems;

  const openSettings = () => {
    onClose();
    navigate('/settings', { state: { from: window.location.pathname } });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="" size="lg">
      <div className="space-y-6">
        <header className="border-b border-gray-100 pb-4 text-center dark:border-border-primary">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-gray-100 px-3 py-1.5 dark:bg-background-primary">
            <img src="/logo.png" alt="" className="h-6 w-6 object-contain" />
            <span className="text-sm font-semibold text-gray-700 dark:text-foreground-secondary">
              {APP_IDENTITY.displayName}
            </span>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-foreground-primary">
            {t(workflowStep ? 'guide.workflowTitle' : 'guide.setupTitle')}
          </h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-foreground-tertiary">
            {t(workflowStep ? 'guide.workflowSubtitle' : 'guide.setupSubtitle')}
          </p>
        </header>

        <div className="flex justify-center gap-2" aria-label="guide progress">
          {[0, 1].map((index) => (
            <button
              key={index}
              type="button"
              aria-label={`guide step ${index + 1}`}
              onClick={() => setStep(index)}
              className={`h-2 rounded-full transition-all ${index === step ? 'w-8 bg-brand-500' : 'w-2 bg-gray-300'}`}
            />
          ))}
        </div>

        <div className="grid min-h-[320px] gap-3 sm:grid-cols-2">
          {items.map((item, index) => (
            <section
              key={item.titleKey}
              className="flex gap-3 rounded-lg border border-gray-200 p-4 dark:border-border-primary"
            >
              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-background-primary">
                {item.icon}
              </div>
              <div>
                <div className="mb-1 text-xs font-semibold text-gray-400">{index + 1}</div>
                <h3 className="font-semibold text-gray-900 dark:text-foreground-primary">{t(item.titleKey)}</h3>
                <p className="mt-1 text-sm leading-6 text-gray-600 dark:text-foreground-tertiary">{t(item.bodyKey)}</p>
              </div>
            </section>
          ))}
        </div>

        <footer className="flex items-center justify-between border-t border-gray-100 pt-4 dark:border-border-primary">
          <div>
            {workflowStep && (
              <Button variant="ghost" size="sm" icon={<ChevronLeft size={16} />} onClick={() => setStep(0)}>
                {t('guide.previous')}
              </Button>
            )}
          </div>
          {!workflowStep ? (
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" icon={<Settings size={16} />} onClick={openSettings}>
                {t('guide.settingsAction')}
              </Button>
              <Button size="sm" icon={<ChevronRight size={16} />} onClick={() => setStep(1)}>
                {t('guide.next')}
              </Button>
            </div>
          ) : (
            <Button variant="secondary" size="sm" onClick={onClose}>{t('common.close')}</Button>
          )}
        </footer>
      </div>
    </Modal>
  );
};
