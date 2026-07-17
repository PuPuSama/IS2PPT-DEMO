import { describe, expect, test } from 'vitest';
import {
  templateFileFromChoice,
  templateIdFromChoice,
  templateReferenceFromChoice,
} from './templateSelection';

describe('template selection', () => {
  test('preserves an explicit preset source without inspecting the identifier', () => {
    const choice = { kind: 'preset', templateId: 'company-template' } as const;

    expect(templateReferenceFromChoice(choice)).toEqual(choice);
    expect(templateIdFromChoice(choice)).toBe('company-template');
  });

  test('keeps the original file for a newly uploaded library template', () => {
    const file = new File(['image'], 'brand.png', { type: 'image/png' });
    const choice = { kind: 'library', templateId: '7', file } as const;

    expect(templateReferenceFromChoice(choice)).toEqual({
      kind: 'library',
      templateId: '7',
    });
    expect(templateFileFromChoice(choice)).toBe(file);
  });

  test('does not expose a template identifier for a local-only upload', () => {
    const file = new File(['image'], 'local.png', { type: 'image/png' });
    const choice = { kind: 'upload', file } as const;

    expect(templateReferenceFromChoice(choice)).toBeNull();
    expect(templateIdFromChoice(choice)).toBeUndefined();
    expect(templateFileFromChoice(choice)).toBe(file);
  });
});
