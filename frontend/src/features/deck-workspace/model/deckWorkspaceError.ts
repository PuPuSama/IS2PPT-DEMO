import { normalizeErrorMessage } from '@/utils';

interface ErrorPayload {
  error?: string | { message?: unknown };
  message?: unknown;
}

interface RequestFailure {
  message?: unknown;
  response?: {
    data?: ErrorPayload;
  };
}

const stringMessage = (value: unknown): string | undefined => (
  typeof value === 'string' && value.trim() ? value : undefined
);

export const deckWorkspaceErrorDetail = (
  error: unknown,
  fallback: string,
): string => {
  const failure = error as RequestFailure;
  const payload = failure?.response?.data;
  const nestedError = payload?.error;

  return stringMessage(typeof nestedError === 'object' ? nestedError?.message : undefined)
    || stringMessage(payload?.message)
    || stringMessage(nestedError)
    || stringMessage(failure?.message)
    || fallback;
};

export const deckWorkspaceErrorMessage = (
  error: unknown,
  fallback: string,
): string => normalizeErrorMessage(deckWorkspaceErrorDetail(error, fallback));
