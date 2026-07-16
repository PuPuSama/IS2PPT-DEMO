import { describe, expect, test } from 'vitest';
import type { BackendJobDto } from '@/shared/api/backendJobDto';
import {
  exportJobPatchFromDto,
  exportJobStatusFromDto,
  exportProgressFromDto,
} from './exportJobMapper';

describe('export job mapper', () => {
  test('maps backend lifecycle statuses to export domain statuses', () => {
    expect(exportJobStatusFromDto('PENDING')).toBe('queued');
    expect(exportJobStatusFromDto('PROCESSING')).toBe('running');
    expect(exportJobStatusFromDto('RUNNING')).toBe('running');
    expect(exportJobStatusFromDto('COMPLETED')).toBe('ready');
    expect(exportJobStatusFromDto('FAILED')).toBe('failed');
  });

  test('normalizes progress and warning details', () => {
    expect(exportProgressFromDto({
      total: 3,
      completed: 2,
      percent: 67,
      current_step: 'Rendering text',
      help_text: 'Check export settings',
      messages: ['Slide 2'],
      warnings: ['Font fallback'],
      warning_details: {
        style_extraction_failed: [{ element_id: 'shape-1', reason: 'Unsupported fill' }],
        text_render_failed: [{ text: 'Title', reason: 'Missing font' }],
        total_warnings: 2,
      },
    })).toEqual({
      total: 3,
      completed: 2,
      percent: 67,
      currentStep: 'Rendering text',
      helpText: 'Check export settings',
      messages: ['Slide 2'],
      warnings: ['Font fallback'],
      warningDetails: {
        styleExtractionFailed: [{ elementId: 'shape-1', reason: 'Unsupported fill' }],
        textRenderFailed: [{ text: 'Title', reason: 'Missing font' }],
        imageAddFailed: undefined,
        jsonParseFailed: undefined,
        otherWarnings: undefined,
        totalWarnings: 2,
      },
    });
  });

  test('extracts download metadata from serialized progress', () => {
    const dto = {
      task_id: 'backend-1',
      status: 'COMPLETED',
      progress: JSON.stringify({
        total: 1,
        completed: 1,
        download_url: '/exports/deck.pptx',
        filename: 'deck.pptx',
      }),
    } as unknown as BackendJobDto;

    expect(exportJobPatchFromDto(dto, '2026-07-16T10:00:00.000Z')).toMatchObject({
      status: 'ready',
      downloadUrl: '/exports/deck.pptx',
      filename: 'deck.pptx',
      completedAt: '2026-07-16T10:00:00.000Z',
    });
  });

  test('keeps backend failure details', () => {
    const dto: BackendJobDto = {
      task_id: 'backend-2',
      status: 'FAILED',
      error_message: 'Renderer unavailable',
    };

    expect(exportJobPatchFromDto(dto)).toMatchObject({
      status: 'failed',
      errorMessage: 'Renderer unavailable',
    });
  });
});
