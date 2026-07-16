import { useCallback, useMemo, useState } from 'react';
import {
  triggerFileParse,
  uploadReferenceFile,
  type ReferenceFile,
} from '@/api/referenceFilesApi';
import {
  mergeReferenceSelection,
  partitionReferenceDocuments,
} from './referenceDocuments';

type Translate = (
  key: string,
  params?: string | Record<string, string | number>,
) => string;
type Notify = (toast: {
  message: string;
  type?: 'success' | 'error' | 'info' | 'warning';
}) => void;

interface UseCreationReferencesOptions {
  translate: Translate;
  notify: Notify;
}

const MAX_REFERENCE_FILE_SIZE = 200 * 1024 * 1024;

export const useCreationReferences = ({
  translate,
  notify,
}: UseCreationReferencesOptions) => {
  const [references, setReferences] = useState<ReferenceFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [previewReferenceId, setPreviewReferenceId] = useState<string | null>(null);

  const uploadReference = useCallback(async (file: File) => {
    if (isUploading) return;
    if (file.size > MAX_REFERENCE_FILE_SIZE) {
      notify({
        message: translate('home.messages.fileTooLarge', {
          size: (file.size / 1024 / 1024).toFixed(1),
        }),
        type: 'error',
      });
      return;
    }

    const extension = file.name.split('.').pop()?.toLowerCase();
    if (extension === 'ppt' || extension === 'pptx') {
      notify({ message: `💡 ${translate('home.messages.pptTip')}`, type: 'info' });
    }

    setIsUploading(true);
    try {
      const response = await uploadReferenceFile(file, null);
      const uploaded = response.data?.file;
      if (!uploaded) {
        notify({ message: translate('home.messages.fileUploadFailed'), type: 'error' });
        return;
      }

      setReferences((current) => [...current, uploaded]);
      notify({ message: translate('home.messages.fileUploadSuccess'), type: 'success' });

      if (uploaded.parse_status !== 'pending') return;
      try {
        const parseResponse = await triggerFileParse(uploaded.id);
        setReferences((current) => current.map((reference) => {
          if (reference.id !== uploaded.id) return reference;
          return parseResponse.data?.file
            ?? { ...reference, parse_status: 'parsing' as const };
        }));
      } catch (error) {
        console.error('Failed to start reference parsing:', error);
      }
    } catch (error: any) {
      console.error('Reference upload failed:', error);
      const message = error?.response?.status === 413
        ? translate('home.messages.fileTooLarge', {
            size: (file.size / 1024 / 1024).toFixed(1),
          })
        : `${translate('home.messages.fileUploadFailed')}: ${
            error?.response?.data?.error?.message || error.message || ''
          }`.replace(/: $/, '');
      notify({ message, type: 'error' });
    } finally {
      setIsUploading(false);
    }
  }, [isUploading, notify, translate]);

  const addDocuments = useCallback(async (files: File[]) => {
    if (isUploading) {
      notify({ message: translate('home.messages.fileUploadInProgress'), type: 'info' });
      return;
    }

    const { accepted, rejected } = partitionReferenceDocuments(files);
    if (rejected.length > 0) {
      notify({
        message: translate('home.messages.unsupportedFileType', {
          type: rejected.join(', '),
        }),
        type: 'info',
      });
    }

    for (const file of accepted) {
      await uploadReference(file);
    }
  }, [isUploading, notify, translate, uploadReference]);

  const removeReference = useCallback((referenceId: string) => {
    setReferences((current) => current.filter((file) => file.id !== referenceId));
  }, []);

  const updateReference = useCallback((updated: ReferenceFile) => {
    setReferences((current) => current.map((file) =>
      file.id === updated.id ? updated : file
    ));
  }, []);

  const addSelectedReferences = useCallback((selected: ReferenceFile[]) => {
    setReferences((current) => mergeReferenceSelection(current, selected));
    notify({
      message: translate('home.messages.filesAdded', { count: selected.length }),
      type: 'success',
    });
  }, [notify, translate]);

  const handleReferenceInput = useCallback(async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const files = Array.from(event.target.files ?? []);
    for (const file of files) {
      await uploadReference(file);
    }
    event.target.value = '';
  }, [uploadReference]);

  const selectedReferenceIds = useMemo(
    () => references.map((file) => file.id),
    [references],
  );

  return {
    references,
    isUploading,
    isPickerOpen,
    setIsPickerOpen,
    previewReferenceId,
    setPreviewReferenceId,
    uploadReference,
    addDocuments,
    removeReference,
    updateReference,
    addSelectedReferences,
    handleReferenceInput,
    selectedReferenceIds,
  };
};
