export interface ExportSlideReference {
  page_id: string;
  id?: string;
}

export interface ExportSelectionLabel {
  key: string;
  values?: Record<string, number>;
}

export const describeExportSelection = (
  slideIds: string[] | undefined,
  slides: ExportSlideReference[],
): ExportSelectionLabel => {
  if (!slideIds?.length) {
    return { key: 'export.allPages' };
  }

  const requestedIds = [...new Set(slideIds)];
  const positions = requestedIds
    .map((slideId) => slides.findIndex((slide) => (slide.id || slide.page_id) === slideId))
    .filter((position) => position >= 0)
    .sort((left, right) => left - right);

  if (positions.length !== requestedIds.length) {
    return { key: 'export.pagesCount', values: { count: requestedIds.length } };
  }

  const first = positions[0];
  const last = positions[positions.length - 1];
  const isContinuous = positions.length === last - first + 1;

  if (!isContinuous) {
    return { key: 'export.pagesCount', values: { count: requestedIds.length } };
  }

  if (first === last) {
    return { key: 'export.singlePage', values: { num: first + 1 } };
  }

  return {
    key: 'export.pageRange',
    values: { start: first + 1, end: last + 1 },
  };
};
