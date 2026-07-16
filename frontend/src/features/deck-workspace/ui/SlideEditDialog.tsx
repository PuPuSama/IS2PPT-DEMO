import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Image as ImageIcon,
  Sparkles,
  Upload,
  X,
} from 'lucide-react';
import { Button, Modal, Textarea, useToast } from '@/components/shared';
import InlineSvgImage from '@/components/preview/InlineSvgImage';
import { previewI18n } from '@/config/slidePreviewI18n';
import { useT } from '@/hooks/useT';
import { getImageUrl } from '@/api/client';
import type { Page } from '@/types';
import {
  cloneSlideEditSession,
  descriptionImageUrls,
  emptySlideEditSession,
  slideMetadataDraftFromSlide,
  slideMetadataPatch,
  type SlideEditSession,
  type SlideMetadataDraft,
  type SlideReferenceSelection,
} from '../model/slideEditSession';

interface SelectionPoint {
  x: number;
  y: number;
}

interface SelectionRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface SlideEditCommand {
  slideId: string;
  instruction: string;
  references: SlideReferenceSelection;
}

interface SlideEditDialogProps {
  isOpen: boolean;
  slide: Page | undefined;
  templateAssetPath?: string | null;
  deckUpdatedAt?: string;
  aspectRatioStyle: string;
  onClose: () => void;
  onOpenSvgEditor: () => void;
  onSaveMetadata: (slideId: string, patch: Partial<Page>) => void;
  onSubmitEdit: (command: SlideEditCommand) => Promise<void>;
}

const cloneReferences = (references: SlideReferenceSelection): SlideReferenceSelection => ({
  useTemplate: references.useTemplate,
  descriptionImageUrls: [...references.descriptionImageUrls],
  uploadedFiles: [...references.uploadedFiles],
});

export const SlideEditDialog: React.FC<SlideEditDialogProps> = ({
  isOpen,
  slide,
  templateAssetPath,
  deckUpdatedAt,
  aspectRatioStyle,
  onClose,
  onOpenSvgEditor,
  onSaveMetadata,
  onSubmitEdit,
}) => {
  const t = useT(previewI18n);
  const { show, ToastContainer } = useToast();
  const [metadataDraft, setMetadataDraft] = useState<SlideMetadataDraft>({
    title: '',
    pointsText: '',
    descriptionText: '',
  });
  const [session, setSession] = useState<SlideEditSession>(emptySlideEditSession);
  const [outlineExpanded, setOutlineExpanded] = useState(false);
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  const sessionCacheRef = useRef<Record<string, SlideEditSession>>({});
  const activeSlideIdRef = useRef<string | null>(null);
  const skipCacheWriteRef = useRef(false);

  const imageRef = useRef<HTMLImageElement | null>(null);
  const [regionSelectionEnabled, setRegionSelectionEnabled] = useState(false);
  const [selectingRegion, setSelectingRegion] = useState(false);
  const [selectionStart, setSelectionStart] = useState<SelectionPoint | null>(null);
  const [selectionRect, setSelectionRect] = useState<SelectionRect | null>(null);
  const [uploadedPreviews, setUploadedPreviews] = useState<string[]>([]);

  const slideId = slide?.id;
  const imageUrl = slide?.generated_image_path
    ? getImageUrl(slide.generated_image_path, slide.updated_at)
    : '';

  useEffect(() => {
    if (!isOpen || !slide || !slideId) {
      activeSlideIdRef.current = null;
      return;
    }
    if (activeSlideIdRef.current === slideId) return;

    activeSlideIdRef.current = slideId;
    skipCacheWriteRef.current = true;
    setMetadataDraft(slideMetadataDraftFromSlide(slide));
    setSession(cloneSlideEditSession(sessionCacheRef.current[slideId] ?? emptySlideEditSession()));
    setOutlineExpanded(false);
    setDescriptionExpanded(false);
    setRegionSelectionEnabled(false);
    setSelectingRegion(false);
    setSelectionStart(null);
    setSelectionRect(null);
  }, [isOpen, slide, slideId]);

  useEffect(() => {
    if (!isOpen || !slideId || activeSlideIdRef.current !== slideId) return;
    if (skipCacheWriteRef.current) {
      skipCacheWriteRef.current = false;
      return;
    }
    sessionCacheRef.current[slideId] = cloneSlideEditSession(session);
  }, [isOpen, session, slideId]);

  useEffect(() => {
    const urls = session.references.uploadedFiles.map((file) => URL.createObjectURL(file));
    setUploadedPreviews(urls);
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, [session.references.uploadedFiles]);

  const updateReferences = useCallback((
    updater: (current: SlideReferenceSelection) => SlideReferenceSelection,
  ) => {
    setSession((current) => ({
      ...current,
      references: updater(current.references),
    }));
  }, []);

  const persistMetadata = useCallback(() => {
    if (!slide || !slideId) return;
    const patch = slideMetadataPatch(slide, metadataDraft);
    if (Object.keys(patch).length > 0) {
      onSaveMetadata(slideId, patch);
    }
  }, [metadataDraft, onSaveMetadata, slide, slideId]);

  const handleSubmit = useCallback(async () => {
    if (!slideId || !session.instruction.trim()) return;
    persistMetadata();
    sessionCacheRef.current[slideId] = cloneSlideEditSession(session);
    await onSubmitEdit({
      slideId,
      instruction: session.instruction,
      references: cloneReferences(session.references),
    });
    onClose();
  }, [onClose, onSubmitEdit, persistMetadata, session, slideId]);

  const resetRegionSelection = () => {
    setSelectionStart(null);
    setSelectionRect(null);
    setSelectingRegion(false);
  };

  const handleSelectionMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!regionSelectionEnabled || !imageRef.current) return;
    const bounds = imageRef.current.getBoundingClientRect();
    const x = event.clientX - bounds.left;
    const y = event.clientY - bounds.top;
    if (x < 0 || y < 0 || x > bounds.width || y > bounds.height) return;
    setSelectingRegion(true);
    setSelectionStart({ x, y });
    setSelectionRect(null);
  };

  const handleSelectionMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!regionSelectionEnabled || !selectingRegion || !selectionStart || !imageRef.current) return;
    const bounds = imageRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(event.clientX - bounds.left, bounds.width));
    const y = Math.max(0, Math.min(event.clientY - bounds.top, bounds.height));

    setSelectionRect({
      left: Math.min(selectionStart.x, x),
      top: Math.min(selectionStart.y, y),
      width: Math.abs(x - selectionStart.x),
      height: Math.abs(y - selectionStart.y),
    });
  };

  const handleSelectionMouseUp = () => {
    if (!regionSelectionEnabled || !selectingRegion || !selectionRect || !imageRef.current) {
      setSelectingRegion(false);
      setSelectionStart(null);
      return;
    }

    setSelectingRegion(false);
    setSelectionStart(null);
    const image = imageRef.current;
    const { left, top, width, height } = selectionRect;
    if (width < 10 || height < 10) return;
    if (!image.naturalWidth || !image.naturalHeight || !image.clientWidth || !image.clientHeight) return;

    const scaleX = image.naturalWidth / image.clientWidth;
    const scaleY = image.naturalHeight / image.clientHeight;
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(width * scaleX));
    canvas.height = Math.max(1, Math.round(height * scaleY));
    const context = canvas.getContext('2d');
    if (!context) return;

    try {
      context.drawImage(
        image,
        left * scaleX,
        top * scaleY,
        width * scaleX,
        height * scaleY,
        0,
        0,
        canvas.width,
        canvas.height,
      );
      canvas.toBlob((blob) => {
        if (!blob) return;
        const file = new File([blob], `crop-${Date.now()}.png`, { type: 'image/png' });
        updateReferences((current) => ({
          ...current,
          uploadedFiles: [...current.uploadedFiles, file],
        }));
        show({ message: t('slidePreview.regionCropSuccess'), type: 'success' });
      }, 'image/png');
    } catch (error) {
      console.error('Failed to crop the selected slide region:', error);
      show({ message: t('slidePreview.regionCropFailed'), type: 'error' });
    }
  };

  const handleUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    updateReferences((current) => ({
      ...current,
      uploadedFiles: [...current.uploadedFiles, ...files],
    }));
    event.target.value = '';
  };

  const availableDescriptionImages = descriptionImageUrls(slide?.description_content);

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={t('preview.editPage')}
        size="lg"
      >
        <div className="space-y-4">
          <div
            className="bg-gray-100 dark:bg-background-secondary rounded-lg overflow-hidden relative"
            style={{ aspectRatio: aspectRatioStyle }}
            onMouseDown={handleSelectionMouseDown}
            onMouseMove={handleSelectionMouseMove}
            onMouseUp={handleSelectionMouseUp}
            onMouseLeave={handleSelectionMouseUp}
          >
            {imageUrl && (
              <>
                {!slide?.generated_svg_url && (
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      setRegionSelectionEnabled((enabled) => !enabled);
                      resetRegionSelection();
                    }}
                    className="absolute top-2 left-2 z-10 px-2 py-1 rounded bg-white/80 text-[10px] text-gray-700 dark:text-foreground-secondary hover:bg-brand-50 dark:hover:bg-background-hover shadow-sm dark:shadow-background-primary/30 flex items-center gap-1"
                  >
                    <Sparkles size={12} />
                    <span>
                      {regionSelectionEnabled
                        ? t('preview.endRegionSelect')
                        : t('preview.regionSelect')}
                    </span>
                  </button>
                )}

                {slide?.generated_svg_url && slideId && (
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      onOpenSvgEditor();
                    }}
                    className="absolute top-2 right-2 z-10 px-2 py-1 rounded bg-white/80 text-[10px] text-gray-700 dark:text-foreground-secondary hover:bg-brand-50 dark:hover:bg-background-hover shadow-sm dark:shadow-background-primary/30 flex items-center gap-1"
                  >
                    <Sparkles size={12} />
                    <span>编辑 SVG</span>
                  </button>
                )}

                {slide?.generated_svg_url ? (
                  <InlineSvgImage
                    svgUrl={slide.generated_svg_url}
                    fallbackUrl={slide.generated_image_path!}
                    alt="Current slide"
                    updatedAt={slide.updated_at}
                    className="w-full h-full object-contain select-none"
                  />
                ) : (
                  <img
                    ref={imageRef}
                    src={imageUrl}
                    alt="Current slide"
                    className="w-full h-full object-contain select-none"
                    draggable={false}
                    crossOrigin="anonymous"
                  />
                )}
                {selectionRect && (
                  <div
                    className="absolute border-2 border-brand-500 bg-brand-400/10 pointer-events-none"
                    style={selectionRect}
                  />
                )}
              </>
            )}
          </div>

          <div className="bg-gray-50 dark:bg-background-primary rounded-lg border border-gray-200 dark:border-border-primary">
            <button
              type="button"
              onClick={() => setOutlineExpanded((expanded) => !expanded)}
              className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-100 dark:hover:bg-background-hover transition-colors"
            >
              <h4 className="text-sm font-semibold text-gray-700 dark:text-foreground-secondary">
                {t('preview.pageOutline')}
              </h4>
              {outlineExpanded
                ? <ChevronUp size={18} className="text-gray-500 dark:text-foreground-tertiary" />
                : <ChevronDown size={18} className="text-gray-500 dark:text-foreground-tertiary" />}
            </button>
            {outlineExpanded && (
              <div className="px-4 pb-4 space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-foreground-tertiary mb-1">
                    {t('outline.titleLabel')}
                  </label>
                  <input
                    type="text"
                    value={metadataDraft.title}
                    onChange={(event) => setMetadataDraft((draft) => ({
                      ...draft,
                      title: event.target.value,
                    }))}
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-border-primary bg-white dark:bg-background-secondary text-gray-900 dark:text-foreground-primary rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
                    placeholder={t('preview.enterTitle')}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-foreground-tertiary mb-1">
                    {t('preview.pointsPerLine')}
                  </label>
                  <textarea
                    value={metadataDraft.pointsText}
                    onChange={(event) => setMetadataDraft((draft) => ({
                      ...draft,
                      pointsText: event.target.value,
                    }))}
                    rows={4}
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-border-primary bg-white dark:bg-background-secondary text-gray-900 dark:text-foreground-primary rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
                    placeholder={t('preview.enterPointsPerLine')}
                  />
                </div>
              </div>
            )}
          </div>

          <div className="bg-blue-50 dark:bg-blue-900/30 rounded-lg border border-blue-200 dark:border-blue-700">
            <button
              type="button"
              onClick={() => setDescriptionExpanded((expanded) => !expanded)}
              className="w-full px-4 py-3 flex items-center justify-between hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
            >
              <h4 className="text-sm font-semibold text-gray-700 dark:text-foreground-secondary">
                {t('preview.pageDescription')}
              </h4>
              {descriptionExpanded
                ? <ChevronUp size={18} className="text-gray-500 dark:text-foreground-tertiary" />
                : <ChevronDown size={18} className="text-gray-500 dark:text-foreground-tertiary" />}
            </button>
            {descriptionExpanded && (
              <div className="px-4 pb-4">
                <textarea
                  value={metadataDraft.descriptionText}
                  onChange={(event) => setMetadataDraft((draft) => ({
                    ...draft,
                    descriptionText: event.target.value,
                  }))}
                  rows={8}
                  className="w-full px-3 py-2 text-sm border border-blue-300 dark:border-blue-700 bg-white dark:bg-background-secondary text-gray-900 dark:text-foreground-primary rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
                  placeholder={t('preview.enterDescription')}
                />
              </div>
            )}
          </div>

          <div className="bg-gray-50 dark:bg-background-primary rounded-lg border border-gray-200 dark:border-border-primary p-4 space-y-4">
            <h4 className="text-sm font-semibold text-gray-700 dark:text-foreground-secondary mb-3">
              {t('preview.selectContextImages')}
            </h4>

            {templateAssetPath && (
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="use-template"
                  checked={session.references.useTemplate}
                  onChange={(event) => updateReferences((current) => ({
                    ...current,
                    useTemplate: event.target.checked,
                  }))}
                  className="w-4 h-4 text-brand-600 rounded focus:ring-brand-500"
                />
                <label htmlFor="use-template" className="flex items-center gap-2 cursor-pointer">
                  <ImageIcon size={16} className="text-gray-500 dark:text-foreground-tertiary" />
                  <span className="text-sm text-gray-700 dark:text-foreground-secondary">
                    {t('preview.useTemplateImage')}
                  </span>
                  <img
                    src={getImageUrl(templateAssetPath, deckUpdatedAt)}
                    alt="Template"
                    className="w-16 h-10 object-cover rounded border border-gray-300 dark:border-border-primary"
                  />
                </label>
              </div>
            )}

            {availableDescriptionImages.length > 0 && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 dark:text-foreground-secondary">
                  {t('preview.imagesInDescription')}:
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {availableDescriptionImages.map((url, index) => {
                    const selected = session.references.descriptionImageUrls.includes(url);
                    return (
                      <button
                        key={`${url}-${index}`}
                        type="button"
                        className="relative group"
                        onClick={() => updateReferences((current) => ({
                          ...current,
                          descriptionImageUrls: selected
                            ? current.descriptionImageUrls.filter((candidate) => candidate !== url)
                            : [...current.descriptionImageUrls, url],
                        }))}
                      >
                        <img
                          src={url}
                          alt={`Desc image ${index + 1}`}
                          className="w-full h-20 object-cover rounded border-2 border-gray-300 dark:border-border-primary transition-all"
                          style={{
                            borderColor: selected
                              ? 'var(--brand-yellow)'
                              : 'var(--border-primary)',
                          }}
                        />
                        {selected && (
                          <span className="absolute inset-0 bg-brand-500/20 border-2 border-brand-500 rounded flex items-center justify-center">
                            <span className="w-6 h-6 bg-brand-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                              ✓
                            </span>
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-foreground-secondary">
                {t('preview.uploadImages')}:
              </label>
              <div className="flex flex-wrap gap-2">
                {session.references.uploadedFiles.map((_, index) => (
                  <div key={index} className="relative group">
                    <img
                      src={uploadedPreviews[index] ?? ''}
                      alt={`Uploaded ${index + 1}`}
                      className="w-20 h-20 object-cover rounded border border-gray-300 dark:border-border-primary"
                    />
                    <button
                      type="button"
                      onClick={() => updateReferences((current) => ({
                        ...current,
                        uploadedFiles: current.uploadedFiles.filter((__, candidate) => candidate !== index),
                      }))}
                      className="no-min-touch-target absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      aria-label={`${t('common.delete')} ${index + 1}`}
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
                <label className="w-20 h-20 border-2 border-dashed border-gray-300 dark:border-border-primary rounded flex flex-col items-center justify-center cursor-pointer hover:border-brand-500 transition-colors">
                  <Upload size={20} className="text-gray-400 mb-1" />
                  <span className="text-xs text-gray-500 dark:text-foreground-tertiary">
                    {t('preview.upload')}
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={handleUpload}
                  />
                </label>
              </div>
            </div>
          </div>

          <Textarea
            label={t('preview.editPromptLabel')}
            placeholder={t('preview.editPromptPlaceholder')}
            value={session.instruction}
            onChange={(event) => setSession((current) => ({
              ...current,
              instruction: event.target.value,
            }))}
            rows={4}
          />
          <div className="flex justify-between gap-3">
            <Button
              variant="secondary"
              onClick={() => {
                persistMetadata();
                onClose();
              }}
            >
              {t('preview.saveOutlineOnly')}
            </Button>
            <div className="flex gap-3">
              <Button variant="ghost" onClick={onClose}>
                {t('common.cancel')}
              </Button>
              <Button
                variant="primary"
                onClick={() => void handleSubmit()}
                disabled={!session.instruction.trim() || !slide?.generated_image_path}
              >
                {t('preview.generateImage')}
              </Button>
            </div>
          </div>
        </div>
      </Modal>
      <ToastContainer />
    </>
  );
};
