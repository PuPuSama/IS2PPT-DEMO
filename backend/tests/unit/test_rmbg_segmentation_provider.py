from pathlib import Path

from services.ai_providers.image import rmbg_segmentation_provider as rmbg


def test_resolve_model_path_prefers_env(monkeypatch, tmp_path: Path):
    env_model = tmp_path / "custom" / "model.onnx"
    monkeypatch.setenv("RMBG_MODEL_PATH", str(env_model))
    monkeypatch.setattr(rmbg, "_DEFAULT_MODEL_PATH", tmp_path / "is2ppt" / "model.onnx")
    monkeypatch.setattr(rmbg, "_LEGACY_MODEL_PATH", tmp_path / "legacy" / "model.onnx")

    assert rmbg._resolve_model_path() == env_model


def test_resolve_model_path_defaults_to_is2ppt_cache(monkeypatch, tmp_path: Path):
    default_model = tmp_path / "is2ppt" / "models" / "rmbg-2.0" / "model_fp16.onnx"
    legacy_model = tmp_path / "banana-slides" / "models" / "rmbg-2.0" / "model_fp16.onnx"
    monkeypatch.delenv("RMBG_MODEL_PATH", raising=False)
    monkeypatch.setattr(rmbg, "_DEFAULT_MODEL_PATH", default_model)
    monkeypatch.setattr(rmbg, "_LEGACY_MODEL_PATH", legacy_model)

    assert rmbg._resolve_model_path() == default_model


def test_resolve_model_path_reuses_existing_legacy_cache(monkeypatch, tmp_path: Path):
    default_model = tmp_path / "is2ppt" / "models" / "rmbg-2.0" / "model_fp16.onnx"
    legacy_model = tmp_path / "banana-slides" / "models" / "rmbg-2.0" / "model_fp16.onnx"
    legacy_model.parent.mkdir(parents=True)
    legacy_model.write_bytes(b"onnx")
    monkeypatch.delenv("RMBG_MODEL_PATH", raising=False)
    monkeypatch.setattr(rmbg, "_DEFAULT_MODEL_PATH", default_model)
    monkeypatch.setattr(rmbg, "_LEGACY_MODEL_PATH", legacy_model)

    assert rmbg._resolve_model_path() == legacy_model


def test_resolve_model_path_prefers_existing_is2ppt_cache(monkeypatch, tmp_path: Path):
    default_model = tmp_path / "is2ppt" / "models" / "rmbg-2.0" / "model_fp16.onnx"
    legacy_model = tmp_path / "banana-slides" / "models" / "rmbg-2.0" / "model_fp16.onnx"
    default_model.parent.mkdir(parents=True)
    legacy_model.parent.mkdir(parents=True)
    default_model.write_bytes(b"new")
    legacy_model.write_bytes(b"legacy")
    monkeypatch.delenv("RMBG_MODEL_PATH", raising=False)
    monkeypatch.setattr(rmbg, "_DEFAULT_MODEL_PATH", default_model)
    monkeypatch.setattr(rmbg, "_LEGACY_MODEL_PATH", legacy_model)

    assert rmbg._resolve_model_path() == default_model