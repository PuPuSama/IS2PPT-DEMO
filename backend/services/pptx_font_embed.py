"""
Embed a subsetted font into a .pptx so its text renders with the exact font on any
machine — regardless of what's installed — and matches the browser/SVG preview.

A .pptx is an OPC (Open Packaging Conventions) ZIP. Embedding a font adds four things:
  1. ``ppt/fonts/font1.fntdata`` — the font bytes, subsetted to only the glyphs used.
  2. a relationship in ``ppt/_rels/presentation.xml.rels`` pointing at that part.
  3. ``<p:embeddedFontLst>`` in ``ppt/presentation.xml`` referencing it by ``r:id``,
     plus ``embedTrueTypeFonts="1"``/``saveSubsetFonts="1"`` on ``<p:presentation>``.
  4. a ``Default`` content-type for the ``fntdata`` extension in ``[Content_Types].xml``.

Only the regular weight is embedded (the bundled Noto Sans SC ships one weight); bold
runs fall back to PowerPoint's synthetic bold, which is fine for these decks. The font
must permit embedding — Noto/Source Han (OFL) does; this is why a free font is required.

Everything here is best-effort: on any error the original pptx bytes are returned
unchanged, so a font-tooling problem can never break an export.
"""
import io
import logging
import zipfile
from typing import Optional

logger = logging.getLogger(__name__)

P_NS = "http://schemas.openxmlformats.org/presentationml/2006/main"
R_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
CT_NS = "http://schemas.openxmlformats.org/package/2006/content-types"
REL_NS = "http://schemas.openxmlformats.org/package/2006/relationships"
FONT_REL_TYPE = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/font"

# CT_Presentation child order (ECMA-376); embeddedFontLst sits right after notesSz.
_PRES_ORDER = [
    "sldMasterIdLst", "notesMasterIdLst", "handoutMasterIdLst", "sldIdLst",
    "sldSz", "notesSz", "smartTags", "embeddedFontLst", "custShowLst",
    "photoAlbum", "custDataLst", "kinsoku", "defaultTextStyle", "modifyVerifier",
    "extLst",
]
_PRES_ORDER_IDX = {name: i for i, name in enumerate(_PRES_ORDER)}

_FONT_PART = "ppt/fonts/font1.fntdata"


def _otf_to_ttf(font) -> None:
    """Convert a CFF/OpenType font in place to TrueType (glyf) outlines.

    PowerPoint's font embedding only reliably honours TrueType-flavoured fonts; an
    embedded CFF/OTF is silently ignored (the text then falls back to a system font).
    The bundled Noto Sans SC is CFF, so we re-draw every glyph's cubic curves as the
    quadratic curves TrueType uses (cu2qu) and swap CFF → glyf.
    """
    if "glyf" in font:
        return
    from fontTools.pens.cu2quPen import Cu2QuPen
    from fontTools.pens.ttGlyphPen import TTGlyphPen
    from fontTools.ttLib import newTable

    glyph_order = font.getGlyphOrder()
    glyph_set = font.getGlyphSet()
    glyf = newTable("glyf")
    glyf.glyphOrder = glyph_order
    glyf.glyphs = {}
    for name in glyph_order:
        pen = TTGlyphPen(glyph_set)
        glyph_set[name].draw(Cu2QuPen(pen, max_err=1.0, reverse_direction=True))
        glyf[name] = pen.glyph()
    font["loca"] = newTable("loca")  # populated from glyf on save; must exist for glyf
    font["glyf"] = glyf
    # TTGlyphPen leaves bounding boxes unset; compile needs xMin/yMin/xMax/yMax.
    for name in glyph_order:
        glyf[name].recalcBounds(glyf)

    # TrueType needs maxp 1.0 (CFF ships 0.5); recompute the glyf-derived limits.
    maxp = newTable("maxp")
    maxp.tableVersion = 0x00010000
    maxp.numGlyphs = len(glyph_order)
    for attr in ("maxPoints", "maxContours", "maxCompositePoints",
                 "maxCompositeContours", "maxSizeOfInstructions",
                 "maxComponentElements"):
        setattr(maxp, attr, 0)
    maxp.maxZones = 1
    maxp.maxTwilightPoints = maxp.maxStorage = maxp.maxFunctionDefs = 0
    maxp.maxInstructionDefs = maxp.maxStackElements = maxp.maxComponentDepth = 0
    font["maxp"] = maxp
    if hasattr(maxp, "recalc"):
        maxp.recalc(font)

    font.sfntVersion = "\x00\x01\x00\x00"
    for tag in ("CFF ", "CFF2", "VORG"):
        if tag in font:
            del font[tag]


def _subset_font(font_path: str, chars: str) -> Optional[bytes]:
    """Subset ``font_path`` to ``chars`` (+ ASCII), convert to TrueType, return bytes."""
    try:
        from fontTools import subset
        from fontTools.ttLib import TTFont
    except Exception as e:  # pragma: no cover - dependency missing
        logger.warning(f"fonttools unavailable, skipping font embed: {e}")
        return None
    # Always keep printable ASCII so latin / digits / punctuation never go missing.
    ascii_base = "".join(chr(c) for c in range(0x20, 0x7F))
    text = ascii_base + "".join(sorted(set(chars)))
    opts = subset.Options()
    opts.name_IDs = ['*']        # keep the name table so PowerPoint matches the family
    opts.recalc_timestamp = False
    opts.notdef_outline = True
    opts.drop_tables = []
    font = TTFont(font_path)
    sub = subset.Subsetter(options=opts)
    sub.populate(text=text)
    sub.subset(font)
    _otf_to_ttf(font)  # PowerPoint only honours embedded TrueType, not CFF/OTF
    buf = io.BytesIO()
    font.save(buf)
    return buf.getvalue()


def _insert_in_order(parent, el, localname: str) -> None:
    """Insert ``el`` into ``parent`` at its schema-correct position."""
    from lxml import etree
    target = _PRES_ORDER_IDX.get(localname, len(_PRES_ORDER))
    idx = len(parent)
    for i, child in enumerate(parent):
        if not isinstance(child.tag, str):
            continue
        ln = etree.QName(child).localname
        if _PRES_ORDER_IDX.get(ln, 999) > target:
            idx = i
            break
    parent.insert(idx, el)


def embed_font_into_pptx_bytes(data: bytes, chars: str, family: str,
                               font_path: str) -> bytes:
    """Return new pptx bytes with ``family`` (subsetted to ``chars``) embedded.

    Best-effort: returns ``data`` unchanged on any failure.
    """
    if not data or not chars:
        return data
    try:
        from lxml import etree

        font_bytes = _subset_font(font_path, chars)
        if not font_bytes:
            return data

        zin = zipfile.ZipFile(io.BytesIO(data), 'r')
        names = zin.namelist()

        ct = etree.fromstring(zin.read('[Content_Types].xml'))
        pres = etree.fromstring(zin.read('ppt/presentation.xml'))
        rels_name = 'ppt/_rels/presentation.xml.rels'
        rels = etree.fromstring(zin.read(rels_name))

        # 1) content type for the fntdata extension
        if not any(d.get('Extension') == 'fntdata' for d in ct):
            d = etree.SubElement(ct, f'{{{CT_NS}}}Default')
            d.set('Extension', 'fntdata')
            d.set('ContentType', 'application/x-fontdata')

        # 2) relationship presentation -> font part (unique Id)
        existing_ids = {r.get('Id') for r in rels}
        i = 1
        while f'rIdFont{i}' in existing_ids:
            i += 1
        rid = f'rIdFont{i}'
        rel = etree.SubElement(rels, f'{{{REL_NS}}}Relationship')
        rel.set('Id', rid)
        rel.set('Type', FONT_REL_TYPE)
        rel.set('Target', 'fonts/font1.fntdata')

        # 3) embeddedFontLst + flags on <p:presentation>
        pres.set('embedTrueTypeFonts', '1')
        pres.set('saveSubsetFonts', '1')
        for ex in pres.findall(f'{{{P_NS}}}embeddedFontLst'):
            pres.remove(ex)
        efl = etree.Element(f'{{{P_NS}}}embeddedFontLst')
        ef = etree.SubElement(efl, f'{{{P_NS}}}embeddedFont')
        fnt = etree.SubElement(ef, f'{{{P_NS}}}font')
        fnt.set('typeface', family)
        # CJK hints PowerPoint writes for Chinese fonts: variable-pitch swiss + GB2312
        # charset, so it associates the embed with East-Asian text runs.
        fnt.set('pitchFamily', '34')
        fnt.set('charset', '-122')
        # Declare ALL four weight/style slots pointing at the one embedded face. Our
        # decks use bold titles (b="1"); without a <p:bold> slot PowerPoint can't find a
        # bold variant and substitutes a system font — the "wrong font" symptom. Reusing
        # the single regular face for every slot makes every run resolve to the embed.
        for slot in ('regular', 'bold', 'italic', 'boldItalic'):
            e = etree.SubElement(ef, f'{{{P_NS}}}{slot}')
            e.set(f'{{{R_NS}}}id', rid)
        _insert_in_order(pres, efl, 'embeddedFontLst')

        # write a fresh zip: copy untouched parts, replace the 3 xml parts, add the font
        replaced = {'[Content_Types].xml', 'ppt/presentation.xml', rels_name, _FONT_PART}
        out = io.BytesIO()
        with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as zout:
            for n in names:
                if n in replaced:
                    continue
                zout.writestr(n, zin.read(n))
            opts = dict(xml_declaration=True, encoding='UTF-8', standalone=True)
            zout.writestr('[Content_Types].xml', etree.tostring(ct, **opts))
            zout.writestr('ppt/presentation.xml', etree.tostring(pres, **opts))
            zout.writestr(rels_name, etree.tostring(rels, **opts))
            zout.writestr(_FONT_PART, font_bytes)
        zin.close()
        logger.info(f"Embedded font '{family}' ({len(font_bytes)} bytes, "
                    f"{len(set(chars))} unique chars) into pptx")
        return out.getvalue()
    except Exception as e:
        logger.warning(f"Font embed failed, exporting without embedded font: {e}")
        return data
