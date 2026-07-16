import React from 'react';
import { Info } from 'lucide-react';
import {
  PPTX_TRANSITION_OPTIONS,
  type PptxTransitionEffect,
} from '@/config/slideExportOptions';
import { previewI18n } from '@/config/slidePreviewI18n';
import { useT } from '@/hooks/useT';
import type { ExportRangeSnapshot } from '../model/deckWorkspaceSnapshot';

export interface PptxExportOptions {
  transitionEnabled: boolean;
  transitionEffects: PptxTransitionEffect[];
}

interface DeckExportDialogsProps {
  pptxOpen: boolean;
  editablePptxOpen: boolean;
  transitionsEnabled: boolean;
  transitionEffects: PptxTransitionEffect[];
  exportRange: ExportRangeSnapshot;
  onClosePptx: () => void;
  onCloseEditablePptx: () => void;
  onTransitionsEnabledChange: (enabled: boolean) => void;
  onTransitionEffectsChange: (effects: PptxTransitionEffect[]) => void;
  onStartPptx: (options: PptxExportOptions) => void;
  onStartEditablePptx: () => void;
}

export const DeckExportDialogs: React.FC<DeckExportDialogsProps> = ({
  pptxOpen,
  editablePptxOpen,
  transitionsEnabled,
  transitionEffects,
  exportRange,
  onClosePptx,
  onCloseEditablePptx,
  onTransitionsEnabledChange,
  onTransitionEffectsChange,
  onStartPptx,
  onStartEditablePptx,
}) => {
  const t = useT(previewI18n);
  const rangeText = exportRange.partial
    ? t('preview.editablePptxRangePages', {
        pages: exportRange.selectedSlideNumbers.join(', '),
        count: exportRange.selectedSlideNumbers.length,
      })
    : t('preview.editablePptxRangeAll', { count: exportRange.totalSlideCount });

  return (
    <>
      {pptxOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClosePptx}>
          <div className="bg-white dark:bg-background-secondary rounded-2xl shadow-xl p-6 w-full max-w-xl mx-4" onClick={(event) => event.stopPropagation()}>
            <h3 className="text-lg font-semibold">{t('preview.pptxExportTitle')}</h3>
            <p className="text-sm text-gray-500 dark:text-foreground-tertiary mt-1 mb-5">{t('preview.pptxExportSubtitle')}</p>

            <div className="space-y-4">
              <label className="flex items-start gap-3 cursor-pointer p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-background-hover">
                <input
                  type="checkbox"
                  checked={transitionsEnabled}
                  onChange={(event) => onTransitionsEnabledChange(event.target.checked)}
                  className="w-4 h-4 mt-0.5 rounded border-gray-300 text-brand-500 focus:ring-brand-500"
                />
                <div className="flex-1">
                  <div className="text-sm font-medium">{t('preview.pptxTransitionToggle')}</div>
                  <div className="text-xs text-gray-500 dark:text-foreground-tertiary mt-1">{t('preview.pptxTransitionDesc')}</div>
                </div>
              </label>

              {transitionsEnabled && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {PPTX_TRANSITION_OPTIONS.map((option) => {
                    const checked = transitionEffects.includes(option.value);
                    return (
                      <label
                        key={option.value}
                        className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm cursor-pointer transition-colors ${
                          checked
                            ? 'border-brand-400 bg-brand-50 text-brand-700 dark:border-brand-500 dark:bg-brand-500/10 dark:text-brand-300'
                            : 'border-gray-200 dark:border-border-primary hover:bg-gray-50 dark:hover:bg-background-hover'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(event) => {
                            const nextEffects = event.target.checked
                              ? transitionEffects.includes(option.value)
                                ? transitionEffects
                                : [...transitionEffects, option.value]
                              : transitionEffects.filter((effect) => effect !== option.value);
                            onTransitionEffectsChange(nextEffects);
                          }}
                          className="w-4 h-4 rounded border-gray-300 text-brand-500 focus:ring-brand-500"
                        />
                        <span>{t(`preview.${option.labelKey}`)}</span>
                      </label>
                    );
                  })}
                </div>
              )}

              {transitionsEnabled && transitionEffects.length === 0 && (
                <div className="text-xs text-amber-600 dark:text-amber-400 px-1">
                  {t('preview.pptxTransitionRequired')}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button type="button" onClick={onClosePptx} className="px-4 py-2 text-sm text-gray-600 dark:text-foreground-tertiary hover:bg-gray-100 dark:hover:bg-background-hover rounded-lg transition-colors">
                {t('preview.pptxCancel')}
              </button>
              <button
                type="button"
                onClick={() => onStartPptx({
                  transitionEnabled: transitionsEnabled,
                  transitionEffects,
                })}
                disabled={transitionsEnabled && transitionEffects.length === 0}
                className="px-4 py-2 text-sm bg-brand-500 text-white rounded-lg hover:bg-brand-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {t('preview.pptxStartExport')}
              </button>
            </div>
          </div>
        </div>
      )}

      {editablePptxOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onCloseEditablePptx}>
          <div className="bg-white dark:bg-background-secondary rounded-2xl p-6 w-full max-w-md mx-4 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <h3 className="text-lg font-semibold">{t('preview.editablePptxDialogTitle')}</h3>
            <p className="text-sm text-gray-500 dark:text-foreground-tertiary mt-1 mb-5">{t('preview.editablePptxDialogSubtitle')}</p>
            <div className="mt-3 px-3 py-2.5 rounded-lg bg-gray-50 dark:bg-background-tertiary flex items-start gap-2">
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-gray-500 dark:text-foreground-tertiary">{t('preview.editablePptxRangeLabel')}</div>
                <div className="text-sm mt-0.5 break-words">{rangeText}</div>
              </div>
              <span className="flex-shrink-0 text-gray-400 dark:text-foreground-tertiary cursor-help" title={t('preview.editablePptxRangeTip')}>
                <Info size={16} />
              </span>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button type="button" onClick={onCloseEditablePptx} className="px-4 py-2 text-sm text-gray-600 dark:text-foreground-tertiary hover:bg-gray-100 dark:hover:bg-background-hover rounded-lg transition-colors">
                {t('preview.editablePptxCancel')}
              </button>
              <button type="button" onClick={onStartEditablePptx} className="px-4 py-2 text-sm bg-brand-500 text-white rounded-lg hover:bg-brand-600 transition-colors">
                {t('preview.editablePptxStartExport')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
