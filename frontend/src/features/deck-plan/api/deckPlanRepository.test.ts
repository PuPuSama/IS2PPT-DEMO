import { beforeEach, describe, expect, test, vi } from 'vitest';
import { refineOutline } from '@/api/outlineApi';
import { addPage } from '@/api/pagesApi';
import { updateProject } from '@/api/projectsApi';
import {
  appendDeckPlanSlides,
  refineDeckPlan,
  saveDeckPlanRequirements,
  saveDeckSourceText,
} from './deckPlanRepository';

vi.mock('@/api/outlineApi', () => ({ refineOutline: vi.fn() }));
vi.mock('@/api/pagesApi', () => ({ addPage: vi.fn() }));
vi.mock('@/api/projectsApi', () => ({ updateProject: vi.fn() }));

describe('deck plan repository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test.each([
    ['idea', 'idea_prompt'],
    ['outline', 'outline_text'],
    ['description', 'description_text'],
    ['source-deck', 'outline_text'],
  ] as const)('maps %s source updates to %s', async (source, field) => {
    vi.mocked(updateProject).mockResolvedValue({});
    await saveDeckSourceText('deck-1', source, 'updated text');
    expect(updateProject).toHaveBeenCalledWith('deck-1', { [field]: 'updated text' });
  });

  test('saves plan requirements', async () => {
    vi.mocked(updateProject).mockResolvedValue({});
    await saveDeckPlanRequirements('deck-1', 'Use five sections');
    expect(updateProject).toHaveBeenCalledWith('deck-1', {
      outline_requirements: 'Use five sections',
    });
  });

  test('normalizes the refinement response', async () => {
    vi.mocked(refineOutline).mockResolvedValue({ data: { pages: [], message: 'Updated' } });
    await expect(refineDeckPlan('deck-1', 'Shorter', ['Formal'])).resolves.toBe('Updated');
  });

  test('maps slide drafts to backend page requests', async () => {
    vi.mocked(addPage).mockResolvedValue({});
    await appendDeckPlanSlides('deck-1', [{
      title: 'Opening',
      points: ['Context'],
      description: 'Visual direction',
      section: 'Intro',
      extraFields: { audience: 'Leadership' },
    }], 3);

    expect(addPage).toHaveBeenCalledWith('deck-1', {
      outline_content: { title: 'Opening', points: ['Context'] },
      description_content: {
        text: 'Visual direction',
        extra_fields: { audience: 'Leadership' },
      },
      part: 'Intro',
      order_index: 3,
    });
  });
});
