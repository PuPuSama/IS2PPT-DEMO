export type DeckCreationMode = 'idea' | 'outline' | 'description';

export interface GenerateDeckCommand {
  kind: 'generate';
  mode: DeckCreationMode;
  brief: string;
  templateFile?: File;
  templateId?: string;
  style?: string;
  readyReferenceIds?: string[];
  additionalReferenceIds?: string[];
  aspectRatio?: string;
}

export interface ImportDeckCommand {
  kind: 'import';
  sourceFile: File;
  keepLayout: boolean;
  style?: string;
}

export type DeckCreationCommand = GenerateDeckCommand | ImportDeckCommand;

export type DeckCreationDestination = 'deck-plan' | 'slide-specs';

export interface DeckCreationResult {
  deckId: string;
  destination: DeckCreationDestination;
}

export type DeckCreationErrorCode =
  | 'template-unavailable'
  | 'deck-id-missing';

export class DeckCreationError extends Error {
  constructor(
    public readonly code: DeckCreationErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'DeckCreationError';
  }
}
