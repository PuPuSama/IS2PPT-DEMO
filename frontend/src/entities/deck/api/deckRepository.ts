import {
  deleteProject,
  getProject,
  listProjects,
  updateProject,
} from '@/api/projectsApi';
import { deckToProjectUpdateDto, projectDtoToDeck } from '../model/projectMapper';
import type { Deck } from '../model/types';

export interface DeckListPage {
  decks: Deck[];
  total: number;
}

export const listDecks = async (limit?: number, offset?: number): Promise<DeckListPage> => {
  const response = await listProjects(limit, offset);
  const page = response.data;

  return {
    decks: page?.projects.map(projectDtoToDeck) ?? [],
    total: page?.total ?? 0,
  };
};

export const fetchDeck = async (deckId: string): Promise<Deck> => {
  const response = await getProject(deckId);
  if (!response.data) {
    throw new Error(`Deck ${deckId} was not returned by the API`);
  }
  return projectDtoToDeck(response.data);
};

export const renameDeck = async (deckId: string, title: string): Promise<void> => {
  await updateProject(deckId, deckToProjectUpdateDto({ title }));
};

export const deleteDeck = async (deckId: string): Promise<void> => {
  await deleteProject(deckId);
};
