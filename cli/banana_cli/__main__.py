"""Compatibility entry point for the legacy banana_cli module."""

from __future__ import annotations

if __package__ and __package__.startswith("cli."):
    from cli.is2ppt_cli.__main__ import main
else:
    from is2ppt_cli.__main__ import main

if __name__ == "__main__":
    main()
