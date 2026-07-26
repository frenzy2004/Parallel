# PARALLEL Prototype Implementation Report

Date: 2026-07-26  
Branch: `build/prototype`  
Worktree: `.worktrees/prototype`

## Baseline

- Verified the worktree is a linked Git worktree on `build/prototype`.
- Baseline was clean at commit `ca89917`.
- No application `package.json` existed, so there was no baseline suite to run.

## Task 1 — Workspace and typed product contracts

- RED: `npm test -- packages/contracts/src/twin.test.ts`
  - Failed as expected because `./twin.js` did not exist.
- Added strict Zod schemas for structural signatures, twin renders, precedents, requests, and the seven exact event states.
- GREEN: `npm test -- packages/contracts/src/twin.test.ts && npm run typecheck`
  - 4 tests passed; contracts TypeScript check passed.

## Task 2 — Validated Statics registry and deterministic compiler

- RED: `npm test -- packages/statics-patterns/src/compiler.test.ts`
  - Failed as expected because `./compiler.js` did not exist.
- Added six bounded pattern definitions, deterministic surface/worked-step generators, mapping anchors, and a fail-closed compiler.
- GREEN: `npm test -- packages/statics-patterns && npm run typecheck`
  - 4 compiler/registry tests passed across all six patterns; workspace typecheck passed.

## Task 3 — Privacy-safe OpenAI and Exa adapters

- RED: `npm test -- packages/twin-engine/src/providers/providers.test.ts`
  - Failed as expected because `../engine.js` did not exist.
- Added Responses API parse/compile adapters with strict Zod formats, image input, `store: false`, low reasoning, and configurable luna/terra models.
- Added abstract-query-only Exa search, teaching-domain result filtering, and deterministic no-key providers.
- GREEN: `npm test -- packages/twin-engine && npm run typecheck`
  - 4 provider/engine tests passed without network or credentials; workspace typecheck passed.

## Task 4 — Streaming local API and event budgets

- RED: `npm test -- apps/api/src/app.test.ts`
  - Failed as expected because `./app.js` did not exist.
- Added multipart crop validation, in-memory-only byte handling with zeroing in `finally`, ordered SSE events, a rolling 100-fresh-twin budget, abstract precedent matching, outcomes, health, and the versioned Statics course pack.
- GREEN: `npm test -- apps/api && npm run typecheck && npm run build -w @parallel/api`
  - 5 API tests passed; workspace typecheck and API compilation passed.

## Task 5 — Electron lasso, sidecar, and mapping overlay

- RED: `npm test -- apps/desktop`
  - Failed as expected because the Sidecar and placement modules did not exist.
- Added `Alt+Space` global invocation, macOS screen-access gate, explicit capture window, in-memory lasso crop, sidecar/mapping windows, a narrow preload bridge, accessible progressive UI, and keyboard actions `M/N/U/X/Esc`.
- GREEN: `npm test -- apps/desktop && npm run typecheck && npm run build -w @parallel/desktop`
  - 8 desktop tests passed; workspace typecheck passed; Vite renderer and Electron main/preload compiled.
- Runtime probe: `npx electron --version`
  - Electron `v37.10.3` is available.

## Current Exa request-shape correction

- RED: `npm test -- packages/twin-engine/src/providers/providers.test.ts`
  - Failed against the old top-level `highlights` payload.
- Updated to Bearer authorization, exact `includeDomains`, and
  `contents: { highlights: true }`, retaining post-response allowlist filtering.
- GREEN: focused provider suite passed (8 tests after safety-gate coverage was added).

## Task 6 — Personal Precedents, telemetry, demo, and evaluation

- RED: `npm test -- apps/desktop/electron/precedents.test.ts`
  - Failed as expected because `./precedents.js` did not exist.
- Added real SQLite abstract-precedent/outcome storage, a `0.92` match threshold,
  negative-outcome suppression, and an Electron outcome path that persists only
  the active abstract signature and generated twin.
- RED: `npm test -- tests/e2e/demo.spec.ts`
  - Failed because the bundled Statics fixture did not exist.
- Added the fixture, deterministic end-to-end journey, Map-toggle regression,
  `U/X/N` telemetry wiring, abstract match IPC hook, and 100 gold cases.
- Added a compiler safety gate for exact pattern match, confidence `>= 0.8`,
  null rejection reason, and evidence-backed allowlisted source references.
- `npm run evaluate`
  - 100/100 schema-valid and structurally faithful synthetic cases;
    0 confidently wrong; 0 answer leakage. Explicitly labeled as a synthetic
    preflight, not live-model validation.
- `npm run verify`
  - `prohibited_fields=0 crop_echoes=0 exa_raw_leaks=0
    sqlite_raw_columns=0 sqlite_raw_values=0`.
- Runtime packaging probe initially reproduced
  `ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX` because Electron resolved workspace
  TypeScript source. Electron main/preload now bundle to ignored generated
  output with esbuild.
- Electron 43 and Node 24 require different native ABIs for better-sqlite3.
  The desktop build now creates an ignored Electron-specific binding and
  restores the Node binding afterward, so both the real app and Node test/eval
  tooling remain runnable.
- `node scripts/probe-electron-runtime.mjs`
  - Launches the real bundled Electron main for two seconds. During
    `app.whenReady`, both better-sqlite3-backed stores open; the probe fails on
    Electron load errors, binding lookup failures, or native ABI/version
    mismatch diagnostics.
  - `electron_runtime_probe status=passed sqlite_native_load=passed`.
- Upgraded Electron to `43.2.0`; `npm audit` reports 0 vulnerabilities.
- `npm run smoke:live` without credentials
  - Exited with the expected
    `status=skipped reason=missing_OPENAI_API_KEY_or_EXA_API_KEY`.
  - Live provider execution remains pending because neither credential is
    present in this worktree process environment.

## Final verification

Fresh command:

```text
npm test &&
npm run typecheck &&
npm run build &&
npm run evaluate &&
npm run verify &&
npm audit &&
node scripts/probe-electron-runtime.mjs &&
git diff --check
```

Results:

- 36/36 tests passed in 8 test files.
- All five workspaces typechecked.
- API, renderer, bundled Electron main, and bundled preload built.
- Synthetic preflight: 100 cases, 100% schema validity/fidelity, 0%
  confidently wrong, 0% answer leakage.
- Privacy scan: all five prohibited counters were zero.
- npm audit: 0 vulnerabilities.
- Electron runtime probe: passed, including better-sqlite3 native load.
- Git whitespace check: passed.
