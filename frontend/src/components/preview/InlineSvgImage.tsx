import { useEffect, useRef, useState } from 'react';
import { getImageUrl } from '@/api/client';

/**
 * Lazily inject the @font-face for the SVG whitelist font the FIRST time an inline
 * SVG preview is shown. The TTF is large (~16MB) so it's never loaded eagerly; the
 * browser fetches it once (cached immutable) and substitutes a fallback until ready
 * (font-display:swap). The family name must match what the SVG declares and what
 * resvg/PPTX use: "Noto Sans CJK SC".
 */
let _fontInjected = false;
function ensureSvgPreviewFont() {
  if (_fontInjected || typeof document === 'undefined') return;
  _fontInjected = true;
  const style = document.createElement('style');
  style.setAttribute('data-svg-preview-font', '');
  style.textContent =
    // The .ttf is actually OpenType/CFF (first bytes 'OTTO'), so hint 'opentype'.
    "@font-face{font-family:'Noto Sans CJK SC';" +
    "src:url('/files/fonts/NotoSansSC-Regular.ttf') format('opentype');" +
    'font-weight:normal;font-style:normal;font-display:swap;}';
  document.head.appendChild(style);
}

interface InlineSvgImageProps {
  svgUrl: string;        // vector source (/files/{project}/pages/x.svg)
  fallbackUrl: string;   // PNG shown while the SVG loads or if it fails
  alt: string;
  className?: string;
  updatedAt?: string;    // cache-busting (mirrors getImageUrl on the PNG)
}

/**
 * Renders a generated slide as an inline vector <svg> so it stays crisp at any zoom
 * (the PNG is a fixed 2560px raster). Falls back to the PNG while loading or on any
 * fetch/parse failure, so it's always safe to use in place of the <img>.
 *
 * The SVG is inlined into the DOM (not via <img>/<object>) on purpose: only inline
 * SVG picks up the document @font-face, so the CJK text matches resvg/PPTX output.
 */
export default function InlineSvgImage({ svgUrl, fallbackUrl, alt, className, updatedAt }: InlineSvgImageProps) {
  const [markup, setMarkup] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    setMarkup(null);
    setFailed(false);
    ensureSvgPreviewFont();
    fetch(getImageUrl(svgUrl, updatedAt))
      .then((r) => (r.ok ? r.text() : Promise.reject(new Error(String(r.status)))))
      .then((txt) => {
        if (cancelled) return;
        if (txt.includes('<svg')) setMarkup(txt);
        else setFailed(true);
      })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [svgUrl, updatedAt]);

  // Make the injected <svg> fill the wrapper (override any fixed width/height attrs).
  useEffect(() => {
    const svg = hostRef.current?.querySelector('svg');
    if (svg) {
      svg.setAttribute('width', '100%');
      svg.setAttribute('height', '100%');
      (svg as SVGSVGElement).style.display = 'block';
    }
  }, [markup]);

  if (failed || !markup) {
    return <img src={getImageUrl(fallbackUrl, updatedAt)} alt={alt} className={className} />;
  }
  return (
    <div
      ref={hostRef}
      role="img"
      aria-label={alt}
      className={className}
      // Backend-generated, contract-validated SVG (no script/foreignObject/external
      // refs by contract; same-origin). Inlined so the @font-face webfont applies.
      dangerouslySetInnerHTML={{ __html: markup }}
    />
  );
}
