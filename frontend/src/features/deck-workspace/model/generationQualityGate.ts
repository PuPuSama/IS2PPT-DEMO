export type GenerationQualityDecision = 'proceed' | 'confirm-low-resolution';

export const generationQualityDecision = (
  resolution: string | undefined,
  warningDismissed: boolean,
): GenerationQualityDecision => {
  if (warningDismissed) return 'proceed';
  return resolution === '1K' ? 'confirm-low-resolution' : 'proceed';
};
