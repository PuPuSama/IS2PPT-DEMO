import React, { useState } from 'react';
import {
  ArrowLeft,
  Download,
  FileText,
  Home,
  Loader2,
  Presentation,
  RefreshCw,
  Settings,
  Upload,
} from 'lucide-react';
import { ExportJobsPanel } from '@/components/shared';
import { Button } from '@/shared/ui';
import { previewI18n } from '@/config/slidePreviewI18n';
import { useT } from '@/hooks/useT';
import type { Page } from '@/types';
import type { WorkspaceRenderMode } from '../model/deckWorkspaceSnapshot';

interface DeckWorkspaceHeaderProps {
  projectId?: string;
  slides: Page[];
  renderMode: WorkspaceRenderMode;
  activeExportJob: boolean;
  exportJobCount: number;
  refreshing: boolean;
  multiSelectEnabled: boolean;
  selectedSlideCount: number;
  exportReady: boolean;
  missingImageCount: number;
  onHome: () => void;
  onBack: () => void;
  onPrevious: () => void;
  onOpenSettings: () => void;
  onOpenStyle: () => void;
  onRefresh: () => void;
  onOpenPptxExport: () => void;
  onOpenEditablePptxExport: () => void;
  onExport: (format: 'pdf' | 'images') => void;
}

export const DeckWorkspaceHeader: React.FC<DeckWorkspaceHeaderProps> = ({
  projectId,
  slides,
  renderMode,
  activeExportJob,
  exportJobCount,
  refreshing,
  multiSelectEnabled,
  selectedSlideCount,
  exportReady,
  missingImageCount,
  onHome,
  onBack,
  onPrevious,
  onOpenSettings,
  onOpenStyle,
  onRefresh,
  onOpenPptxExport,
  onOpenEditablePptxExport,
  onExport,
}) => {
  const t = useT(previewI18n);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [jobsPanelOpen, setJobsPanelOpen] = useState(false);
  const selectionActive = multiSelectEnabled && selectedSlideCount > 0;

  const runExport = (format: 'pdf' | 'images') => {
    setExportMenuOpen(false);
    onExport(format);
  };

  return (
    <header className="h-14 md:h-16 bg-white dark:bg-background-secondary shadow-sm dark:shadow-background-primary/30 border-b border-gray-200 dark:border-border-primary flex items-center justify-between px-3 md:px-6 flex-shrink-0">
      <div className="flex items-center gap-2 md:gap-4 min-w-0 flex-1">
        <Button
          variant="ghost"
          size="sm"
          icon={<Home size={16} className="md:w-[18px] md:h-[18px]" />}
          onClick={onHome}
          className="hidden sm:inline-flex flex-shrink-0"
        >
          <span className="hidden md:inline">{t('nav.home')}</span>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          icon={<ArrowLeft size={16} className="md:w-[18px] md:h-[18px]" />}
          onClick={onBack}
          className="flex-shrink-0"
        >
          <span className="hidden sm:inline">{t('common.back')}</span>
        </Button>
        <div className="flex items-center gap-1.5 md:gap-2 min-w-0">
          <Presentation size={22} className="text-brand-600" />
          <span className="text-base md:text-xl font-bold truncate">{t('home.title')}</span>
        </div>
        <span className="text-gray-400 hidden md:inline">|</span>
        <span className="text-sm md:text-lg font-semibold truncate hidden sm:inline">
          {t('preview.title')}
        </span>
        {renderMode === 'svg' ? (
          <span
            title="当前生成路线：SVG 矢量（便当版面，可在幻灯片上直接编辑）"
            className="hidden md:inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300"
          >
            SVG 矢量
          </span>
        ) : (
          <span
            title="当前生成路线：生图（位图）"
            className="hidden md:inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400"
          >
            生图
          </span>
        )}
      </div>

      <div className="flex items-center gap-1 md:gap-3 flex-shrink-0">
        <Button
          variant="ghost"
          size="sm"
          icon={<Settings size={16} className="md:w-[18px] md:h-[18px]" />}
          onClick={onOpenSettings}
          className="hidden lg:inline-flex"
        >
          <span className="hidden xl:inline">{t('preview.projectSettings')}</span>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          icon={<Upload size={16} className="md:w-[18px] md:h-[18px]" />}
          onClick={onOpenStyle}
          className="hidden lg:inline-flex"
        >
          <span className="hidden xl:inline">{t('preview.changeTemplate')}</span>
        </Button>
        <Button
          variant="secondary"
          size="sm"
          icon={<ArrowLeft size={16} className="md:w-[18px] md:h-[18px]" />}
          onClick={onPrevious}
          className="hidden sm:inline-flex"
        >
          <span className="hidden md:inline">{t('common.previous')}</span>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          icon={<RefreshCw size={16} className={`md:w-[18px] md:h-[18px] ${refreshing ? 'animate-spin' : ''}`} />}
          onClick={onRefresh}
          disabled={refreshing}
          className="hidden md:inline-flex"
        >
          <span className="hidden lg:inline">{t('preview.refresh')}</span>
        </Button>

        <div className="relative">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setJobsPanelOpen((open) => !open);
              setExportMenuOpen(false);
            }}
            className="relative"
            aria-label={t('preview.exportJobs')}
          >
            {activeExportJob
              ? <Loader2 size={16} className="animate-spin text-brand-500" />
              : <FileText size={16} />}
            {exportJobCount > 0 && <span className="ml-1 text-xs">{exportJobCount}</span>}
          </Button>
          {jobsPanelOpen && (
            <div className="absolute right-0 mt-2 z-20">
              <ExportJobsPanel
                deckId={projectId}
                pages={slides}
                className="w-96 max-h-[28rem] shadow-lg"
              />
            </div>
          )}
        </div>

        <div className="relative">
          <Button
            variant="primary"
            size="sm"
            icon={<Download size={16} className="md:w-[18px] md:h-[18px]" />}
            onClick={() => {
              setExportMenuOpen((open) => !open);
              setJobsPanelOpen(false);
            }}
            disabled={multiSelectEnabled && selectedSlideCount === 0}
            title={!multiSelectEnabled && !exportReady
              ? t('preview.disabledExportTip', { count: missingImageCount })
              : undefined}
            aria-label={t('preview.export')}
            className="text-xs md:text-sm"
          >
            <span className="hidden sm:inline">
              {selectionActive
                ? `${t('preview.export')} (${selectedSlideCount})`
                : t('preview.export')}
            </span>
            <span className="sm:hidden">
              {selectionActive ? `(${selectedSlideCount})` : t('preview.export')}
            </span>
          </Button>
          {exportMenuOpen && (
            <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-background-secondary rounded-lg shadow-lg border border-gray-200 dark:border-border-primary py-2 z-10">
              {selectionActive && (
                <div className="px-4 py-2 text-xs text-gray-500 dark:text-foreground-tertiary border-b border-gray-100 dark:border-border-primary">
                  {t('preview.exportSelectedPages', { count: selectedSlideCount })}
                </div>
              )}
              <button
                type="button"
                onClick={() => {
                  setExportMenuOpen(false);
                  onOpenPptxExport();
                }}
                disabled={!exportReady}
                className="w-full px-4 py-2 text-left hover:bg-gray-50 dark:hover:bg-background-hover transition-colors text-sm disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {t('preview.exportPptx')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setExportMenuOpen(false);
                  onOpenEditablePptxExport();
                }}
                disabled={!exportReady}
                className="w-full px-4 py-2 text-left hover:bg-gray-50 dark:hover:bg-background-hover transition-colors text-sm disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {t('preview.exportEditablePptx')}
              </button>
              <button
                type="button"
                onClick={() => runExport('pdf')}
                disabled={!exportReady}
                className="w-full px-4 py-2 text-left hover:bg-gray-50 dark:hover:bg-background-hover transition-colors text-sm disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {t('preview.exportPdf')}
              </button>
              <button
                type="button"
                onClick={() => runExport('images')}
                disabled={!exportReady}
                className="w-full px-4 py-2 text-left hover:bg-gray-50 dark:hover:bg-background-hover transition-colors text-sm disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {t('preview.exportImages')}
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
