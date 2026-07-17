export const STYLE_ACCENT_PALETTE = [
  '#DC2626',
  '#EA580C',
  '#CA8A04',
  '#16A34A',
  '#0891B2',
  '#2563EB',
  '#7C3AED',
  '#DB2777',
] as const;

export const styleAccentFor = (value: string): string => {
  const normalized = value.trim().toLowerCase();
  let hash = 0;

  for (const character of normalized) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  }

  return STYLE_ACCENT_PALETTE[hash % STYLE_ACCENT_PALETTE.length];
};
