import { STORAGE_KEYS } from './storageKeys';

export const DEFAULT_DESCRIPTION_FIELDS = ['视觉元素', '视觉焦点', '排版布局', '演讲者备注'] as const;

export const getDefaultDescriptionFields = () => [...DEFAULT_DESCRIPTION_FIELDS];

const normalizeFields = (value: unknown) => {
  if (!Array.isArray(value)) return [];

  return value.filter((field): field is string =>
    typeof field === 'string' && field.trim().length > 0
  );
};

export const extraFieldCatalog = {
  read: () => {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.availableExtraFields);
      const parsed = stored ? JSON.parse(stored) : null;
      const fields = normalizeFields(parsed);
      return fields.length > 0 ? fields : getDefaultDescriptionFields();
    } catch {
      return getDefaultDescriptionFields();
    }
  },

  save: (fields: string[]) => {
    localStorage.setItem(STORAGE_KEYS.availableExtraFields, JSON.stringify(fields));
  },

  mergeAndSave: (baseFields: string[], fieldsToMerge: string[]) => {
    const merged = [...new Set([...baseFields, ...fieldsToMerge])];
    extraFieldCatalog.save(merged);
    return merged;
  },
};
