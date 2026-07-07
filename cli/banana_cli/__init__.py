"""Compatibility package for the legacy banana_cli import path."""

from __future__ import annotations

import importlib
import sys

_BASE_PACKAGE = "cli.is2ppt_cli" if __name__.startswith("cli.") else "is2ppt_cli"
_TARGET_PACKAGE = importlib.import_module(_BASE_PACKAGE)

__all__ = getattr(_TARGET_PACKAGE, "__all__", ())
__version__ = getattr(_TARGET_PACKAGE, "__version__", None)

_SUBMODULES = (
    "app",
    "config",
    "errors",
    "http_client",
    "identity",
    "models",
    "output",
    "reporter",
    "resolve",
    "state",
    "commands",
    "commands.common",
    "commands.exports",
    "commands.files",
    "commands.materials",
    "commands.pages",
    "commands.projects",
    "commands.refs",
    "commands.renovation",
    "commands.run",
    "commands.settings",
    "commands.styles",
    "commands.tasks",
    "commands.templates",
    "commands.workflows",
    "jobs",
    "jobs.interactive_builder",
    "jobs.loader",
    "jobs.runner",
    "jobs.workflow",
)

for _submodule in _SUBMODULES:
    _target = importlib.import_module(f"{_BASE_PACKAGE}.{_submodule}")
    sys.modules[f"{__name__}.{_submodule}"] = _target
    if "." not in _submodule:
        setattr(sys.modules[__name__], _submodule, _target)
