import { beforeEach, describe, expect, test, vi } from 'vitest';
import type { ProjectDto } from './projectDto';
import { deleteProject, getProject, listProjects, updateProject } from '@/api/projectsApi';
import { deleteDeck, fetchDeck, listDecks, renameDeck } from './deckRepository';

vi.mock('@/api/projectsApi', () => ({
  deleteProject: vi.fn(),
  getProject: vi.fn(),
  listProjects: vi.fn(),
  updateProject: vi.fn(),
}));

const projectDto: ProjectDto = {
  project_id: 'deck-11',
  project_title: 'Launch plan',
  idea_prompt: 'Plan the launch',
  status: 'DRAFT',
  pages: [],
  created_at: '2026-07-15T08:00:00Z',
  updated_at: '2026-07-15T08:30:00Z',
};

describe('deckRepository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('returns domain decks from the paginated project endpoint', async () => {
    vi.mocked(listProjects).mockResolvedValue({
      data: { projects: [projectDto], total: 1 },
    });

    await expect(listDecks(20, 0)).resolves.toMatchObject({
      decks: [{ id: 'deck-11', title: 'Launch plan' }],
      total: 1,
    });
    expect(listProjects).toHaveBeenCalledWith(20, 0);
  });

  test('loads one deck and rejects an empty API response', async () => {
    vi.mocked(getProject).mockResolvedValueOnce({ data: projectDto });
    await expect(fetchDeck('deck-11')).resolves.toMatchObject({ id: 'deck-11' });

    vi.mocked(getProject).mockResolvedValueOnce({});
    await expect(fetchDeck('missing')).rejects.toThrow('Deck missing was not returned');
  });

  test('translates rename and delete commands to compatibility endpoints', async () => {
    vi.mocked(updateProject).mockResolvedValue({ data: projectDto });
    vi.mocked(deleteProject).mockResolvedValue({});

    await renameDeck('deck-11', 'New title');
    await deleteDeck('deck-11');

    expect(updateProject).toHaveBeenCalledWith('deck-11', { project_title: 'New title' });
    expect(deleteProject).toHaveBeenCalledWith('deck-11');
  });
});
