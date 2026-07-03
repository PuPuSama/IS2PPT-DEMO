"""Unit tests for services.svg_contract (extract / clean / validate page SVG)."""
import pytest

from services.svg_contract import (
    extract_svg,
    clean_svg,
    validate_svg,
    extract_clean_validate,
    SVG_FONT_FAMILY,
)

_GOOD = (
    '<svg viewBox="0 0 1280 720" xmlns="http://www.w3.org/2000/svg">'
    '<rect x="0" y="0" width="1280" height="720" fill="#111"/>'
    '<text x="80" y="200" font-family="SimSun" font-size="60" fill="#fff">标题</text>'
    '</svg>'
)


@pytest.mark.unit
def test_extract_strips_markdown_fence_and_prose():
    reply = "好的，这是设计：\n```svg\n" + _GOOD + "\n```\n希望满意！"
    out = extract_svg(reply)
    assert out is not None
    assert out.startswith("<svg") and out.endswith("</svg>")
    assert "希望满意" not in out and "```" not in out


@pytest.mark.unit
def test_extract_returns_none_without_svg():
    assert extract_svg("there is no svg here") is None
    assert extract_svg("") is None


@pytest.mark.unit
def test_clean_normalizes_font_family_attribute():
    cleaned = clean_svg(_GOOD)
    assert f'font-family="{SVG_FONT_FAMILY}"' in cleaned
    assert "SimSun" not in cleaned


@pytest.mark.unit
def test_clean_normalizes_font_stack_and_inline_style():
    svg = (
        '<svg viewBox="0 0 1280 720">'
        "<text font-family='\"PingFang SC\", \"Noto Sans SC\", sans-serif' >a</text>"
        '<text style="font-weight:700;font-family:Arial, sans-serif;">b</text>'
        '</svg>'
    )
    cleaned = clean_svg(svg)
    assert "PingFang" not in cleaned and "Arial" not in cleaned
    assert SVG_FONT_FAMILY in cleaned


@pytest.mark.unit
def test_validate_accepts_good_svg():
    ok, err = validate_svg(_GOOD)
    assert ok, err


@pytest.mark.unit
@pytest.mark.parametrize("svg,frag", [
    ("<div>nope</div>", "root"),
    ('<svg xmlns="x"><text>a</text></svg>', "viewBox"),
    ('<svg viewBox="0 0 1920 1080"></svg>', '0 0 1280 720'),
    ('<svg viewBox="0 0 1280 720"><script>x()</script></svg>', "forbidden"),
    ('<svg viewBox="0 0 1280 720"><foreignObject/></svg>', "forbidden"),
])
def test_validate_rejects_contract_violations(svg, frag):
    ok, err = validate_svg(svg)
    assert not ok
    assert frag in err


@pytest.mark.unit
def test_validate_rejects_malformed_xml_duplicate_attr():
    # duplicate attribute is well-formed-looking but resvg/lxml reject it
    bad = ('<svg viewBox="0 0 1280 720" xmlns="http://www.w3.org/2000/svg">'
           '<rect x="0" y="0" width="10" height="10" opacity="0.1" opacity="0.2"/>'
           '</svg>')
    ok, err = validate_svg(bad)
    assert not ok
    assert "malformed" in err


@pytest.mark.unit
def test_extract_clean_validate_happy_path():
    reply = "```svg\n" + _GOOD + "\n```"
    svg, err = extract_clean_validate(reply)
    assert svg is not None and err == ""
    assert SVG_FONT_FAMILY in svg and "SimSun" not in svg


@pytest.mark.unit
def test_extract_clean_validate_reports_failure():
    svg, err = extract_clean_validate("no svg at all")
    assert svg is None and "no <svg>" in err
