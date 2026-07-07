"""Tests for PPTX builder identity metadata."""

from app_identity import APP_NAME
from utils.pptx_builder import PPTXBuilder


def test_pptx_builder_sets_app_identity_core_properties():
    prs = PPTXBuilder().create_presentation()

    assert prs.core_properties.author == APP_NAME
    assert prs.core_properties.last_modified_by == APP_NAME