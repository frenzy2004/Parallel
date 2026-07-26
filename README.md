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
- Screen Recording permission for the terminal/Electron host

## Run without API keys

```bash
npm install
npm run demo
```

The command builds the renderer and Electron processes, opens the bundled
Statics fixture, then starts PARALLEL. Press `Option+Space`, lasso the complete
problem and diagram, and follow the sidecar. Demo mode uses no network.

Keyboard controls:

- `M` — toggle mapping
- `N` — request another twin outcome
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

`npm run verify` exercises the real local API, Exa request boundary, and SQLite
storage behavior. It checks for answer fields, crop echoes, raw Exa leakage,
and raw storage columns/values.

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
- Only the in-memory lasso crop is submitted.
- OpenAI requests use strict structured outputs and `store: false`.
- Exa receives only an abstract query, uses an exact teaching-domain allowlist,
  and is filtered again after response.
- Compilation fails closed on pattern mismatch, confidence below `0.8`, or a
  non-null rejection reason.
- Personal Precedents store an abstract signature, mapping summary, twin style,
  and outcome—never screenshot bytes or raw OCR.
- `wrong_twin`, `not_same`, and `another_twin` suppress reuse.

The Electron main process saves the active abstract precedent when `Unlocked`
is selected and records negative outcomes for `Wrong twin`/`Another`. An
abstract-only precedent match IPC hook is implemented and tested at the storage
boundary. The current MVP does not yet render a “Same shape as Tuesday” reopen
card in the sidecar.

## Packages

- `packages/contracts` — strict Zod product/event contracts
- `packages/statics-patterns` — six deterministic, bounded Statics patterns
- `packages/twin-engine` — demo, OpenAI, and Exa providers plus safety gates
- `apps/api` — in-memory crop handling and SSE API
- `apps/desktop` — Electron lasso, sidecar, mapping overlay, and local SQLite
