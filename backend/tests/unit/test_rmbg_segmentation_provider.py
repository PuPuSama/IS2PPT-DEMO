from pathlib import Path

from services.ai_providers.image import rmbg_segmentation_provider as rmbg


def test_resolve_model_path_prefers_env(monkeypatch, tmp_path: Path):
    env_model = tmp_path / "custom" / "model.onnx"
    monkeypatch.setenv("RMBG_MODEL_PATH", str(env_model))
    monkeypatch.setattr(rmbg, "_DEFAULT_MODEL_PATH", tmp_path / "is2ppt" / "model.onnx")

    assert rmbg._resolve_model_path() == env_model


def test_resolve_model_path_defaults_to_is2ppt_cache(monkeypatch, tmp_path: Path):
    default_model = tmp_path / "is2ppt" / "models" / "rmbg-2.0" / "model_fp16.onnx"
    monkeypatch.delenv("RMBG_MODEL_PATH", raising=False)
    monkeypatch.setattr(rmbg, "_DEFAULT_MODEL_PATH", default_model)

    assert rmbg._resolve_model_path() == default_model
