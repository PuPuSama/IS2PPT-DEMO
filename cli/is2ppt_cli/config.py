"""Configuration loading and precedence resolution."""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from .errors import ConfigError
from .identity import CONFIG_DIR_NAME, ENV_PREFIX, LEGACY_CONFIG_DIR_NAME, LEGACY_ENV_PREFIX


@dataclass
class CLIConfig:
    base_url: str = "http://localhost:5011"
    access_code: str = ""
    poll_interval: int = 3
    request_timeout: int = 60
    continue_on_error: bool = True
    json_output: bool = False
    verbose: bool = False


def _env_name(prefix: str, suffix: str) -> str:
    return f"{prefix}_{suffix}"


ENV_MAP = {
    "base_url": (_env_name(ENV_PREFIX, "BASE_URL"), _env_name(LEGACY_ENV_PREFIX, "BASE_URL")),
    "access_code": (_env_name(ENV_PREFIX, "ACCESS_CODE"), _env_name(LEGACY_ENV_PREFIX, "ACCESS_CODE")),
    "poll_interval": (_env_name(ENV_PREFIX, "POLL_INTERVAL"), _env_name(LEGACY_ENV_PREFIX, "POLL_INTERVAL")),
    "request_timeout": (_env_name(ENV_PREFIX, "REQUEST_TIMEOUT"), _env_name(LEGACY_ENV_PREFIX, "REQUEST_TIMEOUT")),
    "continue_on_error": (_env_name(ENV_PREFIX, "CONTINUE_ON_ERROR"), _env_name(LEGACY_ENV_PREFIX, "CONTINUE_ON_ERROR")),
}


def _platform_config_dir(config_dir_name: str) -> Path:
    appdata = os.getenv("APPDATA")
    if appdata:
        return Path(appdata) / config_dir_name

    xdg_home = os.getenv("XDG_CONFIG_HOME")
    if xdg_home:
        return Path(xdg_home) / config_dir_name

    return Path.home() / ".config" / config_dir_name


def default_config_dir() -> Path:
    """Return the is2ppt platform-default config directory."""
    return _platform_config_dir(CONFIG_DIR_NAME)


def legacy_config_dir() -> Path:
    """Return the legacy platform-default config directory."""
    return _platform_config_dir(LEGACY_CONFIG_DIR_NAME)


def default_config_path() -> Path:
    """Return the platform-default config path."""
    return default_config_dir() / "cli.toml"


def legacy_config_path() -> Path:
    """Return the legacy platform-default config path."""
    return legacy_config_dir() / "cli.toml"


def migrate_legacy_config_file(filename: str) -> Path:
    """Return the is2ppt config file path, copying legacy content when needed."""
    current = default_config_dir() / filename
    legacy = legacy_config_dir() / filename
    if current.exists() or not legacy.exists():
        return current

    try:
        current.parent.mkdir(parents=True, exist_ok=True)
        current.write_bytes(legacy.read_bytes())
        return current
    except OSError:
        return legacy


def _parse_bool(value: str | bool | None) -> bool | None:
    if value is None or isinstance(value, bool):
        return value
    v = value.strip().lower()
    if v in {"1", "true", "yes", "y", "on"}:
        return True
    if v in {"0", "false", "no", "n", "off"}:
        return False
    raise ConfigError(f"Invalid boolean value: {value}")


def _read_toml(path: Path) -> dict[str, Any]:
    try:
        import tomllib  # py3.11+
    except ModuleNotFoundError:
        try:
            import tomli as tomllib  # type: ignore[no-redef]
        except ModuleNotFoundError as exc:  # pragma: no cover
            raise ConfigError("Reading TOML config requires tomllib (py3.11+) or tomli") from exc

    try:
        return tomllib.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        return {}
    except Exception as exc:  # noqa: BLE001
        raise ConfigError(f"Failed to parse config file: {path}", details=str(exc)) from exc


def _load_file_config(path: Path) -> dict[str, Any]:
    raw = _read_toml(path)
    if not isinstance(raw, dict):
        raise ConfigError("Config file root must be an object")
    return raw


def _validate(cfg: CLIConfig) -> CLIConfig:
    if not cfg.base_url.startswith(("http://", "https://")):
        raise ConfigError("base_url must start with http:// or https://")
    if cfg.poll_interval <= 0:
        raise ConfigError("poll_interval must be > 0")
    if cfg.request_timeout <= 0:
        raise ConfigError("request_timeout must be > 0")
    return cfg


def _first_env_value(env_names: tuple[str, ...]) -> str | None:
    for env_name in env_names:
        val = os.getenv(env_name)
        if val is not None:
            return val
    return None


def resolve_config(
    *,
    base_url: str | None = None,
    access_code: str | None = None,
    poll_interval: int | None = None,
    request_timeout: int | None = None,
    continue_on_error: bool | None = None,
    config_path: str | None = None,
    json_output: bool = False,
    verbose: bool = False,
) -> CLIConfig:
    """Resolve config with priority: explicit params > env > file > defaults."""
    cfg = CLIConfig()

    config_file = Path(config_path) if config_path else migrate_legacy_config_file("cli.toml")
    file_cfg = _load_file_config(config_file)

    if "base_url" in file_cfg:
        cfg.base_url = str(file_cfg["base_url"]).rstrip("/")
    if "access_code" in file_cfg:
        cfg.access_code = str(file_cfg["access_code"] or "")
    if "poll_interval" in file_cfg:
        cfg.poll_interval = int(file_cfg["poll_interval"])
    if "request_timeout" in file_cfg:
        cfg.request_timeout = int(file_cfg["request_timeout"])
    if "continue_on_error" in file_cfg:
        parsed = _parse_bool(file_cfg["continue_on_error"])
        cfg.continue_on_error = True if parsed is None else parsed

    for key, env_names in ENV_MAP.items():
        val = _first_env_value(env_names)
        if val is None:
            continue
        if key in {"poll_interval", "request_timeout"}:
            setattr(cfg, key, int(val))
        elif key == "continue_on_error":
            parsed = _parse_bool(val)
            setattr(cfg, key, True if parsed is None else parsed)
        elif key == "base_url":
            setattr(cfg, key, val.rstrip("/"))
        else:
            setattr(cfg, key, val)

    if base_url:
        cfg.base_url = base_url.rstrip("/")
    if access_code is not None:
        cfg.access_code = access_code
    if poll_interval is not None:
        cfg.poll_interval = int(poll_interval)
    if request_timeout is not None:
        cfg.request_timeout = int(request_timeout)
    if continue_on_error is not None:
        cfg.continue_on_error = bool(continue_on_error)

    cfg.json_output = json_output
    cfg.verbose = verbose

    return _validate(cfg)