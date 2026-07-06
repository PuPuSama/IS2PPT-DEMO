"""Material commands."""

from __future__ import annotations

from typing import Optional

import typer

from ..output import cli_command, emit_output
from ..resolve import resolve_project_id
from ..state import state
from .common import ensure_file

app = typer.Typer(no_args_is_help=True)


@app.command("upload")
@cli_command
def materials_upload(
    file: str = typer.Option(..., help="Absolute file path"),
    project_id: Optional[str] = typer.Option(None, help="Project ID or prefix"),
    is_global: bool = typer.Option(False, "--global", help="Upload as global material"),
) -> None:
    """Upload material."""
    if project_id:
        project_id = resolve_project_id(project_id, allow_context=False)
    path = ensure_file(file)
    with path.open("rb") as f:
        if is_global or not project_id:
            emit_output(state.api.post("/api/materials/upload", files={"file": (path.name, f)}))
        else:
            emit_output(state.api.post(f"/api/projects/{project_id}/materials/upload", files={"file": (path.name, f)}))
