import { describe, expect, test } from 'vitest';
import { describeExportSelection, type ExportSlideReference } from './exportSelectionLabel';

const slides: ExportSlideReference[] = [
  { page_id: 'slide-1' },
  { page_id: 'slide-2' },
  { page_id: 'slide-3' },
  { page_id: 'slide-4' },
];

describe('describeExportSelection', () => {
  test('labels an empty selection as all slides', () => {
    expect(describeExportSelection(undefined, slides)).toEqual({
      key: 'export.allPages',
    });
  });

  test('labels one slide with its deck position', () => {
    expect(describeExportSelection(['slide-2'], slides)).toEqual({
      key: 'export.singlePage',
      values: { num: 2 },
    });
  });

  test('labels a continuous selection as a range', () => {
    expect(describeExportSelection(['slide-3', 'slide-2'], slides)).toEqual({
      key: 'export.pageRange',
      values: { start: 2, end: 3 },
    });
  });

  test('labels a split selection by count', () => {
    expect(describeExportSelection(['slide-1', 'slide-3'], slides)).toEqual({
      key: 'export.pagesCount',
      values: { count: 2 },
    });
  });

  test('does not misreport a selection containing a stale slide id', () => {
    expect(describeExportSelection(['slide-1', 'missing'], slides)).toEqual({
      key: 'export.pagesCount',
      values: { count: 2 },
    });
  });

  test('deduplicates repeated slide ids', () => {
    expect(describeExportSelection(['slide-2', 'slide-2'], slides)).toEqual({
      key: 'export.singlePage',
      values: { num: 2 },
    });
  });
});
