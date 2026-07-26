# PARALLEL product build log

This file records failures, root causes, fixes, and fresh evidence so later work does not repeat a solved mistake. No credentials, crops, prompts, or provider responses are recorded.

## Provider boundary

| State | Failure or observation | Root cause | Fix / decision | Fresh evidence |
|---|---|---|---|---|
| Fixed | Exa adapter originally used `x-api-key` and a top-level `highlights` flag. | The implementation followed an older request shape. | Use `Authorization: Bearer`, exact teaching-domain `includeDomains`, and `contents: { highlights: true }`; retain response-side allowlisting. | Mock boundary tests pass; live status-only Exa request returned HTTP 200. |
| Fixed | First live end-to-end smoke recognized the pattern, then failed during compilation. | The live path asked OpenAI to generate and self-certify the entire twin; its strict compilation response was also the safety proof. | OpenAI is classifier-only. The engine canonicalizes the classification and a deterministic verified compiler owns the statement, equations, mappings, confidence, and answer-leak boundary. | Live smoke now reaches `complete`; malicious compiler regression is rejected. |
| Fixed | A model-generated `exaQuery` and other signature prose could contain OCR, PII, or prompt injection. | The privacy boundary trusted prompt compliance. | Replace every textual signature field and Exa query with one of six hardcoded canonical patterns before emit, search, or persistence. | Prompt-injection/PII tests prove private strings do not reach events or Exa. |
| Decision | Default Luna recognition latency was unstable: samples were 35.419 s, 1.940 s, and 19.223 s to recognition. | Provider/model latency variance, not local compilation or Exa (completion followed recognition by about 0.4–0.7 s). | Use Terra for recognition by default; keep the environment override. | Terra recognition samples were 1.569 s, 1.144 s, and 1.190 s; median 1.190 s. Full mapped completion samples were 2.031 s, 1.557 s, and 1.575 s; median 1.575 s. |

## Electron runtime

| State | Failure or observation | Root cause | Fix / decision | Fresh evidence |
|---|---|---|---|---|
| Fixed | Electron initially threw `ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX`. | The runtime resolved workspace TypeScript instead of a bundled main process. | Bundle main/preload with esbuild into ignored generated output. | Actual Electron main-process probe passes. |
| Fixed | `better-sqlite3` could load in Node tests but fail in Electron. | Node and Electron use different native ABIs. | Build an ignored Electron-specific binding, pass it explicitly to both local stores, and restore the Node binding after build. | Runtime probe opens both SQLite stores and reports `sqlite_native_load=passed`. |
| Fixed | Generated `dist-electron` output was tracked. | Initial build output was committed before the ignore rule. | Remove generated binaries and ignore `dist-electron/` and the native binding. | Source tree remains clean after build. |
| Pending user acceptance | Computer Use could launch Electron but could not inspect or drive it. PARALLEL also lacked Screen Recording permission. | macOS Accessibility/Screen Recording grants were unavailable in this session. | User explicitly chose to skip Computer Use and perform the final hands-on overlay check. Automated native launch remains mandatory. | No claim of a Computer Use interaction test is made. |

## Product correctness

| State | Failure or observation | Root cause | Fix / decision | Fresh evidence |
|---|---|---|---|---|
| Fixed on branch | Mapping highlighted one rectangle around the whole lasso. | The contract carried anchor names but no original-screen geometry or step links. | Add bounded normalized original-anchor regions, explicit step-to-anchor IDs, projection into display coordinates, and per-step hover highlights. | Contract, projection, and Sidecar pin/hover tests pass on `fix/mapping-regions`. |
| Fixed on branch | Several “worked” Statics twins omitted angles, magnitudes, geometry, or solved numeric results. | Early templates demonstrated structure but were not closed numerical problems. | Fully specify and solve all six templates with units and quantity provenance. | Seed sweep, hand-checked literals, determinism, no-leak, typecheck, and production build pass on `fix/math-templates`. |
| In progress | Electron IPC trusted arbitrary renderer payloads; dismissal did not cancel late generation; `Another` was inert. | Prototype wiring lacked a hardened privileged boundary and lifecycle token. | Isolated TDD hardening is active on `fix/desktop-product`. | Final evidence will be appended after merge. |

## Verification snapshots

- Initial finished prototype: 36/36 automated tests, all workspaces typechecked, build passed, 100-case synthetic preflight passed, privacy counters zero, npm audit zero, native Electron/SQLite probe passed.
- Canonical intelligence branch: 41/41 tests plus typecheck/build/evaluate/privacy passed.
- Numerically closed Statics branch: 44/44 tests plus typecheck/build passed.
- Mapping branch: 39/39 tests plus typecheck/build/evaluate/privacy passed.
- Final merged verification is still required; branch-local totals are not a substitute.
