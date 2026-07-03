"""Unit tests for services.svg_render_service (resvg-backed SVG -> PNG)."""
import pytest
from PIL import Image

from services.svg_render_service import (
    render_svg_to_png,
    resolution_to_width,
    SvgRenderError,
)

# Minimal page with the canvas contract: 1280x720, a colored bg + one CJK <text>
# using the exact bundled-font family name.
_CJK_SVG = (
    '<svg viewBox="0 0 1280 720" xmlns="http://www.w3.org/2000/svg">'
    '<rect x="0" y="0" width="1280" height="720" fill="#0f2027"/>'
    '<text x="100" y="360" font-family="Noto Sans CJK SC" font-size="80" '
    'fill="#ffffff">中文渲染验证</text>'
    '</svg>'
)


@pytest.mark.unit
def test_renders_correct_dimensions():
    img = render_svg_to_png(_CJK_SVG, width=2560)
    assert isinstance(img, Image.Image)
    assert img.size == (2560, 1440)  # width honored; 16:9 height follows viewBox


@pytest.mark.unit
def test_width_scales_height_by_viewbox_aspect():
    img = render_svg_to_png(_CJK_SVG, width=1280)
    assert img.size == (1280, 720)


@pytest.mark.unit
def test_cjk_text_is_not_tofu():
    """The CJK glyphs must actually paint white pixels over the dark background."""
    img = render_svg_to_png(_CJK_SVG, width=1280).convert("RGB")
    # text sits around y=300..360; scan that band for near-white (the glyph fill)
    band = img.crop((80, 290, 900, 370))
    white = sum(1 for r, g, b in band.getdata() if r > 230 and g > 230 and b > 230)
    assert white > 500, f"expected painted CJK glyphs, only {white} near-white px (tofu?)"


@pytest.mark.unit
def test_resolution_to_width_mapping():
    assert resolution_to_width("1K") == 1280
    assert resolution_to_width("2K") == 2560
    assert resolution_to_width("4K") == 3840
    assert resolution_to_width("2k") == 2560      # case-insensitive
    assert resolution_to_width(None) == 2560      # default
    assert resolution_to_width("weird") == 2560   # fallback


@pytest.mark.unit
def test_invalid_svg_raises():
    with pytest.raises(SvgRenderError):
        render_svg_to_png("not an svg at all", width=512)
    with pytest.raises(SvgRenderError):
        render_svg_to_png("", width=512)
