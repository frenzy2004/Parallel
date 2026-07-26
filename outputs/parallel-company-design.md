# PARALLEL Sidecar Twin — Product and Validation Design

**Date:** 2026-07-26  
**Status:** Ready for founder review  
**Working name:** PARALLEL is a codename. A trademark/domain check is required before public launch.

## 1. Executive decision

Proceed, but do not pretend the company is validated yet.

The investable hypothesis is:

> When a student is stuck, a solved problem with the same hidden structure—but different surface details—can unstick them without replacing the thinking they need to do.

The product is a macOS Electron overlay. The student presses `Option + Space`, lassos an on-screen problem, and receives a **worked structural twin** in a sidecar beside the original. Hovering a twin step highlights the corresponding part of the original. The original answer is never shown.

The long-term vision is universal across quantitative problems, code, prose, charts, and diagrams. The first intelligence pack supports only **2D engineering statics** for one course section. The shell is horizontal; the initial intelligence is deliberately vertical.

The company should be advanced only through a paid, falsifiable 20-student pilot. A waitlist is not validation.

## 2. Why this deserves a test

### The observed bottleneck

Engineering students repeatedly describe the same sequence:

1. Lecture and textbook examples are simpler than the assigned problem.
2. The student searches for a similar worked example.
3. Generic AI either gives away the answer, uses a method or notation their course does not teach, or hallucinates.
4. Correcting the AI takes longer than learning from it.
5. A TA or professor is unavailable when the student is working.

In a recent engineering-student discussion, students explicitly said they prefer examples, want help only with the part they are looking at, worry about dependence on AI, and care whether the process matches their course. Others noted that correcting unreliable AI is itself time-consuming and that human help is unavailable late at night. This maps unusually closely to PARALLEL’s proposed interaction.

Analogical transfer is not a made-up learning theory. Research using isomorphic physics problem pairs shows both the value and difficulty of transferring a solution structure from one problem to another. PARALLEL turns that transfer step into the product.

### Existing willingness to spend

The exact product is unvalidated, but the surrounding spend is real:

- Wolfram|Alpha charges students roughly **$5–$12 per month**, depending on billing and plan.
- HeyClicky charges **$20 per month**, with a student discount reducing Pro to roughly $10 after the first month.
- Human engineering tutoring commonly begins around **$20 per hour**.

This supports a **$9 monthly / $39 semester** price hypothesis. It does not prove students will choose an analogy instead of a direct answer; the pilot must prove that.

### Hard investment view

At this stage, this is a **go for a paid experiment**, not a go for scale. The most dangerous assumption is behavioral rather than technical:

> Under real deadline pressure, will students voluntarily choose a twin over an answer?

If not, stop.

## 3. Target user and launch wedge

### First cohort

- 20 students
- One first-year civil or mechanical engineering course section
- Currently studying 2D Statics
- macOS laptops
- Problems accessed through Canvas, a browser, or PDFs
- One TA or instructor willing to review outputs

### Why 2D Statics

- Diagram, sign, force, and moment conventions make generic solvers visibly unreliable.
- Problems contain repeatable structural families despite varied surface stories.
- A single TA can adjudicate technical and course-method correctness.
- Students work across PDFs, LMS pages, lecture notes, and homework sites, making an overlay more natural than a single-site tutor.
- It is less crowded than introductory coding, where Copilot, IDE assistants, and debugger-specific tools already own the surface.

### Expansion ladder

1. 2D Statics
2. Dynamics and circuit analysis
3. Calculus and introductory physics
4. Introductory programming errors
5. Dense technical prose
6. Charts and diagrams outside STEM

Expansion is earned only after structural fidelity, transfer, retention, and payment thresholds are met.

## 4. Product contract

### One-line promise

> Don’t ask for the answer. Ask for its twin.

### Ten-second loop

1. **Invoke:** Press `Option + Space`.
2. **Select:** Drag around the problem, diagram, or latest working.
3. **Recognize:** A small label streams in: “2D rigid-body equilibrium.”
4. **Twin:** A worked problem with different objects and numbers appears beside the selection.
5. **Map:** Hovering any entity or step in the twin highlights its counterpart in the original.
6. **Return:** The student continues solving the original.
7. **Outcome:** `Unlocked` or `Wrong twin` records whether the analogy worked.
8. **Dismiss:** `Esc` removes the overlay without changing the underlying app.

### Non-negotiable rules

- The twin is fully worked; the original is not.
- No empty chat box.
- No voice requirement.
- No proactive screen monitoring.
- No answer-first action.
- No generated prose wall.
- No unsupported “best guess.” Low confidence causes a recapture request.
- The renderer owns layout and controls; the model returns structured data only.

## 5. Sidecar interaction design

### Placement

The sidecar anchors beside the lasso, choosing the nearest open side that does not cover the selected object. If neither side fits, it appears directly below. Default width is approximately 380 pixels with a maximum width of 45% of the active display.

### Progressive states

1. `Reading selection…`
2. `Recognized: moment equilibrium`
3. Twin problem statement
4. Worked steps, streamed one at a time
5. Correspondence map
6. Source shelf and confidence state

### Result anatomy

- **Pattern label:** the invariant or problem family
- **Twin statement:** different surface, comparable difficulty
- **Worked steps:** complete for the twin only
- **Mapping edges:** twin entity/step ↔ original region
- **Course convention:** notation, sign convention, or permitted method
- **Sources:** collapsed by default
- **Actions:** `Map`, `Another twin`, `Unlocked`, `Wrong twin`

### Keyboard behavior

- `M`: toggle mapping highlights
- `N`: request another twin
- `U`: mark unlocked
- `X`: mark wrong twin
- `Esc`: dismiss

### Failure states

- **Incomplete selection:** “The diagram labels are outside the selection. Widen the lasso.”
- **Unsupported type:** “This pilot currently supports 2D Statics.”
- **Low confidence:** do not generate; ask for a larger crop.
- **Exa unavailable:** use the verified course cache and label sources as cached.
- **Model or network failure:** preserve the crop locally until retry or dismissal, then delete it.
- **Unsafe or exam-like context:** refuse answer-like assistance and explain the product boundary.

## 6. Retention: Personal Precedents

Do not add streaks, decks, daily reminders, or a generic dashboard.

Every successful session stores a private abstract precedent:

`structural signature → chosen twin → correspondence map → outcome`

It does not store the screenshot.

When a high-confidence version of that structure appears later, the sidecar can say:

> Same shape as the problem you unlocked Tuesday.

The current problem is then mapped to the student’s own earlier success instead of a generic web example.

This is retrieval triggered by real work, not scheduled recall. It creates:

- a useful personal memory without note-taking;
- lower latency through reuse;
- increasingly tailored analogies;
- a proprietary outcome dataset showing which analogies actually unlock which structures.

False matches are particularly damaging. The precedent hint appears only above a high confidence threshold and always provides `Not the same` feedback.

## 7. Intelligence architecture

### Architectural principle

PARALLEL is not a screenshot prompt wrapper. It is a domain-pluggable twin compiler:

`capture → typed structure → evidence → verified twin → mapping → deterministic render`

### Desktop client

**Electron + React + TypeScript**

- Main process: global shortcut, screen-capture permission, display geometry, overlay window placement
- Preload bridge: narrow typed IPC surface
- Renderer: lasso, sidecar, correspondence highlighting, progressive states
- Local database: SQLite for Personal Precedents and anonymous outcome events
- No API keys in the renderer

### API service

**Node.js + TypeScript**

- Holds OpenAI and Exa credentials
- Streams server-sent events
- Applies rate limits and request budgets
- Stores the verified pattern registry and course pack
- Does not persist screenshot bytes

Proposed endpoints:

- `POST /v1/twins` — image crop plus minimal context; SSE response
- `POST /v1/outcomes` — unlocked, wrong twin, another twin, dismissal
- `POST /v1/precedents/match` — abstract signature only
- `GET /v1/course-pack/:id` — versioned notation and method rules

### OpenAI responsibilities

Use the Responses API with image input, streaming, and strict structured outputs.

**Pass 1 — structural parser**

- Classify supported/unsupported content
- Extract entities, relationships, constraints, goal, and invariant
- Identify missing crop context
- Produce a privacy-safe Exa query
- Match one validated pattern ID

**Pass 2 — twin compiler**

- Instantiate a different surface scenario
- Apply the course’s notation and method rules
- Produce worked twin steps
- Emit original ↔ twin correspondence anchors
- Detect answer leakage
- Return a confidence score and rejection reason

Initial model benchmark:

- Fast recognition: `gpt-5.6-luna`
- Compilation and review: `gpt-5.6-terra`

These are starting candidates, not permanent choices. The implementation plan must benchmark latency, fidelity, and cost against currently accessible models before locking IDs.

### Exa responsibilities

Exa does not receive the screenshot or raw student work.

It receives a privacy-safe conceptual query such as:

> introductory 2D statics worked example, rigid body moment equilibrium, counter-clockwise positive, forces at oblique angles

Use:

- `instant` or `fast` search for interactive latency
- top 3–5 results
- `highlights` rather than full page text
- allowlisted teaching domains where possible
- cached weekly topic packs for the pilot

Exa grounds the concept, convention, and sources. It does not decide the UI and does not copy a source’s worked problem into the twin.

### Validated pattern registry

The first version should not freely invent arbitrary statics structures.

Create six to twelve expert-reviewed pattern templates, such as:

- concurrent-force particle equilibrium
- resultant of coplanar forces
- moment about a point
- 2D rigid-body equilibrium
- couple moments
- equivalent distributed loads
- two-force members
- introductory method-of-joints trusses

OpenAI maps the selection to a pattern and adapts its surface. A deterministic template layer controls constraints, allowed degrees of freedom, numeric ranges, and render structure. This sharply reduces false isomorphisms and makes evaluation possible.

### Structured contracts

`StructuralSignature`

- `domain`
- `pattern_id`
- `entities`
- `relationships`
- `constraints`
- `goal`
- `invariant`
- `course_convention`
- `missing_context`
- `confidence`
- `exa_query`

`TwinRender`

- `pattern_id`
- `twin_statement`
- `worked_steps`
- `mapping_edges`
- `source_refs`
- `difficulty_delta`
- `answer_leak`
- `confidence`
- `rejection_reason`

`Precedent`

- `signature_hash`
- `pattern_id`
- `mapping_summary`
- `twin_style`
- `outcome`
- `later_transfer_outcome`
- `created_at`

## 8. Latency contract

- Recognition label: under 1.2 seconds median
- First useful twin content: under 4 seconds median
- Full worked mapping and sources: under 7 seconds median
- Overlay invocation and lasso response: under 100 milliseconds locally

Latency strategy:

- stream every useful state;
- prefetch current course-week sources;
- cache pattern templates and course conventions;
- keep Exa results concise;
- use a fast model for recognition and a stronger model only for compilation;
- reuse confirmed Personal Precedents when possible.

## 9. Privacy, trust, and academic integrity

### Data boundaries

- Capture only the lassoed region.
- Never send the full display.
- Delete crop bytes locally after success, explicit dismissal, or retry expiry.
- Call OpenAI with storage disabled where supported.
- Never send screenshot pixels, page URLs, student names, or raw work to Exa.
- Store abstract precedents locally by default.
- Do not claim zero retention unless the configured vendor account and contract support it.

### Trust

- Every twin has a confidence state.
- Low confidence fails closed.
- Source shelf is available but visually secondary.
- Expert-audited pattern templates precede unrestricted generation.
- Confidently wrong output is a headline metric, not an edge-case metric.

### Academic integrity

- The original final answer is never returned, stored as a product field, or shown to the student.
- The product is positioned for ungraded practice and homework learning.
- It should not market “undetectable,” “exam,” or “do your homework.”
- Pilot usage should be disclosed to the cooperating instructor or TA.

## 10. What is explicitly out of scope

- General AI chat
- Original problem solutions
- Lecture transcription
- Summaries and flashcards
- Essay writing
- LMS planner
- Voice character or mascot
- Professor analytics dashboard
- Social feed
- Windows, mobile, or Chromebook clients
- Proactive screen scanning
- Automatic edits to student work
- Broad all-subject marketing

## 11. Purchase validation

### Pilot offer

- 20 seats
- 2D Statics only
- Founding price: **$10 for the first month**, credited toward a **$39 semester** plan
- Clear refund promise if the product cannot support the student’s course problems
- No free semester; free usage is limited to 10 lifetime twins

The purpose of the charge is evidence, not revenue.

### Experiment design

Use real, ungraded practice problems. Randomize stuck moments among:

1. PARALLEL structural twin
2. Conventional non-answer hint
3. No assistance

Measure whether the student completes the original correctly without requesting its answer.

### Internal quality gate before pilot

- 100 gold-standard statics problems
- At least 95% expert-rated structural fidelity
- Fewer than 2% confidently wrong twins
- 100% schema-valid render objects
- No original-answer leakage in the gold set

### Week-one pass criteria

- At least 15 of 20 activate
- At least 10 use it on three separate days
- At least 75 real invocations
- At least 90% TA-rated correct and course-compatible
- Fewer than 5% confidently wrong
- Median full mapping under 7 seconds

### Week-four pass criteria

- At least 12 of 20 remain weekly active
- At least 8 use it on three or more days per week
- At least 60% of genuine stuck sessions end in a correct original solution without answer help
- At least 30% reduction in median time-to-unstuck from the first-week baseline
- At least 8 would be very disappointed to lose it
- At least 5 pay; ideally 3 prepay the semester
- At least 4 organic classmate invitations
- At least 95% TA-rated structural correctness
- Confidently wrong twins at or below 3%

### Kill conditions

Stop or radically change direction if:

- students admire the demo but choose direct-answer tools under real pressure;
- fewer than 8 users return after day three;
- fewer than 5 of 20 pay;
- the twin does not outperform a conventional hint;
- structural correctness cannot exceed 95% in the narrow domain;
- median perceived wait remains above 7 seconds;
- usage occurs only during one deadline-night burst.

## 12. Pricing and unit economics hypothesis

Initial pricing:

- Free: 10 lifetime twins
- Student monthly: $9
- Student semester: $39

Working variable-cost assumption per fresh twin:

- OpenAI parsing, compilation, and review: approximately $0.02–$0.04
- Exa search: approximately $0.007
- Total target: **$0.03–$0.05 per fresh twin**
- Reused verified precedents should be materially cheaper

At 80 fresh twins per month and $0.04 variable cost:

- Revenue: $9.00
- AI/search cost: $3.20
- Payment and infrastructure allowance: approximately $0.80
- Contribution before support: approximately $5.00
- Contribution margin: approximately 56%

That margin is acceptable for a pilot, not for a mature consumer product. Mature targets are:

- under $0.025 blended cost per interaction;
- 70%+ contribution margin;
- increased precedent reuse and source caching.

Bottom-up milestones:

- 100 paying students ≈ $900 MRR
- 1,112 monthly subscribers ≈ $10,000 MRR
- 32 course sections × 40 paid students × $78 annualized semester revenue ≈ $100,000 ARR

The financial model should optimize around measured invocation frequency, not assumed unlimited usage.

## 13. Go-to-market design

### First 20 users

Do not begin with broad paid ads.

1. Recruit one TA or professor as a quality partner.
2. Recruit from one course Discord, GroupMe, engineering club, or in-person tutorial section.
3. Demonstrate one real problem from that week’s material.
4. Offer the 20-seat paid founding pilot.
5. Sit with the first five users and observe real stuck moments.

### Message

Primary:

> Don’t let AI do your statics homework. Give yourself a solved twin.

Secondary:

> Box the problem. See the same structure with different numbers. Solve yours.

### Apollo’s role

Apollo is not the channel for students. Its useful role begins with a focused list of:

- 2D Statics instructors
- mechanics and civil-engineering teaching faculty
- engineering learning-center directors
- supplemental-instruction coordinators
- engineering education researchers

The first outreach asks for a 20-student research pilot, not an institution-wide software purchase. Do not mass-sequence education buyers before outcome evidence exists.

### Research-tool roles

- **GummySearch:** unavailable for new research because it closed in November 2025 following Reddit API restrictions. Use direct public community research and preserve source links instead of depending on a single platform.
- **Artificial Societies:** useful for stress-testing landing-page messages and objections; not evidence of willingness to pay.
- **Orbit:** useful as directional niche discovery; its niche score cannot replace real student behavior.
- **Apollo:** useful for the faculty/academic-support side of the pilot; exact lead-list work requires an authenticated account.

## 14. Falsifiable build sequence

### Phase 0 — Concierge proof

- Thin Electron lasso and sidecar
- Six validated statics patterns
- Human-reviewed twin library
- Manual course pack
- Full event instrumentation
- Five observed study sessions

Goal: prove students choose the strange behavior before automating it.

### Phase 1 — Automated twin compiler

- OpenAI image parsing and strict structured output
- Exa grounding and source shelf
- Deterministic pattern templates
- Streaming sidecar
- TA review queue

### Phase 2 — Personal Precedents

- Local pattern store
- High-confidence precedent matching
- “Same shape as Tuesday” retrieval
- Later-transfer outcome measurement

### Phase 3 — Paid cohort

- 20-seat pilot
- Real payment
- Randomized comparison with a conventional hint
- Week-one and week-four decision gates

No broad launch occurs before Phase 3 passes.

## 15. Key risks and mitigations

| Risk | Mitigation |
|---|---|
| Students prefer direct answers | Paid real-work experiment with direct-answer tools still available |
| False structural match teaches the wrong concept | Narrow domain, validated pattern registry, fail-closed confidence, TA audits |
| “Anything on screen” creates mediocre quality | Universal shell but only one supported intelligence pack |
| Slow two-pass pipeline | Progressive streaming, source prefetch, fast parser, cached precedents |
| Easy overlay cloning | Outcome-labeled pattern graph and course-method memory become the moat |
| Privacy permission distrust | Hotkey-only capture, crop-only upload, no raw precedent storage |
| Copyrighted worked examples | Retrieve concepts and excerpts, generate new surfaces, reject close copying |
| Semester seasonality | Expand to adjacent courses only after proof; precedents persist across courses |
| Poor consumer margins | Cache, template instantiation, small structured outputs, explicit usage limits |

## 16. Final product thesis

HeyClicky validated that screen-aware invocation can feel magical. PARALLEL should not compete on the hotkey.

Its company-defining asset is:

> A graph of reasoning structures, the analogies that teach them, and evidence that a particular learner successfully transferred from one to the other.

The hotkey is the doorway. Personal Precedents are the retention. The outcome graph is the moat.

## Sources

- [Engineering students discussing bounded AI help and dependence](https://www.reddit.com/r/EngineeringStudents/comments/1ss7m2n/how_do_you_use_ai_for_studying_without_making/)
- [Engineering textbook examples versus harder assignments](https://www.reddit.com/r/EngineeringStudents/comments/1jcyjuu/how_do_you_read_engineering_textbook_and_solve_questions/)
- [Research on transfer using isomorphic physics problem pairs](https://arxiv.org/abs/1602.05710)
- [Exa Search API](https://exa.ai/docs/reference/search-api-guide)
- [Exa contents and highlights](https://exa.ai/docs/reference/contents-api-guide)
- [Exa API pricing](https://exa.ai/pricing?tab=api)
- [OpenAI current model catalog](https://developers.openai.com/api/docs/models)
- [OpenAI GPT-5.4 mini capabilities and pricing](https://developers.openai.com/api/docs/models/gpt-5.4-mini)
- [Wolfram|Alpha student pricing](https://www.wolframalpha.com/pro/pricing/students/)
- [HeyClicky pricing and student discount](https://www.heyclicky.com/)
- [GummySearch closure](https://gummysearch.com/closing-time/)
- [Artificial Societies documentation](https://docs.societies.io/)
- [Apollo education buyer segment](https://www.apollo.io/leads/educational-tech)
