# NewDay Notebook — Project Plan & Documentation

> **This file is `PROJECT_PLAN.md`** — the canonical source of truth for the
> NewDay Notebook project. It lives in the repo (`mini952/newday`, branch `main`)
> and is fetched from its raw URL at the start of each working session. Treat the
> fetched copy as authoritative over any pasted or uploaded copy. If the access
> method ever changes, update this note so the doc never contradicts how it's used.

## Status

| Field | Value |
|---|---|
| Current shipped version | **v1.8** |
| In development | — (none active) |
| Active implementation plan | `IMPLEMENTATION_PLAN.md` — holds the most recent cycle (v1.8) |
| `DATA_VERSION` (storage schema) | 5 |

**Last Updated:** July 22, 2026

---

## Repo & Versioning Workflow

The repo is the single source of truth. Filenames are **stable** — the version
lives in content and git history, never in a filename. These rules govern every
change; a working session should follow them and flag any step that looks skipped.

1. **Stable filenames, versioned content.** Never put a version number in a
   filename. The version lives in five places: the in-app nav-bar label, the
   header comments of `app.jsx` / `index.html` / `testrig.html`, `build.py`'s
   `<title>` string, the Status block above, and the changelog below (plus git
   commit messages, and optional release tags).
2. **A code change is a four-file update.** Edit `app.jsx`, then re-run
   `build.py` to regenerate `index.html` **and** `testrig.html` (never hand-edit
   the HTML), and update the changelog in this file. `build.py` emits both builds
   from the one source, applying the Babel-standalone stripping rules.
3. **Opening a cycle.** Write the new cycle's plan into `IMPLEMENTATION_PLAN.md`
   and flip the Status block to `In development: vX.Y`.
4. **Shipping a version.** Fold the cycle summary into the changelog below; bump
   `Current shipped version`; reset `In development` to none and clear
   `IMPLEMENTATION_PLAN.md`; bump the version string in the nav label, the file
   header comments, and `build.py`'s title. Optionally cut a release tag (below).
5. **Fetch before editing.** Always pull the live file from the repo before
   editing — never work from a stale copy.
6. **Manifest hygiene.** When a file is added, renamed, or removed in the repo,
   update the file manifest in the Claude Project instructions to match.
7. **`DATA_VERSION` is separate.** It tracks the localStorage schema only. Bump it
   only on a schema change; it is currently 5.

**Optional — release tags (manual, at ship time, non-gating).** A tag marks the
exact commit that shipped as a given version, giving a frozen snapshot without
any filename change. It does not affect the live/dock URL, which always tracks
`main`. To create one: repo → **Releases** → **Draft a new release** → **Choose a
tag** → type `vX.Y` → **Create new tag on publish** → target `main` → add notes →
**Publish**.

---

## 1. General Features Overview

NewDay Notebook is a personal task management app built around a daily workflow. It organizes tasks into time-based sections across five tabs and provides tools for managing, categorizing, reviewing, and recurring all tasks.

### Core Concept

The app is centered on the idea of starting each day fresh. Tasks live in "Today," and at the end of the day, the "New Day" button lets you decide what carries forward and what gets shelved — one task at a time. The Notebook date only advances when you press New Day, giving you full control over your daily cycle.

### Five Main Tabs

**Daily Notebook (📓)** — The daily workflow view. Contains four sections:

- **New Task** — An expandable input form at the top for creating tasks. Includes an "Ongoing" checkbox next to the due date — checking it creates an ongoing task (due date is disabled and cleared). New tasks are automatically routed: today's date → Today, future date → Future Notebook, past date → Backlog, no date → Someday, ongoing → Ongoing section. An "⊞ Add several" toggle switches the form into a multi-task staging mode (see Multi-Task Add below) for queuing several tasks and committing them in one pass.
- **Today** — The active task list for the current day. Tasks can be reordered via drag-and-drop. Hovering reveals "→ Move" and "↑" buttons. Each task displays Project, Eisenhower Matrix emoji, and Life Category badges. When an ongoing task in Today is checked off, it logs a completion and returns to the Ongoing section (not permanently completed).
- **Ongoing** — Long-running tasks/projects you work on over multiple sessions. Collapsible. Located between Today and Backlog. Tasks show a purple "Ongoing" badge and "Worked on X times" count. Hover reveals "→ Today" to pull into daily list. Three sort modes available (see Ongoing Sort below). "Complete Project" button in edit mode permanently finishes an ongoing task.
- **Backlog** — Active (uncompleted) tasks from previous days, grouped by creation date (default). Collapsible. Three sort modes available (see Backlog Sort below). Completed backlog tasks are excluded from this view but remain accessible via the Task Database's Completed filter.

**Future Notebook (📅)** — Tasks with future due dates and undated tasks. Three sections:

- **New Task** — An expandable input form at the top (identical to Daily Notebook) with due date defaulting to empty (Someday). Tasks auto-route based on the date entered.
- **Upcoming — Next 7 Days** — Grouped by due date with countdown labels.
- **Future — Beyond 7 Days** — Longer-term scheduled tasks.
- **Someday** — Tasks with no due date. Collapsible. Three sort modes available (see Someday Sort below).

**Task Database (📊)** — Read-only spreadsheet of all tasks. Sortable, filterable by section (All, Today, Ongoing, Backlog, Someday, Future, Recurring, Skipped, Missed, Completed, Waiting, Deleted). The **Skipped** and **Missed** filters are strict subsets of Recurring, surfacing recurring instances by their `recurringStatus`; the Recurring filter continues to show every instance. An independent **date-range view filter** (All time, 30 / 60 / 90 days, or a Custom span) narrows the visible rows by due date without altering data. Completed and deleted tasks are preserved in history.

**Recurring (🔄)** — Management screen for recurring task templates. Create templates with frequency rules (daily, weekly, monthly, quarterly, yearly) and schedule configurations. Weekly templates support an "Every N week(s)" interval (1–12), enabling bi-weekly and longer cadences anchored to the template's start week. Templates auto-generate task instances that appear in Today and Future Notebook. Sections grouped by frequency. Each template card shows schedule description, completion stats, visual history, streak indicator, and next due date. Supports pause/unpause, edit, and delete with cascade.

**Tag Manager (🏷)** — Management screen for tag categories with full CRUD, color pickers, emoji browser, and random color generation.

### Key Interactions

- **New Day Button** — Advances notebook date, moves completed/deleted tasks to database history, triages uncompleted tasks, auto-moves due Future tasks into Today. Recurring instances are handled automatically by frequency: uncompleted **daily** instances are marked "missed" and archived; uncompleted **weekly/monthly/quarterly/yearly** instances roll forward (their `dueDate` updates to the new current day while `originalDueDate` stays anchored, surfacing drift) and remain in Today. New instances for the current day appear at the top of Today.
- **Stale Date Indicator** — Yellow badge when notebook date is behind actual date.
- **Auto-Move on Due Date Change** — Tasks route to correct section when due date is edited.
- **Double-click to Edit** — Inline editing with all fields, metadata, and history.
- **Ongoing Task Workflow** — Check off in Today → logs completion, returns to Ongoing. "Complete Project" in edit mode → permanently finishes. "→ Today" hover button → pulls into daily list for a work session. Ongoing and Recurring are mutually exclusive.
- **Recurring Task Workflow** — Templates generate instances that appear as regular tasks with a blue "↻ Recurring" badge. Check off in Today → logs completion to parent template, regenerates to maintain instance count. "Skip" button (available on hover in Today **and Backlog**) → logs as skipped against the instance's original due date in the parent template, then removes the row. "Edit recurring rule →" link in edit panel navigates to Recurring tab. Editing an instance only affects that instance; editing the template only affects future instances.
- **Recurring Gap-Day Handling** — When New Day skips multiple days (e.g., weekend), daily-template instances for gap days are auto-marked as "missed" and archived; only the current day's instance appears in Today. Non-daily templates roll forward instead — any pending instance with `dueDate < currentDay` has its `dueDate` set to the new current day and stays in Today. Missed entries can be manually corrected in the Recurring tab's editable completion history.
- **Newest-Wins Conflict Rule** — If the next scheduled instance for a non-daily template would generate while a rolled-forward instance from a prior cycle is still pending, the rolled-forward instance is auto-marked "missed" against its original due date and the new instance generates fresh.
- **Today Multi-Select** — A "Select" button in the Today section header reveals checkboxes on each row, hides hover Move buttons, and surfaces a floating action bar (selection count, "Move to →" dropdown for Backlog/Someday/Future/Ongoing, Delete, Cancel). Selected tasks can also be drag-reordered as a contiguous block within Today. Recurring instances are silently skipped when bulk-moved to Ongoing (mutually exclusive); a small toast notes the skip. Exit via Cancel, the Select toggle, or Escape — selection clears on exit.
- **Multi-Task Add (Staging)** — In the Daily Notebook, the "⊞ Add several" toggle replaces the single-task form with a staging panel: a full-metadata input on top (title, description, tags, due date, ongoing — kept expanded between adds for rapid entry) feeding a staging list below. Each staged row shows its title with read-only Project / Eisenhower / Life Category badges, plus a destination chip when the row won't land in Today (Future, Someday, Ongoing, or Backlog). Staged rows are drag-reorderable and each carries a ✕ remove control. "Add all (N) and close" commits the whole batch through the normal routing — preserving the listed order at the top of each destination — and exits; Cancel discards and exits. Blank-title rows are dropped on commit. Staging state survives tab switches but not a full reload.
- **Completed Date Picker** — Editable in edit panel for backdating.
- **Soft Delete** — Tasks hidden from active views but preserved in database.
- **Overdue/Drift Indicators** — Red "Xd overdue" badge and subtle "+Xd from original" drift text.
- **Drag and Drop** — With visual drop indicator and pop-out effect. Available in Today (always), Ongoing (Custom Order mode), Backlog (Custom Order mode), and Someday (Custom Order mode).
- **Move to Top** — "↑" button in all sections.
- **Waiting Status** — Tasks can be marked "Waiting" with an optional note (e.g., "Waiting on Mike's review"). Shows amber "⏳ Waiting" badge on task row. Filterable in Task Database.
- **Inline Project Creation** — "+ New Project" option in the Project dropdown of the New Task form. Opens inline mini-form with name, random colors, and auto-links to selected Life Category.
- **Project–Life Category Link** — Projects can be linked to a Life Category. In the New Task form, projects matching the selected Life Category appear first in the dropdown (soft filtering).
- **Version Number** — Displayed subtly in the top-right corner of the navigation bar.

### Ongoing Sort

The Ongoing section header contains three sort mode pills:

- **⠿ Custom** (default) — Drag-and-drop manual ordering, persisted via `ongoingOrder` field. Grab handles appear on task rows when in this mode.
- **● Priority** — Sorts by Eisenhower Matrix level: 🔴 → 🟡 → 🟠 → ⚪ → untagged last.
- **↻ Recent** — Sorts by most recent work session (last `ongoingCompletions` entry) descending. Tasks never worked on go to the bottom.

Sort mode resets to Custom on page reload. The `ongoingOrder` position is preserved in localStorage and exports regardless of which sort mode is active.

### Backlog Sort

The Backlog section header contains three sort mode pills:

- **📅 Date** (default) — Tasks grouped by creation date, newest group first. Matches the original behavior.
- **● Priority** — Flat list sorted by Eisenhower Matrix level: 🔴 → 🟡 → 🟠 → ⚪ → untagged last. Date groupings are hidden.
- **⠿ Custom** — Flat list with drag-and-drop manual ordering, persisted via `backlogOrder` field. Grab handles appear on task rows. Date groupings are hidden.

Sort mode resets to Date on page reload. The `backlogOrder` position is preserved in localStorage and exports.

### Someday Sort

The Someday section header (in Future Notebook) contains three sort mode pills:

- **📅 Date** (default) — Tasks grouped by creation date, newest group first.
- **● Priority** — Flat list sorted by Eisenhower Matrix level: 🔴 → 🟡 → 🟠 → ⚪ → untagged last. Date groupings are hidden.
- **⠿ Custom** — Flat list with drag-and-drop manual ordering, persisted via `somedayOrder` field. Grab handles appear on task rows. Date groupings are hidden.

Sort pills styled in muted blue. Sort mode resets to Date on page reload. The `somedayOrder` position is preserved in localStorage and exports.

### Task Data Model

Each task contains the following fields:

- `id` — Unique identifier
- `title` — Task name
- `description` — Optional details
- `tags` — Object with keys for each tag category
- `dueDate` — Current target date (YYYY-MM-DD)
- `originalDueDate` — Due date when first created (never changes). For recurring instances, this anchors the original emission date so that roll-forward drift can be displayed when `dueDate` advances on a New Day.
- `dueDateHistory` — Array of `{ from, to, changedAt }` entries
- `createdDate` — Full ISO timestamp
- `completedDate` — Full ISO timestamp
- `completed` — Boolean
- `deleted` — Boolean
- `deletedDate` — Full ISO timestamp
- `status` — Task status: `null` (default) or `"waiting"`
- `statusNote` — Optional string for waiting context (e.g., "Mike's review")
- `dayOrder` — Integer position in Today's list
- `backlogOrder` — Integer position in Backlog's custom sort order
- `somedayOrder` — Integer position in Someday's custom sort order
- `ongoing` — Boolean, marks task as ongoing/long-running
- `ongoingOrder` — Integer position in Ongoing's custom sort order
- `ongoingCompletions` — Array of `{ date, completedAt }` entries logging each work session
- `ongoingCompleted` — Boolean, set when project is permanently finished
- `ongoingCompletedDate` — Full ISO timestamp when project was completed
- `recurringParentId` — String ID linking to a RecurringTemplate (null for regular tasks)
- `recurringStatus` — `"pending"` | `"completed"` | `"missed"` | `"skipped"` (null for regular tasks)
- `recurringSequence` — Integer, instance number in the recurring series (null for regular tasks)

### Recurring Template Data Model

Each recurring template contains the following fields:

- `id` — Unique identifier
- `title` — Template name (used as default title for generated instances)
- `description` — Optional details
- `tags` — Object with keys for each tag category
- `recurrenceRule` — Object with `frequency` and `schedule`:
  - `frequency` — `"daily"` | `"weekly"` | `"monthly"` | `"quarterly"` | `"yearly"`
  - `schedule` — Frequency-specific config:
    - daily: `{}` (every day)
    - weekly: `{ days: [0,1,2,3,4,5,6], interval: 1 }` (0=Sun, 1=Mon, etc.; `interval` is the week-stride: 1 = weekly, 2 = bi-weekly, up to 12. Week 0 is the week containing `startDate`; an instance emits on a chosen weekday only when `(weekOffset % interval) === 0`.)
    - monthly: `{ dayOfMonth: 15 }` or `{ weekday: 1, weekNumber: 1 }` (1st Monday)
    - quarterly: `{ dayOfMonth: 1 }` (1st day of each quarter)
    - yearly: `{ month: 3, dayOfMonth: 15 }` (March 15th)
- `startDate` — First date for instance generation (YYYY-MM-DD)
- `status` — `"active"` | `"paused"`
- `createdDate` — Full ISO timestamp
- `deleted` — Boolean (soft delete)
- `deletedDate` — Full ISO timestamp | null
- `completions` — Array of `{ date, instanceId, status, timestamp }` entries logging each instance outcome

---

## 2. Marketing-Style Feature List

### NewDay Notebook — Start every day with clarity.

**🌅 The New Day Workflow**
One button. A fresh start. Review yesterday's unfinished tasks and decide what matters today. Completed tasks clear automatically. No task falls through the cracks.

**📋 Two Notebooks, One System**
The Daily Notebook for today's focus, ongoing projects, and backlog accountability. The Future Notebook for upcoming plans, long-term tasks, and someday ideas. Every task has a home.

**🔄 Ongoing Projects**
Track long-running work that spans multiple sessions. Pull an ongoing task into Today when you want to work on it. Check it off to log progress — it returns to your Ongoing list ready for next time. See how many times you've worked on it. Complete the project when it's truly done.

**📅 Plan Ahead**
Schedule tasks days or weeks in advance. The Future Notebook shows what's coming. When a task's day arrives, it automatically appears in Today.

**🔀 Smart Task Routing**
Change a due date and the task moves itself. Tasks always end up where they belong.

**🏷 Flexible Multi-Tag System**
Categorize tasks across multiple dimensions with fully customizable tag categories, colors, and emojis.

**⏰ Never Lose Track**
Overdue badges, due date drift indicators, and full change history keep you informed about every task's journey.

**📊 Complete History**
A sortable, filterable database of every task — active, ongoing, completed, and deleted. Drill into skipped or missed recurring instances, or narrow the view to the last 30, 60, or 90 days (or a custom span).

**🗂 Sort Your Way**
Arrange your Ongoing and Backlog lists exactly how you want them — by priority, by recency, or in your own custom drag-and-drop order.

**💾 Your Data, Your Control**
Auto-saves locally. Export/import JSON backups. No accounts, no cloud, no tracking.

**↻ Recurring Tasks**
Build habits and routines with recurring task templates. Daily, weekly, monthly, quarterly, or yearly — set your schedule and the app generates instances automatically. Track your streak, see your completion rate, and never lose sight of what you've built. Skip a day intentionally and it won't count against you. Miss a few days and the app catches up gracefully — only today's task shows up, not the backlog.

---

## 3. Development History & Changelog

### v1.0 — February 26, 2026

The initial release — built the core daily task management app with Today/Backlog/Someday workflow, drag-and-drop reordering, inline editing, multi-tag system, three-tab layout (Notebook, Task Database, Tags), localStorage persistence, and JSON export/import.

**Phase 1: Prototyping**

- Created Prototype A — single-column vertical layout with New Task section, Today, Backlog, and Someday sections
- Created Prototype B — two-column layout with sidebar, card-style tasks
- Decision: Chose Prototype A's vertical flow, top-placed New Task section

**Phase 2: Core App Build**

- Built full working app based on Prototype A
- Implemented: New Task form with title, description, tag, due date
- Implemented: Today section with drag-and-drop reordering
- Implemented: Checkbox toggling with strikethrough + gray-out for completed tasks
- Implemented: Backlog section grouped by due date, collapsible
- Implemented: Someday section, collapsible
- Implemented: New Day modal with per-task decision (Today or Backlog) and bulk actions

**Phase 3: Iterative Fixes & Features**

- Fixed "→ Today" button hover behavior (moved to row hover)
- Moved "→ Today" button inline next to the tag badge
- Added clickable tag dropdown on tag badges
- Fixed vertical alignment of "→ Today" button with tag badge
- Added collapse-on-blur for New Task form
- Changed Backlog grouping from due date to creation date
- Added `createdDate` as full timestamp for accurate sorting

**Phase 4: Inline Editing**

- Prototyped two edit styles (inline slide-down vs card pop-out)
- Implemented double-click to edit with Style A (inline slide-down)
- Added click-outside-to-save, Escape to cancel, Enter to save

**Phase 5: Priority & Move System**

- Added `dayOrder` field with auto-recalculation
- Added "→ Move" dropdown button in Today section (Backlog or Someday)

**Phase 6: Tab System & Multi-Tag Refactor**

- Built three-tab system: To-Do Notebook, Task Database, Tags
- Refactored data model: single `tag` → `tags: { life, eisenhower, project }`
- Added `completedDate` field
- Built Task Database tab (read-only, sortable, filterable)
- Built Tags management tab with full CRUD

**Phase 7: Tags Tab Polish**

- Added Name + Preview Name split
- Added random color generator (🎲)
- Fixed editing state conflicts
- Added searchable emoji picker

**Phase 8: Persistence & Distribution**

- Added localStorage auto-save with version tracking
- Added JSON Export/Import buttons
- Renamed file to `NewDayNotebook.jsx` (PascalCase)
- Converted to self-contained HTML file

---

### v1.1 — February 27, 2026

A focused update fixing drag-and-drop reliability, adding soft delete with database tracking, and displaying Eisenhower Matrix emojis on task rows.

**Phase 9: Drag-and-Drop Overhaul**

- Fixed critical drag index bug — uses task IDs instead of array indices
- Added visual drop indicator (2px dark insertion line)
- Added dragged task visual feedback (scale, shadow, tinted background)

**Phase 10: Delete & Eisenhower Display**

- Added soft delete with `deleted` and `deletedDate` fields
- Added "Deleted" filter and date column in Task Database
- Added Eisenhower Matrix emoji display on task rows (clickable dropdown)

---

### v1.2 — March 12, 2026

A big release — adds the Future Tasks tab, due date tracking with history, overdue/drift indicators, stored notebook date with stale detection, editable completion dates, move-to-top buttons, and project badge display.

**Phase 11: Group A Quick Wins**

- New tasks now insert at the top of their respective lists
- Project tag badge now displays on task rows
- Added "↑" move-to-top button between checkbox and title

**Phase 12: Stored Notebook Date (Group B)**

- Notebook date only advances on New Day press
- Added `currentDay` to persisted state
- Stale date indicator (yellow badge + instruction text)
- Added editable Completed Date picker in edit panel

**Phase 13: Due Date Tracking (Group C — Tasks 1-5)**

- Added `originalDueDate` and `dueDateHistory` fields
- Automatic tracking of due date changes
- Expandable history in edit panel
- "Due date changed X times" visible on task row
- Overdue badge (red, when `currentDay > dueDate`)
- Due date drift indicator (subtle "+Xd from original")

**Phase 14: Future Tasks Tab (Group C — Tasks 6-8)**

- New Future Tasks tab with Upcoming and Future sections
- Smart routing of future-dated tasks
- Auto-move on New Day when due date arrives

---

### v1.3 — April 2, 2026

A structural update — renames tabs for clarity, moves Someday to the Future Notebook, fixes hover button visibility, and adds smart auto-routing when due dates change.

**Phase 15: Tab Renaming & Restructuring**

- Renamed tabs: "Daily Notebook", "Future Notebook", "Tag Manager"
- Moved Someday to Future Notebook (3 sections: Upcoming, Future, Someday)

**Phase 16: Hover Button Fix & Auto-Routing**

- Fixed "→ Move" hover button visibility (querySelectorAll fix)
- Auto-move on due date change across all sections and tabs

---

### v1.4 — April 11, 2026

A feature release introducing the fully implemented Ongoing tasks system, sortable Ongoing and Backlog sections, and a version number display.

**Phase 1: Version Number**

- Added subtle `v1.4` label to the top-right corner of the sticky navigation bar

**Phase 2: Ongoing Tasks — Full Release**

- Ongoing tasks promoted from beta to full release
- Added `ongoingOrder` field to the task data model
- Added `assignOngoingOrder()` helper; `setOngoingTasks` wrapped to auto-assign order on every mutation
- Three sort modes added to the Ongoing section header:
  - **⠿ Custom** (default) — drag-and-drop reordering with grab handles, persisted via `ongoingOrder`
  - **● Priority** — sorts by Eisenhower Matrix level (🔴 → 🟡 → 🟠 → ⚪ → untagged last)
  - **↻ Recent** — sorts by most recent `ongoingCompletions` entry, never-worked tasks go last
- Sort pills styled in purple to match the Ongoing color theme
- Drag handles only appear in Custom mode

**Phase 3: Backlog Sort**

- Added `backlogOrder` field to the task data model
- Added `assignBacklogOrder()` helper; `setBacklogTasks` wrapped to auto-assign order on every mutation
- Three sort modes added to the Backlog section header:
  - **📅 Date** (default) — existing grouped-by-creation-date view, unchanged
  - **● Priority** — flat list sorted by Eisenhower Matrix level, no date groupings
  - **⠿ Custom** — flat list with drag-and-drop reordering, persisted via `backlogOrder`, no date groupings
- Sort pills styled in amber to match the Backlog color theme
- Date groupings only appear in Date mode

**Phase 4: Data Model & Persistence Cleanup**

- `DATA_VERSION` bumped from 1 to 2
- Migration shim added: v1 saves load cleanly, `backlogOrder`/`ongoingOrder` backfilled automatically by wrapper functions
- `buildSaveUpdates` in task edit panel now initializes `ongoingOrder` when converting a task to ongoing
- Header comment updated; all beta language removed

**Bugfixes (post-release)**

- Fixed drag-and-drop not working in Ongoing and Backlog custom sort mode. Two root causes:
  - **Stale closure:** `onDragEnd` was capturing `dragId`, `overId`, `dropSide`, and `tasks` at creation time. Added `useRef` mirrors for all four so `onDragEnd` always reads live values regardless of when it fires.
  - **Order not persisting:** `assignOngoingOrder` and `assignBacklogOrder` used `??` to only fill missing order values, so dragging reordered the array correctly but the wrapper immediately re-stamped all the old order numbers, causing the sort to snap tasks back to their original positions on next render. Fixed by always writing fresh sequential order numbers based on current array position.
  - **Mismatched arrays:** Drag hooks were receiving raw state arrays (`ongoingTasks`, `backlogTasks`) while the renderer was displaying derived sorted arrays, causing index lookups to operate on a different order than what was visible. Fixed by computing sorted display arrays before instantiating the drag hooks, so both operate on the identical array.

**Parked for future versions:**

- Move option inside task edit panel (dropdown for moving between sections)
- Project status values on the Project tag category (active/closed/archived/back-burner)
- Archive feature for old tasks (manual export/removal to reduce data size)

---

### v1.5 — April 25, 2026

A feature release adding task history preservation, New Task form in Future Notebook, Someday sorting, waiting status, inline project creation with life-category linking, and data model cleanup.

**Phase 1: Fix Task Database — Preserve Completed/Deleted Tasks**

- Fixed critical data loss: completed and deleted tasks were silently discarded during New Day. They are now moved to the backlog array where they persist in localStorage and appear in the Task Database.
- Fixed both code paths: the `handleNewDay` triage function and the New Day button shortcut (when no uncompleted tasks exist).
- Added "Completed" filter to Task Database (between Future and Deleted).
- All task arrays now label completed tasks as section "Completed" in the database view.

**Phase 2: New Task Form in Future Notebook**

- Added `NewTaskForm` to the Future Notebook tab, positioned between the header and the Upcoming section.
- Due date defaults to empty (routes to Someday) instead of today's date.
- Added `defaultDueDate` prop to `NewTaskForm` for configurable initial date. Existing Daily Notebook form behavior unchanged.
- Tasks auto-route based on entered date: today → Today, future → Future, past → Backlog, no date → Someday, ongoing → Ongoing.
- Added `setOngoingTasks` prop to `FutureTasksTab` for ongoing task routing.

**Phase 3: Someday Section Sorting**

- Added `somedayOrder` field to the task data model.
- Added `assignSomedayOrder()` helper; `setSomedayTasks` wrapped to auto-assign order on every mutation.
- Three sort modes added to the Someday section header in Future Notebook:
  - **📅 Date** (default) — grouped by creation date, matching Backlog's date mode
  - **● Priority** — flat list sorted by Eisenhower Matrix level
  - **⠿ Custom** — flat list with drag-and-drop reordering, persisted via `somedayOrder`
- Sort pills styled in muted blue (#2563EB / #DBEAFE).
- Drag handles only appear in Custom mode.

**Phase 4: Waiting Status Field**

- Added `status` field to task data model (`null` or `"waiting"`)
- Added `statusNote` field (optional string, e.g., "Waiting on Mike's review")
- Amber "⏳ Waiting" badge displayed on task rows when status is "waiting" (hidden when completed/deleted)
- Status note shown inline next to the badge
- Status dropdown and note input added to the edit panel
- "Waiting" filter added to Task Database (cross-sectional: shows all waiting tasks regardless of section)
- Waiting tasks behave identically to normal tasks during New Day triage and routing

**Phase 5: Quick-Add Projects & Life Category Link**

- **Inline Project Creation:** "+ New Project" option at the bottom of the Project dropdown in New Task form. Opens inline mini-form with name input, color preview swatch, 🎲 random color button, Add/Cancel. New project auto-selects and inherits the current Life Category.
- **Life Category Relationship:** Added `lifeCategoryId` field to Project tag values (default `null`). Projects can be linked to a Life Category in the Tag Manager via a new "Life Category" dropdown column (only shown for the Project category).
- **Soft Filtering:** In the New Task form, when a Life Category is selected, the Project dropdown shows matching projects first, then a divider, then remaining projects. No projects are hidden.

**Phase 6: Data Model & Persistence Cleanup**

- `DATA_VERSION` bumped from 2 to 3
- Migration shim updated: v1 and v2 saves load cleanly into v3. New fields (`somedayOrder`, `status`, `statusNote`, `lifeCategoryId`) are backfilled automatically by wrapper functions and default values.
- Header comment and version display updated to v1.5.
- Documentation updated.

**Parked for future versions:**

- Move option inside task edit panel (dropdown for moving between sections)
- Project status values on the Project tag category (active/closed/archived/back-burner)
- Archive feature for old tasks (manual export/removal to reduce data size)

---

### v1.6 — May 1, 2026

A feature release introducing the full recurring tasks system with template management, automatic instance generation, New Day integration, and a dedicated Recurring tab.

**Beta Phase 1: Data Model & Recurring Template CRUD**

- Added `recurringTemplates` array to app state, persisted in localStorage
- `DATA_VERSION` bumped from 3 to 4 with migration shim (v1/v2/v3 saves get empty `recurringTemplates` array)
- Export/import updated to include `recurringTemplates`
- Added 5th tab: Recurring (🔄) between Future Notebook and Task Database
- Built "New Recurring Task" form with title, description, tag dropdowns (including inline project creation with life-category soft filtering), frequency picker (daily/weekly/monthly/quarterly/yearly), schedule configuration per frequency, and start date
- Built template list display grouped by frequency sections (Daily, Weekly, Monthly, Quarterly, Yearly)
- Template CRUD: create, double-click to edit, pause/unpause toggle, soft delete
- Schedule config UI: weekly day-of-week multi-select, monthly day-of-month or Nth-weekday picker, quarterly day, yearly month + day

**Beta Phase 2: Instance Generation Engine**

- Built `generateNextDueDates(template, fromDate, count)` — computes next N due dates for any frequency type with edge case handling (month clamping, iteration caps)
- Built `generateInstancesFromTemplate(template, dueDates, sequenceStart)` — creates full task objects with `recurringParentId`, `recurringStatus`, and `recurringSequence` fields
- Instance generation triggered on template creation (10 for daily/weekly/monthly/quarterly, 5 for yearly)
- Instances route to Today (if due today) or Future Notebook (if due later)
- Added "↻ Recurring" blue badge on recurring task instances
- Completion of a recurring instance logs to parent template's `completions` array and triggers regeneration to maintain target instance count

**Beta Phase 3: Recurring Tab Rich UI**

- Template cards enriched with: frequency badge (color-coded per frequency), "Next: Today/Tomorrow/In X days" indicator, 🔥 streak badge (3+ consecutive completions), stats line with completion rate percentage, colored square history dots with hover tooltips
- Edit mode shows created date, total history entries, and pending instance count
- Empty frequency sections hidden (only sections with templates displayed)
- Section count badges use frequency-specific colors
- Paused count shown in section headers and page subtitle

**Beta Phase 4: New Day Integration & Missed/Skip Handling**

- Recurring instances excluded from New Day triage modal — handled automatically
- Uncompleted pending recurring instances auto-marked as "missed" during New Day
- Gap-day handling: when notebook date jumps multiple days, instances for intermediate days are auto-marked "missed" and archived; only the current day's instance appears in Today
- Recurring instances for the new day placed at the top of the Today list
- Missed entries logged to parent template in chronological order
- Skip button on recurring instances in Today (appears on hover)
- "Missed last N" red badge on recurring instances when parent template has consecutive missed entries
- Post-New Day regeneration pass maintains target instance count for all active templates

**Beta Phase 4.1: Gap-Day Fix & History Editing**

- Fixed stale-date gap issue: pressing New Day after multiple days no longer floods Today with past-due recurring instances
- Added editable completion history in template edit mode: expandable "Edit history" section with clickable status buttons that cycle through Completed → Missed → Skipped
- Allows manual correction of auto-marked entries (e.g., changing "missed" to "completed" if you actually did the task but didn't press New Day)

**Beta Phase 5: Instance Editing & Template Link**

- Double-click a recurring instance in Today or Future → normal edit panel with all standard fields
- "Edit recurring rule →" link at bottom of edit panel navigates to the Recurring tab
- Ongoing checkbox disabled for recurring instances (Ongoing and Recurring are mutually exclusive)
- Editing an instance only affects that instance; editing a template only affects newly generated instances

**Beta Phase 6: Cascade, Database & Polish**

- Pause cascade: pausing a template immediately removes all pending instances from Today and Future
- Unpause regeneration: resuming a template regenerates instances from today forward
- Delete cascade: soft-deleting a template removes all pending instances; completed/missed/skipped instances remain in database history
- Task Database integration: "Recurring" filter button shows all recurring instances regardless of status; blue "Recurring" section badge
- `sectionColors` updated with Recurring entry (#E0F2FE / #0369A1)

**Parked for future versions:**

- Recurring tasks in database: additional columns for recurringStatus and recurringSequence
- Recurring template archive/history view for deleted templates

---

### v1.7 — May 14, 2026

A maintenance + targeted-features release. Theme: bug fixes, recurring task improvements, and bulk task management in Today.

**Phase 1: Backlog Completed-Task Filter (Bug Fix)**

- The Backlog section of the Daily Notebook no longer displays completed tasks. Filter applies across all three sort modes (Date, Priority, Custom) and to the Backlog count badge.
- Completed backlog tasks remain visible in the Task Database under the Completed filter.
- No data model changes.

**Phase 2: Bi-Weekly / Every-N-Weeks Recurrence**

- Weekly recurring templates now support an `interval` field (1–12) on their schedule. `interval: 1` is the existing weekly behavior; `interval: 2` is bi-weekly; higher values produce every-N-weeks cadences.
- Week 0 anchors to the week containing the template's `startDate` (Sunday-anchored). An instance emits on a chosen weekday only when `(weekOffsetFromStart % interval) === 0`.
- Multi-weekday templates (e.g., every 2 weeks on Mon + Wed) emit on each chosen weekday during "on" weeks and nothing during "off" weeks.
- New-template form and template edit panel gain an inline "Every [N] week(s)" number input next to the weekday multi-select.
- Schedule preview text adapts: `Weekly on Tue, Thu` (interval=1), `Bi-weekly on Tue, Thu` (interval=2), `Every 3 weeks on Mon` (interval≥3).
- Existing weekly templates load with `interval: 1` and behave identically to v1.6.

**Phase 3: Non-Daily Recurring Roll-Forward**

- New Day behavior split by template frequency. **Daily** templates retain the v1.6 behavior — uncompleted instances are marked "missed" and archived, gap-day instances are auto-marked "missed."
- **Weekly, monthly, quarterly, yearly** templates now roll uncompleted instances forward: on New Day, the instance's `dueDate` updates to the new current day while `originalDueDate` stays anchored to the first emission date. The instance keeps its ↻ Recurring badge and remains in Today, showing the existing `+Xd from original` drift text.
- **Newest-wins conflict rule:** when the next scheduled instance for a non-daily template is about to generate while a rolled-forward instance from a prior cycle is still pending, the rolled-forward instance is auto-marked "missed" against its original due date and the new instance generates fresh. Applied in the post–New Day regeneration pass and in unpause regeneration.
- Manually skipping a rolled-forward instance logs the skip against its `originalDueDate`. Moving a rolled-forward instance to Backlog leaves it there under standard Backlog rules — New Day does not re-roll it from Backlog.
- Added `originalDueDate` field to recurring instances (set at instance generation; updated only by roll-forward).

**Phase 4: Multi-Select and Bulk Move in Today**

- New "Select" button in the Today section header toggles select mode. Entering select mode reveals checkboxes on each Today task row, hides hover Move buttons, hides single-task drag handles, and shows a floating action bar.
- Action bar contents: selection count, "Move to →" dropdown (Backlog, Someday, Future with inline date picker, Ongoing), Delete, Cancel.
- **Bulk drag within Today:** in select mode with tasks selected, grabbing any selected task drags the whole group. Dragged item shows the existing pop-out plus a "+N more" badge. On drop, selected tasks are inserted contiguously at the drop point in their current relative order; `dayOrder` is reassigned. Non-selected tasks are not draggable while in select mode.
- **Bulk move to other sections:** selected tasks are removed from Today and inserted at the top of the destination section in current relative order, contiguous. Future destination opens a date picker first. Recurring instances bulk-moved to Ongoing are silently skipped with a toast notification ("X recurring task(s) skipped — Recurring and Ongoing are mutually exclusive"). Select mode exits and selection clears after a successful bulk move.
- Exit triggers: Cancel button, toggling Select off, Escape key — selection clears on exit.

**Phase 5: Data Model Migration, Version Label, Documentation**

- `DATA_VERSION` bumped from 4 to 5.
- Migration shim handles v1/v2/v3/v4 saves: backfills `interval: 1` on existing weekly templates and `originalDueDate = dueDate` on existing recurring instances.
- Version label in nav bar: v1.6 → v1.7.
- Header comment in `.jsx` and `.html` updated; documentation file renamed and updated.

**Parked for future versions:**

- Task groups within Today — design needs more thinking; multi-select may meet some of the same need cases. Revisit after v1.7 ships.
- Mobile support — primary use case is faster task entry, not full app manipulation. Approach in a focused later release (responsive polish + possibly a streamlined mobile add-task mode).
- Bi-weekly / every-N intervals on monthly, quarterly, yearly — only weekly received the interval in v1.7. Other frequencies can be extended later using the same pattern.
- "Skip next" button on recurring tab template cards — separate from the per-instance Skip button in Today/Backlog. Could be useful for templates whose next instance hasn't yet appeared in Today.
- Multi-select for Backlog, Someday, and Ongoing — v1.7 limits multi-select to Today.

---

### v1.7.1 — May 14, 2026

A small patch fixing recurring-task hygiene in Backlog.

**Issue:** Old recurring instances were accumulating in the Backlog section across two paths — Today's Skip button archived a copy of the skipped instance into Backlog "for history," and users could manually move recurring instances into Backlog with no way to dismiss them from there. Result: stale recurring rows in Backlog with red "overdue" badges, no way to clean them up except Delete (which loses the template link).

**Fix:**

- **Backlog Skip button.** The existing Skip button on hover (previously only in Today) is now also rendered on recurring instances in Backlog, both in the date-grouped Date sort and the flat Priority/Custom sorts. Pressing Skip logs to the parent template's `completions` array against the instance's `originalDueDate` and removes the row from Backlog.
- **Today's Skip no longer pollutes Backlog.** `skipRecurring` no longer copies the skipped instance into Backlog. The parent template's completions array is the single source of truth for skip history — visible in the Recurring tab's history dots and in the Task Database.
- **One-time cleanup pass on load.** The load-time migration shim removed orphan recurring instances from Backlog where `recurringStatus` was `"skipped"` or `"missed"`. _(Rolled back in v1.7.2 — this was the wrong layer; see v1.7.2 notes.)_
- **Reused `onNavigateToRecurring` prop** on Backlog TaskItem so the "Edit recurring rule →" link in the edit panel works for recurring instances opened from Backlog, matching the Today behavior.

**No data model changes.** `DATA_VERSION` stays at 5; the cleanup was a one-time filter applied on load, not a schema migration. Existing v1.7 JSON exports load cleanly.

**Files:**

- `NewDayNotebook_v1_7_1.jsx` / `NewDayNotebook_v1_7_1.html` — rewritten `skipRecurring` (now takes a `section` param defaulting to `"today"`), Backlog TaskItem prop additions at both call sites, migration shim cleanup pass, version label v1.7 → v1.7.1, header comment updated.
- Documentation file renamed `NewDayNotebook-Documentation-v1_7_1.md`.

---

### v1.7.2 — May 27, 2026

A bug fix release. The v1.7.1 cleanup of orphan recurring instances in Backlog turned out to be the wrong layer; this release moves the fix to the UI display filter where it belongs.

**Issue:** After running New Day with a daily recurring task pending (e.g. advancing the notebook from May 25 → May 27 with "Plan day" pending for May 26), the May 26 instance appeared in Backlog as what looked like a regular overdue task. The Skip button (added in v1.7.1) did not appear on hover because the instance was already marked `recurringStatus: "missed"` and the Skip button is gated on `"pending"` status. Result: the task was visually stuck in Backlog with no way to dismiss it except Delete.

**Root cause:** New Day correctly marks pending daily recurring instances as `"missed"` and pushes them through the `toArchive` bucket. That bucket is appended to `backlogTasks` so the Task Database's "Recurring" filter and `getMaxSequence` (next instance sequence calculation) can still see them. But the Backlog UI's filter (`activeBacklogTasks`) only excluded `deleted` and `completed` tasks — not `skipped` or `missed` recurring instances. So they leaked into the display.

The v1.7.1 cleanup pass attempted to fix this at load time, but missed two cases: (a) it only ran on load, not after each New Day, so freshly archived missed instances were visible until next reload; (b) it deleted data that Task Database history and sequence counting rely on.

**Fix:**

- **UI-layer filter.** `activeBacklogTasks` now also excludes recurring instances with `recurringStatus === "skipped"` or `"missed"`. The data stays in the underlying `backlogTasks` array — Task Database history and sequence counting still work — but those rows no longer appear in the Backlog list, count badge, empty-state check, or sort groupings.
- **v1.7.1 cleanup pass rolled back.** The destructive load-time filter has been removed from `safeLoad`. Any data it deleted in v1.7.1 is unrecoverable, but going forward, no data is removed.

**Why this is the right layer:** `backlogTasks` serves three internal jobs — the user-visible Backlog list, history for completed/deleted regular tasks, and history for skipped/missed/completed recurring instances. The filter at the display layer cleanly separates job 1 from jobs 2 and 3 without restructuring storage. Splitting these into separate arrays would be a deeper refactor — parked for a future version, see below.

**No data model changes.** `DATA_VERSION` stays at 5. Existing v1.7 and v1.7.1 saves load identically.

**Files:**

- `NewDayNotebook_v1_7_2.jsx` / `NewDayNotebook_v1_7_2.html` — `activeBacklogTasks` filter extended, `safeLoad` cleanup pass removed (comment left in place documenting the rollback), version label v1.7.1 → v1.7.2, header comment updated.
- This documentation file renamed `NewDayNotebook-Documentation-v1_7_2.md`.

**Parked for future versions (added in v1.7.2):**

- **Split recurring archive out of `backlogTasks`.** The `backlogTasks` array currently holds three logically distinct collections: the active Backlog list, archived completed/deleted regular tasks (for Task Database history), and archived skipped/missed/completed recurring instances (for Task Database "Recurring" filter and `getMaxSequence`). The display filter in v1.7.2 cleanly separates them at the UI layer, but the underlying storage would benefit from being explicit — e.g. a `recurringArchive` array — to make the architecture self-documenting and prevent future bugs of the same shape. Would require a `DATA_VERSION` bump and migration that moves orphan recurring rows out of `backlogTasks` into the new location.

---

### v1.7.3 — July 16, 2026

A standalone bug-fix patch. The first task created in the Daily Notebook after a New Day advance defaulted to the previous day, quietly routing it to Backlog instead of Today.

**Issue:** In the Daily Notebook, the New Task form's due date defaulted to the real system date captured once, at mount, and frozen in `useState`. Two problems followed. (a) The value never re-anchored when `currentDay` advanced, so after a New Day the form still offered the old date. (b) It was anchored to the real system date rather than the notebook date (`currentDay`), so whenever the notebook lagged the real date, a "today" task got a due date that didn't equal `currentDay`. Since `addTask` routes to Today only when `dueDate === currentDay`, the task silently landed in Backlog (or Future) instead.

**Root cause:** `NewTaskForm` computed `initialDueDate` from `getTodayStr()` (the real clock) when the Daily Notebook rendered it with no `defaultDueDate`, and `useState(initialDueDate)` reads its argument only on the first render — freezing it at mount.

**Fix:**

- **Anchor to the notebook date.** `NotebookTab` now passes `defaultDueDate={currentDay}` to `NewTaskForm`. This drives the initial value and both reset paths (`handleAdd` and Cancel), so the default is always the notebook date and a "today" task lands in Today even when the notebook is behind the real date.
- **Re-anchor reactively.** A `useEffect` keyed on `defaultDueDate` resets the form's due date when it changes (e.g. after New Day), closing the frozen-at-mount gap.
- **Pristine guard.** The reactive re-anchor only runs when the form is pristine — empty title, empty description, no tags, not ongoing. If any of those has content, the form (including the due date) is left untouched, so a date being edited mid-entry is never clobbered. The one accepted trade-off: on an otherwise-blank form where a due date was hand-picked but no title typed, a New Day advance will re-anchor that date. This is deliberate — a `dateTouched` flag to protect that case was considered and rejected as unwarranted machinery, since New Day is a manual action that essentially never coincides with a half-entered task.

**Future Notebook unchanged.** Its `NewTaskForm` is rendered with a constant `defaultDueDate=""` (Someday), which never changes, so the reactive effect never re-fires there. Behavior is identical to before.

**No data model changes.** `DATA_VERSION` stays at 5. Existing v1.7.x saves load identically.

**Files:**

- `NewDayNotebook_v1_7_3.jsx` / `NewDayNotebook_v1_7_3.html` — added the `useEffect` re-anchor with pristine guard to `NewTaskForm`, `NotebookTab` now passes `defaultDueDate={currentDay}`, version label v1.7.2 → v1.7.3, header comment updated.
- This documentation file renamed `NewDayNotebook-Documentation-v1_7_3.md`.

---

### v1.8 — July 22, 2026

A feature release. Theme: sharper Task Database review filters and faster multi-task entry. Two feature phases plus a version/documentation wrap-up. No data model changes — `DATA_VERSION` stays at 5 throughout.

**Phase 1: Task Database — Skipped/Missed Filter + Date-Range Filters**

- Added **Skipped** and **Missed** filter pills to the Task Database's single-select filter row, placed immediately after Recurring. Each is a strict subset of Recurring, drawing from recurring instances that carry `recurringStatus: "skipped"` or `"missed"`. The Recurring pill continues to show *all* instances (pending, skipped, missed, completed). No status column was added — the active pill supplies the context, so a skipped row still shows its Section badge as "Recurring."
- Added an independent, second **date-range view filter** row: All time (default), 30 days, 60 days, 90 days, or Custom. View-only and non-destructive — it narrows which rows are visible, never touching stored data.
  - Anchored on **due date**. Undated rows are excluded whenever any range is active.
  - The 30 / 60 / 90 pills are backward-looking windows `[today − N, today]`. **Custom** exposes two inline date inputs and may span arbitrary dates including the future; an empty Custom range is inactive (behaves like All time).
  - A subtle resolved-window hint (`due <start> – <end>`) renders in the range row when a range is active.
- These additions were kept isolated and read-only; the broader reorganization of the filter row into labeled sections was deliberately deferred (see Parked, below).

**Phase 2: Daily Notebook — Multi-Task Add (Staging Area)**

- A new **"⊞ Add several"** toggle in the Daily Notebook switches the single-task form into a multi-task staging mode. The full-metadata input (title, description, tags, due date, ongoing) sits at the top and stays expanded between adds for rapid entry; each added row drops into a staging list below.
- Staged rows show the title with read-only **Project → Eisenhower → Life Category** badges (each gated on presence, title truncates first), plus a **destination chip** only when the row won't land in Today (Future / Someday / Ongoing / Backlog). Today-bound rows stay bare.
- Staged rows are **drag-reorderable** (reusing the existing `useDragReorder`) and each carries a ✕ remove control; no inline edit.
- The footer is two buttons: **"Add all (N) and close"** commits the whole batch and exits, and **Cancel** (outlined for discoverability) discards and exits. Commit routes each row through the normal `addTask` path, reverse-iterating the non-blank rows so the listed order is preserved at the top of each destination section. Blank-title rows are dropped as a defensive no-op.
- **Persistence Level A:** the staged rows and multi-add mode are lifted to the root component, so they survive tab switches but not a full reload. Nothing is written to `localStorage`.

**Phase 3: Version Label & Documentation**

- Version label in the nav bar: v1.7.3 → v1.8.
- Header comments in the `.jsx` source and both `.html` builds (production and test rig) updated; the test-rig `<title>` and `build.py` title mapping bumped in step.
- `DATA_VERSION` unchanged (5) — no schema need emerged during implementation.
- This documentation file renamed and updated.

**Parked for future versions (added in v1.8):**

- **Task Database filter-pill sectioning redesign** — group the filter pills into labeled sections (working names: Status / Location / Timeline) rather than one flat row. With Skipped + Missed added, the flat single-select row now wraps to two lines at typical width, which is the concrete motivation. Needs its own design pass first to settle which filter axes *compose* versus are *mutually exclusive* (the section filter is single-select; the Phase 1 date range is a second independent axis) before rebuilding — so it was deliberately kept out of Phase 1.

**Files:**

- `NewDayNotebook_v1_8.jsx` / `NewDayNotebook_v1_8.html` / `NewDayNotebook_v1_8_TESTRIG.html` — source and both builds renamed from the `_v1_7_3` cycle-baseline name to `_v1_8`, with the nav-bar version label and header comments bumped to v1.8. Both HTML builds regenerated from the single `.jsx` via `build.py` (both Babel-stripping rules applied), verified identical apart from the `TEST_MODE` flag and title.
- `build.py` — the `JSX` / `TEMPLATE_HTML` / `OUT_PROD` / `OUT_RIG` filename constants and the rig `<title>` mapping updated to the `_v1_8` names.
- Documentation file renamed `NewDayNotebook-Documentation-v1_8.md`.

---

*This document should be updated with each new version of NewDay Notebook.*
