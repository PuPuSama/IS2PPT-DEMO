export type PptxTransitionEffect =
  | 'fade'
  | 'page_turn'
  | 'push'
  | 'wipe'
  | 'split'
  | 'blinds'
  | 'checker'
  | 'wheel';

export const PPTX_TRANSITION_OPTIONS: { value: PptxTransitionEffect; labelKey: string }[] = [
  { value: 'fade', labelKey: 'pptxTransitionFade' },
  { value: 'page_turn', labelKey: 'pptxTransitionPageTurn' },
  { value: 'push', labelKey: 'pptxTransitionPush' },
  { value: 'wipe', labelKey: 'pptxTransitionWipe' },
  { value: 'split', labelKey: 'pptxTransitionSplit' },
  { value: 'blinds', labelKey: 'pptxTransitionBlinds' },
  { value: 'checker', labelKey: 'pptxTransitionChecker' },
  { value: 'wheel', labelKey: 'pptxTransitionWheel' },
];
