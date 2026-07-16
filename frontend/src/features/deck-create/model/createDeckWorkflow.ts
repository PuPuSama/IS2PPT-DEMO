import type {
  DeckCreationCommand,
  DeckCreationResult,
  GenerateDeckCommand,
} from './types';
import { DeckCreationError } from './types';

export interface DeckCreationDependencies {
  loadTemplate: (templateId: string) => Promise<File | null>;
  initializeDeck: (input: {
    mode: GenerateDeckCommand['mode'];
    brief: string;
    templateFile?: File;
    style?: string;
    referenceIds?: string[];
    aspectRatio?: string;
  }) => Promise<string | null>;
  importSourceDeck: (input: {
    sourceFile: File;
    keepLayout: boolean;
    style?: string;
  }) => Promise<{ deckId?: string; jobId?: string }>;
  associateReference: (referenceId: string, deckId: string) => Promise<void>;
  activateDeck: (deckId: string) => void;
  trackImportJob: (jobId: string) => void;
  clearDraft: () => void;
}

const resolveTemplate = async (
  command: GenerateDeckCommand,
  dependencies: DeckCreationDependencies,
): Promise<File | undefined> => {
  if (command.templateFile) return command.templateFile;
  if (!command.templateId) return undefined;

  const template = await dependencies.loadTemplate(command.templateId);
  if (!template) {
    throw new DeckCreationError(
      'template-unavailable',
      `Template ${command.templateId} could not be loaded`,
    );
  }
  return template;
};

export const createDeckFromCommand = async (
  command: DeckCreationCommand,
  dependencies: DeckCreationDependencies,
): Promise<DeckCreationResult> => {
  if (command.kind === 'import') {
    const imported = await dependencies.importSourceDeck({
      sourceFile: command.sourceFile,
      keepLayout: command.keepLayout,
      style: command.style,
    });
    if (!imported.deckId) {
      throw new DeckCreationError('deck-id-missing', 'Import did not return a deck ID');
    }

    dependencies.activateDeck(imported.deckId);
    if (imported.jobId) dependencies.trackImportJob(imported.jobId);
    dependencies.clearDraft();
    return { deckId: imported.deckId, destination: 'slide-specs' };
  }

  const templateFile = await resolveTemplate(command, dependencies);
  const deckId = await dependencies.initializeDeck({
    mode: command.mode,
    brief: command.brief,
    templateFile,
    style: command.style,
    referenceIds: command.readyReferenceIds,
    aspectRatio: command.aspectRatio,
  });
  if (!deckId) {
    throw new DeckCreationError('deck-id-missing', 'Creation did not return a deck ID');
  }

  dependencies.activateDeck(deckId);
  await Promise.allSettled(
    (command.additionalReferenceIds ?? []).map((referenceId) =>
      dependencies.associateReference(referenceId, deckId)
    ),
  );
  dependencies.clearDraft();
  return { deckId, destination: 'deck-plan' };
};
