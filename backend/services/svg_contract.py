"""SVG contract — extract, clean and validate an LLM-produced page SVG.

The 'svg' generation mode asks a text model for a full page ``<svg>``. Models often
wrap it in markdown fences or prose, and reach for system font stacks. This module:

- ``extract_svg``  pulls the ``<svg>...</svg>`` block out of a noisy reply.
- ``clean_svg``    normalises every ``font-family`` to the bundled whitelist font
                   (resvg renders with ``--skip-system-fonts``, so only that font
                   exists; a wrong name => tofu blocks).
- ``validate_svg`` checks the structural contract (root/viewBox/no forbidden tags).

Contract spec: docs/PRD-svg-slide-generation.md §4.
"""
import re

# Must match the bundled font's internal family name (see prompts.SVG_FONT_FAMILY).
# One free font used end to end — declared in the SVG (browser preview), rendered by
# resvg (PNG), and EMBEDDED into the exported PPTX — so every renderer/platform matches.
SVG_FONT_FAMILY = "Noto Sans CJK SC"

# Tags that break clean-primitive rendering / PPTX mapping (PRD §4.2).
_FORBIDDEN = ("<script", "<foreignobject", "<style", "@import")

_SVG_BLOCK = re.compile(r"<svg\b.*?</svg>", re.DOTALL | re.IGNORECASE)
_FONT_ATTR = re.compile(r'font-family\s*=\s*(["\'])(.*?)\1', re.IGNORECASE | re.DOTALL)
_FONT_CSS = re.compile(r'font-family\s*:\s*[^;"\'}]+', re.IGNORECASE)


def extract_svg(text: str):
    """Return the first ``<svg>...</svg>`` block from ``text``, or None."""
    if not text:
        return None
    m = _SVG_BLOCK.search(text)
    return m.group(0).strip() if m else None


def clean_svg(svg: str) -> str:
    """Normalise every font-family (attribute or inline style) to the whitelist font."""
    if not svg:
        return svg
    svg = _FONT_ATTR.sub(f'font-family="{SVG_FONT_FAMILY}"', svg)
    svg = _FONT_CSS.sub(f'font-family:{SVG_FONT_FAMILY}', svg)
    return svg


def validate_svg(svg: str):
    """Check the structural contract. Returns ``(ok: bool, error: str)``."""
    if not svg or "<svg" not in svg.lower():
        return False, "no <svg> root element"
    low = svg.lower()
    if "viewbox" not in low:
        return False, "missing viewBox attribute"
    # canvas must be the fixed logical size (normalise quotes/whitespace)
    norm = re.sub(r"\s+", " ", low.replace("'", '"'))
    if 'viewbox="0 0 1280 720"' not in norm:
        return False, 'viewBox must be "0 0 1280 720"'
    for bad in _FORBIDDEN:
        if bad in low:
            return False, f"forbidden content: {bad}"
    if "</svg>" not in low:
        return False, "unterminated <svg> (no closing tag)"
    # Well-formedness: resvg uses a strict XML parser, so malformations like a
    # duplicate attribute (e.g. opacity written twice on one element) hard-fail at
    # render time. Catch them here so generate_svg retries instead of crashing.
    try:
        from lxml import etree
        etree.fromstring(svg.encode("utf-8"))
    except Exception as e:
        return False, f"malformed XML: {str(e)[:140]}"
    return True, ""


def extract_clean_validate(text: str):
    """Convenience: extract -> clean -> validate. Returns ``(svg|None, error)``."""
    svg = extract_svg(text)
    if not svg:
        return None, "no <svg> block found in model output"
    svg = clean_svg(svg)
    ok, err = validate_svg(svg)
    if not ok:
        return None, err
    return svg, ""
