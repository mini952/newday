# NewDay Notebook — Implementation Plan: v1.7.3 → v1.9 Cycle

**Status:** Active · Source of truth for the upcoming development sessions
**Author baseline:** v1.7.3 (`DATA_VERSION` 5)
**Last updated:** July 22, 2026

**Progress:** ✅ v1.7.3 shipped. ✅ Test Rig shipped (Part A + Part B). ✅ v1.8 Phase 1 implemented (Skipped/Missed filters + date-range row). ✅ v1.8 Phase 2 implemented (multi-task add staging area) — version/doc bump for all v1.8 phases deferred to the v1.8 Final Phase. ▶ **Next: v1.8 Final Phase — version & documentation bump.**

---

## 0. Scope & Sequencing Overview

This plan covers a run of work spanning one standalone patch, a testing-tool build, one feature release with two phases, and a larger deferred release. Work proceeds one implementation phase per chat session to keep context lean. Each change is applied to the full file triad (`.jsx` source, standalone `.html` build, `.md` documentation), version/documentation bumps are deferred to a dedicated final phase within each release, and design decisions are confirmed before implementation.

**Order of execution:**

1. ~~**v1.7.3** — Standalone bug-fix patch: new-task default date goes stale after New Day.~~ ✅ **Done (July 16, 2026).**
2. ~~**Test Rig** — A dedicated testing build with a fake, adjustable clock.~~ ✅ **Done (July 16, 2026).** Shipped in two phases (Part A: flag + two-build + isolated storage + tools; Part B: fake clock + routing + controls + full seed).
3. ~~**v1.8 Phase 1** — Task Database: Skipped/Missed filter + date-range view filters.~~ ✅ **Done (July 21, 2026).**
4. ~~**v1.8 Phase 2** — Multi-task add (staging area in Daily Notebook).~~ ✅ **Done (July 22, 2026).**
5. **v1.9** — Project Notebook (projects promoted to their own tab). Preceded by a Design Philosophy Questionnaire.

**Deferred to future versions (not scheduled here):**

- Task dependencies (#2) — needs its own design pass; both a lightweight visual-nesting version and a full blocking engine are of interest, so this warrants dedicated scoping.
- Task Database inline editing (#4).
- Recurring completion tracker / heatmap (#6).
- Skip logging off-by-one investigation (#9, root-cause half) — strong working hypothesis is the UTC/`toISOString()` date derivation; the Test Rig will make this trivial to reproduce and prove when revisited.
- Recurring-in-Backlog skip button (#1) — moot; no recurring tasks currently appear in Backlog.
- **Task Database filter-pill sectioning redesign** — group the `DatabaseTab` filter pills into labeled sections (working names: Status / Location / Timeline) instead of one flat row. Needs its own design pass to settle which filter axes *compose* vs. are *mutually exclusive* before building (the current section filter is single-select; the range row added in Phase 1 is a second independent axis). Deliberately kept out of v1.8 Phase 1 — which added Skipped/Missed and the range row to the existing flat single-select row — because sectioning wrong would mean rebuilding the pill row twice. With Skipped + Missed the flat row now wraps to two lines at typical width, which is the concrete motivation for this pass. (Raised and deferred July 21, 2026.)
- GitHub integration (#7) and iOS/Brave launch shortcut (#8) — handled outside these sessions.

---

## 1. v1.7.3 — New-Task Default Date Fix ✅ Shipped July 16, 2026

Standalone patch. The Daily Notebook new-task default now anchors to the notebook date (`currentDay`) and re-anchors reactively after New Day, instead of freezing the real system date at mount — so the first task after a New Day lands in Today, not the previous day. The reactive re-anchor only runs on a pristine form (empty title/description/tags, not ongoing), so a mid-entry due date is never clobbered; the simple pristine rule was chosen over a `dateTouched` flag. Future Notebook (`defaultDueDate=""`) unchanged. No data model change (`DATA_VERSION` 5).

Delivered: `NewDayNotebook_v1_7_3.jsx` / `.html`, docs → `…-v1_7_3.md`, version label and header comments bumped. Full detail in the v1.7.3 changelog.

---

## 2. Test Rig — Dedicated Testing Build ✅ Shipped July 16, 2026

**Shipped in two phases from a single `.jsx` behind the build-time `TEST_MODE` flag; `build.py` emits both the production and `..._TESTRIG.html` builds, verified byte-identical apart from the flag + title. `DATA_VERSION` stays 5.**

*Part A:* `TEST_MODE` flag (authored off), two-build in `build.py` (both Babel stripping rules applied to each), isolated storage key `newday-notebook-TEST`, blue rig banner + tools drawer (seed / reset-island / state inspector).

*Part B — fake clock:*
- **Single clock source `getClockToday()`.** `getTodayStr()` now delegates to it, which auto-routes every "what day is it now?" call site (New Day's `newToday`, the staleness/"N days ago" badge, new-task defaults, and recurring generation's `fromDate` anchors — all flow through `getTodayStr`/`currentDay`). The bulk-move "tomorrow" default was the one remaining raw now-read and is also routed. When `TEST_MODE` is off, `getClockToday()` collapses to the original real-clock read, so production is behaviorally identical.
- **Audit — deliberately NOT routed (leave as-is in future work):** "seven days out" is a `currentDay` projection, not a now-read; every `toISOString()` inside `generateNextDueDates` operates on already-chosen dates via its `fromDate`/`startDate` params. Routing these would break the date math. `nowTimestamp()`, `generateId()`, and `Date.now()` React keys stay on the real clock (audit timestamps are an honest record).
- **Persistence.** The fake date lives in its OWN key `newday-notebook-TEST-clock`, entirely outside the app data blob — production schema and `DATA_VERSION` (5) untouched. A module-level mirror (`__fakeClockDate`) is seeded synchronously at module load, so the fake date is available on the very first render (no real-clock flash). Rig React state/setter are defined unconditionally to keep hook ordering stable across both builds; only rendering is gated.
- **UI.** Controls at the day-name/date location: date input, `+1 day`, one-tap `☀ New Day` (`handleNewDay({})`). Banner clock chip renders **blue when the fake clock is ahead of the notebook date**; the existing amber "N days ago" badge is the "behind" signal and already reflects the fake clock.
- **Full seed.** Fixed reproducible anchor **Monday 2026-03-02**; instances generated exactly as `handleAddTemplate` does. 5 templates (daily lands today; weekly every Friday; biweekly every other Tuesday; monthly on the 15th; quarterly on the 1st), 6 today + 5 future + 2 someday + 2 ongoing, and 3 recurring-archive rows in Backlog (skipped / missed / completed) — giving v1.8 Phase 1's Skipped/Missed filter real data.

**Bearing on the deferred skip off-by-one (#9):** as anticipated, the fake clock now makes that bug trivially reproducible when it's revisited.

**Files:** canonical `NewDayNotebook_v1_7_3.jsx` / `.html` / `_TESTRIG.html` (overwrite project); `build.py` unchanged; app documentation intentionally not bumped (Test Rig is tooling). Descriptive-name archival snapshots kept locally (`…_TestRig-PartB-fakeclock…`).

---

### Original design brief (retained for rationale)

**Approach:** Design session first. Come into the next rig session with a proposed control set; confirm the design; then build. The notes below are the design brief.

### What "test rig as a separate build" means (fork-drift explanation)

The risk with literally maintaining a second, hand-edited copy of the app for testing is **fork drift**: the moment a feature ships to the real app, the separate test copy is out of date, and the two diverge until the test build no longer reflects reality.

The fix is a single source of truth. All testing-only affordances live in the one `.jsx` file, gated behind a build-time flag (working name `TEST_MODE`). Testing code paths are wrapped so they are inert when the flag is off. The Python build script then emits **two** HTML files from that one `.jsx`:

- the clean **production** build (flag off — no testing controls), and
- the **test-rig** build (flag on — testing controls active).

Same code, same behavior, genuinely separate artifact, no divergent fork. This preserves the file-triad workflow: one `.jsx`, and the build step produces the production `.html` plus the test-rig `.html`.

**Build-script note:** going forward, on every finalized feature/version update, the Python build emits both HTML files (production + test-rig) from the single `.jsx`, applying the existing Babel-standalone stripping rules to each. Documentation output is unchanged.

### Isolated storage (how it works, and the export/import workaround)

The rig must never touch real notebook data. Implementation: the storage layer reads/writes a **different `localStorage` key** when `TEST_MODE` is on (e.g. a `_TEST` suffix on the existing key). Because the key is different, the rig operates on a completely separate data island — using the rig can never overwrite the production notebook, and vice versa.

The rig gets a one-click **reset/seed** to clear its island and drop in a known starting state for testing.

Regarding the export/import workaround: it would work (export from production, test, re-import), but it is unnecessary and error-prone once storage keys are separated — the whole point of the separate key is that no manual data shuffling is needed. Export/import remains available as a normal feature; it is just not required to protect production data.

### Single clock (faithful date override)

Today, "today" is derived independently in several places via `getTodayStr()` (New Day, overdue/drift badges, recurring generation). For the override to be faithful, these are centralized to read from one clock source. When `TEST_MODE` is on, that clock returns the fake, adjustable date; everything downstream — New Day, badges, recurring generation, new-task defaults — obeys it. (This centralization is also what will later make the skip off-by-one bug straightforward to reproduce and fix.)

### Date-adjust control (per user request)

Where the Daily Notebook currently shows the day name and date, the rig should place a control — either replacing that element or sitting next to it — to adjust the current date: a button/badge to set or advance the fake "current date." This is the primary rig interaction and should be front-and-center there.

### Proposed control set (to confirm in the design session)

- Set fake date directly / advance by one day, surfaced at the Day-name-and-date location in the Daily Notebook.
- One-tap New Day (to iterate rollover behavior quickly).
- Quick-seed for recurring templates and scheduled/future tasks (the scenarios hardest to set up by hand).
- A state inspector (view the current arrays / template completions).
- Reset/seed the rig's isolated storage.

### Data model

No changes to the production schema. `DATA_VERSION` stays at 5.

---

## 3. v1.8 — Feature Release

### Phase 1 — Task Database: Skipped/Missed Filter + Date-Range Filters (#9, filter half) ✅ Implemented July 21, 2026

Small, self-contained, read-only additions to `DatabaseTab`. Skipped/missed instances already exist in the archive (`recurringStatus: "skipped"|"missed"`) and were already surfacing under the existing **Recurring** pill mixed in with pending instances, so this was largely isolating existing data. (Version label and app documentation intentionally not bumped — deferred to the v1.8 Final Phase per the Phase 5 pattern.)

**Delivered:**

- **Skipped** and **Missed** filter pills added to the existing single-select filter row, placed right after **Recurring** (they are strict subsets of it). Each draws from recurring instances carrying the corresponding `recurringStatus`; the **Recurring** pill continues to show *all* instances (pending, skipped, missed, completed). No status column was added — the active pill supplies the context, so a skipped row still shows its Section badge as "Recurring."
- **Date-range view filter** as a second, independent pill row: All time (default) · 30 days · 60 days · 90 days · Custom. View-only and non-destructive.
  - Anchored on **due date**. Undated rows are excluded whenever any range is active.
  - Fixed 30/60/90 pills are backward-looking windows `[today − N, today]`. **Custom** exposes two inline `<input type="date">` boxes (grouped so they stay side-by-side and wrap together as one unit) and may span arbitrary dates including the future; an empty custom range is inactive (behaves like All time).
  - The window endpoint reads from `getTodayStr()`, so it obeys the fake clock in the rig build.
  - A subtle resolved-window hint (`due <start> – <end>`) renders in the range row when a range is active.
- The **"Skipped sort" line item was dropped**: with no status column there is nothing for it to sort on, and once filtered to Skipped/Missed the existing column-header sorts (due, completed, etc.) already cover the useful cases.

**Design decision — flat row now, sectioning later:** the full reorganization of the filter pills into labeled groups was deliberately deferred to its own future feature (see the Deferred list). The compose-vs-exclusive question underneath sectioning warrants its own pass.

**Data model:** No changes. `DATA_VERSION` stays at 5.

**Test plan:** Skip a recurring instance; confirm it appears under the **Skipped** pill and a missed instance under **Missed**, and neither appears in active Today/Backlog views. Confirm 30/60/90 windows include/exclude correctly against due date (undated and future rows excluded). Confirm Custom with future dates includes forward-dated tasks. Confirm ranges compose with the section pills. (Range logic was spot-checked in isolation: 30-day and 90-day windows, custom span, empty-custom inactivity, and undated exclusion all behaved as specified.)

### Phase 2 — Multi-Task Add (Staging Area) (#5) ✅ Implemented July 22, 2026

Self-contained new UI in the **Daily Notebook only** — enter several tasks, reorder them, and commit as one batch. No data-model change (`DATA_VERSION` 5); version label and app documentation intentionally not bumped — deferred to the v1.8 Final Phase per the Phase 5 pattern.

**Delivered:**

- **Entry.** A compact **⊞ Add several** toggle sits just above the single-add form. Entering multi-add mode replaces the single-add `NewTaskForm` with a **staging panel**: full-metadata input on top, staged list below, footer at the bottom.
- **Staging input.** The panel reuses `NewTaskForm` in a staging configuration via two new backward-compatible props: `submitLabel` (button reads **"Add to list"**) and `alwaysExpanded` (form starts expanded, never collapses on blur, and refocuses the title after each add for fast repeated entry; its secondary button reads **"Clear"** instead of "Cancel"). The single-add form's own behavior is byte-unchanged.
- **Staged rows.** Each is one line: drag handle (`⠿`) · title (truncates first when space is tight) · **read-only tag pills** (project → Eisenhower → life, mirroring Today's badges, shown only when set) · destination chip · **✕** remove. No inline edit — to change a row, remove and re-add it.
- **Destination chip.** Shown only when a row will *not* land in Today — `→ Future` / `→ Someday` / `→ Ongoing` / `→ Backlog`; Today rows stay bare. The label comes from `computeDestination`, a read-only mirror of `addTask`'s routing (kept in sync by hand; both key off `ongoing` + `dueDate`).
- **Reorder.** The staged list uses the existing `useDragReorder(stagedRows, setStagedRows)` — same drop-indicator treatment as `TaskItem`.
- **Commit — "Add all (N) and close".** A single primary action commits every non-blank staged row and exits multi-add mode. Commit **reverse-iterates** the non-blank rows through `addTask`; because `addTask` prepends, reverse iteration lands the staged (listed) order on top of each destination. The blank-title filter is a defensive no-op (`NewTaskForm` already refuses to stage a blank title). **Cancel** discards staged rows and exits.
- **Persistence — Level A.** `multiAddMode` + `stagedRows` are lifted to `TodoApp` so they **survive tab switches** (`NotebookTab` unmounts when another tab is active). Not written to `localStorage` — a reload clears them. No schema touch.

**Design decisions (some revised mid-session from the pre-implementation confirm):**

- **Footer collapsed from three buttons to two.** The confirmed design (Model A) had *Add all (N)* commit-and-stay, plus a separate *Done* (commit-and-exit) and *Cancel*. In testing, *Add all* and *Done* read as redundant: for a single batch you commit once and immediately want to leave, so they did effectively the same thing. Resolved to one **"Add all (N) and close"** (commit + exit) plus **Cancel** (discard + exit) — a clean, non-redundant pair. A second batch is one click on ⊞ to reopen.
- **Staged rows gained read-only tag pills.** The confirmed design was "title only." Revised during testing: the pills are the at-a-glance confirmation that a row is tagged correctly before committing, which is exactly what staging is for. Rendered read-only, consistent with "no inline edit."
- **Cancel styling.** Lighter font, but given the 1px outline (matching the former Done button) so it's easy to find beside the solid primary.

**Files:** canonical `NewDayNotebook_v1_7_3.jsx` / `.html` / `_TESTRIG.html` (overwrite project). `build.py` unchanged. Route: edit `.jsx` → `build.py` (both HTML builds) → esbuild syntax check (0 errors) → prod/test-rig verified byte-identical apart from flag + title. Descriptive-name archival snapshot kept locally (`…_TESTRIG_Phase2…`).

**Test plan (run and passed):** Enter multi-add; stage several today rows (title-only rows show no chip; form stays expanded and refocuses). Reorder by the handle; ✕ removes. "Add all (N) and close" commits in listed order at the top of Today and returns to the single-add form. Chips: future → Future, undated → Someday, ongoing → Ongoing, past → Backlog — each lands in its section, not Today. A mixed batch preserves per-destination listed order. Cancel discards + exits. Level A: staged rows survive a tab switch and clear on reload. Read-only tag pills match Today's badges.

### v1.8 Final Phase — Version & Documentation

- Version label v1.7.3 → v1.8.
- Header comments updated in `.jsx` and both `.html` builds.
- Documentation renamed `…-v1_8.md`, changelog and feature descriptions updated.
- `DATA_VERSION` unchanged (5) unless a schema need emerges during implementation.

---

## 4. v1.9 — Project Notebook (Deferred, Larger Change) (#11)

Promoted to its own version because it is a new surface, not an incremental tweak. Projects currently live as values inside the `project` tag category in Tag Manager; that column is getting dense, and the goal is to use projects more actively with a dedicated home.

**Precondition:** A **Design Philosophy Questionnaire** for the Project Notebook, completed before implementation, to define what "tracking projects" means, the tab's layout, and the archive/pause model.

**Anticipated scope (to be refined by the questionnaire):**

- New **Project Notebook** tab (working name), a sixth tab.
- Migrate project CRUD, the inline "+ New Project" creator, and the Project–Life-Category link out of Tag Manager into the new tab.
- Add archive/pause state to projects: archived projects are hidden from the New Task project dropdown but remain in the data so historical task badges still render. Archived projects are flagged, never removed.
- Whatever active project-tracking views the questionnaire defines.

**Data model:** Likely a `status` / `archived` flag on project values, and possibly project-level metadata; requires a `DATA_VERSION` bump and migration. Details deferred to the questionnaire and its own plan.

---

## 5. Cross-Cutting Notes

- **File triad** maintained throughout: `.jsx` source, standalone `.html` build(s), `.md` documentation. From the Test Rig onward, the build emits both production and test-rig HTML from the single `.jsx`.
- **Version discipline:** distinct bug fixes get their own patch bump (v1.7.3); feature work batches into a minor release (v1.8); large new surfaces get their own version (v1.9).
- **Phase snapshots** overwrite the project's canonical files; local descriptive-name snapshots kept for archival.
- **Testing** is manual; each phase ships with a test plan and, where needed, console snippets for localStorage manipulation.
- **`backlogTasks` triple-duty** (active Backlog list, regular-task history, recurring-instance archive) remains as-is; the planned split into a dedicated `recurringArchive` array stays deferred and is not touched by this cycle.
