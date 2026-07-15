import { beforeEach, describe, expect, test, vi } from 'vitest';
import { fetchDeck } from '../api/deckRepository';
import { projectSession } from '@/shared/storage/projectSession';
import { useDeckStore } from './useDeckStore';
import type { Deck } from './types';

vi.mock('../api/deckRepository', () => ({
  fetchDeck: vi.fn(),
}));

const deck: Deck = {
  id: 'deck-21',
  title: 'Architecture',
  source: { ideaPrompt: 'Explain the architecture' },
  requirements: { webResearch: false },
  template: {},
  exportOptions: { allowPartial: false },
  status: 'draft',
  slides: [],
  createdAt: '2026-07-15T12:00:00Z',
  updatedAt: '2026-07-15T12:00:00Z',
};

describe('useDeckStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    useDeckStore.setState({ currentDeck: null, isLoading: false, error: null });
  });

  test('loads and persists the active deck', async () => {
    vi.mocked(fetchDeck).mockResolvedValue(deck);

    await expect(useDeckStore.getState().loadDeck('deck-21')).resolves.toEqual(deck);

    expect(fetchDeck).toHaveBeenCalledWith('deck-21');
    expect(useDeckStore.getState().currentDeck).toEqual(deck);
    expect(projectSession.getActiveProjectId()).toBe('deck-21');
    expect(useDeckStore.getState().isLoading).toBe(false);
  });

  test('resumes from the persisted deck id', async () => {
    projectSession.setActiveProjectId('deck-21');
    vi.mocked(fetchDeck).mockResolvedValue(deck);

    await useDeckStore.getState().loadDeck();

    expect(fetchDeck).toHaveBeenCalledWith('deck-21');
  });

  test('captures load failures and can clear the session', async () => {
    projectSession.setActiveProjectId('deck-21');
    vi.mocked(fetchDeck).mockRejectedValue(new Error('Deck unavailable'));

    await expect(useDeckStore.getState().loadDeck()).rejects.toThrow('Deck unavailable');
    expect(useDeckStore.getState().error).toBe('Deck unavailable');

    useDeckStore.getState().clearDeck();
    expect(useDeckStore.getState().currentDeck).toBeNull();
    expect(projectSession.getActiveProjectId()).toBeNull();
  });
});
