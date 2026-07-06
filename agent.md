# Agent Handoff

## Project Context

- Repo: `D:\PPT rebase\IS2PPT-1`
- Branch: `main`
- Remote: `origin git@github.com:PuPuSama/IS2PPT-DEMO.git`
- Real Python venv: `D:\PPT rebase\IS2PPT-1\.venv`
- Do not use `backend/.venv`; its dependencies may be incomplete.
- Local ports normally used by this worktree:
  - Backend: `http://localhost:5011/`
  - Frontend: `http://localhost:3011/`

## Current Pruning State

Already removed and committed before this handoff:

- Video narration export
- TTS/narration pipeline
- ElevenLabs integration
- Frontend video export/narration UI
- Image-route editable-PPTX options: extractor/inpaint/icon

Current material pruning work:

- Material center UI removed.
- Material generator UI and backend task flow removed.
- Material selector/library UI removed.
- Public material list/delete/download/associate APIs removed.
- Reference-file parse no longer auto-imports parsed images into the material library.
- Prompt/help wording no longer refers to a material library.

Retained deliberately:

- SVG editable-PPTX export entry.
- `allow_partial` export behavior.
- Inline editor image paste/upload internals: `/api/materials/upload`, `/api/projects/<id>/materials/upload`, `/api/materials/<id>/caption`, `/api/materials/by-url`.
- The `Material` model/table remains because inline image paste still stores uploaded images there.
- Existing `/files/.../materials/...` URLs remain compatible with old projects and pasted images.

## Important Decision

Do not remove the remaining internal material upload/caption routes unless you first replace image paste/upload with a neutral image storage endpoint. They are not exposed as a material library UI anymore, but the markdown editors still depend on them for pasted/uploaded images.

## Recently Diagnosed Outline Error

The user reported that creating a new PPT failed on the outline generation page. The confirmed root cause was configuration, not code:

- Active text provider was OpenAI-compatible via `https://www.packyapi.com/v1`.
- Saved `TEXT_MODEL` was `gpt-5.4`.
- The provider returned `model_not_found` for `gpt-5.4` during `/chat/completions`.
- The user fixed the API/model configuration.

If outline generation fails again, inspect backend logs first and identify the exact provider/upstream error before blaming the pruning change.

## Lazy Provider Change

A previous lazy AI provider change in:

- `backend/services/ai_service.py`
- `backend/services/ai_service_manager.py`

was explicitly reverted before continuing material pruning. Do not reintroduce it unless the user asks.

## Verification Checklist

Before any future pruning commit:

1. Check git state:

   ```powershell
   git status --short
   git log --oneline -5
   ```

2. Backend syntax/import checks:

   ```powershell
   cd backend
   ..\.venv\Scripts\python.exe -m compileall services controllers
   ..\.venv\Scripts\python.exe -c "from app import app; print('APP_IMPORT_OK')"
   ```

3. Frontend TypeScript check:

   ```powershell
   cd frontend
   npx tsc --noEmit
   ```

   The project has historical TypeScript errors and does not use `tsc` as a hard gate. Compare against the current baseline and confirm touched files do not introduce new errors.

4. Grep for removed feature remnants:

   ```powershell
   rg "MaterialSelector|MaterialCenter|MaterialGenerator|素材库|素材中心|素材生成|listMaterials|deleteMaterial|associateMaterialsToProject|downloadMaterialsZip" frontend\src backend
   ```

5. Manual smoke test:

   - Open frontend on `http://localhost:3011/`.
   - Create a new PPT.
   - Generate outline.
   - Continue far enough to confirm page/description generation starts.
   - If it fails, inspect backend logs before assuming the last code edit caused it.

## Known Test Notes

- Backend `compileall services controllers` passed after material pruning.
- Backend `from app import app` passed after material pruning.
- Frontend `npx tsc --noEmit` reported 45 historical errors; no errors came from the current pruning files after cleanup.
- `backend/tests/unit/test_api_material.py` had 13/15 passing. The 2 failures are Windows-specific issues in the retained inline image upload/caption path:
  - `relative_path` uses `\` on Windows while the test expects `/`.
  - `_generate_image_caption` leaves an image file handle open long enough for `os.unlink` to fail on Windows.

Those two are not part of the public material library removal, but should be fixed if the retained image upload tests are made a gate.

## Future Pruning Principles

- Prune one feature family at a time.
- Keep commits scoped to one feature family.
- Avoid mixing configuration fixes, dependency cleanup, and UI deletion unless they are inseparable.
- Preserve core PPT creation, outline generation, page generation, templates, and export unless explicitly targeted.
- Run backend compile/import checks and frontend TS comparison before pushing.