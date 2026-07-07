"""Tests for CLI plain-text --help output in non-TTY mode."""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

from cli.is2ppt_cli.identity import CLI_NAME

# Resolve the cli directory relative to this test file
_CLI_DIR = str(Path(__file__).resolve().parents[3] / "cli")


def test_help_plain_text_in_pipe():
    """When stdout is piped (non-TTY), help output should be plain text without Rich boxes."""
    result = subprocess.run(
        [sys.executable, "-m", "is2ppt_cli", "--help"],
        capture_output=True,
        text=True,
        cwd=_CLI_DIR,
    )

    output = result.stdout
    # Should not contain Rich box-drawing characters
    assert "╭" not in output, "Help output contains Rich box-drawing characters in pipe mode"
    assert "╰" not in output, "Help output contains Rich box-drawing characters in pipe mode"
    # Should contain standard help text
    assert CLI_NAME in output or "Usage" in output


def test_help_contains_new_commands():
    """Help output should list the new 'use' and 'unuse' project commands."""
    result = subprocess.run(
        [sys.executable, "-m", "is2ppt_cli", "projects", "--help"],
        capture_output=True,
        text=True,
        cwd=_CLI_DIR,
    )

    output = result.stdout
    assert "use" in output, "projects subcommand should list 'use'"
    assert "unuse" in output, "projects subcommand should list 'unuse'"


def test_legacy_module_help_still_routes_to_is2ppt():
    result = subprocess.run(
        [sys.executable, "-m", "banana_cli", "--help"],
        capture_output=True,
        text=True,
        cwd=_CLI_DIR,
    )

    assert result.returncode == 0
    assert CLI_NAME in result.stdout or "Usage" in result.stdout
