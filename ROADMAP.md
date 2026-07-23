# NewDay Notebook — Roadmap & Development Guardrails

> **This file is `ROADMAP.md`** — the strategic direction doc for NewDay Notebook.
> It answers "where is this going, and what are we deliberately *not* doing yet."
> It complements the other repo docs, and the three should not be confused:
>
> - `PROJECT_PLAN.md` — what the app is + the version-by-version changelog (*descriptive*).
> - `IMPLEMENTATION_PLAN.md` — the working plan for the currently-open cycle (*tactical*).
> - `ROADMAP.md` — development stages, near-term priorities, risks, and guardrails (*directional*).
>
> Consult this when planning a cycle, so new work stays aligned with the stated
> direction and — especially — the "Areas To Avoid (For Now)" guardrails at the end.

**Last reviewed:** July 23, 2026

---

## Current Development Stage

### Phase 1A — Prototype Expansion
Current active phase.

Characteristics:
- Single-user
- Local-first
- Plain HTML / React prototype
- Rapid prototyping
- Incremental feature additions
- Frequent iterative releases
- Backward compatibility preferred

Primary goals:
- Expand and refine workflow model
- Improve usability and behavioral clarity
- Add features carefully without destabilizing core systems
- Preserve iteration speed

Key principles:
- Avoid premature over-engineering
- Prioritize product/workflow quality over technical sophistication
- Preserve flexibility while the operational model evolves
- Continue using the app personally to expose friction points organically

> **Note (July 2026 — continuity tooling adopted early).** During the v1.8 repo
> setup, lightweight continuity and deployment tooling was put in place ahead of
> its original sequencing: a GitHub repo as the single source of truth, GitHub
> Pages deployment, and PWA install (service worker + web manifest) for a
> dock-installable build. This is deliberately *not* the Phase 2 "production
> architecture" work described below. It adds versioning, backup, and
> installability **without** touching the app's single-file React structure or
> introducing a build framework — so the Phase 1A principle of avoiding premature
> architectural over-engineering still holds. The plumbing was pulled forward
> because it is cheap and protects the work; the heavier structural changes
> (modularization, build tooling, component architecture) remain future.

---

## Future Development Stages

### Phase 1B — Structural Consolidation
Planned intermediate phase before production-oriented development.

Focus areas:
- Extract logical modules/components
- Document state flows
- Identify and formalize core systems
- Reduce hidden workflow complexity
- Begin improving maintainability
- Improve debugging and change safety
- Introduce clearer separation of concerns

Possible technical steps:
- Split large React file into modules
- Introduce folder structure
- Formalize data schemas
- Create recurring system boundaries
- Create explicit task lifecycle/state diagrams
- Improve internal documentation

---

### Phase 2 — Production-Oriented Development
Future phase after workflow model stabilizes.

Possible goals:
- Proper local development environment
- Vite or equivalent setup
- Safer refactoring
- Component architecture
- Mobile responsiveness
- Testing infrastructure
- Long-term maintainability

> **Already adopted early (v1.8, July 2026).** Git/GitHub integration, a
> version-control workflow, and deployment readiness were originally listed here
> as future Phase 2 goals. They are now in place via the repo setup — pulled
> forward as lightweight continuity infrastructure (see the Phase 1A note above).
> The items still listed here are the heavier architectural changes, which should
> continue to wait until the workflow model has stabilized.

Important note:
Production architecture should follow product stabilization, not precede it.

---

# Major Product/System Risks

## Hidden Workflow Complexity Accumulation

Primary long-term risk.

The app already contains:
- recurring systems
- rollover logic
- historical tracking
- multiple task states
- due-date routing
- ongoing task behavior
- backlog/someday/future transitions
- waiting states
- completion history
- priority systems

Risk:
Increasing interactions between systems may create:
- state contradictions
- edge-case instability
- confusing UX behavior
- maintenance difficulty
- feature overlap

Ongoing mitigation strategy:
- Preserve conceptual clarity
- Avoid redundant systems
- Keep task lifecycle understandable
- Regularly reassess workflow simplicity
- Prefer coherent behavior over feature quantity

---

# Areas To Focus On (Near-Term Priorities)

## High-Value Product Directions

### UX Friction Reduction
Reduce the amount of effort required to:
- capture tasks
- organize tasks
- review tasks
- reschedule tasks
- complete recurring workflows

---

### Keyboard-Driven Workflow
Potential future focus:
- keyboard shortcuts
- quick capture
- rapid task movement
- command-style interactions

Goal:
Increase operational speed and reduce interface friction.

---

### Review Systems
Improve:
- backlog review
- overdue review
- recurring review
- weekly review
- stale-task identification
- project visibility

Goal:
Prevent task decay and cognitive overload.

---

### Recurring Task Ergonomics
Continue improving:
- recurring generation logic
- missed/skipped behavior
- recurring visibility
- recurring editing
- recurrence clarity

Recurring systems are becoming a core feature of the app.

---

### Project Visualization
Potential future directions:
- project grouping
- progress visibility
- active/inactive project states
- project review workflows

---

### State Clarity
Users should always understand:
- why a task is where it is
- what state it is in
- what will happen next
- what rules affect it

Important as complexity grows.

---

### Historical Insight
Potential future improvements:
- completion patterns
- recurring adherence
- overdue drift
- task movement history
- behavioral trends

Should support reflection without becoming analytics-heavy.

---

### Mobile Responsiveness
Future high-priority usability improvement.

Current prototype remains desktop-first.

---

### Cognitive Load Reduction
Avoid:
- overwhelming interfaces
- excessive metadata
- unnecessary decisions
- feature overload

Favor:
- progressive disclosure
- simplicity
- operational clarity

---

### Preventing Stale-Task Accumulation
Long-term productivity systems often fail because tasks become:
- invisible
- normalized
- permanently deferred

System design should actively resist this.

---

# Areas To Avoid (For Now)

Avoid introducing prematurely:
- authentication/accounts
- cloud sync
- collaboration
- multi-user systems
- backend infrastructure
- advanced AI integrations
- native mobile apps
- notifications infrastructure

Reason:
These significantly increase complexity before the workflow model is fully stable.

> **Guardrail check when scoping a cycle.** Before committing a feature to an
> `IMPLEMENTATION_PLAN.md`, sanity-check it against this list and the complexity
> risk above: does it fit Phase 1A, does it add hidden cross-system interactions,
> and is it on the avoid list? If it trips a guardrail, park it in
> `PROJECT_PLAN.md` rather than building it now.
