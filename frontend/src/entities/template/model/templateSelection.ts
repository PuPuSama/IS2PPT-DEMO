export type TemplateReference =
  | { kind: 'preset'; templateId: string }
  | { kind: 'library'; templateId: string };

export type TemplateChoice =
  | TemplateReference
  | { kind: 'library'; templateId: string; file: File }
  | { kind: 'upload'; file: File };

export const templateReferenceFromChoice = (
  choice: TemplateChoice | null,
): TemplateReference | null => {
  if (!choice || choice.kind === 'upload') return null;
  return { kind: choice.kind, templateId: choice.templateId };
};

export const templateFileFromChoice = (
  choice: TemplateChoice | null,
): File | undefined => (
  choice?.kind === 'upload' || (choice?.kind === 'library' && 'file' in choice)
    ? choice.file
    : undefined
);

export const templateIdFromChoice = (
  choice: TemplateChoice | null,
): string | undefined => (
  choice && choice.kind !== 'upload' ? choice.templateId : undefined
);
