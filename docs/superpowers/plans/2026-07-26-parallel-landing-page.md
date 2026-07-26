# PARALLEL Landing Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish a conversion-focused PARALLEL landing page that explains the paid 2D Statics pilot in under two minutes and durably records course-fit reservations.

**Architecture:** A Sites vinext app renders one responsive page and a D1-backed reservation endpoint. Product copy mirrors the approved four-question business contract; the interface includes an interactive lasso-to-twin demonstration without calling model APIs.

**Tech Stack:** Sites starter, React, TypeScript, vinext, Cloudflare D1, Drizzle migrations, Vitest

## Global Constraints

- The public offer is for 20 macOS students in one first-year 2D Statics section.
- Founding pilot reservations require the student to confirm they are 18 or older.
- Founding price is $10 for the first month, credited toward a $39 semester.
- Free usage is 10 lifetime twins.
- A paid month includes 100 fresh twins and unlimited reopening of saved precedents.
- The original answer is never shown.
- Primary copy is “Don’t ask for the answer. Ask for its twin.”
- Primary CTA records a reservation; it must not imply payment was taken.
- Reservation data is durable D1 state, not browser storage.
- Do not market exams, undetectability, homework completion, or broad all-subject support.
- Final deployment uses Sites and defaults to private access when available.

---

### Task 1: Initialize the Sites app and reservation schema

**Files:**
- Create: `site/` via `scripts/init-site.sh`
- Modify: `site/.openai/hosting.json`
- Create: `site/db/schema.ts`
- Create: `site/drizzle/0000_parallel_reservations.sql`
- Create: `site/lib/db.ts`
- Create: `site/app/api/reservations/route.ts`
- Test: `site/app/api/reservations/route.test.ts`

**Interfaces:**
- Consumes: `ReservationInput { email, school, courseCode, device, priceConsent }`.
- Produces: `POST /api/reservations` returning `{ ok, reservationId, cohortStatus }`.

- [ ] **Step 1: Run the Sites initializer exactly once**

Run: `bash /Users/muthuramanpalaniappan/.codex/plugins/cache/openai-bundled/sites/0.1.31/scripts/init-site.sh "$PWD/site"`

Expected: starter install completes and `site/.openai/hosting.json` exists.

- [ ] **Step 2: Write red endpoint tests**

```ts
expect((await post({ email: "bad", device: "Mac", priceConsent: true })).status).toBe(422);
expect((await post(validReservation)).status).toBe(201);
```

- [ ] **Step 3: Run the focused test and confirm red**

Run: `npm test -- app/api/reservations/route.test.ts` from `site/`

Expected: FAIL because the route is absent.

- [ ] **Step 4: Add D1 schema and prepared queries**

Create one reservation table with unique normalized email, course metadata, explicit price consent, 18-or-older confirmation, referral code, timestamp, and status. Configure logical D1 binding `DB`; generate and inspect `0000_parallel_reservations.sql`; execute one SQL statement per prepared call.

- [ ] **Step 5: Run tests and commit**

Run: `npm test -- app/api/reservations/route.test.ts`

```bash
git add site
git commit -m "feat: persist founding pilot reservations"
```

### Task 2: Build the product-specific page and demo

**Files:**
- Modify: `site/app/page.tsx`
- Modify: `site/app/globals.css`
- Modify: `site/app/layout.tsx`
- Create: `site/app/components/TwinDemo.tsx`
- Create: `site/app/components/ReservationForm.tsx`
- Test: `site/app/page.test.tsx`

**Interfaces:**
- Consumes: static `DemoStep[]` and the reservation endpoint.
- Produces: accessible hero, live interaction demo, differentiation, exact offer, four-answer clarity section, evidence, FAQ, and reservation form.

- [ ] **Step 1: Write red copy and interaction tests**

Assert the page names the exact user, shows `$10` and `$39`, states the no-answer contract, and moves the demo from `lasso` to `mapped twin` when activated.

- [ ] **Step 2: Run the page test and confirm red**

Run: `npm test -- app/page.test.tsx` from `site/`

Expected: FAIL against the starter skeleton.

- [ ] **Step 3: Replace the starter in one complete product patch**

Use Braun-inspired warm white, charcoal, safety orange, strict grid, restrained motion, and concrete Statics diagrams rendered with CSS/HTML. Remove `_sites-preview`, temporary metadata, and unused skeleton dependencies.

- [ ] **Step 4: Run tests and build**

Run: `npm test && npm run build` from `site/`

Expected: PASS with the finished page metadata.

- [ ] **Step 5: Commit**

```bash
git add site
git commit -m "feat: explain and demonstrate PARALLEL"
```

### Task 3: Conversion telemetry, accessibility, and social preview

**Files:**
- Create: `site/lib/events.ts`
- Create: `site/app/api/events/route.ts`
- Create: `site/public/og.png`
- Modify: `site/app/layout.tsx`
- Test: `site/app/api/events/route.test.ts`

**Interfaces:**
- Consumes: `hero_demo_started`, `form_started`, `reservation_submitted`, and `referral_opened`.
- Produces: anonymous funnel rows in D1 and host-derived Open Graph metadata.

- [ ] **Step 1: Write red event validation tests**

Reject unknown event names, arbitrary payload keys, and identifiers longer than 128 characters; accept only the four declared events.

- [ ] **Step 2: Run the event test and confirm red**

Run: `npm test -- app/api/events/route.test.ts` from `site/`

Expected: FAIL because event validation is absent.

- [ ] **Step 3: Implement bounded event capture and one bespoke social card**

Store event name, anonymous session ID, referral code, and timestamp only. Generate one 1200×630 PARALLEL card after copy is frozen, inspect its text, and wire absolute host-derived metadata.

- [ ] **Step 4: Run accessibility and production validation**

Run: `npm test && npm run build` from `site/`

Expected: PASS; every input has a label, focus states are visible, and reduced-motion users receive no looping animation.

- [ ] **Step 5: Commit**

```bash
git add site
git commit -m "feat: instrument the PARALLEL validation funnel"
```

### Task 4: Package, save, and deploy the validated site

**Files:**
- Modify: `site/.openai/hosting.json` with the exact Sites `project_id`
- Create: `work/site/parallel-site.tar.gz`

**Interfaces:**
- Consumes: successful `npm run build`, Sites source credential, current branch HEAD.
- Produces: one saved Sites version and one production deployment URL.

- [ ] **Step 1: Re-run the deployment build**

Run: `npm run build` from `site/`

Expected: PASS and `dist/server/index.js` exists.

- [ ] **Step 2: Create or reuse the Sites project**

Read `site/.openai/hosting.json`; call `create_site` once only when `project_id` is absent, then persist the returned opaque ID unchanged.

- [ ] **Step 3: Push and package the exact source**

Push current HEAD with the short-lived credential and run `/Users/muthuramanpalaniappan/.codex/plugins/cache/openai-bundled/sites/0.1.31/scripts/package-site.sh site work/site/parallel-site.tar.gz`.

- [ ] **Step 4: Save and deploy**

Save one version using the pushed HEAD SHA and archive, deploy that saved version privately when available, and poll status until `succeeded` or `failed`.

- [ ] **Step 5: Record deployment provenance**

Run: `git status --short`

Expected: only the intended persisted hosting metadata differs; commit it with `git commit -m "chore: record PARALLEL site project"`.
