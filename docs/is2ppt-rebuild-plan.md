# is2ppt New Project Rebuild Plan

This document is the working plan for rebuilding the existing application into
the `is2ppt` project. The goal is not a shallow rename. The goal is to keep the
product capabilities while establishing a clean, independent project structure,
domain language, configuration model, frontend architecture, backend boundaries,
CLI naming, documentation, tests, and deployment story.

Important boundary: this plan is for legitimate re-architecture and
maintainability. It must not rely on cosmetic obfuscation, random renames, or
changes whose only purpose is to disguise provenance. Every change should make
the project easier to maintain as `is2ppt`.

## Current State

Progress snapshot (2026-07-15):

- Phase 1 identity work is complete across frontend, backend identity constants,
  and the CLI package.
- Phase 2 frontend API split is complete; the legacy `endpoints.ts` facade has
  been removed.
- Phase 3 is complete. `Deck` and `Slide` domain models, DTO contracts,
  bidirectional mappers, and explicit legacy-store adapters are in place. The
  history feature consumes the new domain model, and business normalization no
  longer lives in generic utilities.
- Phase 4 is complete. A domain-level deck repository now owns list, load,
  rename, and delete operations; the history feature no longer imports project
  API endpoints or DTO mappers directly. `useDeckStore` owns the synchronized
  Deck snapshot, session restore, and load errors, while `useProjectStore`
  mirrors server syncs into it as a temporary compatibility facade.
  `useSlidesStore` now owns domain-level slide snapshots, local edits, ordering,
  additions, removals, and clearing. The compatibility facade mirrors full
  project syncs plus optimistic page edits and reorders into that store.
  `useGenerationJobsStore` now owns the active job, normalized progress,
  per-slide job assignments, warnings, and stream activity through independent
  domain names. `OutlineEditor` and `SlidePreview` consume it directly, and all
  generation actions write to it without legacy state fields or a subscription
  bridge. A reusable, cancellable backend job poller in `shared/api` owns status
  normalization, scheduling, and retry limits; generation and export modules
  depend on it through their own domain adapters. An image-generation coordinator
  owns per-slide job release, warning propagation, terminal failure handling,
  and generated-asset synchronization retries. `useProjectStore` supplies only
  project-data and error adapters to that coordinator. Export behavior now has
  an independent `ExportJob` model, DTO mapper, repository, persistent
  `useExportJobsStore`, and resumable polling. `SlidePreview` and
  `ExportJobsPanel` consume that boundary; the old export task store and the
  duplicate export methods in `useProjectStore` have been removed.
- Phase 5 is in progress. `Home.tsx` is now a thin route over the public
  `features/deck-create` entry point. Reference-document selection, validation,
  upload, parsing, and deduplication are owned by the feature model with focused
  tests instead of the route component.
- Phase 6 is in progress. Settings and several locale payloads have been split,
  and the remaining legacy banana visual marks have been removed from frontend
  source.
- Phase 7 and Phase 8 backend package/domain restructuring have not started.

The repository currently contains:

- React 18 + Vite frontend under `frontend/`.
- Flask backend under `backend/`.
- Python CLI under `cli/is2ppt_cli/`.
- Docker, docs, skills, tests, migrations, and deployment scripts.
- Frontend business logic concentrated in large files:
  - `frontend/src/pages/SlidePreview.tsx`
  - `frontend/src/store/useProjectStore.ts`
- Frontend DTO compatibility types now live at the API/domain boundary, while
  migrated UI code uses `Deck` and `Slide` terminology.
- Backend logic organized around `controllers/`, `services/`, `models/`, and
  `utils/`, but still uses the old project vocabulary heavily.

## Target Project Identity

Project name:

- Product: `is2ppt`
- Frontend package: `is2ppt-frontend`
- Backend package/module target: `is2ppt_backend`
- CLI command target: `is2ppt`
- Docker image names: `is2ppt-frontend`, `is2ppt-backend`, `is2ppt-allinone`
- Storage prefix: `is2ppt`

Domain language:

- `Project` remains as backend compatibility DTO initially, but frontend domain
  code should move toward `Deck`.
- `Page` remains as backend compatibility DTO initially, but frontend domain
  code should move toward `Slide`.
- `Outline` becomes `DeckPlan` in frontend domain code.
- `Description` becomes `SlideSpec` in frontend domain code.
- `Task` becomes `GenerationJob` or `ExportJob` depending on context.
- `PPT renovation` becomes `Import/Renew` or `Source Deck Import` depending on
  final product wording.

## Guiding Principles

1. Preserve behavior first.
2. Keep backend API compatibility until frontend adapters are stable.
3. Introduce new domain models behind mappers instead of mass-renaming DTOs.
4. Move side effects out of stores and components.
5. Prefer feature-based modules over global catch-all folders.
6. Make every step small enough to test.
7. Avoid unrelated formatting churn.
8. Never delete old compatibility paths until callers and tests are migrated.

## Target Frontend Architecture

Proposed structure:

```text
frontend/src/
  app/
    App.tsx
    routes.tsx
    providers/
  features/
    deck-create/
    deck-plan/
    slide-spec/
    deck-workspace/
    settings/
    exports/
    reference-files/
  entities/
    deck/
    slide/
    generation-job/
    template/
  shared/
    api/
    config/
    i18n/
    lib/
    storage/
    ui/
```

Frontend responsibilities:

- `shared/api`: low-level HTTP client and API modules.
- `entities/*`: domain types, DTO mappers, selectors, pure helpers.
- `features/*`: page-level flows, hooks, and feature-specific components.
- `shared/ui`: reusable presentational components.
- `app`: routing and providers only.

Store target:

- `useDeckStore`: current deck, sync, persistence.
- `useSlidesStore`: local slide edits, ordering, optimistic updates.
- `useGenerationJobsStore`: outline/spec/image generation state.
- `useExportJobsStore`: export task persistence and polling.
- `useWorkspaceStore`: UI-only workspace state where global state is justified.

The existing `useProjectStore` should become a temporary compatibility facade,
then disappear after feature migration.

## Target Backend Architecture

Initial backend target keeps Flask and existing database compatibility.

Proposed structure:

```text
backend/
  is2ppt_backend/
    app/
      factory.py
      extensions.py
      routes/
    domain/
      deck/
      slide/
      generation/
      export/
      settings/
      assets/
    infrastructure/
      database/
      ai/
      storage/
      files/
      pptx/
    api/
      schemas/
      adapters/
    jobs/
    shared/
```

Backend migration approach:

- Keep existing Flask app bootable while introducing new package paths.
- Move controllers into route modules by domain.
- Move service logic into use-case-oriented modules.
- Keep SQLAlchemy models stable until migrations are intentionally planned.
- Add DTO/schema adapters so API response compatibility does not block internal
  renaming.

## Target API Strategy

Keep current endpoints first:

- `/api/projects`
- `/api/projects/:id/pages`
- `/api/projects/:id/generate/*`
- `/api/projects/:id/export/*`
- `/api/settings`
- `/api/reference-files/*`

Introduce frontend API modules:

- `projectsApi`
- `slidesApi`
- `generationApi`
- `exportsApi`
- `settingsApi`
- `referenceFilesApi`
- `templatesApi`

Only after frontend and backend internals are stable, consider new endpoint
aliases such as:

- `/api/decks`
- `/api/decks/:id/slides`
- `/api/decks/:id/jobs/*`

Endpoint aliases are optional and should come late.

## Phased Work Plan

### Phase 0: Safety Baseline

Goal: know what must keep working before large movement.

Tasks:

- Record current package names, commands, ports, and entry points.
- Identify unit tests and e2e tests that cover the main workflows.
- Add a lightweight refactor checklist document.
- Run the fastest reliable test subset before and after each phase.

Acceptance:

- No application behavior changes.
- Git diff contains docs or test-only updates.

### Phase 1: Project Identity Foundation

Goal: establish centralized `is2ppt` identity without touching business logic.

Tasks:

- Add frontend brand config.
- Add frontend storage key registry and migration helper.
- Replace hard-coded frontend app title and package name.
- Replace obvious UI product names through centralized constants.
- Add backend app identity constants.
- Add CLI identity constants.

Acceptance:

- App still boots.
- Existing storage can migrate to new keys.
- No route or database behavior changes.

### Phase 2: Frontend API Split

Goal: remove `endpoints.ts` as the single API dumping ground.

Tasks:

- Create `shared/api/httpClient.ts`.
- Move access-code APIs.
- Move project/deck APIs.
- Move generation APIs, including SSE helpers.
- Move slide/page APIs.
- Move export APIs.
- Move settings APIs.
- Keep `endpoints.ts` as a compatibility re-export until imports are migrated.

Acceptance:

- Existing imports still work.
- Unit tests still pass.
- New modules have clear responsibility boundaries.

### Phase 3: Frontend Domain Layer

Goal: separate backend DTO names from frontend domain names.

Tasks:

- Add `entities/deck/model/types.ts`.
- Add `entities/slide/model/types.ts`.
- Add DTO mappers:
  - `projectDtoToDeck`
  - `deckToProjectUpdateDto`
  - `pageDtoToSlide`
  - `slideToPageUpdateDto`
- Move normalization logic from generic utils into entity modules.
- Keep DTO compatibility types available for API modules.

Acceptance:

- UI code can start using `Deck` and `Slide`.
- API modules still speak current backend DTOs.

### Phase 4: Frontend Store Split

Goal: break up `useProjectStore` by responsibility.

Tasks:

- Extract deck sync and persistence into `useDeckStore`.
- Extract slide local updates into `useSlidesStore`.
- Extract async generation state into `useGenerationJobsStore`.
- Extract export state and requests into `useExportJobsStore`.
- Extract polling helpers into services.
- Keep a temporary `useProjectStore` adapter that delegates to new stores.
- Migrate tests from `useProjectStore` behavior to new store behavior.

Acceptance:

- Existing pages continue to work through the compatibility facade.
- New tests cover the split stores.
- Side effects are reduced in stores.

### Phase 5: Frontend Feature Rebuild

Goal: move from page-heavy files to feature modules.

Tasks:

- Create `features/deck-create`.
- Rebuild `Home.tsx` as a thin route component.
- Create `features/deck-plan`.
- Rebuild `OutlineEditor.tsx` as a thin route component.
- Create `features/slide-spec`.
- Rebuild `DetailEditor.tsx` as a thin route component.
- Create `features/deck-workspace`.
- Split `SlidePreview.tsx` into:
  - workspace shell
  - slide navigator
  - slide canvas
  - edit panel/dialog
  - version history
  - export menu/dialogs
  - project settings launcher

Acceptance:

- Route files should mainly compose feature components and hooks.
- No single route file should remain above roughly 400 lines unless justified.
- Playwright smoke flow passes.

### Phase 6: Frontend UI System Cleanup

Goal: make the UI system belong to `is2ppt`.

Tasks:

- Move reusable controls into `shared/ui`.
- Introduce design tokens with neutral `brand` naming.
- Replace old color token names gradually.
- Centralize dialogs, menus, loading states, and status badges.
- Move embedded page i18n objects into locale files or feature locale modules.

Acceptance:

- No old product-specific style token names in new code.
- UI components are reusable and not tied to a single page.

### Phase 7: Backend Package Restructure

Goal: prepare backend for `is2ppt_backend` without breaking the current app.

Tasks:

- Add `backend/is2ppt_backend/` package.
- Add app factory wrapper and extension registry.
- Move route registration gradually.
- Keep old `backend/app.py` as boot compatibility.
- Move config constants into the new package.
- Add tests for app factory and health endpoints.

Acceptance:

- Old start command works.
- New app factory can be imported in tests.
- Health and settings endpoints remain compatible.

### Phase 8: Backend Domain Refactor

Goal: move business logic out of large service/controller modules.

Tasks:

- Create domain modules for deck, slide, generation, export, settings, files.
- Move pure logic first.
- Move IO-heavy logic second.
- Add adapters around AI providers, file storage, and PPTX export.
- Preserve SQLAlchemy models initially.
- Add use-case tests for:
  - create deck
  - generate deck plan
  - generate slide specs
  - generate slide images
  - export deck
  - import/renew source deck

Acceptance:

- Controllers become thin request/response adapters.
- Services become focused use cases.
- Tests cover domain behavior independent from Flask where possible.

### Phase 9: CLI Rebuild

Goal: replace old CLI identity and command organization with `is2ppt`.

Tasks:

- Add new CLI package and command entry point.
- Keep old CLI command as compatibility alias for one transition period if
  needed.
- Reorganize commands around deck, slides, jobs, exports, settings, refs.
- Update CLI tests.

Acceptance:

- `is2ppt --help` works.
- Main CLI workflows work against existing backend API.

### Phase 10: Docs, Docker, Scripts, Skills

Goal: make operational surfaces consistent with `is2ppt`.

Tasks:

- Rewrite README.
- Update docs site metadata and pages.
- Update Docker image names and container names.
- Update start scripts.
- Update CI/local scripts.
- Decide whether old skills are removed, renamed, or replaced.

Acceptance:

- Fresh developer can follow docs to run the app.
- Docker compose boots using `is2ppt` names.

### Phase 11: Compatibility Cleanup

Goal: remove old compatibility layers after migration is complete.

Tasks:

- Remove old frontend facade modules.
- Remove old CLI package alias if no longer needed.
- Remove obsolete docs and assets.
- Remove old storage migration only after one or more releases if this is a
  distributed app.
- Remove dead tests tied only to old implementation details.

Acceptance:

- No active code imports obsolete compatibility modules.
- Search results for old project identity are limited to changelog/license or
  intentional migration notes.

## Small Task Queue

Work in this order unless a test failure forces a smaller prerequisite.

1. Add this plan.
2. Add `frontend/src/shared/config/appIdentity.ts`.
3. Add `frontend/src/shared/storage/storageKeys.ts`.
4. Add frontend storage migration helper.
5. Wire migration helper in app startup.
6. Update frontend package name and document title.
7. Replace visible app display name through identity constants.
8. Add backend identity constants.
9. Add CLI identity constants.
10. Split API client from endpoint catalog.
11. Split access-code API.
12. Split settings API.
13. Split project/deck API.
14. Split slide/page API.
15. Split generation API and SSE parser.
16. Split export API.
17. Add frontend domain types for deck and slide.
18. Add DTO mappers.
19. Move project normalization into entity mapper.
20. Introduce `useDeckStore`.
21. Introduce `useSlidesStore`.
22. Introduce generation job service.
23. Introduce export job service.
24. Convert `useProjectStore` to compatibility facade.
25. Rebuild `Home` as `deck-create`.
26. Rebuild `OutlineEditor` as `deck-plan`.
27. Rebuild `DetailEditor` as `slide-spec`.
28. Rebuild `SlidePreview` as `deck-workspace`.
29. Split settings page.
30. Clean UI tokens and locale placement.
31. Add backend package skeleton.
32. Wrap Flask app factory.
33. Move backend routes by domain.
34. Move backend use cases by domain.
35. Add new CLI package entry.
36. Update docs/docker/scripts.
37. Remove obsolete compatibility layers.

## Verification Matrix

Fast checks after each small task:

- `npm run test:run` in `frontend/` when frontend logic changes.
- Targeted Playwright spec when a route changes.
- `pytest` targeted backend tests when backend logic changes.
- CLI unit tests when CLI changes.

Critical manual or e2e flows:

- Access code gate.
- Create deck from idea.
- Create deck from outline.
- Create deck from description.
- Upload reference files.
- Generate deck plan through streaming.
- Generate slide specs through streaming and parallel modes.
- Generate one slide image.
- Generate all slide images.
- Edit one slide image.
- Export PPTX.
- Export PDF.
- Export images.
- Export editable PPTX task.
- Import/renew PPT/PDF source deck.
- Settings save/reset/service tests.

## Stop Conditions

Pause and reassess if any of these happen:

- A small task requires changing backend API contracts unexpectedly.
- A store split causes route behavior regressions not covered by existing tests.
- Storage migration risks deleting user data.
- A large file split starts mixing behavior changes with movement.
- Docker or CLI changes require package publishing decisions.

## Working Rule For Future Tasks

Each implementation task should include:

- One clear scope.
- A before/after import strategy.
- Compatibility path if callers are not migrated in the same task.
- Focused tests or a reason tests were not run.
- A short note in the final response naming the next queued task.
