import React from 'react';
import { ChevronLeft, ChevronRight, ImageOff, RefreshCw, Upload } from 'lucide-react';
import { Button } from '@/shared/ui';
import InlineSvgImage from '@/components/preview/InlineSvgImage';
import { previewI18n } from '@/config/slidePreviewI18n';
import { useT } from '@/hooks/useT';
import { getImageUrl } from '@/api/client';
import type { ImageVersion, Page as LegacySlide } from '@/types';

interface SlideCanvasProps {
  slides: LegacySlide[];
  selectedIndex: number;
  jobsBySlideId: Record<string, string>;
  aspectRatioStyle: string;
  imageVersions: ImageVersion[];
  versionMenuOpen: boolean;
  refreshing: boolean;
  onBackToPlan: () => void;
  onSelectSlide: (index: number) => void;
  onGenerateSlide: () => void;
  onOpenTemplate: () => void;
  onRefresh: () => void;
  onToggleVersionMenu: () => void;
  onSwitchVersion: (versionId: string) => void;
  onEditSlide: () => void;
  onRegenerateSlide: () => void;
}

export const SlideCanvas: React.FC<SlideCanvasProps> = ({
  slides,
  selectedIndex,
  jobsBySlideId,
  aspectRatioStyle,
  imageVersions,
  versionMenuOpen,
  refreshing,
  onBackToPlan,
  onSelectSlide,
  onGenerateSlide,
  onOpenTemplate,
  onRefresh,
  onToggleVersionMenu,
  onSwitchVersion,
  onEditSlide,
  onRegenerateSlide,
}) => {
  const t = useT(previewI18n);
  const selectedSlide = slides[selectedIndex];
  const imageUrl = selectedSlide?.generated_image_path
    ? getImageUrl(selectedSlide.generated_image_path, selectedSlide.updated_at)
    : '';
  const slideGenerating = Boolean(selectedSlide?.id && jobsBySlideId[selectedSlide.id]);

  if (slides.length === 0) {
    return (
      <main className="flex-1 flex flex-col bg-gradient-to-br from-brand-50 dark:from-background-primary via-white dark:via-background-primary to-gray-50 dark:to-background-primary min-w-0 overflow-hidden">
        <div className="flex-1 flex items-center justify-center overflow-y-auto">
          <div className="text-center">
            <div className="text-4xl md:text-6xl mb-4">📊</div>
            <h3 className="text-lg md:text-xl font-semibold text-gray-700 dark:text-foreground-secondary mb-2">
              {t('preview.noPages')}
            </h3>
            <p className="text-sm md:text-base text-gray-500 dark:text-foreground-tertiary mb-6">
              {t('preview.noPagesHint')}
            </p>
            <Button variant="primary" onClick={onBackToPlan} className="text-sm md:text-base">
              {t('preview.backToEdit')}
            </Button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 flex flex-col bg-gradient-to-br from-brand-50 dark:from-background-primary via-white dark:via-background-primary to-gray-50 dark:to-background-primary min-w-0 overflow-hidden">
      <div className="flex-1 overflow-y-auto min-h-0 flex items-center justify-center p-4 md:p-8">
        <div className="max-w-5xl w-full">
          <div className="relative bg-white dark:bg-background-secondary rounded-lg shadow-xl overflow-hidden touch-manipulation" style={{ aspectRatio: aspectRatioStyle }}>
            {selectedSlide?.generated_image_path ? (
              selectedSlide.generated_svg_url ? (
                <InlineSvgImage
                  svgUrl={selectedSlide.generated_svg_url}
                  fallbackUrl={selectedSlide.generated_image_path}
                  alt={`Slide ${selectedIndex + 1}`}
                  updatedAt={selectedSlide.updated_at}
                  className="w-full h-full object-contain select-none"
                />
              ) : (
                <img
                  src={imageUrl}
                  alt={`Slide ${selectedIndex + 1}`}
                  className="w-full h-full object-cover select-none"
                  draggable={false}
                />
              )
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gray-100 dark:bg-background-secondary">
                <div className="text-center">
                  <ImageOff size={56} className="mx-auto mb-4 text-gray-400" />
                  <p className="text-gray-500 dark:text-foreground-tertiary mb-4">
                    {selectedSlide?.status === 'QUEUED'
                      ? t('preview.queued')
                      : slideGenerating || selectedSlide?.status === 'GENERATING'
                        ? t('preview.generating')
                        : t('preview.notGenerated')}
                  </p>
                  {!slideGenerating
                    && selectedSlide?.status !== 'QUEUED'
                    && selectedSlide?.status !== 'GENERATING' && (
                      <Button variant="primary" onClick={onGenerateSlide}>
                        {t('preview.generateThisPage')}
                      </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-background-secondary border-t border-gray-200 dark:border-border-primary px-3 md:px-6 py-3 md:py-4 flex-shrink-0">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 max-w-5xl mx-auto">
          <div className="flex items-center gap-2 w-full sm:w-auto justify-center">
            <Button
              variant="ghost"
              size="sm"
              icon={<ChevronLeft size={16} className="md:w-[18px] md:h-[18px]" />}
              onClick={() => onSelectSlide(Math.max(0, selectedIndex - 1))}
              disabled={selectedIndex === 0}
              className="text-xs md:text-sm"
            >
              {t('preview.prevPage')}
            </Button>
            <span className="px-2 md:px-4 text-xs md:text-sm text-gray-600 dark:text-foreground-tertiary whitespace-nowrap">
              {selectedIndex + 1} / {slides.length}
            </span>
            <Button
              variant="ghost"
              size="sm"
              icon={<ChevronRight size={16} className="md:w-[18px] md:h-[18px]" />}
              onClick={() => onSelectSlide(Math.min(slides.length - 1, selectedIndex + 1))}
              disabled={selectedIndex === slides.length - 1}
              className="text-xs md:text-sm"
            >
              {t('preview.nextPage')}
            </Button>
          </div>

          <div className="flex items-center gap-1.5 md:gap-2 w-full sm:w-auto justify-center">
            <Button
              variant="ghost"
              size="sm"
              icon={<Upload size={16} />}
              onClick={onOpenTemplate}
              className="lg:hidden text-xs"
              title={t('preview.changeTemplate')}
            />
            <Button
              variant="ghost"
              size="sm"
              icon={<RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />}
              onClick={onRefresh}
              disabled={refreshing}
              className="md:hidden text-xs"
              title={t('preview.refresh')}
            />
            {imageVersions.length > 1 && (
              <div className="relative">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onToggleVersionMenu}
                  className="text-xs md:text-sm"
                >
                  <span className="hidden md:inline">{t('preview.historyVersions')} ({imageVersions.length})</span>
                  <span className="md:hidden">{t('preview.versions')}</span>
                </Button>
                {versionMenuOpen && (
                  <div className="absolute right-0 bottom-full mb-2 w-56 md:w-64 bg-white dark:bg-background-secondary rounded-lg shadow-lg border border-gray-200 dark:border-border-primary py-2 z-20 max-h-96 overflow-y-auto">
                    {imageVersions.map((version) => (
                      <button
                        type="button"
                        key={version.version_id}
                        onClick={() => onSwitchVersion(version.version_id)}
                        className={`w-full px-3 md:px-4 py-2 text-left hover:bg-gray-50 dark:hover:bg-background-hover transition-colors flex items-center justify-between text-xs md:text-sm ${
                          version.is_current ? 'bg-brand-50 dark:bg-background-secondary' : ''
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span>{t('preview.version')} {version.version_number}</span>
                          {version.is_current && (
                            <span className="text-xs text-brand-600 font-medium">({t('preview.current')})</span>
                          )}
                        </div>
                        <span className="text-xs text-gray-400 hidden md:inline">
                          {version.created_at
                            ? new Date(version.created_at).toLocaleString('zh-CN', {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : ''}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            <Button
              variant="secondary"
              size="sm"
              onClick={onEditSlide}
              disabled={!selectedSlide}
              className="text-xs md:text-sm flex-1 sm:flex-initial"
            >
              {t('common.edit')}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onRegenerateSlide}
              disabled={slideGenerating}
              className="text-xs md:text-sm flex-1 sm:flex-initial"
            >
              {slideGenerating ? t('preview.regenerating') : t('preview.regenerate')}
            </Button>
          </div>
        </div>
      </div>
    </main>
  );
};
