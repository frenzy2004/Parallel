# PARALLEL GTM Pilot Package Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce a field-ready package for recruiting, charging, onboarding, observing, and deciding the fate of a 20-student 2D Statics pilot.

**Architecture:** Plain-text source files define the offer and scripts; a Node validation script enforces every required message, threshold, and scorecard column. Final founder-facing Markdown and CSV files live in `outputs/`.

**Tech Stack:** Markdown, CSV, JavaScript ES modules, Node.js assertions

## Global Constraints

- First cohort is exactly 20 macOS students from one first-year 2D Statics section.
- Founding pilot participants are 18 or older.
- One TA or instructor is the quality partner.
- Charge $10 for month one, credited toward $39 for the semester.
- Free usage is limited to 10 lifetime twins.
- Paid access includes 100 fresh twins per rolling month and unlimited reopening of saved precedents.
- Outreach promises a solved twin and correspondence mapping, never the original answer.
- Discovery starts with one TA, one course community, one live weekly problem, and five observed study sessions.
- Apollo is used only for faculty and academic-support contacts after direct local outreach.
- Pass requires at least 5/20 pay, 95% structural fidelity, 60% correct original completion without answer help, and full mapping under 7 seconds.
- Kill language must be explicit and operational.

---

### Task 1: Offer, ICP, and two-minute business test

**Files:**
- Create: `work/gtm/build-package.mjs`
- Create: `work/gtm/test-package.mjs`
- Create: `work/gtm/offer.txt`
- Create: `outputs/parallel-gtm-field-kit.md`

**Interfaces:**
- Consumes: approved product/business design.
- Produces: founder field kit sections `Who`, `Why us`, `Paid deliverable`, `Discover/buy/receive`, offer, exclusions, and refund policy.

- [ ] **Step 1: Write the failing package assertions**

```js
for (const phrase of ["first-year 2D Statics","$10","$39","20 seats","original answer is never shown"]) {
  assert.match(fieldKit, new RegExp(escape(phrase), "i"));
}
```

- [ ] **Step 2: Run and confirm red**

Run: `node work/gtm/test-package.mjs`

Expected: FAIL because outputs do not exist.

- [ ] **Step 3: Implement the field-kit generator**

Write concise copy a founder can read before each interview, including exact fit/disqualification criteria and the paid outcome the student receives.

- [ ] **Step 4: Generate, test, and commit**

```bash
node work/gtm/build-package.mjs
node work/gtm/test-package.mjs
git add work/gtm outputs/parallel-gtm-field-kit.md
git commit -m "feat: define the PARALLEL founding offer"
```

### Task 2: Outreach, demo, payment, and onboarding scripts

**Files:**
- Create: `work/gtm/scripts.txt`
- Create: `outputs/parallel-outreach-scripts.md`
- Modify: `work/gtm/build-package.mjs`
- Modify: `work/gtm/test-package.mjs`

**Interfaces:**
- Consumes: exact cohort and offer.
- Produces: TA ask, student post, direct message, 90-second demo, price ask, objection handling, refund, onboarding, day-three nudge, and referral scripts.

- [ ] **Step 1: Add red script-presence tests**

Require all ten scripts plus explicit responses to “Why not ChatGPT?”, “Will it do my homework?”, “Why Mac only?”, and “Why pay for a beta?”. The price script sends a manual Stripe payment link only after course-fit confirmation.

- [ ] **Step 2: Run and confirm red**

Run: `node work/gtm/test-package.mjs`

Expected: FAIL because the script set is incomplete.

- [ ] **Step 3: Write natural channel-specific scripts**

Keep the course-community post under 120 words, the TA email under 180 words, the DM under 60 words, and the demo narration under 90 seconds.

- [ ] **Step 4: Generate, test, and commit**

```bash
node work/gtm/build-package.mjs
node work/gtm/test-package.mjs
git add work/gtm outputs/parallel-outreach-scripts.md
git commit -m "feat: add PARALLEL pilot scripts"
```

### Task 3: Pilot scorecard and research protocol

**Files:**
- Create: `outputs/parallel-pilot-scorecard.csv`
- Create: `outputs/parallel-session-log.csv`
- Create: `outputs/parallel-research-protocol.md`
- Modify: `work/gtm/build-package.mjs`
- Modify: `work/gtm/test-package.mjs`

**Interfaces:**
- Consumes: activation, usage, fidelity, transfer, latency, payment, referral, and disappointment outcomes.
- Produces: one row per participant, one row per stuck session, randomized arm assignment, and week-one/week-four verdict rules.

- [ ] **Step 1: Add red CSV schema tests**

Require participant columns `participant_id,activated,paid_amount,days_used,weekly_active,very_disappointed,referrals`; require session columns `arm,pattern_id,latency_ms,ta_correct,confidently_wrong,original_completed_without_answer,outcome`.

- [ ] **Step 2: Run and confirm red**

Run: `node work/gtm/test-package.mjs`

Expected: FAIL because scorecards are absent.

- [ ] **Step 3: Generate blank but operational instruments**

Include deterministic arm assignment instructions, consent/privacy language, TA audit sampling, facilitator observation prompts, and formulas described for the decision summary.

- [ ] **Step 4: Generate, test, and commit**

```bash
node work/gtm/build-package.mjs
node work/gtm/test-package.mjs
git add work/gtm outputs/parallel-pilot-scorecard.csv outputs/parallel-session-log.csv outputs/parallel-research-protocol.md
git commit -m "feat: operationalize the PARALLEL pilot"
```

### Task 4: Four-week calendar and explicit go/kill decision

**Files:**
- Create: `outputs/parallel-4-week-launch-calendar.md`
- Modify: `outputs/parallel-gtm-field-kit.md`
- Modify: `work/gtm/build-package.mjs`
- Modify: `work/gtm/test-package.mjs`

**Interfaces:**
- Consumes: complete pilot package.
- Produces: day-by-day owner/action/output calendar and an unambiguous decision meeting script.

- [ ] **Step 1: Add red calendar and verdict tests**

Require actions for days 0, 1, 3, 7, 14, 21, and 28; require `GO`, `ITERATE`, and `KILL` branches; require the five approved kill conditions.

- [ ] **Step 2: Run and confirm red**

Run: `node work/gtm/test-package.mjs`

Expected: FAIL because calendar and verdict branches are missing.

- [ ] **Step 3: Generate the operating calendar**

Assign founder, TA, and participant responsibilities; include the exact artifact or metric produced at each checkpoint; end on a 30-minute evidence review with no roadmap discussion until verdict.

- [ ] **Step 4: Run final package validation**

Run: `node work/gtm/build-package.mjs && node work/gtm/test-package.mjs`

Expected: PASS with no blank required fields, all price references consistent, and all gates present.

- [ ] **Step 5: Commit**

```bash
git add work/gtm outputs
git commit -m "feat: complete the PARALLEL GTM pilot package"
```
