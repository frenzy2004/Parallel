# PARALLEL

PARALLEL is a screenshot-to-structural-twin workspace for 2D Statics. A student
uploads one complete problem, PARALLEL recognizes its underlying pattern, and
returns a different fully worked problem with the same structure. It never
returns the uploaded problem's final answer.

The primary product is the Next.js web app in `apps/web`. The earlier Electron
prototype remains in `apps/desktop` as preserved R&D, but it is not the default
product surface.

## Requirements

- Node.js 22.12 or newer
- pnpm 11.9.0

This repository is pnpm-only. Internal packages use `workspace:*`, the lockfile
is committed, and install scripts are allowlisted only for the four packages
that require them.

## Run the web product

```bash
pnpm install --frozen-lockfile
pnpm dev:web
```

Open `http://localhost:3000`.

The bundled Statics demo works without credentials and is visibly labeled as a
fixed fixture. It is physically separated from live screenshot analysis:

- `POST /api/twins` accepts exactly one live PNG, JPEG, or WebP crop up to
  4 MiB. This leaves multipart headroom under Vercel's 4.5 MB Function payload
  limit. The route returns an honest `503` when live recognition is not
  configured.
- `POST /api/demo` accepts only the named bundled fixture. It rejects uploads
  and cannot impersonate a result for a student's screenshot.

For live recognition, set server-side environment variables from
`apps/web/.env.example`. Never prefix these variables with `NEXT_PUBLIC_`.

```bash
cp apps/web/.env.example apps/web/.env.local
pnpm dev:web
```

`OPENAI_API_KEY` enables image-structure recognition. `EXA_API_KEY` adds
allowlisted teaching-source enrichment; the verified twin can still compile
when Exa is unavailable.

## Verify

```bash
pnpm test
pnpm typecheck
pnpm build
pnpm evaluate
pnpm verify
pnpm audit --audit-level high
```

`pnpm evaluate` runs 100 deterministic known-structure cases across the six
bounded 2D Statics pattern families. Its output is explicitly labeled
`synthetic_preflight_not_live_model_validation`.

`pnpm verify` composes the API boundary, a poisoned Exa request, and local
storage inspection. It checks for answer fields, crop echoes, raw Exa leakage,
and raw storage values. It is a deterministic privacy preflight, not a claim of
live-provider fidelity.

The optional live-provider smoke test receives credentials only from the
process environment and prints no keys, images, prompts, provider responses, or
student content:

```bash
OPENAI_API_KEY=... EXA_API_KEY=... pnpm smoke:live
```

## Product truth and privacy boundaries

- There is no screen recording. A user explicitly chooses, drops, or pastes one
  screenshot.
- The browser previews the image locally. The live route keeps its bytes only
  for the active request, sends them only to OpenAI recognition with
  `store: false`, and clears its references afterward.
- Missing credentials, malformed images, low confidence, unsupported subjects,
  and visible live assessments fail closed. Demo output is never substituted.
- OpenAI classifies into one of six bounded patterns or refuses. A deterministic
  compiler owns the new statement, equations, answer-leak boundary, mapping,
  and structural checks.
- Exa receives only a hardcoded canonical teaching query—not OCR, student text,
  attempt context, or image bytes—and results are filtered through an exact
  domain allowlist.
- Worked steps map to normalized regions on the original image. Hover, focus,
  or pin a step to reveal the corresponding geometry.

## Deploy to Vercel

The linked Vercel project uses `apps/web` as its application root.
The verified production release is available at
`https://web-sandy-seven-10.vercel.app`.

```bash
pnpm dlx vercel@57.0.0 deploy --prod --cwd apps/web
```

Add `OPENAI_API_KEY` and optionally `EXA_API_KEY` as encrypted server-side
Vercel environment variables to enable live analysis. The fixed demo remains
available without either key.

## Workspace map

- `apps/web` — primary Next.js product and live/demo route boundary
- `packages/contracts` — strict Zod product and event contracts
- `packages/statics-patterns` — six deterministic, bounded Statics compilers
- `packages/twin-engine` — OpenAI classifier, Exa enrichment, and safety gates
- `apps/api` — reusable in-process streaming API
- `apps/desktop` — preserved Electron capture and overlay prototype
- `docs/BUILD_LOG.md` — failures, root causes, fixes, and fresh evidence
