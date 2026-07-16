import React from 'react';
import { Check, CheckSquare, Sparkles, Square } from 'lucide-react';
import { Button } from '@/components/shared';
import { SlideCard as LegacySlideCard } from '@/components/preview/SlideCard';
import { previewI18n } from '@/config/slidePreviewI18n';
import { useT } from '@/hooks/useT';
import { getImageUrl } from '@/api/client';
import type { Page as LegacySlide } from '@/types';

interface SlideNavigatorProps {
  slides: LegacySlide[];
  selectedIndex: number;
  selectedSlideIds: Set<string>;
  multiSelectEnabled: boolean;
  jobsBySlideId: Record<string, string>;
  aspectRatio: string;
  onGenerate: () => void;
  onToggleMultiSelect: () => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onToggleSlide: (slideId: string) => void;
  onSelectSlide: (index: number) => void;
  onEditSlide: (index: number) => void;
  onDeleteSlide: (slideId: string) => void;
}

export const SlideNavigator: React.FC<SlideNavigatorProps> = ({
  slides,
  selectedIndex,
  selectedSlideIds,
  multiSelectEnabled,
  jobsBySlideId,
  aspectRatio,
  onGenerate,
  onToggleMultiSelect,
  onSelectAll,
  onClearSelection,
  onToggleSlide,
  onSelectSlide,
  onEditSlide,
  onDeleteSlide,
}) => {
  const t = useT(previewI18n);
  const selectableSlides = slides.filter((slide) => slide.id && slide.generated_image_path);
  const allSelected = selectedSlideIds.size === selectableSlides.length;

  const handleSlideClick = (slide: LegacySlide, index: number) => {
    if (multiSelectEnabled && slide.id && slide.generated_image_path) {
      onToggleSlide(slide.id);
      return;
    }
    onSelectSlide(index);
  };

  return (
    <aside className="w-full md:w-80 bg-white dark:bg-background-secondary border-b md:border-b-0 md:border-r border-gray-200 dark:border-border-primary flex flex-col flex-shrink-0 min-h-0">
      <div className="p-3 md:p-4 border-b border-gray-200 dark:border-border-primary flex-shrink-0 space-y-2 md:space-y-3 md:sticky md:top-0 md:z-10">
        <Button
          variant="primary"
          icon={<Sparkles size={16} className="md:w-[18px] md:h-[18px]" />}
          onClick={onGenerate}
          className="w-full text-sm md:text-base"
          disabled={multiSelectEnabled && selectedSlideIds.size === 0}
        >
          {multiSelectEnabled && selectedSlideIds.size > 0
            ? t('preview.generateSelected', { count: selectedSlideIds.size })
            : t('preview.batchGenerate', { count: slides.length })}
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto md:overflow-y-auto overflow-x-auto md:overflow-x-visible p-3 md:p-4 min-h-0">
        <div className="flex items-center gap-2 text-xs mb-3 md:sticky md:top-0 md:z-10 md:pb-3">
          <button
            type="button"
            onClick={onToggleMultiSelect}
            className={`px-2 py-1 rounded transition-colors flex items-center gap-1 ${
              multiSelectEnabled
                ? 'bg-brand-100 dark:bg-brand-500/20 text-brand-700 dark:text-brand-300 hover:bg-brand-200 dark:hover:bg-brand-500/30'
                : 'text-gray-500 dark:text-foreground-tertiary hover:bg-gray-100 dark:hover:bg-background-hover'
            }`}
          >
            {multiSelectEnabled ? <CheckSquare size={14} /> : <Square size={14} />}
            <span>{multiSelectEnabled ? t('preview.cancelMultiSelect') : t('preview.multiSelect')}</span>
          </button>
          {multiSelectEnabled && (
            <>
              <button
                type="button"
                onClick={allSelected ? onClearSelection : onSelectAll}
                className="text-gray-500 dark:text-foreground-tertiary hover:text-brand-600 dark:hover:text-brand-300 transition-colors"
              >
                {allSelected ? t('common.deselectAll') : t('common.selectAll')}
              </button>
              {selectedSlideIds.size > 0 && (
                <span className="text-brand-600 font-medium">
                  ({selectedSlideIds.size}{t('preview.pagesUnit')})
                </span>
              )}
            </>
          )}
        </div>

        <div className="flex md:flex-col gap-2 md:gap-4 min-w-max md:min-w-0">
          {slides.map((slide, index) => (
            <div key={slide.id || `slide-${index}`} className="md:w-full flex-shrink-0 relative">
              <div className="md:hidden relative">
                <button
                  type="button"
                  onClick={() => handleSlideClick(slide, index)}
                  className={`w-20 h-14 rounded border-2 transition-all ${
                    selectedIndex === index
                      ? 'border-brand-500 shadow-md'
                      : 'border-gray-200 dark:border-border-primary'
                  } ${multiSelectEnabled && slide.id && selectedSlideIds.has(slide.id) ? 'ring-2 ring-brand-400' : ''}`}
                >
                  {slide.generated_image_path ? (
                    <img
                      src={getImageUrl(slide.generated_image_path, slide.updated_at)}
                      alt={`Slide ${index + 1}`}
                      className="w-full h-full object-cover rounded"
                    />
                  ) : (
                    <div className="w-full h-full bg-gray-100 dark:bg-background-secondary rounded flex items-center justify-center text-xs text-gray-400">
                      {index + 1}
                    </div>
                  )}
                </button>
                {multiSelectEnabled && slide.id && slide.generated_image_path && (
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      onToggleSlide(slide.id!);
                    }}
                    className={`absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center transition-all ${
                      selectedSlideIds.has(slide.id)
                        ? 'bg-brand-500 text-white'
                        : 'bg-white dark:bg-background-secondary border-2 border-gray-300 dark:border-border-primary'
                    }`}
                  >
                    {selectedSlideIds.has(slide.id) && <Check size={12} />}
                  </button>
                )}
              </div>

              <div className="hidden md:block relative">
                {multiSelectEnabled && slide.id && slide.generated_image_path && (
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      onToggleSlide(slide.id!);
                    }}
                    className={`absolute top-2 left-2 z-10 w-6 h-6 rounded flex items-center justify-center transition-all ${
                      selectedSlideIds.has(slide.id)
                        ? 'bg-brand-500 text-white shadow-md'
                        : 'bg-white/90 border-2 border-gray-300 dark:border-border-primary hover:border-brand-400'
                    }`}
                  >
                    {selectedSlideIds.has(slide.id) && <Check size={14} />}
                  </button>
                )}
                <LegacySlideCard
                  page={slide}
                  index={index}
                  isSelected={selectedIndex === index}
                  onClick={() => handleSlideClick(slide, index)}
                  onEdit={() => onEditSlide(index)}
                  onDelete={() => { if (slide.id) onDeleteSlide(slide.id); }}
                  isGenerating={slide.id ? Boolean(jobsBySlideId[slide.id]) : false}
                  aspectRatio={aspectRatio}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
};
