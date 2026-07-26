# PARALLEL prototype

PARALLEL is a macOS Electron prototype for one narrow learning loop:
press `Option+Space`, lasso a complete 2D Statics problem, and receive a
fully worked structural twin with different surface details. It never returns
the original problem’s final answer.

This build is a deterministic product demo and synthetic technical preflight.
It is not evidence of live-model fidelity, learning outcomes, or product-market
fit. The pilot protocol and TA review remain responsible for those claims.

## Requirements

- macOS
- Node.js 22 or newer
- npm

Screen Recording is optional. Without it, PARALLEL accepts a screenshot by
paste, drag/drop, or the file picker. Grant it only if you want the instant
one-click lasso.

## Run without API keys

```bash
npm install
npm run demo
```

The command builds the renderer and Electron processes, opens the bundled
Statics fixture, then starts PARALLEL in an explicit fixed-fixture mode. Press
`Option+Space`:

- Without Screen Recording access, paste, drop, or choose one complete PNG,
  JPEG, or WebP problem screenshot (up to 8 MiB), then select **Make twin**.
- With Screen Recording access, lasso the complete problem and diagram
  directly on screen.

The compact import view includes a trusted **Enable one-click lasso** action
that opens the exact macOS Screen Recording settings pane. Demo mode uses no
network and cannot silently become a solver for arbitrary screens. Outside this
command, a missing live recognition provider fails closed.

Keyboard controls:

- `M` — toggle mapping
- `N` — generate a different verified twin from the same abstract structure
- `U` — mark unlocked
- `X` — mark wrong twin
- `Esc` — dismiss

## Verify

```bash
npm test
npm run typecheck
npm run build
npm run evaluate
npm run verify
```

`npm run evaluate` runs 100 deterministic known-structure cases across the six
bounded pattern families. Its output is explicitly labeled
`synthetic_preflight_not_live_model_validation`.

`npm run verify` composes the in-process API route, a poisoned Exa request
boundary, and SQLite storage inspection. It checks for answer fields, crop
echoes, raw Exa leakage, and raw storage columns/values. It is a deterministic
privacy preflight, not a bound-service or live-provider claim.

## Optional live-provider smoke test

No `.env` file is needed or read. Supply credentials only in the process
environment:

```bash
OPENAI_API_KEY=... EXA_API_KEY=... npm run smoke:live
```

The smoke test renders the bundled Statics fixture and exercises both providers.
It prints only status, recognized pattern, and latency. It never prints keys,
the image, prompts, provider responses, or student content. It exits with a
clear skipped status when either credential is absent.

Optional model overrides:

- `OPENAI_RECOGNITION_MODEL` (default `gpt-5.6-terra`; chosen from live latency samples)

## Privacy and safety boundaries

- Capture occurs only after explicit `Option+Space` invocation.
- Only the in-memory lasso crop or explicitly imported screenshot is
  submitted.
- Imported screenshots are never written to disk by PARALLEL. The renderer
  keeps the selected image only as a visible mapping reference until the
  overlay closes; the generation lease releases its copy immediately after
  recognition. In live mode, the selected image is sent only to the configured
  OpenAI provider to recognize the structure.
- Optional instant lasso reads screen thumbnails locally so the user can make
  a selection. Full-screen pixels are never uploaded; only the completed lasso
  crop is submitted.
- Import accepts exactly one PNG, JPEG, or WebP image under the existing 8 MiB
  crop limit; the main process validates MIME, base64 bytes, payload shape,
  display bounds, sender identity, and the exact trusted renderer view.
- OpenAI requests use strict structured outputs and `store: false`.
- Dismissal aborts an in-flight provider request, and regeneration works from
  the abstract signature without uploading the crop again.
- Exa receives only an abstract query, uses an exact teaching-domain allowlist,
  and is filtered again after response.
- Compilation fails closed on pattern mismatch, confidence below `0.8`, or a
  non-null rejection reason.
- Personal Precedents store an abstract signature, mapping summary, twin style,
  and outcome—never screenshot bytes or raw OCR.
- `wrong_twin`, `not_same`, and `another_twin` suppress reuse.

The Electron main process saves the active abstract precedent when `Unlocked`
is selected and records negative outcomes for `Wrong twin`/`Another`. The
sidecar renders a matched **Personal Precedent** card and lets the student mark
an incorrect match as **Not same** without persisting screenshot geometry.

## Paid-recognition budget

The Electron main process—not the renderer—is the authority for paid live
recognition. Before it can construct a fresh OpenAI recognition stream, a
single SQLite transaction removes timestamps older than the 30-day rolling
window, checks the 100-call limit, and persists the new timestamp. The
transaction survives app restarts and stores only an integer ID and timestamp;
API keys, screenshots, OCR, prompts, and provider responses never enter the
budget table.

`N` regeneration uses the already validated abstract signature and is
explicitly uncharged. A Personal Precedent can be treated as uncharged only
when an exact `sha256:` ID resolves locally to an `unlocked` row containing a
schema-valid stored twin. Arbitrary IDs never create an exemption, and the
fresh capture/API paths do not accept a precedent ID at all. The current
overlay does not yet expose a precedent shelf, so every new capture remains a
fresh recognition; this is the deliberate fail-closed behavior until a real
stored-twin reopen entry point ships.

## Packages

- `packages/contracts` — strict Zod product/event contracts
- `packages/statics-patterns` — six deterministic, bounded Statics patterns
- `packages/twin-engine` — demo, OpenAI, and Exa providers plus safety gates
- `apps/api` — in-memory crop handling and SSE API
- `apps/desktop` — Electron lasso, sidecar, mapping overlay, and local SQLite
