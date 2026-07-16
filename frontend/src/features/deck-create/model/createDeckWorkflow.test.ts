import { beforeEach, describe, expect, test, vi } from 'vitest';
import type { DeckCreationDependencies } from './createDeckWorkflow';
import { createDeckFromCommand } from './createDeckWorkflow';

const dependencies = (): DeckCreationDependencies => ({
  loadTemplate: vi.fn(),
  initializeDeck: vi.fn(),
  importSourceDeck: vi.fn(),
  associateReference: vi.fn().mockResolvedValue(undefined),
  activateDeck: vi.fn(),
  trackImportJob: vi.fn(),
  clearDraft: vi.fn(),
});

describe('createDeckFromCommand', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('creates a generated deck with resolved template and references', async () => {
    const deps = dependencies();
    const template = new File(['image'], 'template.png', { type: 'image/png' });
    vi.mocked(deps.loadTemplate).mockResolvedValue(template);
    vi.mocked(deps.initializeDeck).mockResolvedValue('deck-1');

    const result = await createDeckFromCommand({
      kind: 'generate',
      mode: 'outline',
      brief: '# Plan',
      templateId: 'template-7',
      style: 'Editorial',
      readyReferenceIds: ['ref-ready'],
      additionalReferenceIds: ['ref-later'],
      aspectRatio: '16:9',
    }, deps);

    expect(deps.initializeDeck).toHaveBeenCalledWith({
      mode: 'outline',
      brief: '# Plan',
      templateFile: template,
      style: 'Editorial',
      referenceIds: ['ref-ready'],
      aspectRatio: '16:9',
    });
    expect(deps.associateReference).toHaveBeenCalledWith('ref-later', 'deck-1');
    expect(deps.activateDeck).toHaveBeenCalledWith('deck-1');
    expect(deps.clearDraft).toHaveBeenCalledOnce();
    expect(result).toEqual({ deckId: 'deck-1', destination: 'deck-plan' });
  });

  test('imports a source deck and tracks its backend job', async () => {
    const deps = dependencies();
    const sourceFile = new File(['deck'], 'source.pptx');
    vi.mocked(deps.importSourceDeck).mockResolvedValue({
      deckId: 'deck-2',
      jobId: 'job-2',
    });

    await expect(createDeckFromCommand({
      kind: 'import',
      sourceFile,
      keepLayout: true,
      style: 'Keep visual hierarchy',
    }, deps)).resolves.toEqual({
      deckId: 'deck-2',
      destination: 'slide-specs',
    });

    expect(deps.activateDeck).toHaveBeenCalledWith('deck-2');
    expect(deps.trackImportJob).toHaveBeenCalledWith('job-2');
    expect(deps.clearDraft).toHaveBeenCalledOnce();
  });

  test('stops before creation when a selected template cannot be loaded', async () => {
    const deps = dependencies();
    vi.mocked(deps.loadTemplate).mockResolvedValue(null);

    await expect(createDeckFromCommand({
      kind: 'generate',
      mode: 'idea',
      brief: 'Quarterly review',
      templateId: 'missing',
    }, deps)).rejects.toMatchObject({
      code: 'template-unavailable',
    });

    expect(deps.initializeDeck).not.toHaveBeenCalled();
    expect(deps.clearDraft).not.toHaveBeenCalled();
  });

  test('does not clear the draft when creation returns no deck ID', async () => {
    const deps = dependencies();
    vi.mocked(deps.initializeDeck).mockResolvedValue(null);

    await expect(createDeckFromCommand({
      kind: 'generate',
      mode: 'description',
      brief: 'Slide details',
    }, deps)).rejects.toMatchObject({
      code: 'deck-id-missing',
    });

    expect(deps.activateDeck).not.toHaveBeenCalled();
    expect(deps.clearDraft).not.toHaveBeenCalled();
  });
});
