import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, FileText } from 'lucide-react';
import { useT } from '@/hooks/useT';
import { listProjectReferenceFiles, type ReferenceFile } from '@/api/referenceFilesApi';
import { ReferenceFileCard } from './ReferenceFileCard';

const projectResourcesI18n = {
  zh: {
    projectResources: {
      uploadedFiles: "已上传的文件",
      refreshList: "刷新列表",
    },
  },
  en: {
    projectResources: {
      uploadedFiles: "Uploaded Files",
      refreshList: "Refresh List",
    },
  },
};

interface ProjectResourcesListProps {
  projectId: string | null;
  className?: string;
  showFiles?: boolean;
  onFileClick?: (fileId: string) => void;
  showToast?: (props: { message: string; type: 'success' | 'error' | 'info' | 'warning' }) => void;
}

/**
 * 项目资源列表组件：展示项目参考文件。
 */
export const ProjectResourcesList: React.FC<ProjectResourcesListProps> = ({
  projectId,
  className = 'mb-4',
  showFiles = true,
  onFileClick,
  showToast,
}) => {
  const t = useT(projectResourcesI18n);
  const [files, setFiles] = useState<ReferenceFile[]>([]);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);

  const loadFiles = useCallback(async () => {
    if (!projectId || !showFiles) return;

    setIsLoadingFiles(true);
    try {
      const response = await listProjectReferenceFiles(projectId);
      if (response.data?.files) {
        setFiles(response.data.files);
      }
    } catch (error) {
      console.error('Load files failed:', error);
      showToast?.({ message: '加载参考文件失败', type: 'error' });
    } finally {
      setIsLoadingFiles(false);
    }
  }, [projectId, showFiles, showToast]);

  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  const handleFileStatusChange = (updatedFile: ReferenceFile) => {
    setFiles(prev => prev.map(f => f.id === updatedFile.id ? updatedFile : f));
  };

  const handleFileDelete = (fileId: string) => {
    setFiles(prev => prev.filter(f => f.id !== fileId));
  };

  if (!projectId || !showFiles || files.length === 0) {
    return null;
  }

  return (
    <div className={className}>
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <FileText size={16} className="text-gray-500 dark:text-foreground-tertiary" />
            <span className="text-sm font-medium text-gray-700 dark:text-foreground-secondary">
              {t('projectResources.uploadedFiles')} ({files.length})
            </span>
          </div>
          <button
            onClick={loadFiles}
            disabled={isLoadingFiles}
            className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-50"
            title={t('projectResources.refreshList')}
          >
            <RefreshCw size={14} className={isLoadingFiles ? 'animate-spin' : ''} />
          </button>
        </div>
        <div className="space-y-2">
          {files.map(file => (
            <ReferenceFileCard
              key={file.id}
              file={file}
              onDelete={handleFileDelete}
              onStatusChange={handleFileStatusChange}
              deleteMode="remove"
              onClick={() => onFileClick?.(file.id)}
              showToast={showToast}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default ProjectResourcesList;
