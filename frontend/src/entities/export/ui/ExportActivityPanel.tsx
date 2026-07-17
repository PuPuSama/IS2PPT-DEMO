import React, { useState, useEffect } from 'react';
import { Download, X, Trash2, FileText, Clock, CheckCircle, XCircle, Loader2, AlertTriangle, HelpCircle, Settings, FileSpreadsheet, Image } from 'lucide-react';
import { useExportJobsStore } from '../model/useExportJobsStore';
import type {
  ExportFormat,
  ExportJob,
  ExportedFile,
  ExportWarningDetails,
} from '../model/types';
import { isExportJobActive, isExportJobFinished } from '../model/types';
import { listDeckExports } from '../api/exportRepository';
import {
  describeExportSelection,
  type ExportSlideReference,
} from '../model/exportSelectionLabel';
import { useT } from '@/hooks/useT';
import { Button } from '@/shared/ui';
import { cn } from '@/utils';
import { exportActivityI18n } from './exportActivityI18n';

const ExportStateIcon: React.FC<{ status: ExportJob['status'] }> = ({ status }) => {
  switch (status) {
    case 'queued':
      return <Clock size={16} className="text-gray-400" />;
    case 'running':
      return <Loader2 size={16} className="text-brand-500 animate-spin" />;
    case 'ready':
      return <CheckCircle size={16} className="text-green-500" />;
    case 'failed':
      return <XCircle size={16} className="text-red-500" />;
    default:
      return null;
  }
};

const ExportWarningsDialog: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  warnings: string[];
  warningDetails?: ExportWarningDetails;
}> = ({ isOpen, onClose, warnings, warningDetails }) => {
  const t = useT(exportActivityI18n);
  const styleFailures = warningDetails?.styleExtractionFailed ?? [];
  const textFailures = warningDetails?.textRenderFailed ?? [];
  
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      
      <div className="relative bg-white dark:bg-background-secondary rounded-lg shadow-xl max-w-lg w-full mx-4 max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-border-primary bg-amber-50">
          <div className="flex items-center gap-2">
            <AlertTriangle size={18} className="text-amber-500" />
            <h3 className="text-base font-semibold text-amber-800">
              {t('export.warningsCount', { count: warnings.length })}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-amber-100 rounded transition-colors"
          >
            <X size={18} className="text-gray-500 dark:text-foreground-tertiary" />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4">
          <div className="space-y-2">
            {warnings.map((warning, idx) => (
              <div
                key={idx}
                className="flex items-start gap-2 p-2 bg-amber-50 border border-amber-200 rounded text-sm text-amber-800"
              >
                <span className="text-amber-500 mt-0.5">•</span>
                <span className="break-words">{warning}</span>
              </div>
            ))}
          </div>
          
          {warningDetails && (
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-border-primary">
              <h4 className="text-sm font-medium text-gray-700 dark:text-foreground-secondary mb-2">{t('export.detailInfo')}</h4>
              
              {styleFailures.length > 0 && (
                <div className="mb-3">
                  <p className="text-xs text-gray-500 dark:text-foreground-tertiary mb-1">
                    {t('export.styleExtractionFailed', { count: styleFailures.length })}
                  </p>
                  <div className="text-xs text-gray-600 dark:text-foreground-tertiary bg-gray-50 dark:bg-background-primary p-2 rounded max-h-32 overflow-y-auto">
                    {styleFailures.slice(0, 10).map((item, idx) => (
                      <div key={idx} className="truncate" title={item.reason}>
                        • {item.elementId}: {item.reason}
                      </div>
                    ))}
                    {styleFailures.length > 10 && (
                      <div className="text-gray-400 mt-1">
                        {t('export.moreItems', { count: styleFailures.length - 10 })}
                      </div>
                    )}
                  </div>
                </div>
              )}
              
              {textFailures.length > 0 && (
                <div className="mb-3">
                  <p className="text-xs text-gray-500 dark:text-foreground-tertiary mb-1">
                    {t('export.textRenderFailed', { count: textFailures.length })}
                  </p>
                  <div className="text-xs text-gray-600 dark:text-foreground-tertiary bg-gray-50 dark:bg-background-primary p-2 rounded max-h-32 overflow-y-auto">
                    {textFailures.slice(0, 10).map((item, idx) => (
                      <div key={idx} className="truncate" title={item.reason}>
                        • "{item.text}": {item.reason}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        
        <div className="px-4 py-3 border-t border-gray-200 dark:border-border-primary bg-gray-50 dark:bg-background-primary">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 dark:text-foreground-secondary rounded-md text-sm font-medium transition-colors"
          >
            {t('common.close')}
          </button>
        </div>
      </div>
    </div>
  );
};

const ExportJobRow: React.FC<{
  job: ExportJob;
  slides: ExportSlideReference[];
  onRemove: () => void;
}> = ({ job, slides, onRemove }) => {
  const t = useT(exportActivityI18n);
  const [warningsOpen, setWarningsOpen] = useState(false);
  
  const formatLabels: Record<ExportFormat, string> = {
    'pptx': t('export.exportPptx'),
    'pdf': t('export.exportPdf'),
    'editable-pptx': t('export.exportEditablePptx'),
    'images': t('export.exportImages'),
  };
  
  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  };

  const selectionLabel = describeExportSelection(job.slideIds, slides);
  const pageRangeText = t(selectionLabel.key, selectionLabel.values);

  const getProgressPercent = () => {
    if (!job.progress) return 0;
    if (job.progress.percent !== undefined) return job.progress.percent;
    if (job.progress.total > 0) {
      return Math.round((job.progress.completed / job.progress.total) * 100);
    }
    return 0;
  };

  const progressPercent = getProgressPercent();
  const isProcessing = isExportJobActive(job);
  
  const hasWarnings = job.status === 'ready' && job.progress?.warnings && job.progress.warnings.length > 0;

  return (
    <div className="flex items-start gap-3 py-2.5 px-3 hover:bg-gray-50 dark:hover:bg-background-hover rounded-lg transition-colors">
      <div className="mt-0.5">
        <ExportStateIcon status={job.status} />
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-medium text-gray-700 dark:text-foreground-secondary truncate">
            {formatLabels[job.format]}
          </span>
          <span className="text-xs text-gray-500 dark:text-foreground-tertiary">
            {pageRangeText}
          </span>
          <span className="text-xs text-gray-400">
            {formatTime(job.createdAt)}
          </span>
        </div>
        
        {isProcessing && (
          <div className="mt-2 space-y-1.5">
            {job.progress ? (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-brand-600">
                    {progressPercent > 0 ? `${progressPercent}%` : t('export.preparing')}
                  </span>
                  {job.progress.currentStep && (
                    <span className="text-xs text-gray-500 dark:text-foreground-tertiary truncate max-w-[140px]" title={job.progress.currentStep}>
                      {job.progress.currentStep}
                    </span>
                  )}
                </div>
                
                <div className="h-2.5 bg-gray-200 rounded-full overflow-hidden shadow-inner">
                  <div
                    className="h-full bg-gradient-to-r from-brand-500 to-brand-600 transition-all duration-500 ease-out"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                
                {job.progress.messages && job.progress.messages.length > 0 && (
                  <div className="mt-1.5 space-y-0.5">
                    {job.progress.messages.slice(-2).map((msg, idx) => (
                      <div key={idx} className="text-xs text-gray-500 dark:text-foreground-tertiary truncate" title={msg}>
                        {msg}
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="flex items-center gap-2">
                <div className="h-2.5 w-full bg-gray-200 rounded-full overflow-hidden">
                  <div className="h-full bg-brand-500 animate-pulse" style={{ width: '30%' }} />
                </div>
                <span className="text-xs text-gray-500 dark:text-foreground-tertiary whitespace-nowrap">{t('common.pending')}</span>
              </div>
            )}
          </div>
        )}
        
        {job.status === 'failed' && job.errorMessage && (
          <div className="mt-2 space-y-2">
            <div className="p-2 bg-red-50 border border-red-200 rounded">
              <div className="flex items-start gap-2">
                <XCircle size={14} className="text-red-500 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-red-700 font-medium">{t('export.exportFailed')}</p>
                  <p className="text-xs text-red-600 mt-1 whitespace-pre-wrap break-words">
                    {job.errorMessage}
                  </p>
                </div>
              </div>
            </div>

            {job.progress?.helpText && (
              <div className="p-2 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded">
                <div className="flex items-start gap-2">
                  <HelpCircle size={14} className="text-blue-500 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-blue-700">
                    {job.progress.helpText}
                  </p>
                </div>
              </div>
            )}

            <div className="flex items-center gap-1.5 text-[11px] text-gray-500 dark:text-foreground-tertiary">
              <Settings size={12} />
              <span>{t('export.settingsTip')}</span>
            </div>

            {job.errorMessage.toLowerCase().includes('codex') && (
              <div className="flex items-center gap-1.5 text-[11px] text-gray-500 dark:text-foreground-tertiary">
                <Settings size={12} />
                <span>{t('export.codexReconnectTip')}</span>
              </div>
            )}
          </div>
        )}
        
        {hasWarnings && (
          <>
            <button
              onClick={() => setWarningsOpen(true)}
              className="mt-1.5 w-full text-left px-2 py-1.5 bg-amber-50 border border-amber-200 rounded hover:bg-amber-100 transition-colors"
            >
              <div className="flex items-center gap-1.5">
                <AlertTriangle size={12} className="text-amber-500 flex-shrink-0" />
                <span className="text-xs font-medium text-amber-700">
                  {t('export.warnings', { count: job.progress?.warnings?.length ?? 0 })}
                </span>
                <span className="text-[11px] text-amber-500 ml-auto">
                  {t('export.clickToView')}
                </span>
              </div>
            </button>
            
            <ExportWarningsDialog
              isOpen={warningsOpen}
              onClose={() => setWarningsOpen(false)}
              warnings={job.progress?.warnings ?? []}
              warningDetails={job.progress?.warningDetails}
            />
          </>
        )}
      </div>
      
      <div className="flex items-center gap-1 flex-shrink-0">
        {job.status === 'ready' && job.downloadUrl && (
          <Button
            variant="primary"
            size="sm"
            icon={<Download size={14} />}
            onClick={() => {
              const a = document.createElement('a');
              a.href = job.downloadUrl!;
              a.download = job.filename || '';
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
            }}
            className="text-xs px-2 py-1"
          >
            {t('common.download')}
          </Button>
        )}
        
        <button
          onClick={onRemove}
          className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
          title={t('common.delete')}
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
};

interface ExportActivityPanelProps {
  deckId?: string;
  slides?: ExportSlideReference[];
  /** Compatibility input for callers that have not adopted slide terminology yet. */
  pages?: ExportSlideReference[];
  className?: string;
}

const ExportFileIcon: React.FC<{ type: string }> = ({ type }) => {
  switch (type) {
    case 'pptx': return <FileSpreadsheet size={14} className="text-orange-500" />;
    case 'pdf': return <FileText size={14} className="text-blue-500" />;
    case 'images': case 'image': return <Image size={14} className="text-green-500" />;
    default: return <FileText size={14} className="text-gray-400" />;
  }
};

const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export const ExportActivityPanel: React.FC<ExportActivityPanelProps> = ({
  deckId,
  slides,
  pages,
  className,
}) => {
  const t = useT(exportActivityI18n);
  const deckSlides = slides ?? pages ?? [];
  const [isExpanded, setIsExpanded] = useState(true);
  const { jobs, removeJob, clearFinished, restoreActiveJobs } = useExportJobsStore();
  const [exportedFiles, setExportedFiles] = useState<ExportedFile[]>([]);

  const filteredJobs = deckId
    ? jobs.filter((job) => job.deckId === deckId)
    : jobs;

  const activeJobs = filteredJobs.filter(isExportJobActive);
  const finishedJobs = filteredJobs.filter(isExportJobFinished);

  useEffect(() => {
    restoreActiveJobs();
  }, [restoreActiveJobs]);

  // Refresh server files whenever a job reaches a terminal state.
  useEffect(() => {
    if (!deckId) return;
    listDeckExports(deckId)
      .then(setExportedFiles)
      .catch(() => {});
  }, [deckId, finishedJobs.length]);

  useEffect(() => {
    if (activeJobs.length > 0 && !isExpanded) {
      setIsExpanded(true);
    }
  }, [activeJobs.length, isExpanded]);

  // Keep the workspace header clean until there is export activity to show.
  if (filteredJobs.length === 0 && exportedFiles.length === 0) {
    return null;
  }
  
  return (
    <div className={cn(
      "bg-white dark:bg-background-secondary rounded-lg shadow-lg border border-gray-200 dark:border-border-primary overflow-hidden",
      className
    )}>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center bg-gray-50 dark:bg-background-primary hover:bg-gray-100 dark:hover:bg-background-hover transition-colors"
      >
        <div className="flex items-center gap-2">
          <FileText size={18} className="text-gray-600 dark:text-foreground-tertiary" />
          <span className="text-sm font-medium text-gray-700 dark:text-foreground-secondary">
            {t('export.jobs')}
          </span>
          {activeJobs.length > 0 && (
            <span className="px-1.5 py-0.5 text-xs bg-brand-100 text-brand-700 rounded-full">
              {t('export.inProgress', { count: activeJobs.length })}
            </span>
          )}
        </div>
      </button>
      
      {isExpanded && (
        <div className="max-h-96 overflow-y-auto">
          {activeJobs.length > 0 && (
            <div className="p-2 border-b border-gray-100 dark:border-border-primary">
              {activeJobs.map((job) => (
                <ExportJobRow
                  key={job.id}
                  job={job}
                  slides={deckSlides}
                  onRemove={() => removeJob(job.id)}
                />
              ))}
            </div>
          )}
          
          {finishedJobs.length > 0 && (
            <div className="p-2">
              <div className="flex items-center justify-between px-3 py-1 mb-1">
                <span className="text-xs text-gray-400">{t('shared.historyRecords')}</span>
                <button
                  onClick={clearFinished}
                  className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1"
                >
                  <Trash2 size={12} />
                  {t('export.clearHistory')}
                </button>
              </div>
              {finishedJobs.map((job) => (
                <ExportJobRow
                  key={job.id}
                  job={job}
                  slides={deckSlides}
                  onRemove={() => removeJob(job.id)}
                />
              ))}
            </div>
          )}

          {/* Files already available on the server */}
          {exportedFiles.length > 0 && (
            <div className="p-2 border-t border-gray-100 dark:border-border-primary">
              <div className="px-3 py-1 mb-1">
                <span className="text-xs text-gray-400">{t('export.exportedFiles')}</span>
              </div>
              {exportedFiles.map(file => (
                <div key={file.filename} className="flex items-center gap-3 py-2 px-3 hover:bg-gray-50 dark:hover:bg-background-hover rounded-lg transition-colors">
                    <ExportFileIcon type={file.format} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-gray-700 dark:text-foreground-secondary truncate" title={file.filename}>
                      {file.filename}
                    </div>
                    <div className="text-xs text-gray-400">
                      {formatBytes(file.size)} · {new Date(file.modifiedAt).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                  <Button
                    variant="primary"
                    size="sm"
                    icon={<Download size={14} />}
                    onClick={() => {
                      const a = document.createElement('a');
                      a.href = file.downloadUrl;
                      a.download = file.filename;
                      document.body.appendChild(a);
                      a.click();
                      document.body.removeChild(a);
                    }}
                    className="text-xs px-2 py-1"
                  >
                    {t('common.download')}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
