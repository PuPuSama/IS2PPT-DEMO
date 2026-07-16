import type { ReferenceFile } from '@/api/referenceFilesApi';

export const REFERENCE_DOCUMENT_EXTENSIONS = [
  'pdf',
  'docx',
  'pptx',
  'doc',
  'ppt',
  'xlsx',
  'xls',
  'csv',
  'txt',
  'md',
] as const;

const supportedExtensions = new Set<string>(REFERENCE_DOCUMENT_EXTENSIONS);

export const fileExtension = (file: File): string =>
  file.name.split('.').pop()?.toLowerCase() ?? '';

export const isReferenceDocument = (file: File): boolean =>
  supportedExtensions.has(fileExtension(file));

export const partitionReferenceDocuments = (files: File[]) => {
  const accepted: File[] = [];
  const rejected: string[] = [];

  files.forEach((file) => {
    if (isReferenceDocument(file)) {
      accepted.push(file);
    } else {
      rejected.push(fileExtension(file) || file.type || file.name);
    }
  });

  return { accepted, rejected: Array.from(new Set(rejected)) };
};

export const mergeReferenceSelection = (
  current: ReferenceFile[],
  selected: ReferenceFile[],
): ReferenceFile[] => {
  const selectedById = new Map(selected.map((file) => [file.id, file]));
  const updated = current.map((file) => selectedById.get(file.id) ?? file);
  const currentIds = new Set(current.map((file) => file.id));
  const additions = selected.filter((file) => !currentIds.has(file.id));
  return [...updated, ...additions];
};

export const isReferenceParsing = (file: ReferenceFile): boolean =>
  file.parse_status === 'pending' || file.parse_status === 'parsing';

export const completedReferenceIds = (files: ReferenceFile[]): string[] =>
  files.filter((file) => file.parse_status === 'completed').map((file) => file.id);
