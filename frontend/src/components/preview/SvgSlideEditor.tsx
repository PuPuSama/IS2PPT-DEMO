import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Code2, Eye, Group as GroupIcon, Loader2, Minus, Plus, RotateCcw, Save, Ungroup as UngroupIcon, X } from 'lucide-react';
import { getPageSvg, savePageSvg } from '@/api/endpoints';

/**
 * In-frontend slide editor for SVG-generation-mode pages.
 *
 * The slide *is* an SVG, so editing the slide = editing the SVG. A single `svgText`
 * source of truth backs these interactions:
 *   • Text:   click a <text> → an HTML input pops over it for inline copy edits.
 *   • Vector: click an icon / shape → a selection box with corner handles; drag the
 *     body to move, drag a corner to scale. Changes are written as an SVG transform.
 *   • Group:  a multi-element icon authored as `<g data-role="icon">` selects as ONE
 *     unit. Marquee-drag empty canvas (or shift-click) selects several elements; the
 *     "组合"/Ctrl+G action wraps them in a real `<g data-role="group">` so they move /
 *     scale together; "取消组合"/Ctrl+Shift+G unwraps a group (baking its transform
 *     onto the children so they don't jump).
 *   • Code:   a textarea exposes the raw SVG for power edits.
 *
 * Move / scale apply the SAME affine transform to every selected element about a shared
 * anchor (the opposite corner of the combined box), which scales the whole arrangement
 * correctly without needing a wrapper element — grouping is only for *persisting* the
 * unit into the saved SVG (and matching the PPTX export's data-role semantics).
 *
 * Direct DOM mutations (text commit / move / resize / group / ungroup) set `svgText`
 * for saving but skip re-injecting the SVG (suppressInject), so live element identity —
 * and the current selection — survive a gesture. Edits from the code panel / reset DO
 * re-inject. Saving PUTs the SVG; the backend validates, re-renders a PNG and persists.
 *
 * Rendered through a portal to <body> so it overlays above the shared Modal (z-50).
 */

function ensureEditorFont() {
  if (typeof document === 'undefined') return;
  if (document.querySelector('style[data-svg-preview-font]')) return;
  const style = document.createElement('style');
  style.setAttribute('data-svg-preview-font', '');
  style.textContent =
    "@font-face{font-family:'Noto Sans CJK SC';" +
    "src:url('/files/fonts/NotoSansSC-Regular.ttf') format('opentype');" +
    'font-weight:normal;font-style:normal;font-display:swap;}';
  document.head.appendChild(style);
}

const SELECTABLE = new Set(['path', 'polygon', 'polyline', 'circle', 'ellipse', 'rect']);
// data-role values that mark a deliberate, movable-as-one unit. Clicking any child of
// such a <g> selects the whole group (icons authored by the generator; user-made groups).
const UNIT_ROLES = new Set(['icon', 'group']);
type Corner = 'tl' | 'tr' | 'bl' | 'br';
const CORNERS: Corner[] = ['tl', 'tr', 'bl', 'br'];

// A rect that (almost) fills the canvas is the page background — never selectable.
function isBackgroundRect(el: Element, fullW: number, fullH: number): boolean {
  if (el.tagName.toLowerCase() !== 'rect') return false;
  const w = parseFloat(el.getAttribute('width') || '0');
  const h = parseFloat(el.getAttribute('height') || '0');
  return w >= fullW * 0.92 && h >= fullH * 0.92;
}

// From a clicked leaf, walk up to the OUTERMOST ancestor <g> tagged with a UNIT_ROLE.
// That makes a whole icon / group select as one; falls back to the leaf when ungrouped.
function selectionUnit(el: SVGGraphicsElement, svg: Element): SVGGraphicsElement {
  let unit: SVGGraphicsElement = el;
  let cur: Element | null = el.parentElement;
  while (cur && cur !== svg) {
    if (cur.tagName.toLowerCase() === 'g') {
      const role = (cur.getAttribute('data-role') || '').toLowerCase();
      if (UNIT_ROLES.has(role)) unit = cur as unknown as SVGGraphicsElement;
    }
    cur = cur.parentElement;
  }
  return unit;
}

// A unit covering more than this fraction of the canvas is a "surface" (card / big
// rect): dragging over it marquees the small things inside instead of moving it.
const SMALL_AREA_FRAC = 0.1;
const ZOOM_MIN = 0.5, ZOOM_MAX = 8;
const clampZoom = (z: number) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));
function isSmallUnit(el: Element, host: HTMLElement | null): boolean {
  if (!host) return true;
  const hr = host.getBoundingClientRect();
  const r = (el as SVGGraphicsElement).getBoundingClientRect();
  const hostArea = hr.width * hr.height || 1;
  return (r.width * r.height) / hostArea < SMALL_AREA_FRAC;
}

// Every distinct selectable unit on the canvas (for marquee hit-testing).
function collectUnits(svg: Element, fullW: number, fullH: number): SVGGraphicsElement[] {
  const out = new Set<SVGGraphicsElement>();
  svg.querySelectorAll('path, polygon, polyline, circle, ellipse, rect').forEach((node) => {
    const el = node as SVGGraphicsElement;
    const tag = el.tagName.toLowerCase();
    if (!SELECTABLE.has(tag)) return;
    if (isBackgroundRect(el, fullW, fullH)) return;
    out.add(selectionUnit(el, svg));
  });
  return Array.from(out);
}

interface EditingState {
  left: number; top: number; width: number; height: number; fontSize: number;
  value: string; el: SVGTextElement;
}
interface Box { left: number; top: number; width: number; height: number; }
interface SelMeta { count: number; canGroup: boolean; canUngroup: boolean; }

interface SvgSlideEditorProps {
  projectId: string;
  pageId: string;
  onClose: () => void;
  onSaved: () => void;
}

export default function SvgSlideEditor({ projectId, pageId, onClose, onSaved }: SvgSlideEditorProps) {
  const [svgText, setSvgText] = useState<string>('');
  const [originalSvg, setOriginalSvg] = useState<string>('');
  const [showCode, setShowCode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<EditingState | null>(null);
  const [selBox, setSelBox] = useState<Box | null>(null);
  const [selMeta, setSelMeta] = useState<SelMeta>({ count: 0, canGroup: false, canUngroup: false });
  const [marqueeBox, setMarqueeBox] = useState<Box | null>(null);
  const [zoom, setZoom] = useState(1);

  const viewportRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef<SVGGraphicsElement[]>([]);
  const suppressInject = useRef(false);
  const gesture = useRef<any>(null);
  const marqueeRef = useRef<Box | null>(null);

  // ---- load source SVG ----
  useEffect(() => {
    let cancelled = false;
    ensureEditorFont();
    setLoading(true);
    getPageSvg(projectId, pageId)
      .then((res) => {
        if (cancelled) return;
        const svg = res?.data?.svg || '';
        setSvgText(svg);
        setOriginalSvg(svg);
      })
      .catch((e) => { if (!cancelled) setError(e?.message || '加载 SVG 失败'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [projectId, pageId]);

  const syncFromDom = useCallback(() => {
    const svg = hostRef.current?.querySelector('svg');
    if (!svg) return;
    suppressInject.current = true; // DOM is already correct — don't blow it away
    setSvgText(new XMLSerializer().serializeToString(svg));
  }, []);

  // geometry helpers (screen <-> SVG user units; viewBox fills the host)
  const viewBox = useCallback(() => {
    const svg = hostRef.current?.querySelector('svg') as SVGSVGElement | null;
    const vb = svg?.viewBox?.baseVal;
    return { w: vb && vb.width ? vb.width : 1280, h: vb && vb.height ? vb.height : 720 };
  }, []);

  // Combined (union) box of the current selection, in host-local coords.
  const recomputeBox = useCallback(() => {
    const host = hostRef.current;
    const els = selectedRef.current;
    if (!host || !els.length) { setSelBox(null); return; }
    const hr = host.getBoundingClientRect();
    let l = Infinity, t = Infinity, r = -Infinity, b = -Infinity;
    els.forEach((el) => {
      const x = el.getBoundingClientRect();
      l = Math.min(l, x.left); t = Math.min(t, x.top);
      r = Math.max(r, x.right); b = Math.max(b, x.bottom);
    });
    setSelBox({ left: l - hr.left, top: t - hr.top, width: r - l, height: b - t });
  }, []);

  const setSelection = useCallback((els: SVGGraphicsElement[]) => {
    setEditing(null);
    selectedRef.current = els;
    recomputeBox();
    setSelMeta({
      count: els.length,
      canGroup: els.length >= 2,
      canUngroup: els.length === 1 && els[0].tagName.toLowerCase() === 'g',
    });
  }, [recomputeBox]);

  const deselect = useCallback(() => { setSelection([]); }, [setSelection]);

  // Open the inline input positioned over a clicked <text>.
  const beginEdit = useCallback((el: SVGTextElement) => {
    const host = hostRef.current;
    if (!host) return;
    deselect();
    const tr = el.getBoundingClientRect();
    const hr = host.getBoundingClientRect();
    setEditing({
      el, value: el.textContent ?? '',
      left: tr.left - hr.left, top: tr.top - hr.top,
      width: Math.max(tr.width, 40), height: Math.max(tr.height, 16),
      fontSize: Math.max(tr.height * 0.78, 10),
    });
  }, [deselect]);

  const commitEdit = useCallback(() => {
    setEditing((cur) => {
      if (cur) { cur.el.textContent = cur.value; syncFromDom(); }
      return null;
    });
  }, [syncFromDom]);

  // ---- group / ungroup ----
  const group = useCallback(() => {
    const host = hostRef.current;
    const els = selectedRef.current;
    if (!host || els.length < 2) return;
    const svg = host.querySelector('svg');
    if (!svg) return;
    // document order, so the wrapper preserves the original stacking of its children
    const ordered = [...els].sort((a, b) =>
      a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1);
    const last = ordered[ordered.length - 1];
    const parent = last.parentNode;
    if (!parent) return;
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('data-role', 'group');
    parent.insertBefore(g, last.nextSibling); // wrapper sits at the topmost member's z
    ordered.forEach((el) => g.appendChild(el)); // moves children in, preserving order
    setSelection([g as unknown as SVGGraphicsElement]);
    syncFromDom();
  }, [setSelection, syncFromDom]);

  const ungroup = useCallback(() => {
    const host = hostRef.current;
    const els = selectedRef.current;
    if (!host || els.length !== 1) return;
    const g = els[0];
    if (g.tagName.toLowerCase() !== 'g') return;
    const parent = g.parentNode;
    if (!parent) return;
    const gt = g.getAttribute('transform') || '';
    const moved: SVGGraphicsElement[] = [];
    // bake the group's transform onto each child so nothing visually jumps, then lift
    // the children out to the group's parent at the group's position.
    Array.from(g.childNodes).forEach((child) => {
      if (child.nodeType === 1) {
        const el = child as SVGGraphicsElement;
        if (gt) {
          const ct = el.getAttribute('transform') || '';
          el.setAttribute('transform', `${gt} ${ct}`.trim());
        }
        moved.push(el);
      }
      parent.insertBefore(child, g);
    });
    parent.removeChild(g);
    setSelection(moved);
    syncFromDom();
  }, [setSelection, syncFromDom]);

  // ---- inject SVG + wire text-edit / vector-select ----
  useEffect(() => {
    if (editing) return;                 // keep DOM stable while typing
    const host = hostRef.current;
    if (!host || !svgText) return;

    // After a direct DOM edit (move / resize / text commit / group) the DOM is already
    // correct, so we MUST NOT re-inject (it would lose the live element identity +
    // selection). But React already ran this effect's cleanup, detaching every click
    // listener — so we still fall through to RE-ATTACH them to the existing nodes.
    // Only a fresh source (code panel / reset / first load) re-injects + deselects.
    if (suppressInject.current) {
      suppressInject.current = false;
    } else {
      host.innerHTML = svgText;
      deselect();
    }

    const svg = host.querySelector('svg');
    if (!svg) return;
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');
    (svg as SVGSVGElement).style.display = 'block';

    // Affordances only (cursor + hover outline). Actual selection / edit / move is
    // driven centrally by the canvas pointer handlers via a hit-test (see
    // unitsUnderPoint), so overlapping elements resolve to the *smallest* one — a small
    // icon wins over the big card / background it sits on, instead of whatever happens
    // to be topmost at that pixel.
    const cleanups: Array<() => void> = [];
    (Array.from(svg.querySelectorAll('text')) as SVGTextElement[]).forEach((el) => {
      el.style.cursor = isSmallUnit(el, host) ? 'move' : 'crosshair'; // small=grab, big=marquee surface
      el.style.pointerEvents = 'bounding-box';  // hittable across the whole text box
      const onEnter = () => { el.style.outline = '1px dashed rgba(245,158,11,0.9)'; };
      const onLeave = () => { el.style.outline = ''; };
      el.addEventListener('mouseenter', onEnter);
      el.addEventListener('mouseleave', onLeave);
      cleanups.push(() => {
        el.removeEventListener('mouseenter', onEnter);
        el.removeEventListener('mouseleave', onLeave);
      });
    });
    const vb = (svg as SVGSVGElement).viewBox?.baseVal;
    const fullW = vb?.width || 1280, fullH = vb?.height || 720;
    svg.querySelectorAll('path, polygon, polyline, circle, ellipse, rect').forEach((node) => {
      const el = node as SVGGraphicsElement;
      if (!SELECTABLE.has(el.tagName.toLowerCase())) return;
      if (isBackgroundRect(el, fullW, fullH)) return;
      el.style.cursor = isSmallUnit(el, host) ? 'move' : 'crosshair';
    });
    return () => cleanups.forEach((fn) => fn());
  }, [svgText, editing, deselect]);

  // ---- marquee / move / resize gesture (window-level mousemove/up while dragging) ----
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const g = gesture.current;
      const host = hostRef.current;
      if (!g || !host) return;
      const hr = host.getBoundingClientRect();

      if (g.type === 'pending') {
        // not a real drag yet → wait (onUp will treat it as a click)
        if (Math.abs(e.clientX - g.sx) <= 4 && Math.abs(e.clientY - g.sy) <= 4) return;
        g.type = 'marquee'; // promote: dragging off a large card starts a marquee
        g.moved = true;
        const mb: Box = { left: g.sx - hr.left, top: g.sy - hr.top, width: 0, height: 0 };
        marqueeRef.current = mb;
        setMarqueeBox(mb);
      }

      if (g.type === 'marquee') {
        const box: Box = {
          left: Math.min(g.sx, e.clientX) - hr.left,
          top: Math.min(g.sy, e.clientY) - hr.top,
          width: Math.abs(e.clientX - g.sx),
          height: Math.abs(e.clientY - g.sy),
        };
        g.moved = box.width > 3 || box.height > 3;
        marqueeRef.current = box;
        setMarqueeBox(box);
        return;
      }

      const els = selectedRef.current;
      if (!els.length) return;
      g.moved = true;
      const vb = viewBox();
      const rx = vb.w / hr.width, ry = vb.h / hr.height;
      if (g.type === 'move') {
        const dxU = (e.clientX - g.startX) * rx;
        const dyU = (e.clientY - g.startY) * ry;
        g.bases.forEach(({ el, base }: any) =>
          el.setAttribute('transform', `translate(${dxU} ${dyU}) ${base}`.trim()));
      } else { // resize — same affine about a shared anchor scales the whole arrangement
        const len0 = Math.hypot(g.h0x - g.ax, g.h0y - g.ay) || 1;
        const len1 = Math.hypot(e.clientX - g.ax, e.clientY - g.ay);
        const s = Math.max(0.05, Math.min(20, len1 / len0));
        const aux = (g.ax - hr.left) * rx, auy = (g.ay - hr.top) * ry;
        g.bases.forEach(({ el, base }: any) =>
          el.setAttribute('transform',
            `translate(${aux} ${auy}) scale(${s}) translate(${-aux} ${-auy}) ${base}`.trim()));
      }
      recomputeBox();
    };
    const onUp = () => {
      const g = gesture.current;
      if (!g) return;
      if (g.type === 'pending') {
        // released without dragging → a plain click: select the surface, or deselect on empty
        if (g.pick) setSelection([g.pick]); else deselect();
        gesture.current = null;
        return;
      }
      if (g.type === 'marquee') {
        const host = hostRef.current;
        const svg = host?.querySelector('svg');
        const box = marqueeRef.current;
        if (g.moved && host && svg && box) {
          const vb = (svg as SVGSVGElement).viewBox?.baseVal;
          const fullW = vb?.width || 1280, fullH = vb?.height || 720;
          const hr = host.getBoundingClientRect();
          const hits = collectUnits(svg, fullW, fullH).filter((u) => {
            const x = u.getBoundingClientRect();
            const ub = { left: x.left - hr.left, top: x.top - hr.top, right: x.right - hr.left, bottom: x.bottom - hr.top };
            // fully-enclosed (containment), not mere overlap — so a marquee drawn inside a
            // card grabs the small elements within but NOT the card itself (its box can't
            // fit inside a smaller marquee).
            return ub.left >= box.left && ub.top >= box.top &&
                   ub.right <= box.left + box.width && ub.bottom <= box.top + box.height;
          });
          setSelection(hits);
        } else if (!g.moved) {
          deselect();
        }
        gesture.current = null;
        marqueeRef.current = null;
        setMarqueeBox(null);
        return;
      }
      gesture.current = null;
      if (g.moved) syncFromDom(); // a pure click (select) must not mark the slide dirty
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [viewBox, recomputeBox, syncFromDom, setSelection, deselect]);

  // Esc deselects; Ctrl/Cmd+G groups, Ctrl/Cmd+Shift+G ungroups.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (editing) return;
      if (e.key === 'Escape') { deselect(); return; }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'g' || e.key === 'G')) {
        e.preventDefault();
        if (e.shiftKey) ungroup(); else group();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [editing, deselect, group, ungroup]);

  // Ctrl/⌘ + wheel zooms the slide (plain wheel scrolls the viewport). Native listener
  // with passive:false so preventDefault actually suppresses the browser page-zoom.
  useEffect(() => {
    const vp = viewportRef.current;
    if (!vp) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      setZoom((z) => clampZoom(z * (e.deltaY < 0 ? 1.1 : 1 / 1.1)));
    };
    vp.addEventListener('wheel', onWheel, { passive: false });
    return () => vp.removeEventListener('wheel', onWheel);
  }, []);

  // All distinct selectable units painted under a screen point, topmost first. Uses the
  // browser's real hit-testing (respects fill / pointer-events), so only elements
  // actually drawn at that pixel qualify — then pickUnit chooses the smallest.
  const unitsUnderPoint = (clientX: number, clientY: number): SVGGraphicsElement[] => {
    const svg = hostRef.current?.querySelector('svg');
    if (!svg) return [];
    const vb = (svg as SVGSVGElement).viewBox?.baseVal;
    const fullW = vb?.width || 1280, fullH = vb?.height || 720;
    const out: SVGGraphicsElement[] = [];
    const seen = new Set<Element>();
    for (const node of document.elementsFromPoint(clientX, clientY)) {
      if (!svg.contains(node)) continue;
      const tag = node.tagName.toLowerCase();
      if (tag !== 'text' && !SELECTABLE.has(tag)) continue;
      if (SELECTABLE.has(tag) && isBackgroundRect(node, fullW, fullH)) continue;
      const unit = selectionUnit(node as SVGGraphicsElement, svg);
      if (!seen.has(unit)) { seen.add(unit); out.push(unit); }
    }
    return out;
  };
  // Smallest bounding box wins, so a small icon beats the big card / frame it sits on.
  const pickUnit = (units: SVGGraphicsElement[]): SVGGraphicsElement | null => {
    let best: SVGGraphicsElement | null = null;
    let bestArea = Infinity;
    for (const u of units) {
      const r = u.getBoundingClientRect();
      const a = r.width * r.height;
      if (a < bestArea) { best = u; bestArea = a; }
    }
    return best;
  };
  // Grab tolerance: thin / low-fill icons are hard to hit exactly, and a near-miss lands
  // on the card underneath. Sample a small halo around the cursor and return the smallest
  // SMALL unit found, so pressing *near* an icon still grabs it (cards are excluded by the
  // size filter, so this never accidentally grabs the card).
  const pickSmallNear = (clientX: number, clientY: number, host: HTMLElement, radius = 7): SVGGraphicsElement | null => {
    const offsets = [[0, 0], [radius, 0], [-radius, 0], [0, radius], [0, -radius],
      [radius, radius], [-radius, -radius], [radius, -radius], [-radius, radius]];
    let best: SVGGraphicsElement | null = null;
    let bestArea = Infinity;
    for (const [dx, dy] of offsets) {
      for (const u of unitsUnderPoint(clientX + dx, clientY + dy)) {
        if (!isSmallUnit(u, host)) continue;
        const r = u.getBoundingClientRect();
        const a = r.width * r.height;
        if (a < bestArea) { best = u; bestArea = a; }
      }
    }
    return best;
  };

  // Press an element → select it (shift toggles) and arm a move so a drag moves it
  // immediately; press empty space → start a marquee. A pure click just selects.
  const armMove = (e: React.MouseEvent) => {
    gesture.current = {
      type: 'move', startX: e.clientX, startY: e.clientY, moved: false,
      bases: selectedRef.current.map((el) => ({ el, base: el.getAttribute('transform') || '' })),
    };
  };

  const onCanvasMouseDown = (e: React.MouseEvent) => {
    if (editing) return;
    const host = hostRef.current;
    if (!host) return;
    const under = unitsUnderPoint(e.clientX, e.clientY);
    const cur = selectedRef.current;
    const pick = pickUnit(under); // smallest element actually painted under the cursor

    if (e.shiftKey) {
      if (pick) setSelection(cur.includes(pick) ? cur.filter((x) => x !== pick) : [...cur, pick]);
      return; // shift = toggle membership, no drag
    }
    // Pressing a member of the current selection grabs it whole → drag moves all (this
    // is how you move a card: select it first, then drag).
    if (pick && cur.includes(pick)) {
      e.preventDefault();
      armMove(e);
      return;
    }
    // A small object (icon / text / small shape), at the cursor or within grab tolerance
    // → select it and press-drag to move.
    const small = (pick && isSmallUnit(pick, host)) ? pick : pickSmallNear(e.clientX, e.clientY, host);
    if (small) {
      e.preventDefault();
      if (!cur.includes(small)) setSelection([small]);
      armMove(e);
      return;
    }
    // A large surface (card / big rect) or empty space → "pending": a drag marquees over
    // it (box-selecting the small things inside), a plain click selects it / deselects.
    e.preventDefault();
    gesture.current = { type: 'pending', sx: e.clientX, sy: e.clientY, pick: pick || null, moved: false };
  };

  // Double-click a <text> to edit its copy (single click now selects/moves it).
  const onCanvasDoubleClick = (e: React.MouseEvent) => {
    if (editing) return;
    const svg = hostRef.current?.querySelector('svg');
    if (!svg) return;
    const textEl = document.elementsFromPoint(e.clientX, e.clientY)
      .find((n) => svg.contains(n) && n.tagName.toLowerCase() === 'text') as SVGTextElement | undefined;
    if (textEl) { e.preventDefault(); beginEdit(textEl); }
  };

  const startResize = (corner: Corner, e: React.MouseEvent) => {
    const els = selectedRef.current;
    if (!els.length) return;
    e.preventDefault(); e.stopPropagation();
    // union screen rect of the selection
    let l = Infinity, t = Infinity, r = -Infinity, b = -Infinity;
    els.forEach((el) => {
      const x = el.getBoundingClientRect();
      l = Math.min(l, x.left); t = Math.min(t, x.top);
      r = Math.max(r, x.right); b = Math.max(b, x.bottom);
    });
    const R0 = { left: l, top: t, right: r, bottom: b };
    // anchor = opposite corner (stays fixed); h0 = the dragged corner's start point
    const anchor = {
      tl: { x: R0.right, y: R0.bottom }, tr: { x: R0.left, y: R0.bottom },
      bl: { x: R0.right, y: R0.top }, br: { x: R0.left, y: R0.top },
    }[corner];
    const h0 = {
      tl: { x: R0.left, y: R0.top }, tr: { x: R0.right, y: R0.top },
      bl: { x: R0.left, y: R0.bottom }, br: { x: R0.right, y: R0.bottom },
    }[corner];
    gesture.current = {
      type: 'resize', ax: anchor.x, ay: anchor.y, h0x: h0.x, h0y: h0.y,
      bases: els.map((el) => ({ el, base: el.getAttribute('transform') || '' })),
    };
  };

  const dirty = svgText !== originalSvg;

  const handleSave = async () => {
    setSaving(true); setError(null);
    try {
      await savePageSvg(projectId, pageId, svgText);
      onSaved(); onClose();
    } catch (e: any) {
      setError(e?.response?.data?.error?.message || e?.message || '保存失败');
    } finally { setSaving(false); }
  };

  const handlePos: Record<Corner, string> = {
    tl: '-left-1.5 -top-1.5 cursor-nwse-resize',
    tr: '-right-1.5 -top-1.5 cursor-nesw-resize',
    bl: '-left-1.5 -bottom-1.5 cursor-nesw-resize',
    br: '-right-1.5 -bottom-1.5 cursor-nwse-resize',
  };

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
      <div className="flex h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl dark:bg-background-secondary">
        {/* header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-2.5 dark:border-background-tertiary">
          <div className="flex items-center gap-2 text-sm font-medium text-gray-800 dark:text-foreground">
            编辑幻灯片（SVG）
            <span className="text-xs text-gray-400">单击选中可拖动 · 双击文字改字 · 拖空白框选 / Shift 多选 · Ctrl+G 组合 · Ctrl+滚轮缩放</span>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={group} disabled={!selMeta.canGroup}
              className="flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs text-gray-600 hover:bg-gray-100 disabled:opacity-40 dark:text-foreground-secondary dark:hover:bg-background-hover">
              <GroupIcon size={14} /> 组合
            </button>
            <button type="button" onClick={ungroup} disabled={!selMeta.canUngroup}
              className="flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs text-gray-600 hover:bg-gray-100 disabled:opacity-40 dark:text-foreground-secondary dark:hover:bg-background-hover">
              <UngroupIcon size={14} /> 取消组合
            </button>
            <div className="mx-1 h-4 w-px bg-gray-200 dark:bg-background-tertiary" />
            <button type="button" onClick={() => setShowCode((v) => !v)}
              className="flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs text-gray-600 hover:bg-gray-100 dark:text-foreground-secondary dark:hover:bg-background-hover">
              {showCode ? <Eye size={14} /> : <Code2 size={14} />}
              {showCode ? '隐藏代码' : '查看 SVG 代码'}
            </button>
            <button type="button" onClick={() => setSvgText(originalSvg)} disabled={!dirty || saving}
              className="flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs text-gray-600 hover:bg-gray-100 disabled:opacity-40 dark:text-foreground-secondary dark:hover:bg-background-hover">
              <RotateCcw size={14} /> 重置
            </button>
            <button type="button" onClick={handleSave} disabled={!dirty || saving || loading}
              className="flex items-center gap-1 rounded-md bg-banana-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-banana-600 disabled:opacity-40">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} 保存
            </button>
            <button type="button" onClick={onClose}
              className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-background-hover">
              <X size={16} />
            </button>
          </div>
        </div>

        {error && (
          <div className="border-b border-red-200 bg-red-50 px-4 py-2 text-xs text-red-600 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-400">
            {error}
          </div>
        )}

        {/* body */}
        <div className="flex min-h-0 flex-1">
          <div className="relative flex min-h-0 flex-1 bg-gray-100 dark:bg-background-primary">
            {/* scrollable viewport; the slide box below is sized zoom×base so scrollbars
                appear when zoomed in. Sizing (not CSS transform) keeps getBoundingClientRect
                zoom-aware, so all the gesture math stays correct. */}
            <div ref={viewportRef} className="absolute inset-0 overflow-auto">
              {loading ? (
                <div className="flex min-h-full min-w-full items-center justify-center">
                  <Loader2 className="animate-spin text-gray-400" />
                </div>
              ) : (
                <div className="flex min-h-full min-w-full items-center justify-center p-4">
                  <div
                    className="relative overflow-hidden rounded-lg bg-white shadow"
                    style={{ width: `${zoom * 100}%`, aspectRatio: '16 / 9', flexShrink: 0 }}
                    onMouseDown={onCanvasMouseDown}
                    onDoubleClick={onCanvasDoubleClick}
                  >
                    <div ref={hostRef} className="absolute inset-0" />

                {/* text inline input */}
                {editing && (
                  <input
                    autoFocus
                    value={editing.value}
                    onChange={(e) => setEditing((cur) => (cur ? { ...cur, value: e.target.value } : cur))}
                    onBlur={commitEdit}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') { e.preventDefault(); commitEdit(); }
                      else if (e.key === 'Escape') { e.preventDefault(); setEditing(null); }
                    }}
                    style={{
                      position: 'absolute', left: editing.left, top: editing.top,
                      minWidth: editing.width, height: editing.height,
                      fontSize: editing.fontSize, lineHeight: `${editing.height}px`,
                    }}
                    className="z-20 rounded border border-banana-500 bg-white px-1 text-gray-900 shadow outline-none"
                  />
                )}

                {/* marquee rubber-band */}
                {marqueeBox && (
                  <div
                    className="pointer-events-none absolute z-10 border border-dashed border-banana-500 bg-banana-400/10"
                    style={{ left: marqueeBox.left, top: marqueeBox.top, width: marqueeBox.width, height: marqueeBox.height }}
                  />
                )}

                {/* vector selection box + corner handles */}
                {selBox && !editing && (
                  <div
                    className="pointer-events-none absolute z-10 border border-banana-500 bg-banana-400/5"
                    style={{ left: selBox.left, top: selBox.top, width: selBox.width, height: selBox.height }}
                  >
                    {selMeta.count > 1 && (
                      <span className="absolute -top-5 left-0 rounded bg-banana-500 px-1.5 py-0.5 text-[10px] font-medium text-white">
                        {selMeta.count} 个元素
                      </span>
                    )}
                    {CORNERS.map((c) => (
                      <div
                        key={c}
                        onMouseDown={(e) => startResize(c, e)}
                        className={`pointer-events-auto absolute h-3 w-3 rounded-sm border border-banana-600 bg-white ${handlePos[c]}`}
                      />
                    ))}
                  </div>
                )}
                  </div>
                </div>
              )}
            </div>

            {/* zoom controls — fixed to the preview corner, outside the scroll area */}
            {!loading && (
              <div className="absolute bottom-3 right-3 z-30 flex items-center gap-0.5 rounded-lg border border-gray-200 bg-white/90 px-1 py-0.5 shadow backdrop-blur dark:border-background-tertiary dark:bg-background-secondary/90">
                <button
                  type="button"
                  onClick={() => setZoom((z) => clampZoom(z / 1.25))}
                  className="rounded p-1 text-gray-600 hover:bg-gray-100 dark:text-foreground-secondary dark:hover:bg-background-hover"
                  title="缩小"
                >
                  <Minus size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => setZoom(1)}
                  className="min-w-[3rem] rounded px-1 py-1 text-center text-xs tabular-nums text-gray-600 hover:bg-gray-100 dark:text-foreground-secondary dark:hover:bg-background-hover"
                  title="重置为 100%"
                >
                  {Math.round(zoom * 100)}%
                </button>
                <button
                  type="button"
                  onClick={() => setZoom((z) => clampZoom(z * 1.25))}
                  className="rounded p-1 text-gray-600 hover:bg-gray-100 dark:text-foreground-secondary dark:hover:bg-background-hover"
                  title="放大"
                >
                  <Plus size={14} />
                </button>
              </div>
            )}
          </div>
          {showCode && (
            <div className="flex min-h-0 w-1/2 flex-col border-l border-gray-200 dark:border-background-tertiary">
              <textarea
                value={svgText}
                onChange={(e) => setSvgText(e.target.value)}
                spellCheck={false}
                className="min-h-0 flex-1 resize-none bg-gray-50 p-3 font-mono text-[11px] leading-relaxed text-gray-800 outline-none dark:bg-background-primary dark:text-foreground-secondary"
              />
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
