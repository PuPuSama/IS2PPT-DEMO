"""Tests for LazyLLM environment key resolution."""

import os

from services.ai_providers.lazyllm_env import (
    PROJECT_LAZYLLM_NAMESPACE,
    ensure_lazyllm_namespace_key,
    get_lazyllm_api_key,
)


def test_get_lazyllm_api_key_prefers_vendor_key(monkeypatch):
    monkeypatch.setenv("QWEN_API_KEY", "vendor-key")
    monkeypatch.setenv("IS2PPT_QWEN_API_KEY", "namespaced-key")

    assert get_lazyllm_api_key("qwen") == "vendor-key"


def test_ensure_lazyllm_namespace_key_sets_is2ppt_key(monkeypatch):
    monkeypatch.setenv("DOUBAO_API_KEY", "doubao-key")
    monkeypatch.delenv("IS2PPT_DOUBAO_API_KEY", raising=False)

    assert ensure_lazyllm_namespace_key("doubao") is True
    assert os.environ[f"{PROJECT_LAZYLLM_NAMESPACE}_DOUBAO_API_KEY"] == "doubao-key"


def test_ensure_lazyllm_namespace_key_accepts_legacy_namespace(monkeypatch):
    monkeypatch.delenv("GLM_API_KEY", raising=False)
    monkeypatch.delenv("IS2PPT_GLM_API_KEY", raising=False)
    monkeypatch.setenv("BANANA_GLM_API_KEY", "legacy-key")

    assert ensure_lazyllm_namespace_key("glm") is True
    assert os.environ["IS2PPT_GLM_API_KEY"] == "legacy-key"
