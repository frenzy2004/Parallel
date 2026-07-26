# PARALLEL Financial Model Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create an auditable, formula-driven three-year model that shows whether PARALLEL can reach healthy contribution margins and what pilot evidence must be true before scaling.

**Architecture:** One JavaScript builder uses `@oai/artifact-tool` to create separate Cover, Assumptions, Cohorts, Operating Model, Scenarios, Dashboard, Checks, and Sources sheets. All outputs reference visible blue input cells; scenarios and sensitivities recalculate the same operating logic.

**Tech Stack:** JavaScript ES modules, `@oai/artifact-tool`, Excel formulas and native charts

## Global Constraints

- Final workbook path is `outputs/parallel-financial-model.xlsx`.
- Builder and QA files live under `work/financial-model/`.
- Monthly price is $9; semester price is $39; founding month is $10.
- Base fresh-twin cost is $0.04 with a visible $0.03–$0.05 input range.
- Base fresh twins per monthly user is 80.
- Paid capacity is 100 fresh twins per rolling month, with precedent reopens excluded.
- Base fundraising input is a $250,000 SAFE funding nine months of proof work.
- Mature target is under $0.025 blended interaction cost and at least 70% contribution margin.
- All derived values are formulas; calculation areas contain no magic numbers.
- Inputs use blue text, formulas black, and cross-sheet links green.
- Every researched assumption has a full source URL in Sources and a cell comment.
- Every sheet is rendered and visually inspected before export.

---

### Task 1: Workbook shell, assumptions, and source ledger

**Files:**
- Create: `work/financial-model/build-model.mjs`
- Create: `work/financial-model/test-model.mjs`
- Create: `work/financial-model/source-notes.txt`
- Create: `work/financial-model/qa/`

**Interfaces:**
- Consumes: approved pricing, Exa pricing, current OpenAI pricing, and pilot thresholds.
- Produces: workbook sheets, named input blocks, and `outputs/parallel-financial-model.xlsx`.

- [ ] **Step 1: Write the failing structural test**

```js
assert.deepEqual(sheetNames, ["Cover","Assumptions","Cohorts","Operating Model","Scenarios","Dashboard","Checks","Sources"]);
assert.equal(assumptions.getRange("B8").values[0][0], 0.04);
```

- [ ] **Step 2: Run the test and confirm red**

Run: bundled Node `work/financial-model/test-model.mjs`

Expected: FAIL because the workbook has not been built.

- [ ] **Step 3: Implement the shell and input taxonomy**

Add Base/Downside/Upside selectors; pricing, mix, activation, retention, referrals, usage, variable cost, payment fees, support, hiring, infrastructure, and fundraising inputs; include finance color legend and conventions.

- [ ] **Step 4: Export and run the structural test**

Run: bundled Node `work/financial-model/build-model.mjs && work/financial-model/test-model.mjs`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add work/financial-model outputs/parallel-financial-model.xlsx
git commit -m "feat: establish PARALLEL model assumptions"
```

### Task 2: Cohort engine, operating model, and runway

**Files:**
- Modify: `work/financial-model/build-model.mjs`
- Modify: `work/financial-model/test-model.mjs`

**Interfaces:**
- Consumes: Assumptions sheet scenario-selected inputs.
- Produces: 36 monthly cohorts, subscriber/revenue bridge, COGS, contribution, opex, cash flow, and runway.

- [ ] **Step 1: Add red reconciliation assertions**

Assert month-one ending paid users equals opening paid plus activated users minus churn; revenue equals monthly subscriptions plus allocated semester receipts; ending cash equals beginning cash plus net cash flow.

- [ ] **Step 2: Run and confirm red**

Run: bundled Node `work/financial-model/test-model.mjs`

Expected: FAIL because operating formulas are absent.

- [ ] **Step 3: Add copy-across formulas**

Model monthly and semester cohorts separately, seasonal acquisition, retained precedents reducing fresh-twin share, OpenAI/Exa costs, payment fees, support, salaries, marketing, hosting, and financing. Guard every division and return formula.

- [ ] **Step 4: Rebuild and reconcile**

Run: bundled Node `work/financial-model/build-model.mjs && work/financial-model/test-model.mjs`

Expected: PASS for 36 periods and all bridges.

- [ ] **Step 5: Commit**

```bash
git add work/financial-model outputs/parallel-financial-model.xlsx
git commit -m "feat: model PARALLEL cohorts and runway"
```

### Task 3: Scenarios, sensitivities, dashboard, and decision gates

**Files:**
- Modify: `work/financial-model/build-model.mjs`
- Modify: `work/financial-model/test-model.mjs`

**Interfaces:**
- Consumes: operating outputs and explicit scenario drivers.
- Produces: downside/base/upside summaries, formula-backed sensitivity grid, KPI cards, two native charts, and pilot verdict.

- [ ] **Step 1: Add red decision-gate tests**

Require visible gates for `5/20 pay`, `95% structural fidelity`, `60% unassisted completion`, `≤7 sec latency`, and `≤3% confidently wrong`; assert the verdict is `GO`, `ITERATE`, or `KILL`.

- [ ] **Step 2: Run and confirm red**

Run: bundled Node `work/financial-model/test-model.mjs`

Expected: FAIL because Dashboard and Checks outputs are empty.

- [ ] **Step 3: Implement outputs and sensitivities**

Create a formula-backed price-versus-interaction-cost margin grid, a paid-users-versus-retention ARR grid, a 36-month paid-user/revenue chart, a contribution-margin chart, and the pilot verdict formula.

- [ ] **Step 4: Rebuild and inspect key ranges**

Run the builder, inspect `Dashboard!A1:N32`, `Scenarios!A1:N30`, and `Checks!A1:G20`, then run tests.

Expected: all scenarios recalculate and checks show `OK`.

- [ ] **Step 5: Commit**

```bash
git add work/financial-model outputs/parallel-financial-model.xlsx
git commit -m "feat: add PARALLEL scenarios and decision dashboard"
```

### Task 4: Financial audit and visual verification

**Files:**
- Modify: `work/financial-model/build-model.mjs`
- Create: `work/financial-model/qa/audit.txt`
- Create: `work/financial-model/qa/*.png`
- Modify: `outputs/parallel-financial-model.xlsx`

**Interfaces:**
- Consumes: completed workbook.
- Produces: final audited workbook with zero formula errors and legible rendered sheets.

- [ ] **Step 1: Run formula and trace checks**

Inspect for `#REF!|#DIV/0!|#VALUE!|#NAME?|#N/A`; trace representative revenue, contribution margin, runway, and model-status cells to input sources.

- [ ] **Step 2: Render every sheet**

Render each sheet’s used range at scale 1.5 to `work/financial-model/qa/`.

- [ ] **Step 3: Inspect all renders and repair defects**

Fix clipped labels, unreadable source notes, blank charts, misformatted percentages/currency, excessive widths, or failed checks in the single builder.

- [ ] **Step 4: Rebuild, re-render, and run the final audit**

Run: bundled Node `work/financial-model/build-model.mjs && work/financial-model/test-model.mjs`

Expected: zero formula errors, eight renders, model status `OK`, and final workbook present.

- [ ] **Step 5: Commit**

```bash
git add work/financial-model outputs/parallel-financial-model.xlsx
git commit -m "chore: audit PARALLEL financial model"
```
