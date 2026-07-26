# PARALLEL Electron Prototype Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a macOS Electron prototype where `Option+Space` opens a crop-only lasso and a sidecar returns a mapped, worked 2D Statics twin without revealing the original answer.

**Architecture:** An npm workspace separates Electron shell, local API, shared Zod contracts, validated Statics patterns, and provider adapters. The renderer owns layout; providers return strict data. Deterministic demo mode is the default, while OpenAI Responses API and Exa adapters activate only when server-side credentials exist.

**Tech Stack:** Node.js 22+, TypeScript 5, Electron, React, Vite, Vitest, Zod, OpenAI Node SDK, Exa REST API, Hono, Server-Sent Events, better-sqlite3

## Global Constraints

- Initial platform is macOS only.
- Initial intelligence pack is 2D engineering Statics only.
- Founding pilot participants are 18 or older.
- Invoke with `Option+Space`; dismiss with `Esc`.
- Capture and transmit only the lassoed region, never the full display.
- Never send screenshot pixels, page URLs, student names, or raw work to Exa.
- Never return or persist the original final answer.
- Low-confidence and incomplete selections fail closed.
- Demo mode must work with neither `OPENAI_API_KEY` nor `EXA_API_KEY`.
- Paid usage budget is 100 fresh twins per rolling month; verified precedent reopens do not consume the budget.
- Recognition label target is under 1.2 seconds median; full mapping target is under 7 seconds median.
- Store abstract precedents locally; never store screenshot bytes after success, dismissal, or retry expiry.
- Active model defaults are `gpt-5.6-luna` for recognition and `gpt-5.6-terra` for compilation, both overridable by environment variables.

---

### Task 1: Workspace and typed product contracts

**Files:**
- Create: `package.json`
- Create: `tsconfig.base.json`
- Create: `packages/contracts/package.json`
- Create: `packages/contracts/src/twin.ts`
- Create: `packages/contracts/src/events.ts`
- Test: `packages/contracts/src/twin.test.ts`

**Interfaces:**
- Consumes: Product fields in `docs/superpowers/specs/2026-07-26-parallel-sidecar-twin-design.md`.
- Produces: `StructuralSignatureSchema`, `TwinRenderSchema`, `PrecedentSchema`, `TwinEventSchema`, and inferred TypeScript types.

- [ ] **Step 1: Write the failing schema tests**

```ts
it("rejects answer leakage and missing mapping anchors", () => {
  expect(() => TwinRenderSchema.parse({ ...validTwin, answerLeak: true })).toThrow();
  expect(() => TwinRenderSchema.parse({ ...validTwin, mappingEdges: [] })).toThrow();
});
```

- [ ] **Step 2: Run the focused test and confirm red**

Run: `npm test -- packages/contracts/src/twin.test.ts`

Expected: FAIL because `TwinRenderSchema` is not exported.

- [ ] **Step 3: Add the npm workspace and strict Zod contracts**

Implement exact discriminated states `reading | recognized | twin_step | complete | recapture | unsupported | error`; constrain confidence to `0..1`; reject `answerLeak: true`; require at least one mapping edge for a successful render.

- [ ] **Step 4: Run contract tests and typecheck**

Run: `npm test -- packages/contracts/src/twin.test.ts && npm run typecheck`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add package.json tsconfig.base.json packages/contracts
git commit -m "feat: define PARALLEL twin contracts"
```

### Task 2: Validated Statics pattern registry and deterministic compiler

**Files:**
- Create: `packages/statics-patterns/package.json`
- Create: `packages/statics-patterns/src/registry.ts`
- Create: `packages/statics-patterns/src/compiler.ts`
- Create: `packages/statics-patterns/src/patterns/*.ts`
- Test: `packages/statics-patterns/src/compiler.test.ts`

**Interfaces:**
- Consumes: `StructuralSignature` and `TwinRender`.
- Produces: `getPattern(patternId: StaticsPatternId): StaticsPattern` and `compileVerifiedTwin(signature, seed): TwinRender`.

- [ ] **Step 1: Write a red test for structural invariance**

```ts
it("changes surface details but preserves moment-equilibrium structure", () => {
  const twin = compileVerifiedTwin(momentSignature, 7);
  expect(twin.patternId).toBe("moment_about_point");
  expect(twin.twinStatement).not.toContain("ladder");
  expect(twin.workedSteps.at(-1)?.expression).toContain("ΣM");
  expect(twin.answerLeak).toBe(false);
});
```

- [ ] **Step 2: Run the test and confirm red**

Run: `npm test -- packages/statics-patterns/src/compiler.test.ts`

Expected: FAIL because the registry does not exist.

- [ ] **Step 3: Implement six expert-bounded patterns**

Implement `concurrent_force_equilibrium`, `resultant_coplanar_forces`, `moment_about_point`, `rigid_body_equilibrium_2d`, `couple_moments`, and `equivalent_distributed_load`. Each pattern declares invariants, numeric bounds, allowed methods, a deterministic surface generator, worked-step generator, and mapping-anchor generator.

- [ ] **Step 4: Run pattern tests**

Run: `npm test -- packages/statics-patterns`

Expected: PASS for schema validity, deterministic seeds, surface variation, and no original-answer field.

- [ ] **Step 5: Commit**

```bash
git add packages/statics-patterns
git commit -m "feat: add verified Statics twin compiler"
```

### Task 3: Privacy-safe OpenAI and Exa provider adapters

**Files:**
- Create: `packages/twin-engine/package.json`
- Create: `packages/twin-engine/src/providers/types.ts`
- Create: `packages/twin-engine/src/providers/openai.ts`
- Create: `packages/twin-engine/src/providers/exa.ts`
- Create: `packages/twin-engine/src/providers/demo.ts`
- Create: `packages/twin-engine/src/engine.ts`
- Test: `packages/twin-engine/src/providers/providers.test.ts`

**Interfaces:**
- Consumes: `TwinRequest { cropDataUrl, coursePackId, attemptContext? }`.
- Produces: `TwinEngine.stream(request): AsyncGenerator<TwinEvent>` and provider interfaces `parseStructure`, `findEvidence`, `compileTwin`.

- [ ] **Step 1: Write provider-boundary tests**

```ts
it("sends Exa only the abstract query", async () => {
  await provider.search({ query: safeQuery, cropDataUrl: secretCrop } as never);
  expect(fetchBody).toEqual({ query: safeQuery, type: "fast", numResults: 4, highlights: true });
  expect(JSON.stringify(fetchBody)).not.toContain(secretCrop);
});
```

- [ ] **Step 2: Run the tests and confirm red**

Run: `npm test -- packages/twin-engine/src/providers/providers.test.ts`

Expected: FAIL because provider modules are missing.

- [ ] **Step 3: Implement strict providers and demo fallback**

Use `openai.responses.parse` with base64 `input_image`, `zodTextFormat`, `store: false`, and lean system prompts. Exa receives only `StructuralSignature.exaQuery`, requests four `fast` results with highlights, and allows only `engineeringstatics.org`, `eng.libretexts.org`, `ocw.mit.edu`, and `pressbooks.library.upei.ca`. Select demo providers whenever credentials are absent.

- [ ] **Step 4: Run provider tests and mock integration**

Run: `npm test -- packages/twin-engine`

Expected: PASS without network or credentials.

- [ ] **Step 5: Commit**

```bash
git add packages/twin-engine
git commit -m "feat: add private twin provider pipeline"
```

### Task 4: Streaming local API and event budgets

**Files:**
- Create: `apps/api/package.json`
- Create: `apps/api/src/app.ts`
- Create: `apps/api/src/routes/twins.ts`
- Create: `apps/api/src/routes/outcomes.ts`
- Create: `apps/api/src/routes/precedents.ts`
- Create: `apps/api/src/routes/course-packs.ts`
- Create: `apps/api/src/budget.ts`
- Test: `apps/api/src/app.test.ts`

**Interfaces:**
- Consumes: multipart `POST /v1/twins` with crop and course pack.
- Produces: SSE `TwinEvent` stream; JSON outcome acknowledgements; `GET /health`.

- [ ] **Step 1: Write red API tests**

Test unsupported MIME rejection, 8 MB crop cap, ordered SSE states, and a stream containing no original answer field.

- [ ] **Step 2: Run the API tests and confirm red**

Run: `npm test -- apps/api/src/app.test.ts`

Expected: FAIL because `createApp` is missing.

- [ ] **Step 3: Implement the Hono routes**

Keep crop bytes in request memory only, stream `reading → recognized → twin_step → complete`, enforce the 100-fresh-twins rolling budget, expose abstract-only precedent matching and a versioned `statics-2d-v1` course pack, and always clear the crop buffer in `finally`.

- [ ] **Step 4: Run API tests**

Run: `npm test -- apps/api`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api
git commit -m "feat: stream bounded twin sessions"
```

### Task 5: Electron lasso, sidecar, and correspondence overlay

**Files:**
- Create: `apps/desktop/package.json`
- Create: `apps/desktop/electron/main.ts`
- Create: `apps/desktop/electron/preload.ts`
- Create: `apps/desktop/src/capture/Lasso.tsx`
- Create: `apps/desktop/src/sidecar/Sidecar.tsx`
- Create: `apps/desktop/src/mapping/MappingOverlay.tsx`
- Create: `apps/desktop/src/app.tsx`
- Create: `apps/desktop/src/styles.css`
- Test: `apps/desktop/src/sidecar/Sidecar.test.tsx`
- Test: `apps/desktop/electron/window-placement.test.ts`

**Interfaces:**
- Consumes: preload IPC `startCapture`, `submitCrop`, `setMappingHighlights`, `dismiss`.
- Produces: capture window, sidecar window, click-through mapping window, and keyboard actions `M/N/U/X/Esc`.

- [ ] **Step 1: Write red UI and placement tests**

Assert the sidecar chooses right, left, then below without covering the lasso; assert every streamed state has an accessible announcement; assert `Esc` calls `dismiss`.

- [ ] **Step 2: Run focused desktop tests and confirm red**

Run: `npm test -- apps/desktop`

Expected: FAIL because components and placement logic are absent.

- [ ] **Step 3: Implement the macOS overlay loop**

Register `Alt+Space`, request screen-recording access, capture only after explicit invocation, render a drag lasso, crop in-memory canvas bytes, close capture before showing the sidecar, and draw click-through mapping rectangles on hover.

- [ ] **Step 4: Run desktop tests and renderer build**

Run: `npm test -- apps/desktop && npm run build -w @parallel/desktop`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop
git commit -m "feat: build PARALLEL overlay interaction"
```

### Task 6: Personal Precedents, telemetry, and end-to-end demo

**Files:**
- Create: `apps/desktop/electron/precedents.ts`
- Create: `apps/desktop/electron/telemetry.ts`
- Create: `apps/desktop/demo/statics-problem.html`
- Create: `tests/e2e/demo.spec.ts`
- Create: `tests/evals/statics-gold.json`
- Create: `scripts/evaluate-gold.mjs`
- Create: `scripts/verify-privacy.mjs`
- Create: `README.md`
- Test: `apps/desktop/electron/precedents.test.ts`

**Interfaces:**
- Consumes: confirmed `StructuralSignature`, `TwinRender`, and outcome.
- Produces: `savePrecedent`, `matchPrecedent`, local outcome events, `npm run demo`, and `npm run verify`.

- [ ] **Step 1: Write red precedent and privacy tests**

Assert screenshot bytes and raw OCR never enter SQLite; require a match threshold of `0.92`; require `wrong_twin` and `not_same` to suppress reuse.

- [ ] **Step 2: Run the tests and confirm red**

Run: `npm test -- apps/desktop/electron/precedents.test.ts`

Expected: FAIL because persistence is missing.

- [ ] **Step 3: Implement local storage and the sample journey**

Create SQLite tables for abstract precedents and outcome events, add a bundled Statics problem, and make `npm run demo` open the sample before the overlay shortcut is used.

Populate 100 deterministic known-structure cases across the six patterns and make `npm run evaluate` report schema validity, structural-pattern fidelity, confidently wrong rate, answer leakage, and latency separately. Label this a synthetic preflight; the GTM protocol remains responsible for TA review.

- [ ] **Step 4: Verify the entire prototype**

Run: `npm test && npm run typecheck && npm run build && npm run evaluate && npm run verify`

Expected: all tests pass; privacy scan reports zero prohibited fields; packaged renderer and Electron main compile.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop tests scripts README.md
git commit -m "feat: complete the PARALLEL prototype loop"
```
