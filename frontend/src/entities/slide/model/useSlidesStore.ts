import { create } from 'zustand';
import type { Slide, SlideUpdate } from './types';

interface SlidesState {
  slides: Slide[];
  replaceSlides: (slides: Slide[]) => void;
  updateSlide: (slideId: string, update: SlideUpdate) => void;
  reorderSlides: (slideIds: string[]) => void;
  appendSlide: (slide: Slide) => void;
  removeSlide: (slideId: string) => void;
  clearSlides: () => void;
}

export const useSlidesStore = create<SlidesState>((set) => ({
  slides: [],

  replaceSlides: (slides) => set({ slides: [...slides] }),

  updateSlide: (slideId, update) => set((state) => ({
    slides: state.slides.map((slide) => (
      slide.id === slideId ? { ...slide, ...update } : slide
    )),
  })),

  reorderSlides: (slideIds) => set((state) => {
    const slidesById = new Map(state.slides.map((slide) => [slide.id, slide]));
    const reordered = slideIds
      .map((slideId) => slidesById.get(slideId))
      .filter((slide): slide is Slide => Boolean(slide))
      .map((slide, position) => ({ ...slide, position }));
    return { slides: reordered };
  }),

  appendSlide: (slide) => set((state) => ({ slides: [...state.slides, slide] })),

  removeSlide: (slideId) => set((state) => ({
    slides: state.slides.filter((slide) => slide.id !== slideId),
  })),

  clearSlides: () => set({ slides: [] }),
}));
