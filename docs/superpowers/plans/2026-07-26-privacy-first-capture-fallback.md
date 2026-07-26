# Privacy-First Capture Fallback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preserve instant lasso for granted users and give everyone else a private paste/drop/choose screenshot path.

**Architecture:** Add a dedicated React import view plus pure file/geometry helpers. Route ungranted hotkey invocations to a compact trusted Electron window, reuse the existing `submit-crop` boundary, and expose only one new sender-validated no-payload IPC action for macOS System Settings.

**Tech Stack:** Electron 43, React 18, TypeScript, Vitest, Testing Library, Vite/esbuild.

## Global Constraints

- Screen Recording is optional and only enables one-click lasso.
- Accepted input is exactly one PNG, JPEG, or WebP screenshot no larger than the existing 8 MiB crop ceiling.
- Screenshot bytes stay in memory and never enter a path, log, telemetry row, or new storage API.
- Every privileged IPC call requires the expected active `webContents`, trusted renderer URL, and exact payload cardinality.
- Granted users retain the existing full-screen lasso without an extra prompt.
- Do not use Computer Use.

---

### Task 1: Import validation and crop geometry

**Files:**
- Create: `apps/desktop/src/capture/import-image.ts`
- Create: `apps/desktop/src/capture/import-image.test.ts`

**Interfaces:**
- Produces: `validateImportedFile(files: File[]): File`
- Produces: `readImportedFile(file: File): Promise<string>`
- Produces: `locateImportedPreview(previewBounds, windowOrigin): Rectangle`

- [ ] **Step 1: Write failing tests**

Cover one permitted raster, empty/multiple files, SVG/text, empty and
over-8-MiB files, read failure, and a hand-derived preview rectangle translated
through a window with a non-zero screen origin.

- [ ] **Step 2: Run tests and verify red**

Run: `npm test -- apps/desktop/src/capture/import-image.test.ts`

Expected: FAIL because `import-image.ts` does not exist.

- [ ] **Step 3: Implement minimal pure helpers**

Use exact MIME membership, fixed byte limits, `FileReader` for data URLs, and
finite preview-to-screen geometry. Do not inspect or expose filesystem paths.

- [ ] **Step 4: Run tests and verify green**

Run: `npm test -- apps/desktop/src/capture/import-image.test.ts`

Expected: PASS.

### Task 2: Compact import renderer

**Files:**
- Create: `apps/desktop/src/capture/ScreenshotImport.tsx`
- Create: `apps/desktop/src/capture/ScreenshotImport.test.tsx`
- Modify: `apps/desktop/src/app.tsx`
- Modify: `apps/desktop/src/styles.css`

**Interfaces:**
- Consumes: Task 1 helpers
- Produces: `<ScreenshotImport onSubmit onDismiss onOpenScreenSettings />`
- Produces: renderer route `?view=import`

- [ ] **Step 1: Write failing component tests**

Exercise one valid file through change, paste, and drop; assert preview and
submit behavior. Assert inline rejection for invalid/multiple files and real
button behavior for dismiss/settings.

- [ ] **Step 2: Run tests and verify red**

Run: `npm test -- apps/desktop/src/capture/ScreenshotImport.test.tsx`

Expected: FAIL because the component does not exist.

- [ ] **Step 3: Implement the view**

Render a compact drop zone, hidden file input, optional preview, privacy note,
“Make twin” action, and optional-permission explanation. Convert the selected
file only in memory and forward its data URL. After successful submission,
lock the view as the visible original so mapping highlights target the image
the learner actually imported.

- [ ] **Step 4: Run component tests and verify green**

Run: `npm test -- apps/desktop/src/capture/ScreenshotImport.test.tsx`

Expected: PASS.

### Task 3: Trusted Electron fallback and Settings IPC

**Files:**
- Modify: `apps/desktop/electron/runtime-guard.test.ts`
- Modify: `apps/desktop/electron/runtime-guard.ts`
- Modify: `apps/desktop/electron/preload.ts`
- Modify: `apps/desktop/electron/main.ts`
- Modify: `apps/desktop/src/global.d.ts`

**Interfaces:**
- Consumes: existing `validateCropPayload` and generation lifecycle
- Produces: trusted view name `import`
- Produces: bridge methods `getCaptureContext()` and `openScreenSettings()`

- [ ] **Step 1: Write failing trust-policy tests**

Assert `?view=import` is accepted only on the configured document and the same
view on an attacker origin/path is rejected.

- [ ] **Step 2: Run runtime-guard tests and verify red**

Run: `npm test -- apps/desktop/electron/runtime-guard.test.ts`

Expected: FAIL because `import` is not an allowed view.

- [ ] **Step 3: Implement main/preload wiring**

On non-granted screen status, retain the nearest display bounds and open a
fixed compact import window. Validate both new no-payload IPC calls against
that active window. Return only display geometry from capture context; call
`shell.openExternal` only after trusted settings IPC. Reuse `submit-crop`,
preserve the locked import reference beside the sidecar, and close both as one
private session.

- [ ] **Step 4: Run focused desktop tests and typecheck**

Run: `npm test -- apps/desktop && npm run typecheck -w @parallel/desktop`

Expected: PASS.

### Task 4: Documentation and complete verification

**Files:**
- Modify: `README.md`
- Modify: `docs/BUILD_LOG.md`

**Interfaces:**
- Documents the permission-free daily path and exact privacy boundary.

- [ ] **Step 1: Update human documentation**

Document paste/drop/choose, optional Screen Recording, in-memory lifecycle,
accepted formats/limit, and the one-click lasso benefit.

- [ ] **Step 2: Run complete verification**

Run: `npm test`

Run: `npm run typecheck`

Run: `npm run build`

Run: `npm run evaluate`

Run: `npm run verify`

Run: `node scripts/probe-electron-runtime.mjs`

Run: `git diff --check`

- [ ] **Step 3: Commit and push**

Commit the implementation and evidence, then push `fix/privacy-capture`.
