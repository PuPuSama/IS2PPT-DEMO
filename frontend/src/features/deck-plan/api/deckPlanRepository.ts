import { refineOutline } from '@/api/outlineApi';
import { addPage } from '@/api/pagesApi';
import { updateProject } from '@/api/projectsApi';
import type { DeckPlanSource } from '../model/planSource';

export interface DeckPlanSlideDraft {
  title: string;
  points: string[];
  description?: string;
  section?: string;
  extraFields?: Record<string, string>;
}

const sourceFieldByType: Record<DeckPlanSource, string> = {
  idea: 'idea_prompt',
  outline: 'outline_text',
  description: 'description_text',
  'source-deck': 'outline_text',
};

export const saveDeckSourceText = async (
  deckId: string,
  source: DeckPlanSource,
  text: string,
): Promise<void> => {
  await updateProject(deckId, { [sourceFieldByType[source]]: text });
};

export const saveDeckPlanRequirements = async (
  deckId: string,
  requirements: string,
): Promise<void> => {
  await updateProject(deckId, { outline_requirements: requirements });
};

export const refineDeckPlan = async (
  deckId: string,
  requirement: string,
  previousRequirements: string[],
): Promise<string | undefined> => {
  const response = await refineOutline(deckId, requirement, previousRequirements);
  return response.data?.message;
};

export const appendDeckPlanSlides = async (
  deckId: string,
  drafts: DeckPlanSlideDraft[],
  startOrder: number,
): Promise<void> => {
  await Promise.all(drafts.map((draft, index) => addPage(deckId, {
    outline_content: { title: draft.title, points: draft.points },
    description_content: draft.description
      ? {
          text: draft.description,
          ...(draft.extraFields ? { extra_fields: draft.extraFields } : {}),
        }
      : undefined,
    part: draft.section,
    order_index: startOrder + index,
  })));
};
