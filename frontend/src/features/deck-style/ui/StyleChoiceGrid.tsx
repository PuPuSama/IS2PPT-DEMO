import { ImagePlus, Loader2, Trash2 } from 'lucide-react';
import type { UserStyleTemplate } from '@/api/templatesApi';
import { PRESET_STYLE_CATALOG } from '../model/presetStyleCatalog';

interface StyleChoiceGridProps {
  styles: UserStyleTemplate[];
  deletingStyleId: string | null;
  extracting: boolean;
  translate: (key: string) => string;
  onChoose: (description: string) => void;
  onDelete: (styleId: string) => void;
  onExtractRequest: () => void;
}

export function StyleChoiceGrid({
  styles,
  deletingStyleId,
  extracting,
  translate,
  onChoose,
  onDelete,
  onExtractRequest,
}: StyleChoiceGridProps) {
  return (
    <div className="space-y-4">
      {styles.length > 0 && (
        <section aria-labelledby="personal-style-title" className="space-y-2">
          <h4
            id="personal-style-title"
            className="text-xs font-medium text-gray-600 dark:text-foreground-tertiary"
          >
            {translate('myStylesLabel')}
          </h4>
          <div className="flex flex-wrap gap-2">
            {styles.map((style) => (
              <div key={style.id} className="group relative">
                <button
                  type="button"
                  title={style.description}
                  onClick={() => onChoose(style.description)}
                  className="flex h-8 items-center gap-2 rounded-md border border-brand-200 bg-brand-50 px-3 pr-8 text-xs font-medium text-brand-700 transition-colors hover:border-brand-400 hover:bg-brand-100 dark:border-brand/30 dark:bg-brand/10 dark:text-brand dark:hover:border-brand dark:hover:bg-brand/20"
                >
                  <span
                    className="h-2.5 w-2.5 flex-none rounded-full ring-1 ring-black/10"
                    style={{ backgroundColor: style.color || '#2563EB' }}
                  />
                  {style.name}
                </button>
                <button
                  type="button"
                  title={translate('deleteStyle')}
                  aria-label={`${translate('deleteStyle')}: ${style.name}`}
                  disabled={deletingStyleId === style.id}
                  onClick={() => onDelete(style.id)}
                  className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-md text-red-600 opacity-0 transition-opacity hover:bg-red-50 disabled:cursor-not-allowed group-hover:opacity-100 group-focus-within:opacity-100 dark:hover:bg-red-950/40"
                >
                  {deletingStyleId === style.id
                    ? <Loader2 size={13} className="animate-spin" />
                    : <Trash2 size={13} />}
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      <section aria-labelledby="preset-style-title" className="space-y-2">
        <h4
          id="preset-style-title"
          className="text-xs font-medium text-gray-600 dark:text-foreground-tertiary"
        >
          {translate('presetStylesLabel')}
        </h4>
        <div className="flex flex-wrap gap-2">
          {PRESET_STYLE_CATALOG.map((preset) => (
            <div key={preset.id} className="group relative">
              <button
                type="button"
                onClick={() => onChoose(translate(preset.descriptionKey))}
                className="flex h-8 items-center gap-2 rounded-md border border-gray-200 px-3 text-xs font-medium transition-colors hover:border-brand-400 hover:bg-brand-50 dark:border-border-primary dark:text-foreground-secondary dark:hover:border-brand dark:hover:bg-background-hover"
              >
                <span
                  className="h-2.5 w-2.5 flex-none rounded-full ring-1 ring-black/10"
                  style={{ backgroundColor: preset.accentColor }}
                />
                {translate(preset.nameKey)}
              </button>
              <div className="invisible absolute bottom-full left-1/2 z-50 mb-2 w-72 -translate-x-1/2 rounded-md border border-gray-200 bg-white p-2.5 opacity-0 shadow-xl transition-opacity group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100 dark:border-border-primary dark:bg-background-secondary dark:shadow-none">
                <img
                  src={preset.previewImage}
                  alt=""
                  className="h-40 w-full rounded object-cover"
                />
                <p className="mt-2 line-clamp-3 text-xs text-gray-600 dark:text-foreground-tertiary">
                  {translate(preset.descriptionKey)}
                </p>
              </div>
            </div>
          ))}

          <button
            type="button"
            onClick={onExtractRequest}
            disabled={extracting}
            className="flex h-8 items-center gap-1.5 rounded-md border border-dashed border-gray-300 px-3 text-xs font-medium transition-colors hover:border-brand-400 hover:bg-brand-50 disabled:cursor-wait disabled:opacity-60 dark:border-border-primary dark:text-foreground-secondary dark:hover:border-brand dark:hover:bg-background-hover"
          >
            {extracting
              ? <Loader2 size={13} className="animate-spin" />
              : <ImagePlus size={13} />}
            {translate(extracting ? 'extracting' : 'extractFromImage')}
          </button>
        </div>
      </section>
    </div>
  );
}
