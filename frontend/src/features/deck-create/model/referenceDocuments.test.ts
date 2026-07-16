import { describe, expect, test } from 'vitest';
import type { ReferenceFile } from '@/api/referenceFilesApi';
import {
  completedReferenceIds,
  mergeReferenceSelection,
  partitionReferenceDocuments,
} from './referenceDocuments';

const reference = (id: string, parseStatus: ReferenceFile['parse_status']): ReferenceFile => ({
  id,
  project_id: null,
  filename: `${id}.pdf`,
  file_type: 'pdf',
  file_size: 10,
  parse_status: parseStatus,
  markdown_content: null,
  error_message: null,
  created_at: '2026-07-16T09:00:00.000Z',
  updated_at: '2026-07-16T09:00:00.000Z',
});

describe('reference document model', () => {
  test('partitions supported documents and deduplicates rejected extensions', () => {
    const files = [
      new File([''], 'brief.PDF', { type: 'application/pdf' }),
      new File([''], 'notes.md', { type: 'text/markdown' }),
      new File([''], 'clip.exe', { type: 'application/octet-stream' }),
      new File([''], 'other.exe', { type: 'application/octet-stream' }),
    ];

    const result = partitionReferenceDocuments(files);

    expect(result.accepted.map((file) => file.name)).toEqual(['brief.PDF', 'notes.md']);
    expect(result.rejected).toEqual(['exe']);
  });

  test('refreshes selected records and appends new references', () => {
    const current = [reference('one', 'pending'), reference('two', 'completed')];
    const selected = [reference('one', 'completed'), reference('three', 'pending')];

    expect(mergeReferenceSelection(current, selected)).toEqual([
      reference('one', 'completed'),
      reference('two', 'completed'),
      reference('three', 'pending'),
    ]);
  });

  test('returns only references ready for generation', () => {
    expect(completedReferenceIds([
      reference('one', 'completed'),
      reference('two', 'parsing'),
    ])).toEqual(['one']);
  });
});
