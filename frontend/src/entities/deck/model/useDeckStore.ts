import { create } from 'zustand';
import { fetchDeck } from '../api/deckRepository';
import { projectSession } from '@/shared/storage/projectSession';
import type { Deck } from './types';

interface DeckState {
  currentDeck: Deck | null;
  isLoading: boolean;
  error: string | null;
  setCurrentDeck: (deck: Deck | null) => void;
  loadDeck: (deckId?: string) => Promise<Deck | null>;
  clearDeck: () => void;
}

const messageFromError = (error: unknown): string =>
  error instanceof Error ? error.message : 'Unable to load deck';

export const useDeckStore = create<DeckState>((set) => ({
  currentDeck: null,
  isLoading: false,
  error: null,

  setCurrentDeck: (deck) => {
    set({ currentDeck: deck, error: null });
    if (deck) {
      projectSession.setActiveProjectId(deck.id);
    }
  },

  loadDeck: async (deckId) => {
    const targetId = deckId || projectSession.getActiveProjectId();
    if (!targetId) return null;

    set({ isLoading: true, error: null });
    try {
      const deck = await fetchDeck(targetId);
      set({ currentDeck: deck });
      projectSession.setActiveProjectId(deck.id);
      return deck;
    } catch (error) {
      set({ error: messageFromError(error) });
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  clearDeck: () => {
    set({ currentDeck: null, error: null, isLoading: false });
    projectSession.clearActiveProjectId();
  },
}));
