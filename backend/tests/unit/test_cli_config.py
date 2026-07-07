"""Tests for is2ppt CLI config resolution."""

from __future__ import annotations

from pathlib import Path

from cli.banana_cli.config import default_config_path, legacy_config_path, resolve_config
from cli.banana_cli.identity import CONFIG_DIR_NAME, ENV_PREFIX, LEGACY_CONFIG_DIR_NAME, LEGACY_ENV_PREFIX

_ENV_SUFFIXES = ("BASE_URL", "ACCESS_CODE", "POLL_INTERVAL", "REQUEST_TIMEOUT", "CONTINUE_ON_ERROR")


def _clear_cli_env(monkeypatch):
    for prefix in (ENV_PREFIX, LEGACY_ENV_PREFIX):
        for suffix in _ENV_SUFFIXES:
            monkeypatch.delenv(f"{prefix}_{suffix}", raising=False)


def test_default_config_path_uses_is2ppt_dir(tmp_path: Path, monkeypatch):
    monkeypatch.setenv("APPDATA", str(tmp_path / "appdata"))
    monkeypatch.delenv("XDG_CONFIG_HOME", raising=False)

    assert default_config_path() == tmp_path / "appdata" / CONFIG_DIR_NAME / "cli.toml"
    assert legacy_config_path() == tmp_path / "appdata" / LEGACY_CONFIG_DIR_NAME / "cli.toml"


def test_resolve_config_defaults_to_new_backend_port(tmp_path: Path, monkeypatch):
    _clear_cli_env(monkeypatch)

    cfg = resolve_config(config_path=str(tmp_path / "missing.toml"))

    assert cfg.base_url == "http://localhost:5011"


def test_resolve_config_migrates_legacy_default_config(tmp_path: Path, monkeypatch):
    _clear_cli_env(monkeypatch)
    monkeypatch.setenv("APPDATA", str(tmp_path / "appdata"))
    monkeypatch.delenv("XDG_CONFIG_HOME", raising=False)

    legacy_path = legacy_config_path()
    legacy_path.parent.mkdir(parents=True)
    legacy_path.write_text('base_url = "http://legacy-file:5011"\naccess_code = "legacy"\n', encoding="utf-8")

    cfg = resolve_config()

    assert cfg.base_url == "http://legacy-file:5011"
    assert cfg.access_code == "legacy"
    assert default_config_path().read_text(encoding="utf-8") == legacy_path.read_text(encoding="utf-8")


def test_resolve_config_prefers_existing_is2ppt_config(tmp_path: Path, monkeypatch):
    _clear_cli_env(monkeypatch)
    monkeypatch.setenv("APPDATA", str(tmp_path / "appdata"))
    monkeypatch.delenv("XDG_CONFIG_HOME", raising=False)

    current_path = default_config_path()
    current_path.parent.mkdir(parents=True)
    current_path.write_text('base_url = "http://is2ppt-file:5011"\n', encoding="utf-8")
    legacy_path = legacy_config_path()
    legacy_path.parent.mkdir(parents=True)
    legacy_path.write_text('base_url = "http://legacy-file:5011"\n', encoding="utf-8")

    cfg = resolve_config()

    assert cfg.base_url == "http://is2ppt-file:5011"


def test_resolve_config_precedence(tmp_path: Path, monkeypatch):
    cfg_file = tmp_path / "cli.toml"
    cfg_file.write_text(
        (
            'base_url = "http://file:5011"\n'
            'access_code = "from-file"\n'
            "poll_interval = 7\n"
            "request_timeout = 33\n"
            "continue_on_error = false\n"
        ),
        encoding="utf-8",
    )

    monkeypatch.setenv(f"{ENV_PREFIX}_BASE_URL", "http://env:5011")
    monkeypatch.setenv(f"{ENV_PREFIX}_ACCESS_CODE", "from-env")
    monkeypatch.setenv(f"{ENV_PREFIX}_POLL_INTERVAL", "9")
    monkeypatch.setenv(f"{ENV_PREFIX}_REQUEST_TIMEOUT", "66")
    monkeypatch.setenv(f"{ENV_PREFIX}_CONTINUE_ON_ERROR", "true")

    cfg = resolve_config(
        base_url="http://arg:5011",
        access_code="from-arg",
        poll_interval=11,
        request_timeout=77,
        continue_on_error=False,
        config_path=str(cfg_file),
        json_output=False,
        verbose=False,
    )

    assert cfg.base_url == "http://arg:5011"
    assert cfg.access_code == "from-arg"
    assert cfg.poll_interval == 11
    assert cfg.request_timeout == 77
    assert cfg.continue_on_error is False


def test_resolve_config_accepts_legacy_env_prefix(tmp_path: Path, monkeypatch):
    _clear_cli_env(monkeypatch)
    monkeypatch.setenv(f"{LEGACY_ENV_PREFIX}_BASE_URL", "http://legacy-env:5011")

    cfg = resolve_config(config_path=str(tmp_path / "missing.toml"))

    assert cfg.base_url == "http://legacy-env:5011"


def test_resolve_config_prefers_is2ppt_env_prefix(tmp_path: Path, monkeypatch):
    _clear_cli_env(monkeypatch)
    monkeypatch.setenv(f"{LEGACY_ENV_PREFIX}_BASE_URL", "http://legacy-env:5011")
    monkeypatch.setenv(f"{ENV_PREFIX}_BASE_URL", "http://is2ppt-env:5011")

    cfg = resolve_config(config_path=str(tmp_path / "missing.toml"))

    assert cfg.base_url == "http://is2ppt-env:5011"