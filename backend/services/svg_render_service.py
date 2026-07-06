"""
SVG Render Service — render an SVG string to a PNG (PIL.Image) via the resvg CLI.

Used by the 'svg' generation mode to bridge LLM-produced SVG into banana-slides'
existing PNG-based pipeline: thumbnails / PDF / export / the frontend SlideCard all
consume a PNG, so an SVG page is rasterised here and then fed to the unchanged
``save_image_with_version`` path.

Renderer: ``resvg-cli`` (``pip install resvg-cli``), cross-platform via wheels
(Windows win_amd64 / Linux manylinux / macOS). The console-script binary lands next
to the running interpreter (``.venv/Scripts/resvg.exe`` on Windows,
``.venv/bin/resvg`` on Linux); override with the ``RESVG_BIN`` env var.

Fonts: only ``backend/fonts/`` is loaded (``--skip-system-fonts``) so generation,
rendering and PPTX export all share one font set and no machine-specific system font
can sneak in. NOTE: the bundled ``NotoSansSC-Regular.ttf`` registers its family as
**"Noto Sans CJK SC"** (not "Noto Sans SC"); SVG ``font-family`` must use that exact
name or resvg renders tofu blocks.
"""
import os
import sys
import shutil
import subprocess
import tempfile
import logging
from io import BytesIO

from PIL import Image

logger = logging.getLogger(__name__)

# backend/fonts (this file lives at backend/services/svg_render_service.py)
_FONTS_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "fonts"
)

# resolution category -> render width for the 1280x720 logical canvas (1x / 2x / 3x)
_RESOLUTION_WIDTH = {"1K": 1280, "2K": 2560, "4K": 3840}


class SvgRenderError(RuntimeError):
    """Raised when resvg is missing, fails, or produces no output."""


def resolution_to_width(resolution: str) -> int:
    """Map a banana-slides resolution category ("1K"/"2K"/"4K") to a render width."""
    return _RESOLUTION_WIDTH.get((resolution or "2K").upper(), 2560)


def _resvg_bin() -> str:
    """Locate the resvg executable: RESVG_BIN env > next to interpreter > PATH."""
    override = os.environ.get("RESVG_BIN")
    if override:
        if os.path.isfile(override):
            return override
        raise SvgRenderError(f"RESVG_BIN points to a missing file: {override}")
    exe = "resvg.exe" if os.name == "nt" else "resvg"
    # pip console scripts install alongside the python executable
    candidate = os.path.join(os.path.dirname(sys.executable), exe)
    if os.path.isfile(candidate):
        return candidate
    found = shutil.which("resvg")
    if found:
        return found
    raise SvgRenderError(
        "resvg executable not found. Install with `pip install resvg-cli` "
        "or set the RESVG_BIN env var to its path."
    )


def render_svg_to_png(svg: str, width: int = 2560, fonts_dir: str = None,
                      timeout: int = 60) -> Image.Image:
    """Render a complete SVG string to a PIL RGBA Image using resvg.

    Args:
        svg: a full ``<svg ...>...</svg>`` document string.
        width: output width in px; height follows the SVG viewBox aspect ratio.
        fonts_dir: font whitelist directory; defaults to ``backend/fonts/``.
        timeout: subprocess timeout in seconds.

    Returns:
        A PIL ``Image`` in RGBA mode (preserves transparency).

    Raises:
        SvgRenderError: if the SVG is empty/invalid, resvg is missing, the process
            fails or times out, or no PNG is produced.
    """
    if not svg or "<svg" not in svg:
        raise SvgRenderError("Empty or invalid SVG string (no <svg> tag)")
    fonts_dir = fonts_dir or _FONTS_DIR
    resvg = _resvg_bin()

    # resvg works on file paths; isolate each render in its own temp dir
    tmp = tempfile.mkdtemp(prefix="svgrender_")
    in_svg = os.path.join(tmp, "in.svg")
    out_png = os.path.join(tmp, "out.png")
    try:
        with open(in_svg, "w", encoding="utf-8") as f:
            f.write(svg)
        cmd = [resvg, "--skip-system-fonts", "--use-fonts-dir", fonts_dir,
               "--width", str(int(width)), in_svg, out_png]
        try:
            proc = subprocess.run(cmd, capture_output=True, timeout=timeout)
        except subprocess.TimeoutExpired:
            raise SvgRenderError(f"resvg timed out after {timeout}s")
        if proc.returncode != 0 or not os.path.isfile(out_png):
            err = (proc.stderr or b"").decode("utf-8", "replace").strip()[:500]
            raise SvgRenderError(
                f"resvg failed (exit {proc.returncode}): {err or '<no stderr>'}"
            )
        # Read the PNG into memory so the temp dir can be removed immediately.
        with open(out_png, "rb") as f:
            img = Image.open(BytesIO(f.read()))
            img.load()
        return img.convert("RGBA")
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
