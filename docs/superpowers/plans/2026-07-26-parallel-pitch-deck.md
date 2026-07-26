# PARALLEL Pitch Deck Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create an investor-facing 11-slide PowerPoint that makes the paid experiment, differentiated behavior, market wedge, economics, risks, and funding ask clear without pretending traction exists.

**Architecture:** A single JavaScript ES module builds a 16:9 editable deck with `@oai/artifact-tool`. The visual language combines Braun-like industrial restraint with PARALLEL’s warm white, graphite, safety orange, and precise correspondence lines; product and financial evidence come from verified local artifacts.

**Tech Stack:** JavaScript ES modules, `@oai/artifact-tool`, native PowerPoint text/shapes/charts, raster product screenshots

## Global Constraints

- Final deck path is `outputs/parallel-pitch-deck.pptx`.
- Builder, source notes, renders, layouts, and montage live under `work/pitch-deck/`.
- Deck contains exactly 11 slides.
- Visible copy is investor-facing; process notes remain off-slide.
- Title is at least 50 pt, slide titles at least 35 pt, subheads at least 24 pt, body at least 16 pt.
- Every external non-trivial claim and asset has a `[Sources]` block in speaker notes.
- The deck states that traction is unvalidated and the current decision is a paid experiment.
- The explicit financing ask is a $250,000 SAFE for nine months of proof work.
- No original-answer feature, all-subject launch claim, or invented customer quote appears.
- Every slide is rendered and inspected individually; unintended overlap is fixed.

---

### Task 1: Lock narrative, evidence, and deck skeleton

**Files:**
- Create: `work/pitch-deck/build-deck.mjs`
- Create: `work/pitch-deck/test-deck.mjs`
- Create: `work/pitch-deck/narrative.txt`
- Create: `work/pitch-deck/source-notes.txt`
- Create: `work/pitch-deck/qa/`

**Interfaces:**
- Consumes: approved product design, landing-page copy, financial workbook, and cited research.
- Produces: 11-slide `Presentation` with stable slide and object names.

- [ ] **Step 1: Write the failing narrative test**

Require exact slide count and these slide jobs: opening tension, user pain, product behavior, why now, wedge, defensibility, experiment, economics, GTM, risks, ask.

- [ ] **Step 2: Run and confirm red**

Run: bundled Node `work/pitch-deck/test-deck.mjs`

Expected: FAIL because the deck is missing.

- [ ] **Step 3: Write the one-sentence communication job and slide titles**

Use: “By the end, seed investors should fund a 20-student paid experiment because PARALLEL tests a defensible learning behavior rather than another answer bot.”

- [ ] **Step 4: Create the presentation skeleton**

Set 1280×720 canvas, shared margins, page markers, fonts, palette, and named text frames for all 11 slides.

- [ ] **Step 5: Export, test, and commit**

```bash
git add work/pitch-deck
git commit -m "feat: structure the PARALLEL investor story"
```

### Task 2: Author product, market, and experiment slides

**Files:**
- Modify: `work/pitch-deck/build-deck.mjs`
- Modify: `work/pitch-deck/test-deck.mjs`
- Create: `work/pitch-deck/assets/product-sidecar.png`

**Interfaces:**
- Consumes: prototype product screenshot and approved metrics.
- Produces: complete slides 1–7 with editable labels and source notes.

- [ ] **Step 1: Add red content assertions**

Assert slides name the exact first user, show `Option+Space → lasso → twin → map → return`, include the four competitors by job, and display the five week-four pass gates.

- [ ] **Step 2: Run and confirm red**

Run: bundled Node `work/pitch-deck/test-deck.mjs`

Expected: FAIL because content is incomplete.

- [ ] **Step 3: Build slides 1–7**

Use one strong composition per slide: title tension, observed bottleneck, product screenshot, behavioral wedge, initial Statics section, Personal Precedents flywheel, and falsifiable pilot. Keep all claims qualified.

- [ ] **Step 4: Export and inspect slides 1–7**

Render each at scale 2 and inspect one-by-one; fix title wrapping, image crop, and correspondence-line placement.

- [ ] **Step 5: Commit**

```bash
git add work/pitch-deck
git commit -m "feat: tell the PARALLEL product and validation story"
```

### Task 3: Author economics, GTM, risk, and ask slides

**Files:**
- Modify: `work/pitch-deck/build-deck.mjs`
- Modify: `work/pitch-deck/test-deck.mjs`

**Interfaces:**
- Consumes: workbook base-case outputs and GTM package.
- Produces: slides 8–11 with editable economics chart, channel sequence, risk/kill table, and explicit use-of-funds ask.

- [ ] **Step 1: Add red evidence assertions**

Require `$10`, `$39`, `$0.03–$0.05`, `5/20 pay`, `95% fidelity`, one-section channel, and a clearly labeled pre-traction ask.

- [ ] **Step 2: Run and confirm red**

Run: bundled Node `work/pitch-deck/test-deck.mjs`

Expected: FAIL because slides 8–11 lack evidence.

- [ ] **Step 3: Build slides 8–11**

Create a formula-sourced unit-economics bridge, a focused TA-to-20-student GTM sequence, a kill-risk matrix, and a $250,000 SAFE ask funding nine months, three course packs, and a 600-paid-student proof milestone.

- [ ] **Step 4: Export and inspect slides 8–11**

Render at scale 2 and verify chart labels, footnotes, sources, and final-slide closure.

- [ ] **Step 5: Commit**

```bash
git add work/pitch-deck
git commit -m "feat: complete PARALLEL economics and ask"
```

### Task 4: Full-deck rendering, overlap QA, and export

**Files:**
- Modify: `work/pitch-deck/build-deck.mjs`
- Create: `work/pitch-deck/qa/slide-*.png`
- Create: `work/pitch-deck/qa/slide-*.layout.json`
- Create: `work/pitch-deck/qa/montage.webp`
- Create: `work/pitch-deck/qa/qa-ledger.txt`
- Create: `outputs/parallel-pitch-deck.pptx`

**Interfaces:**
- Consumes: completed in-memory presentation.
- Produces: final editable PPTX and verified renders.

- [ ] **Step 1: Render every slide and layout**

Run the builder to export 11 PNGs, 11 layout JSON files, one montage, and the PPTX.

- [ ] **Step 2: Run automated checks**

Run: bundled Node `work/pitch-deck/test-deck.mjs` and `slides_test.py outputs/parallel-pitch-deck.pptx`

Expected: 11 slides, zero unresolved source-note blocks, and zero out-of-bounds elements.

- [ ] **Step 3: Inspect every slide at full size**

Review all 11 PNGs individually, using the montage only for pacing; fix unintended overlaps, clipping, weak contrast, repeated silhouettes, and single-line title wraps.

- [ ] **Step 4: Re-export and re-run checks**

Expected: all tests pass and the final deck opens with editable objects.

- [ ] **Step 5: Commit**

```bash
git add work/pitch-deck outputs/parallel-pitch-deck.pptx
git commit -m "chore: verify PARALLEL pitch deck"
```
