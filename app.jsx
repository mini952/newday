import { useState, useRef, useCallback, useEffect } from "react";

/**
 * NewDay Notebook v1.8.5
 * A daily task management app with Daily/Future Notebook workflow,
 * multi-tag system, task database, and tag manager.
 * Features: Ongoing tasks with sort (custom/priority/recent),
 * Backlog sort (date/priority/custom), Someday sort (date/priority/custom),
 * Future Notebook with New Task form, drag-and-drop, task waiting status,
 * inline project creation with life-category soft filtering.
 * Completed/deleted tasks preserved in database history.
 * Recurring tasks system with template management and instance generation.
 * v1.7: Backlog completed-task filter (bug fix), bi-weekly/every-N-weeks
 * weekly recurrence, non-daily recurring roll-forward on New Day,
 * multi-select and bulk move in Today.
 * v1.7.1: Skip button for recurring instances in Backlog. Today's Skip no
 * longer archives a copy to Backlog (parent template's completions array
 * is the source of truth).
 * v1.7.2: Backlog UI now filters out skipped/missed recurring instances
 * (bug fix — they were leaking into Backlog after New Day archived them
 * via the toArchive path). v1.7.1's safeLoad cleanup rolled back; the
 * UI filter is the right layer (data preserved for Task Database
 * history and recurring sequence counting).
 * v1.7.3: New-task default due date in the Daily Notebook is now anchored
 * to the notebook date (currentDay) and re-anchors reactively after New Day,
 * instead of freezing the real system date at mount (bug fix — the first
 * task added after a New Day advance defaulted to the previous day). The
 * reactive re-anchor only applies to a pristine form, so a due date being
 * edited mid-entry is never overwritten. Future Notebook default unchanged.
 * v1.8: Feature release (two phases). Phase 1 — Task Database: added
 * Skipped and Missed filter pills (strict subsets of Recurring) plus a
 * date-range view filter (All time / 30 / 60 / 90 / Custom) anchored on
 * due date; view-only and non-destructive. Phase 2 — Daily Notebook:
 * multi-task add via a staging area. An "Add several" toggle opens a
 * staging panel with full-metadata entry; staged rows show title + tag
 * badges, carry a destination chip when they won't land in Today, and
 * are drag-reorderable; "Add all (N)" commits the batch (listed order
 * preserved at the top of each destination) and closes. Staging state
 * survives tab switches but not reloads. No data model change.
 * v1.8 data v6 (sync Stage 1): every task and recurring template carries
 * updatedAt (last change time) and reminders (list of ISO datetimes, no UI
 * yet). Older saves and imports are backfilled on load.
 * v1.8.2 (sync Stage 2): ⚙ Sync settings panel — GitHub owner / repo /
 * file path and an access key, a Test connection button, and Forget key.
 * The settings (including the key) live only in this device's localStorage
 * under their own key, never in the notebook data or exports. Tasks are
 * still loaded and saved only in localStorage; GitHub sync comes later.
 * v1.8.3 (sync Stage 3): when Sync settings are filled in, the notebook is
 * pulled from GitHub on open, on focus, and with ⟳ Refresh, and saved ~2 s
 * after edits stop. localStorage stays the local cache. If both sides
 * changed, sync pauses and nothing is overwritten (conflict screen comes in
 * Stage 4). A missing file is never created (import step). Header shows a
 * sync status. The app now checks for a newer deployed version and offers
 * a reload; the service worker revalidates pages instead of trusting the
 * browser cache.
 * v1.8.4 (sync Stage 4): conflict screen. When GitHub and this device both
 * changed, items changed on one side merge on their own (three-way, against
 * this device's copy of the last-synced file); items changed on both sides,
 * including delete-vs-edit, are listed side by side for the user to pick.
 * New Day on both sides asks which day to keep. Nothing is written until
 * Save, which re-checks GitHub first. A never-synced device can switch to
 * GitHub's copy (after an automatic backup download) or merge.
 * v1.8.5 (sync Stage 5): offline — clear Offline badge, edits marked unsaved
 * and kept locally (also across reloads; the service worker now caches the
 * React/Babel/font files so the app opens offline), sync resumes on the
 * online event, focus, or Refresh. Key problems — 401 prompt with a button
 * to Sync settings, separate no-access and rate-limit messages, and a key
 * expiry reminder from 14 days before (GitHub's expiry header when
 * readable, or the date in Sync settings), dismissible per day. Reminder
 * times: add/edit/remove several Eastern date-times per task in the add and
 * edit forms (stored in `reminders`); a 🔔 count shows on the task.
 * Last updated: 2026-11-01
 */



/* ═══════════════════════════════════════════
   TEST RIG — build-time flag
   ───────────────────────────────────────────
   Single source of truth. Authored OFF. The Python build emits two
   HTML files from this one .jsx: the production build (flag off, no
   testing controls) and the test-rig build (flag flipped on). All
   rig-only code is gated behind this flag and is inert when off.
   ═══════════════════════════════════════════ */

const TEST_MODE = false;

// Shown in the header and compared against the deployed page to offer a reload.
const APP_VERSION = "1.8.5";

/* ═══════════════════════════════════════════
   DATA MODEL & HELPERS
   ═══════════════════════════════════════════ */

const defaultTagCategories = [
  {
    id: "life",
    name: "Life Category",
    values: [
      { id: "work", label: "Work", previewLabel: "Work", display: "color", bg: "#EEF2FF", text: "#4F46E5" },
      { id: "personal", label: "Personal", previewLabel: "Personal", display: "color", bg: "#FEF3C7", text: "#B45309" },
      { id: "learning", label: "Learning", previewLabel: "Learning", display: "color", bg: "#ECFDF5", text: "#059669" },
      { id: "health", label: "Health", previewLabel: "Health", display: "color", bg: "#FDE8E8", text: "#B91C1C" },
      { id: "finance", label: "Finance", previewLabel: "Finance", display: "color", bg: "#E0F2FE", text: "#0369A1" },
    ],
  },
  {
    id: "eisenhower",
    name: "Eisenhower Matrix",
    values: [
      { id: "ui", label: "Urgent & Important", previewLabel: "U&I", display: "emoji", emoji: "🔴" },
      { id: "ni", label: "Not Urgent & Important", previewLabel: "NU&I", display: "emoji", emoji: "🟡" },
      { id: "un", label: "Urgent & Not Important", previewLabel: "U&NI", display: "emoji", emoji: "🟠" },
      { id: "nn", label: "Not Urgent & Not Important", previewLabel: "NU&NI", display: "emoji", emoji: "⚪" },
    ],
  },
  {
    id: "project",
    name: "Project",
    values: [
      { id: "alpha", label: "Project Alpha", previewLabel: "Alpha", display: "color", bg: "#F3E8FF", text: "#7C3AED" },
      { id: "beta", label: "Project Beta", previewLabel: "Beta", display: "color", bg: "#DBEAFE", text: "#2563EB" },
    ],
  },
];

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function nowTimestamp() {
  return new Date().toISOString();
}

/* ═══════════════════════════════════════════
   TEST RIG — fake clock (Part B)
   ───────────────────────────────────────────
   getClockToday() is the single "what calendar day is it right now?"
   source. It returns the real date normally; when TEST_MODE is on and a
   fake date has been set, it returns that instead. Only reads that ask
   "what day is it now?" are routed through it — currentDay (downstream
   state), id/key generation (Date.now / generateId), audit timestamps
   (nowTimestamp), and pure date math on already-chosen dates are left on
   the real clock by design (over-routing those would break id/key
   generation and the recurring date math).

   The fake date persists in its OWN localStorage key inside the -TEST
   island, so a reload resumes mid-scenario. It is kept out of the app
   data blob entirely — the production schema and DATA_VERSION (5) are
   untouched. __fakeClockDate is a module-level mirror so the module-level
   date helpers can read the fake date synchronously, including during the
   very first render. All of this is inert when TEST_MODE is off:
   getClockToday() collapses to the original real-clock read, so the
   production build behaves identically to before.
   ═══════════════════════════════════════════ */

const FAKE_CLOCK_KEY = "newday-notebook-TEST-clock";
let __fakeClockDate = null; // "YYYY-MM-DD" or null (= use the real clock)

if (TEST_MODE) {
  try {
    const stored = localStorage.getItem(FAKE_CLOCK_KEY);
    if (stored) __fakeClockDate = stored;
  } catch (e) { /* ignore */ }
}

function realTodayStr() {
  return new Date().toISOString().split("T")[0];
}

function getClockToday() {
  if (TEST_MODE && __fakeClockDate) return __fakeClockDate;
  return realTodayStr();
}

// Persist the fake date and update the module-level mirror. Rig UI only.
function writeFakeClock(dateStr) {
  __fakeClockDate = dateStr || null;
  try {
    if (dateStr) localStorage.setItem(FAKE_CLOCK_KEY, dateStr);
    else localStorage.removeItem(FAKE_CLOCK_KEY);
  } catch (e) { /* ignore */ }
}

function getTodayStr() {
  // Shared "today" helper — routed through the single clock source so the
  // rig's fake clock flows to every call site (New Day, staleness badge,
  // new-task defaults, recurring generation's fromDate anchors, etc.).
  return getClockToday();
}

function formatDate(dateStr) {
  if (!dateStr) return "—";
  const d = new Date(dateStr.includes("T") ? dateStr : dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/* ─── Reminder times (v1.8.5) ───
   Stored per item in `reminders` as ISO datetimes with the US Eastern
   offset, e.g. "2026-11-03T09:00:00-05:00". The app only stores and shows
   them; Task Tracker sends the pings. The form works in Eastern time. */
const REMINDER_TZ = "America/New_York";

function easternWallClock(date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: REMINDER_TZ, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(date);
  const p = Object.fromEntries(parts.map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

// ISO reminder -> "YYYY-MM-DDTHH:MM" (Eastern) for a datetime-local input.
function reminderToInput(iso) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : easternWallClock(d);
}

// "YYYY-MM-DDTHH:MM" (Eastern) -> ISO with the right -05:00 / -04:00 offset.
function inputToReminder(local) {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(local || "");
  if (!m) return null;
  const wall = m[0];
  const asUtc = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  for (const hours of [5, 4]) {
    if (easternWallClock(new Date(asUtc + hours * 3600000)) === wall) return `${wall}:00-0${hours}:00`;
  }
  return `${wall}:00-04:00`; // inside the spring-forward gap: treat as daylight time
}

function remindersFromInputs(values) {
  const out = values.map(inputToReminder).filter(Boolean);
  return [...new Set(out)].sort((a, b) => new Date(a) - new Date(b));
}

function formatReminder(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-US", { timeZone: REMINDER_TZ, weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function formatDateShort(dateStr) {
  if (!dateStr) return "—";
  const d = new Date(dateStr.includes("T") ? dateStr : dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function assignDayOrder(tasks) {
  let order = 1;
  return tasks.map((t) => ({ ...t, dayOrder: t.completed ? null : order++ }));
}

function assignOngoingOrder(tasks) {
  return tasks.map((t, i) => ({ ...t, ongoingOrder: i + 1 }));
}

function assignBacklogOrder(tasks) {
  return tasks.map((t, i) => ({ ...t, backlogOrder: i + 1 }));
}

function assignSomedayOrder(tasks) {
  return tasks.map((t, i) => ({ ...t, somedayOrder: i + 1 }));
}

const EISENHOWER_PRIORITY = { ui: 1, ni: 2, un: 3, nn: 4 };

function randomTagColors() {
  // Pick a random hue, then generate a light pastel bg and a dark matching text color
  const hue = Math.floor(Math.random() * 360);
  const satBg = 60 + Math.floor(Math.random() * 25);  // 60-85%
  const lightBg = 90 + Math.floor(Math.random() * 6);  // 90-95%
  const satText = 60 + Math.floor(Math.random() * 30);  // 60-90%
  const lightText = 25 + Math.floor(Math.random() * 15); // 25-40%

  const hslToHex = (h, s, l) => {
    s /= 100; l /= 100;
    const a = s * Math.min(l, 1 - l);
    const f = (n) => {
      const k = (n + h / 30) % 12;
      const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
      return Math.round(255 * color).toString(16).padStart(2, "0");
    };
    return `#${f(0)}${f(8)}${f(4)}`;
  };

  return {
    bg: hslToHex(hue, satBg, lightBg),
    text: hslToHex(hue, satText, lightText),
  };
}

/* ─── localStorage persistence ─── */
const STORAGE_KEY = TEST_MODE ? "newday-notebook-TEST" : "newday-notebook";
const DATA_VERSION = 6;

/* ─── v6: per-item sync fields ───
   Every task and recurring template carries:
     updatedAt  ISO time of the item's last change (create, edit, complete,
                delete, or move between sections). Later sync stages compare
                it to spot the same item edited in two places.
     reminders  list of ISO datetimes (optional "remind me at" times). No UI
                yet; Task Tracker reads them from the shared file.
   The order fields are recomputed from list position on every save, so they
   are ignored when deciding whether an item changed. */
const ITEM_ARRAY_KEYS = ["todayTasks", "futureTasks", "backlogTasks", "somedayTasks", "ongoingTasks", "recurringTemplates"];
const NON_CONTENT_FIELDS = ["updatedAt", "dayOrder", "backlogOrder", "somedayOrder", "ongoingOrder"];

function itemContentKey(item) {
  const rest = { ...item };
  NON_CONTENT_FIELDS.forEach((k) => { delete rest[k]; });
  return JSON.stringify(rest);
}

// Best guess at when a pre-v6 item last changed: the newest timestamp it
// already records. Null when it has none.
function latestKnownTimestamp(item) {
  const candidates = [item.createdDate, item.completedDate, item.deletedDate, item.ongoingCompletedDate];
  (Array.isArray(item.dueDateHistory) ? item.dueDateHistory : []).forEach((h) => candidates.push(h?.changedAt));
  (Array.isArray(item.ongoingCompletions) ? item.ongoingCompletions : []).forEach((c) => candidates.push(c?.completedAt));
  (Array.isArray(item.completions) ? item.completions : []).forEach((c) => candidates.push(c?.timestamp));
  let best = null;
  candidates.forEach((c) => {
    if (typeof c !== "string" || !c) return;
    const ms = Date.parse(c);
    if (!Number.isNaN(ms) && (best === null || ms > best)) best = ms;
  });
  return best === null ? null : new Date(best).toISOString();
}

// Fill missing updatedAt / reminders; leaves every other field untouched.
function backfillSyncFields(item, fallbackTs) {
  if (!item || typeof item !== "object") return item;
  const hasUpdatedAt = typeof item.updatedAt === "string" && item.updatedAt !== "";
  const hasReminders = Array.isArray(item.reminders);
  if (hasUpdatedAt && hasReminders) return item;
  return {
    ...item,
    ...(hasUpdatedAt ? {} : { updatedAt: latestKnownTimestamp(item) || fallbackTs }),
    ...(hasReminders ? {} : { reminders: [] }),
  };
}

function backfillSyncFieldsAll(arr, fallbackTs) {
  return Array.isArray(arr) ? arr.map((t) => backfillSyncFields(t, fallbackTs)) : arr;
}

// Used by every list setter: items that are new to this list or whose content
// changed get updatedAt = now; unchanged items keep their old updatedAt.
function stampChangedItems(prev, next) {
  if (!Array.isArray(next)) return next;
  const prevById = new Map();
  if (Array.isArray(prev)) prev.forEach((p) => { if (p && p.id != null) prevById.set(p.id, p); });
  let now = null;
  return next.map((item) => {
    if (!item || typeof item !== "object") return item;
    const before = prevById.get(item.id);
    if (before === item) return item;
    const normalized = Array.isArray(item.reminders) ? item : { ...item, reminders: [] };
    if (before && itemContentKey(before) === itemContentKey(normalized)) {
      return normalized.updatedAt === before.updatedAt ? normalized : { ...normalized, updatedAt: before.updatedAt };
    }
    if (!now) now = nowTimestamp();
    return { ...normalized, updatedAt: now };
  });
}

function saveToStorage(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: DATA_VERSION, ...data }));
  } catch (e) {
    console.warn("Failed to save to localStorage:", e);
  }
}

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data) return null;
    // Migrate v1 → v2 → v3 → v4:
    // v1→v2: backlogOrder and ongoingOrder fields, handled by assign*Order wrappers.
    // v2→v3: somedayOrder field (handled by assignSomedayOrder wrapper),
    //   status/statusNote fields on tasks (default null/""),
    //   lifeCategoryId on project tag values (default null).
    //   Completed/deleted tasks now preserved in backlog array.
    // v3→v4: recurringTemplates array (default []).
    //   recurringParentId/recurringStatus/recurringSequence on task instances (default null).
    // v4→v5: weekly recurringTemplates get schedule.interval (default 1).
    //   Recurring task instances get originalDueDate (default = dueDate). This anchors
    //   roll-forward drift display: when a non-daily instance is carried into a new day,
    //   dueDate updates but originalDueDate stays put, and the gap is shown to the user.
    // v5→v6: updatedAt (ISO) and reminders ([]) on every task and template.
    //   updatedAt is backfilled from the newest timestamp the item already
    //   records, else the load time. Nothing else changes.
    // Accept v1–v5 saves — new fields are backfilled automatically.
    if (data.version === DATA_VERSION || data.version === 5 || data.version === 4 || data.version === 3 || data.version === 2 || data.version === 1) {
      return migrateData(data);
    }
    return null;
  } catch (e) {
    console.warn("Failed to load from localStorage:", e);
    return null;
  }
}

// Backfills shared by load and Import. Idempotent: running it on data that is
// already current changes nothing.
function migrateData(data) {
  // v4→v5 backfill: ensure weekly templates have schedule.interval = 1
  if (Array.isArray(data.recurringTemplates)) {
    data.recurringTemplates = data.recurringTemplates.map((t) => {
      if (t?.recurrenceRule?.frequency === "weekly") {
        const sched = t.recurrenceRule.schedule || {};
        if (sched.interval === undefined || sched.interval === null) {
          return { ...t, recurrenceRule: { ...t.recurrenceRule, schedule: { ...sched, interval: 1 } } };
        }
      }
      return t;
    });
  }
  // v4→v5 backfill: ensure recurring instances have originalDueDate.
  // Without this, drift after a v1.7 roll-forward would compare against undefined.
  const backfillRecurringOriginal = (arr) => Array.isArray(arr)
    ? arr.map((t) => (t?.recurringParentId && !t.originalDueDate && t.dueDate)
        ? { ...t, originalDueDate: t.dueDate }
        : t)
    : arr;
  data.todayTasks = backfillRecurringOriginal(data.todayTasks);
  data.futureTasks = backfillRecurringOriginal(data.futureTasks);
  data.backlogTasks = backfillRecurringOriginal(data.backlogTasks);
  // Note: v1.7.1 added a one-time cleanup here that filtered orphan
  // skipped/missed recurring instances out of backlogTasks. That was
  // rolled back in v1.7.2 — those rows are needed by the Task Database
  // (Recurring filter shows them as history) and by getMaxSequence
  // (next instance sequence calculation). The Backlog UI now filters
  // them out at the display layer instead — see activeBacklogTasks.
  // v5→v6 backfill: updatedAt + reminders on every item.
  const loadTs = nowTimestamp();
  ITEM_ARRAY_KEYS.forEach((k) => { data[k] = backfillSyncFieldsAll(data[k], loadTs); });
  return data;
}

function groupByCreatedDate(tasks) {
  const groups = {};
  tasks.forEach((t) => {
    const key = t.createdDate ? t.createdDate.split("T")[0] : "No date";
    if (!groups[key]) groups[key] = [];
    groups[key].push(t);
  });
  return Object.entries(groups).sort(([a], [b]) => {
    if (a === "No date") return 1;
    if (b === "No date") return -1;
    return b.localeCompare(a);
  });
}

function getTagValue(categories, categoryId, valueId) {
  const cat = categories.find((c) => c.id === categoryId);
  if (!cat) return null;
  return cat.values.find((v) => v.id === valueId) || null;
}

/* ═══════════════════════════════════════════
   SHARED COMPONENTS
   ═══════════════════════════════════════════ */

function TagBadge({ categories, categoryId, valueId, small }) {
  const val = getTagValue(categories, categoryId, valueId);
  if (!val) return <span style={{ color: "#D4D4D0", fontSize: small ? "11px" : "12px" }}>—</span>;
  const displayName = val.previewLabel || val.label;
  if (val.display === "emoji") {
    return <span style={{ fontSize: small ? "12px" : "14px" }} title={val.label}>{val.emoji}</span>;
  }
  return (
    <span
      title={val.label}
      style={{
        fontSize: small ? "10px" : "11px",
        fontWeight: 600,
        letterSpacing: "0.03em",
        padding: small ? "2px 6px" : "3px 8px",
        borderRadius: "4px",
        backgroundColor: val.bg,
        color: val.text,
        whiteSpace: "nowrap",
        display: "inline-block",
      }}
    >
      {displayName}
    </span>
  );
}

/* ═══════════════════════════════════════════
   DRAG & DROP
   ═══════════════════════════════════════════ */

function useDragReorder(tasks, setTasks) {
  const [dragId, setDragId] = useState(null);
  const [overId, setOverId] = useState(null);
  const [dropSide, setDropSide] = useState(null); // "above" or "below"

  // Refs so onDragEnd always reads current values, not stale closure captures
  const dragIdRef = useRef(null);
  const overIdRef = useRef(null);
  const dropSideRef = useRef(null);
  const tasksRef = useRef(tasks);
  tasksRef.current = tasks;

  const onDragStart = (taskId) => (e) => {
    dragIdRef.current = taskId;
    setDragId(taskId);
    e.dataTransfer.effectAllowed = "move";
    // Use a transparent 1x1 image as drag ghost (we'll style the source element instead)
    const img = new Image();
    img.src = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
    e.dataTransfer.setDragImage(img, 0, 0);
  };

  const onDragEnd = () => {
    const currentDragId = dragIdRef.current;
    const currentOverId = overIdRef.current;
    const currentDropSide = dropSideRef.current;
    const currentTasks = tasksRef.current;

    if (currentDragId !== null && currentOverId !== null && currentDragId !== currentOverId) {
      const dragIndex = currentTasks.findIndex((t) => t.id === currentDragId);
      let overIndex = currentTasks.findIndex((t) => t.id === currentOverId);
      if (dragIndex !== -1 && overIndex !== -1) {
        const updated = [...currentTasks];
        const [moved] = updated.splice(dragIndex, 1);
        // Adjust target index after removal
        if (dragIndex < overIndex) overIndex--;
        const insertAt = currentDropSide === "below" ? overIndex + 1 : overIndex;
        updated.splice(insertAt, 0, moved);
        setTasks(updated);
      }
    }
    dragIdRef.current = null;
    overIdRef.current = null;
    dropSideRef.current = null;
    setDragId(null);
    setOverId(null);
    setDropSide(null);
  };

  const onDragOver = (taskId) => (e) => {
    e.preventDefault();
    if (taskId === dragIdRef.current) return;
    // Determine if cursor is in top or bottom half of the element
    const rect = e.currentTarget.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    const side = e.clientY < midY ? "above" : "below";
    overIdRef.current = taskId;
    dropSideRef.current = side;
    setOverId(taskId);
    setDropSide(side);
  };

  const onDragLeave = (taskId) => () => {
    if (overIdRef.current === taskId) {
      overIdRef.current = null;
      dropSideRef.current = null;
      setOverId(null);
      setDropSide(null);
    }
  };

  return { onDragStart, onDragEnd, onDragOver, onDragLeave, dragId, overId, dropSide, getDragState: () => ({ dragId: dragIdRef.current, overId: overIdRef.current, dropSide: dropSideRef.current }) };
}

/* ═══════════════════════════════════════════
   TAG DROPDOWN (for tasks)
   ═══════════════════════════════════════════ */

function TagDropdown({ categories, categoryId, currentValueId, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const cat = categories.find((c) => c.id === categoryId);
  if (!cat) return null;
  const currentVal = cat.values.find((v) => v.id === currentValueId);

  useState(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  });

  return (
    <div ref={ref} style={{ position: "relative", flexShrink: 0, marginTop: "2px" }}>
      <span
        onClick={() => setOpen((o) => !o)}
        style={{
          cursor: "pointer",
          display: "inline-block",
          transition: "filter 0.1s",
        }}
        onMouseEnter={(e) => { e.currentTarget.style.filter = "brightness(0.93)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.filter = "none"; }}
      >
        <TagBadge categories={categories} categoryId={categoryId} valueId={currentValueId} />
      </span>
      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 4px)", right: 0,
          backgroundColor: "#FFFFFF", borderRadius: "8px", border: "1px solid #EBEBEA",
          boxShadow: "0 4px 16px rgba(0,0,0,0.1)", padding: "4px", zIndex: 100, minWidth: "130px",
        }}>
          {cat.values.map((v) => {
            const isActive = v.id === currentValueId;
            return (
              <div
                key={v.id}
                onClick={() => { onChange(v.id); setOpen(false); }}
                style={{
                  fontSize: "12px", fontWeight: isActive ? 600 : 500, padding: "6px 10px",
                  borderRadius: "5px", cursor: "pointer",
                  color: v.display === "color" ? v.text : "#4A4A46",
                  backgroundColor: isActive ? (v.display === "color" ? v.bg : "#F5F5F3") : "transparent",
                  transition: "background-color 0.1s", display: "flex", alignItems: "center", gap: "6px",
                }}
                onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.backgroundColor = "#F5F5F3"; }}
                onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.backgroundColor = isActive ? (v.display === "color" ? v.bg : "#F5F5F3") : "transparent"; }}
              >
                {v.display === "emoji" ? <span>{v.emoji}</span> : <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: v.text, flexShrink: 0 }} />}
                {v.label}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════
   MOVE DROPDOWN (Today → Backlog/Someday)
   ═══════════════════════════════════════════ */

function MoveDropdown({ onMove }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useState(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  });
  return (
    <div ref={ref} data-move-btn style={{ position: "relative", flexShrink: 0, opacity: 0, transition: "opacity 0.15s", marginTop: "2px" }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          fontSize: "11px", fontWeight: 600, padding: "3px 8px", borderRadius: "5px",
          border: "1px solid #EBEBEA", backgroundColor: "#FAFAF9", color: "#8A8A86",
          cursor: "pointer", fontFamily: "inherit", transition: "background-color 0.1s, color 0.1s",
        }}
        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#EBEBEA"; e.currentTarget.style.color = "#5A5A56"; }}
        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "#FAFAF9"; e.currentTarget.style.color = "#8A8A86"; }}
      >
        → Move
      </button>
      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 4px)", right: 0,
          backgroundColor: "#FFFFFF", borderRadius: "8px", border: "1px solid #EBEBEA",
          boxShadow: "0 4px 16px rgba(0,0,0,0.1)", padding: "4px", zIndex: 100, minWidth: "110px",
        }}>
          {["Backlog", "Someday"].map((dest) => (
            <div key={dest} onClick={() => { onMove(dest.toLowerCase()); setOpen(false); }}
              style={{ fontSize: "12px", fontWeight: 500, padding: "6px 10px", borderRadius: "5px", cursor: "pointer", color: "#4A4A46", transition: "background-color 0.1s" }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#F5F5F3"; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
            >→ {dest}</div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════
   BULK ACTION BAR (v1.7 — multi-select in Today)
   ═══════════════════════════════════════════ */

function BulkActionBar({ count, onCancel, onMove, onMoveFuture, onDelete, futureDate, setFutureDate, futureDateOpen, setFutureDateOpen, currentDay }) {
  const [moveOpen, setMoveOpen] = useState(false);
  const moveRef = useRef(null);
  const futureRef = useRef(null);
  const hasSelection = count > 0;

  useEffect(() => {
    const h = (e) => {
      if (moveRef.current && !moveRef.current.contains(e.target)) setMoveOpen(false);
      if (futureRef.current && !futureRef.current.contains(e.target)) setFutureDateOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [setFutureDateOpen]);

  const destinations = [
    { key: "backlog", label: "→ Backlog" },
    { key: "someday", label: "→ Someday" },
    { key: "future", label: "→ Future…" },
    { key: "ongoing", label: "→ Ongoing" },
  ];

  return (
    <div style={{
      position: "fixed", bottom: "24px", left: "50%", transform: "translateX(-50%)",
      display: "flex", alignItems: "center", gap: "8px",
      backgroundColor: "#FFFFFF", padding: "10px 14px", borderRadius: "12px",
      border: "1px solid #EBEBEA", boxShadow: "0 8px 28px rgba(0,0,0,0.12)",
      zIndex: 9000, fontFamily: "inherit",
    }}>
      <span style={{ fontSize: "13px", fontWeight: 600, color: hasSelection ? "#1A1A1A" : "#AEAEA6", paddingRight: "4px" }}>
        {hasSelection ? `${count} selected` : "Select tasks…"}
      </span>

      {/* Move to → dropdown */}
      <div ref={moveRef} style={{ position: "relative" }}>
        <button
          onClick={() => { if (hasSelection) setMoveOpen((o) => !o); }}
          disabled={!hasSelection}
          style={{
            fontSize: "12px", fontWeight: 600, padding: "5px 10px", borderRadius: "6px",
            border: "1px solid #EBEBEA",
            backgroundColor: hasSelection ? "#FAFAF9" : "#F5F5F3",
            color: hasSelection ? "#4A4A46" : "#C4C4C0",
            cursor: hasSelection ? "pointer" : "not-allowed", fontFamily: "inherit",
            transition: "background-color 0.1s, color 0.1s",
          }}
          onMouseEnter={(e) => { if (hasSelection) { e.currentTarget.style.backgroundColor = "#EBEBEA"; e.currentTarget.style.color = "#1A1A1A"; } }}
          onMouseLeave={(e) => { if (hasSelection) { e.currentTarget.style.backgroundColor = "#FAFAF9"; e.currentTarget.style.color = "#4A4A46"; } }}
        >Move to ▾</button>
        {moveOpen && (
          <div style={{
            position: "absolute", bottom: "calc(100% + 6px)", left: 0,
            backgroundColor: "#FFFFFF", borderRadius: "8px", border: "1px solid #EBEBEA",
            boxShadow: "0 4px 16px rgba(0,0,0,0.1)", padding: "4px", zIndex: 100, minWidth: "140px",
          }}>
            {destinations.map((d) => (
              <div key={d.key}
                onClick={() => {
                  setMoveOpen(false);
                  if (d.key === "future") {
                    setFutureDateOpen(true);
                  } else {
                    onMove(d.key);
                  }
                }}
                style={{ fontSize: "12px", fontWeight: 500, padding: "6px 10px", borderRadius: "5px", cursor: "pointer", color: "#4A4A46", transition: "background-color 0.1s" }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#F5F5F3"; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
              >{d.label}</div>
            ))}
          </div>
        )}
      </div>

      {/* Inline Future date picker */}
      {futureDateOpen && (
        <div ref={futureRef} style={{
          display: "flex", alignItems: "center", gap: "6px",
          backgroundColor: "#F5F5F3", padding: "4px 8px", borderRadius: "6px",
          border: "1px solid #EBEBEA",
        }}>
          <span style={{ fontSize: "11px", color: "#8A8A86", fontWeight: 500 }}>Date</span>
          <input type="date" value={futureDate} onChange={(e) => setFutureDate(e.target.value)} min={(() => {
            // Future requires a date strictly after currentDay
            const d = new Date((currentDay || getTodayStr()) + "T12:00:00");
            d.setDate(d.getDate() + 1);
            return d.toISOString().split("T")[0];
          })()}
            style={{ fontSize: "12px", border: "none", outline: "none", backgroundColor: "transparent", fontFamily: "inherit", color: "#1A1A1A", padding: "2px 0" }}
          />
          <button
            onClick={() => {
              if (!hasSelection) return;
              if (!futureDate || futureDate <= (currentDay || getTodayStr())) return;
              onMoveFuture(futureDate);
              setFutureDateOpen(false);
            }}
            style={{ fontSize: "11px", fontWeight: 600, padding: "3px 8px", borderRadius: "5px", border: "none", backgroundColor: "#1A1A1A", color: "#FFFFFF", cursor: "pointer", fontFamily: "inherit" }}
          >Move</button>
          <button
            onClick={() => setFutureDateOpen(false)}
            style={{ fontSize: "11px", fontWeight: 500, padding: "3px 6px", borderRadius: "5px", border: "none", backgroundColor: "transparent", color: "#8A8A86", cursor: "pointer", fontFamily: "inherit" }}
          >✕</button>
        </div>
      )}

      {/* Delete */}
      <button
        onClick={() => { if (hasSelection) onDelete(); }}
        disabled={!hasSelection}
        style={{
          fontSize: "12px", fontWeight: 600, padding: "5px 10px", borderRadius: "6px",
          border: "1px solid #EBEBEA",
          backgroundColor: hasSelection ? "#FAFAF9" : "#F5F5F3",
          color: hasSelection ? "#DC2626" : "#C4C4C0",
          cursor: hasSelection ? "pointer" : "not-allowed", fontFamily: "inherit",
          transition: "background-color 0.1s",
        }}
        onMouseEnter={(e) => { if (hasSelection) e.currentTarget.style.backgroundColor = "#FEE2E2"; }}
        onMouseLeave={(e) => { if (hasSelection) e.currentTarget.style.backgroundColor = "#FAFAF9"; }}
      >Delete</button>

      {/* Cancel */}
      <button
        onClick={onCancel}
        style={{
          fontSize: "12px", fontWeight: 600, padding: "5px 10px", borderRadius: "6px",
          border: "1px solid #EBEBEA", backgroundColor: "#FAFAF9", color: "#8A8A86",
          cursor: "pointer", fontFamily: "inherit", transition: "background-color 0.1s",
        }}
        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#EBEBEA"; e.currentTarget.style.color = "#5A5A56"; }}
        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "#FAFAF9"; e.currentTarget.style.color = "#8A8A86"; }}
      >Cancel</button>
    </div>
  );
}

/* ═══════════════════════════════════════════
   TASK ITEM
   ═══════════════════════════════════════════ */

function TaskItem({ task, categories, currentDay, onToggle, onChangeTag, onEditTask, onDeleteTask, onCompleteOngoing, onSkipRecurring, onNavigateToRecurring, onMoveToTop, draggable, dragHandlers, moveBtn, isDragging, dropIndicator, selectMode, selected, onSelect, bulkDragCount }) {
  const [editing, setEditing] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [editTitle, setEditTitle] = useState(task.title);
  const [editDesc, setEditDesc] = useState(task.description);
  const [editDueDate, setEditDueDate] = useState(task.dueDate);
  const [editCompletedDate, setEditCompletedDate] = useState(task.completedDate ? task.completedDate.split("T")[0] : "");
  const [editOngoing, setEditOngoing] = useState(!!task.ongoing);
  const [editStatus, setEditStatus] = useState(task.status || "");
  const [editStatusNote, setEditStatusNote] = useState(task.statusNote || "");
  const initialReminderInputs = () => (Array.isArray(task.reminders) ? task.reminders.map(reminderToInput) : []);
  const [editReminders, setEditReminders] = useState(initialReminderInputs);
  const taskRef = useRef(null);
  const editTitleRef = useRef(editTitle);
  const editDescRef = useRef(editDesc);
  const editDueDateRef = useRef(editDueDate);
  const editCompletedDateRef = useRef(editCompletedDate);
  const editOngoingRef = useRef(editOngoing);
  const editStatusRef = useRef(editStatus);
  const editStatusNoteRef = useRef(editStatusNote);
  const editRemindersRef = useRef(editReminders);
  editRemindersRef.current = editReminders;
  // Only write reminders when they were actually changed in the editor, so
  // reminder times set elsewhere (e.g. by Task Tracker) keep their exact text.
  const reminderUpdates = (inputs) => (JSON.stringify(inputs) === JSON.stringify(initialReminderInputs()) ? {} : { reminders: remindersFromInputs(inputs) });
  editTitleRef.current = editTitle;
  editDescRef.current = editDesc;
  editDueDateRef.current = editDueDate;
  editCompletedDateRef.current = editCompletedDate;
  editOngoingRef.current = editOngoing;
  editStatusRef.current = editStatus;
  editStatusNoteRef.current = editStatusNote;

  const lifeVal = getTagValue(categories, "life", task.tags?.life);
  const eisenhowerVal = getTagValue(categories, "eisenhower", task.tags?.eisenhower);
  const projectVal = getTagValue(categories, "project", task.tags?.project);

  // Close editing on outside click
  useState(() => {
    const handler = (e) => {
      if (taskRef.current && !taskRef.current.contains(e.target)) {
        setEditing((prev) => {
          if (prev && onEditTask) {
            const cd = editCompletedDateRef.current;
            const newDueDate = editDueDateRef.current;
            const isOngoing = editOngoingRef.current;
            const updates = {
              title: editTitleRef.current.trim() || task.title,
              description: editDescRef.current.trim(),
              dueDate: isOngoing ? "" : newDueDate,
              completedDate: cd ? cd + "T12:00:00.000Z" : null,
              completed: !!cd,
              ongoing: isOngoing,
              status: editStatusRef.current || null,
              statusNote: editStatusRef.current === "waiting" ? editStatusNoteRef.current.trim() : "",
              ...reminderUpdates(editRemindersRef.current),
            };
            // Only track due date changes for non-ongoing tasks
            if (!isOngoing && newDueDate !== task.dueDate) {
              const history = task.dueDateHistory || [];
              updates.dueDateHistory = [...history, { from: task.dueDate, to: newDueDate, changedAt: nowTimestamp() }];
            }
            if (!task.originalDueDate && task.dueDate) {
              updates.originalDueDate = task.dueDate;
            }
            onEditTask(task.id, updates);
          }
          return false;
        });
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  });

  const handleDoubleClick = (e) => {
    if (e.target.tagName === "INPUT" || e.target.tagName === "BUTTON" || e.target.tagName === "SELECT") return;
    setEditing(true);
    setEditTitle(task.title);
    setEditDesc(task.description);
    setEditDueDate(task.dueDate);
    setEditCompletedDate(task.completedDate ? task.completedDate.split("T")[0] : "");
    setEditOngoing(!!task.ongoing);
    setEditStatus(task.status || "");
    setEditStatusNote(task.statusNote || "");
    setEditReminders(initialReminderInputs());
  };

  const buildSaveUpdates = () => {
    const cd = editCompletedDate;
    const isOngoing = editOngoing;
    const updates = {
      title: editTitle.trim() || task.title,
      description: editDesc.trim(),
      dueDate: isOngoing ? "" : editDueDate,
      completedDate: cd ? cd + "T12:00:00.000Z" : null,
      completed: !!cd,
      ongoing: isOngoing,
      status: editStatus || null,
      statusNote: editStatus === "waiting" ? editStatusNote.trim() : "",
      ...reminderUpdates(editReminders),
    };
    // Track due date changes (only for non-ongoing)
    if (!isOngoing && editDueDate !== task.dueDate) {
      const history = task.dueDateHistory || [];
      updates.dueDateHistory = [...history, { from: task.dueDate, to: editDueDate, changedAt: nowTimestamp() }];
    }
    // Ensure originalDueDate exists
    if (!task.originalDueDate && task.dueDate) {
      updates.originalDueDate = task.dueDate;
    }
    // Initialize ongoing fields if newly marked as ongoing
    if (isOngoing && !task.ongoing) {
      updates.ongoingCompletions = task.ongoingCompletions || [];
      updates.ongoingCompleted = false;
      updates.ongoingCompletedDate = null;
      updates.ongoingOrder = task.ongoingOrder ?? 0;
    }
    return updates;
  };

  const handleSave = () => {
    if (onEditTask) onEditTask(task.id, buildSaveUpdates());
    setEditing(false);
  };
  const handleCancel = () => {
    setEditTitle(task.title); setEditDesc(task.description); setEditDueDate(task.dueDate);
    setEditCompletedDate(task.completedDate ? task.completedDate.split("T")[0] : "");
    setEditOngoing(!!task.ongoing);
    setEditStatus(task.status || "");
    setEditStatusNote(task.statusNote || "");
    setEditReminders(initialReminderInputs());
    setEditing(false);
  };
  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSave(); }
    if (e.key === "Escape") handleCancel();
  };

  return (
    <div
      ref={taskRef}
      draggable={draggable && !editing}
      onDragStart={dragHandlers?.onDragStart(task.id)}
      onDragEnd={dragHandlers?.onDragEnd}
      onDragOver={dragHandlers?.onDragOver(task.id)}
      onDragLeave={dragHandlers?.onDragLeave(task.id)}
      onDoubleClick={handleDoubleClick}
      onClick={(e) => {
        if (!selectMode || editing) return;
        // Don't toggle selection when clicking the checkbox, buttons, inputs, or interactive elements
        const tag = e.target.tagName;
        if (tag === "INPUT" || tag === "BUTTON" || tag === "SELECT" || tag === "TEXTAREA" || tag === "A") return;
        if (e.target.closest("[data-no-select-toggle]")) return;
        if (onSelect) onSelect(task.id);
      }}
      style={{
        padding: "14px 16px",
        borderBottom: "1px solid #F1F1F0",
        opacity: task.completed ? 0.45 : isDragging ? 0.95 : 1,
        cursor: selectMode && !editing ? "pointer" : draggable && !editing ? "grab" : "default",
        transition: isDragging ? "none" : "background-color 0.15s, box-shadow 0.15s, transform 0.15s",
        backgroundColor: isDragging ? "#F0F0EC" : selected ? "#F0F4FF" : editing ? "#FAFAF9" : "transparent",
        boxShadow: isDragging ? "0 4px 16px rgba(0,0,0,0.1)" : "none",
        transform: isDragging ? "scale(1.02)" : "none",
        zIndex: isDragging ? 10 : "auto",
        position: "relative",
        borderTop: dropIndicator === "above" ? "2px solid #1A1A1A" : undefined,
        borderLeft: selected ? "3px solid #4F46E5" : "3px solid transparent",
        paddingLeft: "13px",
        borderBottomWidth: dropIndicator === "below" ? "2px" : undefined,
        borderBottomColor: dropIndicator === "below" ? "#1A1A1A" : undefined,
        borderBottomStyle: dropIndicator === "below" ? "solid" : undefined,
      }}
      onMouseEnter={(e) => { if (!task.completed && !editing && !isDragging && !selected) e.currentTarget.style.backgroundColor = selectMode ? "#F8F9FC" : "#FCFCFB"; }}
      onMouseLeave={(e) => { if (!editing && !isDragging) e.currentTarget.style.backgroundColor = selected ? "#F0F4FF" : "transparent"; }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
        {draggable && !selectMode && (
          <span style={{ color: "#C4C4C0", fontSize: "14px", marginTop: "2px", userSelect: "none", cursor: editing ? "default" : "grab" }}>⠿</span>
        )}
        {selectMode && selected && (
          <span style={{ color: "#4F46E5", fontSize: "14px", marginTop: "2px", userSelect: "none", cursor: editing ? "default" : "grab" }} title="Drag to move selected tasks together">⠿</span>
        )}
        {selectMode && !selected && (
          // Placeholder grip on non-selected rows in select mode — kept very faint
          // so the rows still align horizontally with selected ones.
          <span aria-hidden="true" style={{ color: "#EBEBEA", fontSize: "14px", marginTop: "2px", userSelect: "none", cursor: "default" }}>⠿</span>
        )}
        <input type="checkbox" checked={task.completed} onChange={() => onToggle(task.id)} onClick={(e) => e.stopPropagation()}
          data-no-select-toggle
          style={{ width: "18px", height: "18px", marginTop: "2px", accentColor: "#3B3B3B", cursor: "pointer", flexShrink: 0 }}
        />
        {!editing && !selectMode && onMoveToTop && (
          <button
            data-move-btn
            onClick={() => onMoveToTop(task.id)}
            title="Move to top"
            style={{
              fontSize: "13px", fontWeight: 600, padding: "2px 5px", borderRadius: "5px",
              border: "1px solid transparent", backgroundColor: "transparent", color: "#C4C4C0",
              cursor: "pointer", fontFamily: "inherit", opacity: 0, transition: "opacity 0.15s, color 0.1s, border-color 0.1s",
              flexShrink: 0, marginTop: "1px", lineHeight: 1,
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "#8A8A86"; e.currentTarget.style.borderColor = "#EBEBEA"; e.currentTarget.style.backgroundColor = "#FAFAF9"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "#C4C4C0"; e.currentTarget.style.borderColor = "transparent"; e.currentTarget.style.backgroundColor = "transparent"; }}
          >↑</button>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          {editing ? (
            <input type="text" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} onKeyDown={handleKeyDown} autoFocus
              style={{ width: "100%", fontSize: "15px", fontWeight: 500, color: "#1A1A1A", border: "none", outline: "none", backgroundColor: "transparent", fontFamily: "inherit", padding: 0, lineHeight: 1.4 }}
            />
          ) : (
            <>
              <div style={{ fontSize: "15px", fontWeight: 500, color: "#1A1A1A", textDecoration: task.completed ? "line-through" : "none", lineHeight: 1.4, display: "flex", alignItems: "center", gap: "8px" }}>
                <span>{task.title}</span>
                {Array.isArray(task.reminders) && task.reminders.length > 0 && (
                  <span data-testid="reminder-bell" title={"Reminders:\n" + task.reminders.map(formatReminder).join("\n")}
                    style={{ fontSize: "11px", fontWeight: 600, color: "#8A8A86", whiteSpace: "nowrap", flexShrink: 0 }}>🔔 {task.reminders.length}</span>
                )}
                {isDragging && bulkDragCount > 1 && (
                  <span style={{ fontSize: "10px", fontWeight: 700, padding: "2px 7px", borderRadius: "10px", backgroundColor: "#4F46E5", color: "#FFFFFF", display: "inline-block" }}>
                    +{bulkDragCount - 1} more
                  </span>
                )}
              </div>
              {(() => {
                if (task.completed || task.deleted) return null;
                const due = task.dueDate;
                const today = currentDay || getTodayStr();
                if (!due || due >= today) return null;
                const days = Math.round((new Date(today + "T12:00:00") - new Date(due + "T12:00:00")) / (1000 * 60 * 60 * 24));
                if (days <= 0) return null;
                return (
                  <span style={{
                    fontSize: "10px", fontWeight: 600, padding: "1px 6px", borderRadius: "3px",
                    backgroundColor: "#FEE2E2", color: "#DC2626", display: "inline-block", marginTop: "3px", marginRight: "6px",
                  }}>{days}d overdue</span>
                );
              })()}
              {task.description && <div style={{ fontSize: "13px", color: "#8A8A86", marginTop: "2px", lineHeight: 1.4 }}>{task.description}</div>}
              {task.dueDateHistory && task.dueDateHistory.length > 0 && (
                <div style={{ fontSize: "11px", color: "#B45309", fontWeight: 500, marginTop: "3px" }}>
                  Due date changed {task.dueDateHistory.length} time{task.dueDateHistory.length !== 1 ? "s" : ""}
                  {(() => {
                    const orig = task.originalDueDate;
                    const current = task.dueDate;
                    if (!orig || !current || orig === current) return null;
                    const drift = Math.round((new Date(current + "T12:00:00") - new Date(orig + "T12:00:00")) / (1000 * 60 * 60 * 24));
                    if (drift === 0) return null;
                    return <span style={{ color: "#AEAEA6", fontWeight: 500 }}> · {drift > 0 ? "+" : ""}{drift}d from original</span>;
                  })()}
                </div>
              )}
              {task.ongoing && (
                <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "3px" }}>
                  <span style={{ fontSize: "10px", fontWeight: 600, padding: "1px 6px", borderRadius: "3px", backgroundColor: "#F3E8FF", color: "#7C3AED", display: "inline-block" }}>Ongoing</span>
                  {task.ongoingCompletions && task.ongoingCompletions.length > 0 && (
                    <span style={{ fontSize: "11px", color: "#7C3AED", fontWeight: 500 }}>
                      Worked on {task.ongoingCompletions.length} time{task.ongoingCompletions.length !== 1 ? "s" : ""}
                    </span>
                  )}
                </div>
              )}
              {task.status === "waiting" && !task.completed && !task.deleted && (
                <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "3px" }}>
                  <span style={{ fontSize: "10px", fontWeight: 600, padding: "1px 6px", borderRadius: "3px", backgroundColor: "#FEF3C7", color: "#D97706", display: "inline-block" }}>⏳ Waiting</span>
                  {task.statusNote && (
                    <span style={{ fontSize: "11px", color: "#D97706", fontWeight: 500 }}>{task.statusNote}</span>
                  )}
                </div>
              )}
              {task.recurringParentId && !task.completed && !task.deleted && (
                <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "3px" }}>
                  <span style={{ fontSize: "10px", fontWeight: 600, padding: "1px 6px", borderRadius: "3px", backgroundColor: "#E0F2FE", color: "#0369A1", display: "inline-block" }}>↻ Recurring</span>
                  {(() => {
                    // Drift indicator for rolled-forward recurring instances.
                    // dueDateHistory isn't populated for roll-forward (the plan calls for
                    // a silent dueDate update), so we surface drift via originalDueDate.
                    const orig = task.originalDueDate;
                    const due = task.dueDate;
                    if (!orig || !due || orig === due) return null;
                    const drift = Math.round((new Date(due + "T12:00:00") - new Date(orig + "T12:00:00")) / (1000 * 60 * 60 * 24));
                    if (drift <= 0) return null;
                    return (
                      <span title={`Originally due ${formatDate(orig)}`}
                        style={{ fontSize: "10px", fontWeight: 600, padding: "1px 6px", borderRadius: "3px", backgroundColor: "#FEF3C7", color: "#92400E", display: "inline-block" }}>
                        Rolled over +{drift}d
                      </span>
                    );
                  })()}
                  {task.recurringMissedStreak > 0 && (
                    <span style={{ fontSize: "10px", fontWeight: 600, padding: "1px 6px", borderRadius: "3px", backgroundColor: "#FEE2E2", color: "#DC2626", display: "inline-block" }}>
                      Missed last {task.recurringMissedStreak}
                    </span>
                  )}
                  {onSkipRecurring && task.recurringStatus === "pending" && (
                    <button data-move-btn onClick={(e) => { e.stopPropagation(); onSkipRecurring(task.id); }}
                      style={{ fontSize: "10px", fontWeight: 600, padding: "1px 6px", borderRadius: "3px", border: "1px solid #EBEBEA", backgroundColor: "#FAFAF9", color: "#8A8A86", cursor: "pointer", fontFamily: "inherit", opacity: 0, transition: "opacity 0.15s" }}
                    >Skip</button>
                  )}
                </div>
              )}
            </>
          )}
        </div>
        {!editing && !selectMode && moveBtn}
        {!editing && projectVal && (
          selectMode ? (
            <span style={{ marginTop: "2px", flexShrink: 0 }}><TagBadge categories={categories} categoryId="project" valueId={task.tags?.project} /></span>
          ) : (
            <TagDropdown categories={categories} categoryId="project" currentValueId={task.tags?.project}
              onChange={(newVal) => onChangeTag && onChangeTag(task.id, "project", newVal)}
            />
          )
        )}
        {!editing && eisenhowerVal && (
          selectMode ? (
            <span style={{ marginTop: "2px", flexShrink: 0 }}><TagBadge categories={categories} categoryId="eisenhower" valueId={task.tags?.eisenhower} /></span>
          ) : (
            <TagDropdown categories={categories} categoryId="eisenhower" currentValueId={task.tags?.eisenhower}
              onChange={(newVal) => onChangeTag && onChangeTag(task.id, "eisenhower", newVal)}
            />
          )
        )}
        {!editing && lifeVal && (
          selectMode ? (
            <span style={{ marginTop: "2px", flexShrink: 0 }}><TagBadge categories={categories} categoryId="life" valueId={task.tags?.life} /></span>
          ) : (
            <TagDropdown categories={categories} categoryId="life" currentValueId={task.tags?.life}
              onChange={(newVal) => onChangeTag && onChangeTag(task.id, "life", newVal)}
            />
          )
        )}
      </div>

      {/* Edit panel */}
      {editing && (
        <div style={{ marginLeft: draggable ? "48px" : "30px", marginTop: "10px", display: "flex", flexDirection: "column", gap: "8px" }}>
          <input type="text" value={editDesc} onChange={(e) => setEditDesc(e.target.value)} onKeyDown={handleKeyDown} placeholder="Description..."
            style={{ width: "100%", fontSize: "13px", color: "#6B6B67", border: "none", outline: "none", backgroundColor: "transparent", fontFamily: "inherit", padding: 0, lineHeight: 1.4, boxSizing: "border-box" }}
          />
          <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
            {categories.map((cat) => (
              <select key={cat.id} value={task.tags?.[cat.id] || ""}
                onChange={(e) => onChangeTag && onChangeTag(task.id, cat.id, e.target.value || null)}
                style={editFieldStyle}
              >
                <option value="">— {cat.name} —</option>
                {cat.values.map((v) => <option key={v.id} value={v.id}>{v.display === "emoji" ? `${v.emoji} ` : ""}{v.label}</option>)}
              </select>
            ))}
            <div style={{ ...editFieldStyle, display: "flex", alignItems: "center", gap: "4px", padding: "0 8px" }}>
              <span style={{ fontSize: "11px", color: "#AEAEA6" }}>Due</span>
              <input type="date" value={editDueDate} onChange={(e) => setEditDueDate(e.target.value)} disabled={editOngoing}
                style={{ fontSize: "12px", border: "none", outline: "none", backgroundColor: "transparent", fontFamily: "inherit", color: "#6B6B67", padding: "4px 0", opacity: editOngoing ? 0.4 : 1 }}
              />
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "12px", fontWeight: 500, color: task.recurringParentId ? "#D4D4D0" : "#6B6B67", cursor: task.recurringParentId ? "not-allowed" : "pointer", userSelect: "none" }}>
              <input type="checkbox" checked={editOngoing} disabled={!!task.recurringParentId} onChange={(e) => {
                const nowOngoing = e.target.checked;
                setEditOngoing(nowOngoing);
                if (!nowOngoing && !editDueDate) {
                  setEditDueDate(currentDay || getTodayStr());
                }
              }}
                style={{ width: "14px", height: "14px", accentColor: "#7C3AED", cursor: task.recurringParentId ? "not-allowed" : "pointer" }} />
              Ongoing
            </label>
            <div style={{ ...editFieldStyle, display: "flex", alignItems: "center", gap: "4px", padding: "0 8px" }}>
              <span style={{ fontSize: "11px", color: "#AEAEA6" }}>Completed</span>
              <input type="date" value={editCompletedDate} onChange={(e) => setEditCompletedDate(e.target.value)}
                style={{ fontSize: "12px", border: "none", outline: "none", backgroundColor: "transparent", fontFamily: "inherit", color: editCompletedDate ? "#059669" : "#6B6B67", padding: "4px 0" }}
              />
              {editCompletedDate && (
                <button onClick={() => setEditCompletedDate("")}
                  style={{ fontSize: "10px", border: "none", backgroundColor: "transparent", color: "#AEAEA6", cursor: "pointer", fontFamily: "inherit", padding: "0 2px" }}
                  title="Clear completed date"
                >✕</button>
              )}
            </div>
            <select value={editStatus} onChange={(e) => setEditStatus(e.target.value)}
              style={{ ...editFieldStyle, color: editStatus === "waiting" ? "#D97706" : "#6B6B67" }}>
              <option value="">— Status —</option>
              <option value="waiting">⏳ Waiting</option>
            </select>
            {editStatus === "waiting" && (
              <input type="text" value={editStatusNote} onChange={(e) => setEditStatusNote(e.target.value)} onKeyDown={handleKeyDown} placeholder="Waiting on..."
                style={{ ...editFieldStyle, flex: "1 1 120px", minWidth: "120px", color: "#D97706" }}
              />
            )}
          </div>
          <ReminderEditor values={editReminders} onChange={setEditReminders} defaultDate={editDueDate} />
          <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
            {task.createdDate && <span style={{ fontSize: "11px", color: "#C4C4C0" }}>Created {formatDate(task.createdDate)}</span>}
            {task.dayOrder != null && <span style={{ fontSize: "11px", color: "#C4C4C0" }}>· Priority #{task.dayOrder}</span>}
            {task.originalDueDate && <span style={{ fontSize: "11px", color: "#C4C4C0" }}>· Original due {formatDate(task.originalDueDate)}</span>}
            {task.dueDateHistory && task.dueDateHistory.length > 0 && (
              <span
                onClick={() => setShowHistory((s) => !s)}
                style={{ fontSize: "11px", color: "#B45309", cursor: "pointer", fontWeight: 500 }}
              >· Due date changed {task.dueDateHistory.length} time{task.dueDateHistory.length !== 1 ? "s" : ""}
              {(() => {
                const orig = task.originalDueDate;
                const current = task.dueDate;
                if (!orig || !current || orig === current) return null;
                const drift = Math.round((new Date(current + "T12:00:00") - new Date(orig + "T12:00:00")) / (1000 * 60 * 60 * 24));
                if (drift === 0) return null;
                return <span style={{ color: "#AEAEA6", fontWeight: 500 }}> · {drift > 0 ? "+" : ""}{drift}d from original</span>;
              })()}
              {" "}{showHistory ? "▾" : "▸"}</span>
            )}
          </div>
          {showHistory && task.dueDateHistory && task.dueDateHistory.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "2px", padding: "4px 0" }}>
              {task.dueDateHistory.map((h, i) => (
                <span key={i} style={{ fontSize: "10px", color: "#AEAEA6" }}>
                  {formatDateShort(h.from)} → {formatDateShort(h.to)} · {formatDate(h.changedAt)}
                </span>
              ))}
            </div>
          )}
          {task.ongoing && task.ongoingCompletions && task.ongoingCompletions.length > 0 && (
            <div style={{ fontSize: "11px", color: "#7C3AED", fontWeight: 500 }}>
              Worked on {task.ongoingCompletions.length} time{task.ongoingCompletions.length !== 1 ? "s" : ""} · Last: {formatDate(task.ongoingCompletions[task.ongoingCompletions.length - 1].completedAt)}
            </div>
          )}
          {task.recurringParentId && onNavigateToRecurring && (
            <div style={{ marginTop: "2px" }}>
              <span onClick={() => { onNavigateToRecurring(task.recurringParentId); setEditing(false); }}
                style={{ fontSize: "11px", fontWeight: 500, color: "#0369A1", cursor: "pointer", borderBottom: "1px dashed #0369A140" }}
                onMouseEnter={(e) => { e.currentTarget.style.color = "#0C4A6E"; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = "#0369A1"; }}
              >Edit recurring rule →</span>
            </div>
          )}
          <div style={{ display: "flex", gap: "6px", alignItems: "center", marginTop: "2px" }}>
            <button onClick={() => { if (onDeleteTask) onDeleteTask(task.id); setEditing(false); }}
              style={{ fontSize: "12px", fontWeight: 600, padding: "4px 10px", borderRadius: "6px", border: "1px solid #FECACA", backgroundColor: "transparent", color: "#DC2626", cursor: "pointer", fontFamily: "inherit", transition: "background-color 0.1s" }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#FEF2F2"; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
            >Delete</button>
            {task.ongoing && onCompleteOngoing && (
              <button onClick={() => { onCompleteOngoing(); setEditing(false); }}
                style={{ fontSize: "12px", fontWeight: 600, padding: "4px 10px", borderRadius: "6px", border: "1px solid #BBF7D0", backgroundColor: "transparent", color: "#059669", cursor: "pointer", fontFamily: "inherit", transition: "background-color 0.1s" }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#ECFDF5"; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
              >Complete Project</button>
            )}
            <div style={{ flex: 1 }} />
            <button onClick={handleCancel} style={{ fontSize: "12px", fontWeight: 600, padding: "4px 10px", borderRadius: "6px", border: "none", backgroundColor: "transparent", color: "#AEAEA6", cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
            <button onClick={handleSave} style={{ fontSize: "12px", fontWeight: 600, padding: "4px 10px", borderRadius: "6px", border: "none", backgroundColor: "#1A1A1A", color: "#FFF", cursor: "pointer", fontFamily: "inherit" }}>Save</button>
          </div>
        </div>
      )}
    </div>
  );
}

const editFieldStyle = {
  fontSize: "12px", fontWeight: 500, padding: "4px 8px", borderRadius: "6px",
  border: "1px solid #EBEBEA", backgroundColor: "#FFFFFF", color: "#6B6B67",
  fontFamily: "inherit", cursor: "pointer", outline: "none",
};

// Reminder times editor (v1.8.5): any number of Eastern date-times.
// `values` are datetime-local strings ("YYYY-MM-DDTHH:MM").
function ReminderEditor({ values, onChange, defaultDate }) {
  const today = easternWallClock(new Date()).slice(0, 10);
  return (
    <div data-testid="reminder-editor" style={{ display: "flex", gap: "6px", alignItems: "center", flexWrap: "wrap" }}>
      <span style={{ fontSize: "11px", color: "#AEAEA6" }}>🔔 Reminders</span>
      {values.map((v, i) => (
        <span key={i} style={{ ...editFieldStyle, display: "flex", alignItems: "center", gap: "2px", padding: "0 6px", cursor: "default" }}>
          <input type="datetime-local" data-testid="reminder-input" value={v}
            onChange={(e) => onChange(values.map((x, j) => (j === i ? e.target.value : x)))}
            style={{ fontSize: "12px", border: "none", outline: "none", backgroundColor: "transparent", fontFamily: "inherit", color: "#6B6B67", padding: "4px 0" }} />
          <button data-testid="reminder-remove" onClick={() => onChange(values.filter((_, j) => j !== i))} title="Remove reminder"
            style={{ fontSize: "10px", border: "none", backgroundColor: "transparent", color: "#AEAEA6", cursor: "pointer", fontFamily: "inherit", padding: "0 2px" }}>✕</button>
        </span>
      ))}
      <button data-testid="reminder-add" onClick={() => onChange([...values, `${defaultDate || today}T09:00`])}
        style={{ ...editFieldStyle, color: "#8A8A86" }}>+ Add time</button>
      {values.length > 0 && <span style={{ fontSize: "10px", color: "#C4C4C0" }}>Eastern time · Task Tracker sends the ping</span>}
    </div>
  );
}

/* ═══════════════════════════════════════════
   SECTION HEADER
   ═══════════════════════════════════════════ */

function SectionHeader({ title, count, children }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 16px", marginBottom: "4px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <h2 style={{ fontSize: "13px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#8A8A86", margin: 0 }}>{title}</h2>
        <span style={{ fontSize: "11px", fontWeight: 600, color: "#B0B0AC", backgroundColor: "#F5F5F3", padding: "1px 7px", borderRadius: "10px" }}>{count}</span>
      </div>
      {children}
    </div>
  );
}

/* ═══════════════════════════════════════════
   NEW TASK FORM
   ═══════════════════════════════════════════ */

function NewTaskForm({ categories, setCategories, onAdd, defaultDueDate, submitLabel = "Add task", alwaysExpanded = false }) {
  const initialDueDate = defaultDueDate !== undefined ? defaultDueDate : getTodayStr();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState({});
  const [dueDate, setDueDate] = useState(initialDueDate);
  const [ongoing, setOngoing] = useState(false);
  const [reminders, setReminders] = useState([]);
  const [showDetails, setShowDetails] = useState(!!alwaysExpanded);
  const [addingProject, setAddingProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectColors, setNewProjectColors] = useState(randomTagColors());
  const formRef = useRef(null);
  const titleRef = useRef(null);

  // v1.7.3: Re-anchor the default due date when it changes (e.g. after New Day),
  // but only for a pristine form — never clobber a due date the user is mid-entry.
  useEffect(() => {
    const pristine = !title.trim() && !description.trim() && Object.keys(tags).length === 0 && !ongoing;
    if (pristine) setDueDate(defaultDueDate !== undefined ? defaultDueDate : getTodayStr());
  }, [defaultDueDate]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleAdd = () => {
    if (!title.trim()) return;
    onAdd({ id: generateId(), title: title.trim(), description: description.trim(), tags: { ...tags }, dueDate: ongoing ? "" : dueDate, originalDueDate: ongoing ? "" : dueDate, dueDateHistory: [], createdDate: nowTimestamp(), completedDate: null, completed: false, ongoing, ongoingCompletions: [], ongoingCompleted: false, ongoingCompletedDate: null, ongoingOrder: 0, reminders: remindersFromInputs(reminders) });
    setTitle(""); setDescription(""); setTags({}); setDueDate(initialDueDate); setOngoing(false); setReminders([]);
    if (alwaysExpanded) { setTimeout(() => titleRef.current?.focus(), 0); }
    else setShowDetails(false);
  };
  const handleKeyDown = (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleAdd(); } };
  const handleBlur = () => {
    if (alwaysExpanded) return;
    setTimeout(() => {
      if (formRef.current && !formRef.current.contains(document.activeElement)) {
        if (!title.trim() && !description.trim() && Object.keys(tags).length === 0 && reminders.length === 0) setShowDetails(false);
      }
    }, 0);
  };

  return (
    <div ref={formRef} onBlur={handleBlur} style={{ backgroundColor: "#FFFFFF", borderRadius: "12px", border: "1px solid #EBEBEA", padding: "16px", marginBottom: "24px" }}>
      <input type="text" ref={titleRef} placeholder="New task title..." value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={handleKeyDown} onFocus={() => setShowDetails(true)}
        style={{ width: "100%", fontSize: "15px", fontWeight: 500, border: "none", outline: "none", color: "#1A1A1A", fontFamily: "inherit", marginBottom: showDetails ? "8px" : "0", boxSizing: "border-box", backgroundColor: "transparent" }}
      />
      {showDetails && (
        <>
          <input type="text" placeholder="Description (optional)" value={description} onChange={(e) => setDescription(e.target.value)} onKeyDown={handleKeyDown}
            style={{ width: "100%", fontSize: "13px", border: "none", outline: "none", color: "#6B6B67", fontFamily: "inherit", marginBottom: "12px", boxSizing: "border-box", backgroundColor: "transparent" }}
          />
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
            {categories.map((cat) => {
              // For the project category, apply soft filtering by life category
              if (cat.id === "project") {
                const selectedLife = tags.life || null;
                const matchingProjects = selectedLife ? cat.values.filter((v) => v.lifeCategoryId === selectedLife) : [];
                const otherProjects = selectedLife ? cat.values.filter((v) => v.lifeCategoryId !== selectedLife) : cat.values;
                return (
                  <React.Fragment key={cat.id}>
                    <select value={tags[cat.id] || ""} onChange={(e) => {
                      if (e.target.value === "__new__") { setAddingProject(true); setNewProjectName(""); setNewProjectColors(randomTagColors()); }
                      else setTags((prev) => ({ ...prev, [cat.id]: e.target.value || null }));
                    }} style={pillSelectStyle}>
                      <option value="">— {cat.name} —</option>
                      {matchingProjects.length > 0 && matchingProjects.map((v) => (
                        <option key={v.id} value={v.id}>{v.label}</option>
                      ))}
                      {matchingProjects.length > 0 && otherProjects.length > 0 && (
                        <option disabled>────────</option>
                      )}
                      {otherProjects.map((v) => (
                        <option key={v.id} value={v.id}>{v.label}</option>
                      ))}
                      <option disabled>────────</option>
                      <option value="__new__">+ New Project</option>
                    </select>
                    {addingProject && (
                      <div style={{ display: "flex", gap: "4px", alignItems: "center", padding: "2px 0" }}>
                        <input type="text" value={newProjectName} onChange={(e) => setNewProjectName(e.target.value)} autoFocus placeholder="Project name..."
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && newProjectName.trim()) {
                              e.preventDefault();
                              const newId = generateId();
                              const newVal = { id: newId, label: newProjectName.trim(), previewLabel: newProjectName.trim(), display: "color", bg: newProjectColors.bg, text: newProjectColors.text, lifeCategoryId: tags.life || null };
                              setCategories((prev) => prev.map((c) => c.id === "project" ? { ...c, values: [...c.values, newVal] } : c));
                              setTags((prev) => ({ ...prev, project: newId }));
                              setAddingProject(false);
                            }
                            if (e.key === "Escape") setAddingProject(false);
                          }}
                          style={{ fontSize: "12px", fontWeight: 500, padding: "4px 8px", borderRadius: "5px", border: "1px solid #EBEBEA", outline: "none", fontFamily: "inherit", color: "#1A1A1A", width: "130px" }}
                        />
                        <span style={{ display: "inline-block", width: "16px", height: "16px", borderRadius: "3px", backgroundColor: newProjectColors.bg, border: `1px solid ${newProjectColors.text}44`, flexShrink: 0 }} />
                        <button onClick={() => setNewProjectColors(randomTagColors())} title="Random colors"
                          style={{ fontSize: "12px", lineHeight: 1, padding: "2px 4px", borderRadius: "3px", border: "1px solid #EBEBEA", backgroundColor: "#FAFAF9", cursor: "pointer" }}>🎲</button>
                        <button onClick={() => {
                          if (!newProjectName.trim()) return;
                          const newId = generateId();
                          const newVal = { id: newId, label: newProjectName.trim(), previewLabel: newProjectName.trim(), display: "color", bg: newProjectColors.bg, text: newProjectColors.text, lifeCategoryId: tags.life || null };
                          setCategories((prev) => prev.map((c) => c.id === "project" ? { ...c, values: [...c.values, newVal] } : c));
                          setTags((prev) => ({ ...prev, project: newId }));
                          setAddingProject(false);
                        }} style={{ fontSize: "11px", fontWeight: 600, padding: "3px 8px", borderRadius: "5px", border: "none", backgroundColor: newProjectName.trim() ? "#1A1A1A" : "#D4D4D0", color: "#FFF", cursor: newProjectName.trim() ? "pointer" : "not-allowed", fontFamily: "inherit" }}>Add</button>
                        <button onClick={() => setAddingProject(false)}
                          style={{ fontSize: "11px", fontWeight: 600, padding: "3px 6px", borderRadius: "5px", border: "none", backgroundColor: "transparent", color: "#AEAEA6", cursor: "pointer", fontFamily: "inherit" }}>✕</button>
                      </div>
                    )}
                  </React.Fragment>
                );
              }
              return (
                <select key={cat.id} value={tags[cat.id] || ""} onChange={(e) => setTags((prev) => ({ ...prev, [cat.id]: e.target.value || null }))} style={pillSelectStyle}>
                  <option value="">— {cat.name} —</option>
                  {cat.values.map((v) => <option key={v.id} value={v.id}>{v.display === "emoji" ? `${v.emoji} ` : ""}{v.label}</option>)}
                </select>
              );
            })}
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} disabled={ongoing} style={{ ...pillSelectStyle, width: "145px", opacity: ongoing ? 0.4 : 1 }} />
            <label style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "12px", fontWeight: 500, color: "#6B6B67", cursor: "pointer", userSelect: "none" }}>
              <input type="checkbox" checked={ongoing} onChange={(e) => setOngoing(e.target.checked)}
                style={{ width: "14px", height: "14px", accentColor: "#4F46E5", cursor: "pointer" }} />
              Ongoing
            </label>
            <div style={{ flex: 1 }} />
            <button onClick={() => { if (!alwaysExpanded) setShowDetails(false); setTitle(""); setDescription(""); setTags({}); setDueDate(initialDueDate); setReminders([]); }}
              style={{ ...pillBtnStyle, backgroundColor: "transparent", color: "#AEAEA6", border: "none" }}>{alwaysExpanded ? "Clear" : "Cancel"}</button>
            <button onClick={handleAdd}
              style={{ ...pillBtnStyle, backgroundColor: title.trim() ? "#1A1A1A" : "#D4D4D0", color: "#FFF", cursor: title.trim() ? "pointer" : "not-allowed" }}>{submitLabel}</button>
          </div>
          <div style={{ marginTop: "10px" }}>
            <ReminderEditor values={reminders} onChange={setReminders} defaultDate={ongoing ? "" : dueDate} />
          </div>
        </>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════
   MULTI-ADD STAGING PANEL (v1.8 Phase 2)
   ═══════════════════════════════════════════ */

// Mirror of addTask's routing, used only to label where a staged row will land.
// Kept in sync with NotebookTab.addTask by hand (both key off ongoing + dueDate).
function computeDestination(task, currentDay) {
  if (task.ongoing) return "Ongoing";
  if (!task.dueDate) return "Someday";
  if (task.dueDate === currentDay) return "Today";
  if (new Date(task.dueDate + "T12:00:00") > new Date(currentDay + "T12:00:00")) return "Future";
  return "Backlog";
}

const stagedChipStyle = { fontSize: "11px", fontWeight: 600, padding: "2px 8px", borderRadius: "10px", backgroundColor: "#F1F1F0", color: "#8A8A86", border: "1px solid #EBEBEA", whiteSpace: "nowrap", flexShrink: 0 };

// Staging panel that replaces the single-add NewTaskForm while in multi-add mode.
// Full-metadata input on top (a NewTaskForm configured to stage instead of commit),
// a reorderable staged list, then the commit / exit footer. Staged rows + the mode
// flag are lifted to TodoApp (Persistence Level A) so they survive tab switches.
function MultiAddPanel({ categories, setCategories, defaultDueDate, currentDay, stagedRows, setStagedRows, onCommit, onCancel }) {
  const stagedDrag = useDragReorder(stagedRows, setStagedRows);
  const nonBlankCount = stagedRows.filter((r) => r.title && r.title.trim()).length;
  const removeStaged = (id) => setStagedRows((prev) => prev.filter((r) => r.id !== id));

  return (
    <div style={{ marginBottom: "24px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
        <span style={{ fontSize: "13px", fontWeight: 600, color: "#6B6B67" }}>⊞ Add multiple tasks</span>
        <span style={{ fontSize: "11px", color: "#AEAEA6" }}>Add rows below, reorder, then commit</span>
      </div>

      <NewTaskForm
        categories={categories}
        setCategories={setCategories}
        onAdd={(task) => setStagedRows((prev) => [...prev, task])}
        defaultDueDate={defaultDueDate}
        submitLabel="Add to list"
        alwaysExpanded
      />

      <div style={{ fontSize: "11px", fontWeight: 600, color: "#8A8A86", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "6px" }}>
        Staged · {nonBlankCount}
      </div>
      <div style={{ backgroundColor: "#FFFFFF", borderRadius: "12px", border: "1px solid #EBEBEA" }}>
        {stagedRows.length === 0 ? (
          <div style={{ padding: "24px 16px", textAlign: "center", color: "#C4C4C0", fontSize: "13px" }}>
            No tasks staged yet — add one above.
          </div>
        ) : (
          stagedRows.map((row) => {
            const dest = computeDestination(row, currentDay);
            const isDragging = stagedDrag.dragId === row.id;
            const dropIndicator = stagedDrag.overId === row.id && stagedDrag.dragId !== row.id ? stagedDrag.dropSide : null;
            return (
              <div key={row.id}
                draggable
                onDragStart={stagedDrag.onDragStart(row.id)}
                onDragEnd={stagedDrag.onDragEnd}
                onDragOver={stagedDrag.onDragOver(row.id)}
                onDragLeave={stagedDrag.onDragLeave(row.id)}
                style={{
                  display: "flex", alignItems: "center", gap: "10px",
                  padding: "10px 14px", borderBottom: "1px solid #F1F1F0",
                  cursor: "grab",
                  opacity: isDragging ? 0.95 : 1,
                  backgroundColor: isDragging ? "#F0F0EC" : "transparent",
                  boxShadow: isDragging ? "0 4px 16px rgba(0,0,0,0.1)" : "none",
                  transform: isDragging ? "scale(1.01)" : "none",
                  transition: isDragging ? "none" : "background-color 0.15s",
                  position: "relative",
                  borderTop: dropIndicator === "above" ? "2px solid #1A1A1A" : undefined,
                  borderBottomWidth: dropIndicator === "below" ? "2px" : undefined,
                  borderBottomColor: dropIndicator === "below" ? "#1A1A1A" : undefined,
                  borderBottomStyle: dropIndicator === "below" ? "solid" : undefined,
                }}
                onMouseEnter={(e) => { if (!isDragging) e.currentTarget.style.backgroundColor = "#FCFCFB"; }}
                onMouseLeave={(e) => { if (!isDragging) e.currentTarget.style.backgroundColor = "transparent"; }}
              >
                <span style={{ color: "#C4C4C0", fontSize: "14px", userSelect: "none", flexShrink: 0, cursor: "grab" }}>⠿</span>
                <span style={{ flex: 1, minWidth: 0, fontSize: "14px", fontWeight: 500, color: "#1A1A1A", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {row.title}
                </span>
                {(() => {
                  // Read-only mirror of Today's tag pills (project → eisenhower → life),
                  // each shown only when set. flexShrink:0 so the title truncates first.
                  const badges = [];
                  if (getTagValue(categories, "project", row.tags?.project)) badges.push(<TagBadge key="project" categories={categories} categoryId="project" valueId={row.tags?.project} small />);
                  if (getTagValue(categories, "eisenhower", row.tags?.eisenhower)) badges.push(<TagBadge key="eisenhower" categories={categories} categoryId="eisenhower" valueId={row.tags?.eisenhower} small />);
                  if (getTagValue(categories, "life", row.tags?.life)) badges.push(<TagBadge key="life" categories={categories} categoryId="life" valueId={row.tags?.life} small />);
                  if (badges.length === 0) return null;
                  return <span style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 }}>{badges}</span>;
                })()}
                {dest !== "Today" && <span style={stagedChipStyle}>→ {dest}</span>}
                <button onClick={() => removeStaged(row.id)} title="Remove"
                  style={{ fontSize: "13px", lineHeight: 1, padding: "3px 6px", borderRadius: "5px", border: "none", backgroundColor: "transparent", color: "#C4C4C0", cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = "#EF4444"; e.currentTarget.style.backgroundColor = "#FEF2F2"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = "#C4C4C0"; e.currentTarget.style.backgroundColor = "transparent"; }}
                >✕</button>
              </div>
            );
          })
        )}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "12px" }}>
        <button onClick={onCommit} disabled={nonBlankCount === 0}
          style={{ ...pillBtnStyle, backgroundColor: nonBlankCount > 0 ? "#1A1A1A" : "#D4D4D0", color: "#FFF", cursor: nonBlankCount > 0 ? "pointer" : "not-allowed" }}>
          Add all ({nonBlankCount}) and close
        </button>
        <div style={{ flex: 1 }} />
        <button onClick={onCancel}
          style={{ ...pillBtnStyle, backgroundColor: "transparent", color: "#AEAEA6", border: "1px solid #EBEBEA" }}>
          Cancel
        </button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   NEW DAY MODAL
   ═══════════════════════════════════════════ */

function NewDayModal({ tasks, categories, onDecide, onCancel }) {
  // Exclude recurring instances — they're handled automatically by New Day
  const uncompleted = tasks.filter((t) => !t.completed && !t.recurringParentId);
  const [decisions, setDecisions] = useState(Object.fromEntries(uncompleted.map((t) => [t.id, "backlog"])));
  if (uncompleted.length === 0) return null;
  const setAll = (v) => setDecisions(Object.fromEntries(uncompleted.map((t) => [t.id, v])));

  return (
    <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.3)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "20px" }}>
      <div style={{ backgroundColor: "#FFFFFF", borderRadius: "16px", padding: "28px", maxWidth: "480px", width: "100%", maxHeight: "80vh", overflow: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.15)", fontFamily: "inherit" }}>
        <h2 style={{ fontSize: "20px", fontWeight: 700, color: "#1A1A1A", margin: "0 0 4px 0" }}>☀ Start a New Day</h2>
        <p style={{ fontSize: "14px", color: "#8A8A86", margin: "0 0 20px 0" }}>What would you like to do with yesterday's uncompleted tasks?</p>
        <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
          <button onClick={() => setAll("today")} style={bulkBtnStyle}>Move all → Today</button>
          <button onClick={() => setAll("backlog")} style={bulkBtnStyle}>Move all → Backlog</button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "24px" }}>
          {uncompleted.map((task) => {
            const lifeVal = getTagValue(categories, "life", task.tags?.life);
            return (
              <div key={task.id} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px 12px", borderRadius: "8px", border: "1px solid #EBEBEA", backgroundColor: "#FAFAF9" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: "14px", fontWeight: 500, color: "#1A1A1A" }}>{task.title}</div>
                </div>
                {lifeVal && <TagBadge categories={categories} categoryId="life" valueId={task.tags.life} small />}
                <select value={decisions[task.id]} onChange={(e) => setDecisions((d) => ({ ...d, [task.id]: e.target.value }))}
                  style={{ fontSize: "12px", fontWeight: 600, padding: "4px 8px", borderRadius: "6px", border: "1px solid #EBEBEA", backgroundColor: "#FFFFFF", color: "#1A1A1A", fontFamily: "inherit", cursor: "pointer", flexShrink: 0 }}>
                  <option value="today">→ Today</option>
                  <option value="backlog">→ Backlog</option>
                </select>
              </div>
            );
          })}
        </div>
        <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
          <button onClick={onCancel} style={{ ...pillBtnStyle, backgroundColor: "transparent", color: "#8A8A86" }}>Cancel</button>
          <button onClick={() => onDecide(decisions)} style={{ ...pillBtnStyle, backgroundColor: "#1A1A1A", color: "#FFF" }}>Start New Day</button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   TAB 1: DAILY NOTEBOOK
   ═══════════════════════════════════════════ */

function NotebookTab({ todayTasks, setTodayTasks, backlogTasks, setBacklogTasks, somedayTasks, setSomedayTasks, futureTasks, setFutureTasks, ongoingTasks, setOngoingTasks, recurringTemplates, setRecurringTemplates, categories, setCategories, currentDay, setCurrentDay, navigateToRecurring, fakeClock, setFakeClock, multiAddMode, setMultiAddMode, stagedRows, setStagedRows }) {
  const [showNewDay, setShowNewDay] = useState(false);
  const [expandedSections, setExpandedSections] = useState({ backlog: true, ongoing: true });
  const [ongoingSort, setOngoingSort] = useState("custom"); // "custom" | "eisenhower" | "lastworked"
  const [backlogSort, setBacklogSort] = useState("date"); // "date" | "eisenhower" | "custom"
  // ─── v1.7 Phase 4: Multi-select state for Today ───
  const [todaySelectMode, setTodaySelectMode] = useState(false);
  const [selectedTodayIds, setSelectedTodayIds] = useState(() => new Set());
  const [bulkToast, setBulkToast] = useState(null); // { message, key }
  const [bulkFutureDateOpen, setBulkFutureDateOpen] = useState(false);
  const [bulkFutureDate, setBulkFutureDate] = useState(() => {
    const d = new Date(getClockToday() + "T12:00:00"); d.setDate(d.getDate() + 1);
    return d.toISOString().split("T")[0];
  });
  const todayDrag = useDragReorder(todayTasks, setTodayTasks);

  // Compute sorted display arrays first so drag hooks operate on the rendered order
  // Backlog display filter. Excludes:
  // - deleted/completed tasks (preserved in array for Task Database history)
  // - skipped/missed recurring instances (preserved in array for Task Database
  //   "Recurring" filter and for getMaxSequence; v1.7.2 hides them from the
  //   Backlog UI because they were leaking in via the New Day archival path)
  const activeBacklogTasks = backlogTasks.filter((t) =>
    !t.deleted &&
    !t.completed &&
    !(t.recurringParentId && (t.recurringStatus === "skipped" || t.recurringStatus === "missed"))
  );
  const sortedBacklogTasks = (() => {
    if (backlogSort === "eisenhower") {
      return [...activeBacklogTasks].sort((a, b) => {
        const pa = EISENHOWER_PRIORITY[a.tags?.eisenhower] ?? 99;
        const pb = EISENHOWER_PRIORITY[b.tags?.eisenhower] ?? 99;
        return pa - pb;
      });
    }
    if (backlogSort === "custom") {
      return [...activeBacklogTasks].sort((a, b) => (a.backlogOrder ?? 999) - (b.backlogOrder ?? 999));
    }
    return activeBacklogTasks;
  })();
  const backlogGroups = backlogSort === "date" ? groupByCreatedDate(activeBacklogTasks) : null;

  const activeOngoingTasksRaw = ongoingTasks.filter((t) => !t.deleted && !t.ongoingCompleted);
  const activeOngoingTasks = (() => {
    if (ongoingSort === "eisenhower") {
      return [...activeOngoingTasksRaw].sort((a, b) => {
        const pa = EISENHOWER_PRIORITY[a.tags?.eisenhower] ?? 99;
        const pb = EISENHOWER_PRIORITY[b.tags?.eisenhower] ?? 99;
        return pa - pb;
      });
    }
    if (ongoingSort === "lastworked") {
      return [...activeOngoingTasksRaw].sort((a, b) => {
        const la = a.ongoingCompletions?.length ? a.ongoingCompletions[a.ongoingCompletions.length - 1].completedAt : null;
        const lb = b.ongoingCompletions?.length ? b.ongoingCompletions[b.ongoingCompletions.length - 1].completedAt : null;
        if (!la && !lb) return 0;
        if (!la) return 1;
        if (!lb) return -1;
        return lb.localeCompare(la);
      });
    }
    return [...activeOngoingTasksRaw].sort((a, b) => (a.ongoingOrder ?? 999) - (b.ongoingOrder ?? 999));
  })();

  // Drag hooks operate on the rendered display arrays so indices always match visuals
  const ongoingDrag = useDragReorder(activeOngoingTasks, setOngoingTasks);
  const backlogDrag = useDragReorder(sortedBacklogTasks, setBacklogTasks);

  const toggleTask = useCallback((section) => (id) => {
    if (section === "today") {
      // Check if this is an ongoing task in Today — if so, log completion and return to Ongoing
      setTodayTasks((prev) => {
        const task = prev.find((t) => t.id === id);
        if (task && task.ongoing && !task.completed) {
          // Log ongoing completion and move back to ongoing
          const updatedTask = {
            ...task,
            completed: false,
            completedDate: null,
            ongoingCompletions: [...(task.ongoingCompletions || []), { date: currentDay, completedAt: nowTimestamp() }],
          };
          setTimeout(() => setOngoingTasks((prev) => [updatedTask, ...prev]), 0);
          return prev.filter((t) => t.id !== id);
        }
        // Check if this is a recurring instance — log completion to parent template
        if (task && task.recurringParentId && !task.completed && task.recurringStatus === "pending") {
          const ts = nowTimestamp();
          // Mark instance as completed
          const updatedTask = { ...task, completed: true, completedDate: ts, recurringStatus: "completed" };
          // Log to parent template
          setTimeout(() => {
            setRecurringTemplates((prev) => prev.map((tmpl) => {
              if (tmpl.id !== task.recurringParentId) return tmpl;
              return { ...tmpl, completions: [...tmpl.completions, { date: currentDay, instanceId: task.id, status: "completed", timestamp: ts }] };
            }));
            // Check if we need to generate more instances
            // Use a setTimeout to let state settle, then check pending count
            setTimeout(() => {
              setRecurringTemplates((prevTemplates) => {
                const template = prevTemplates.find((t) => t.id === task.recurringParentId);
                if (!template || template.status !== "active" || template.deleted) return prevTemplates;
                const targetCount = INSTANCE_COUNTS[template.recurrenceRule.frequency] || 10;
                // We need to read current todayTasks and futureTasks — but we're in a callback
                // so we use setters to read current state
                setTodayTasks((currentToday) => {
                  setFutureTasks((currentFuture) => {
                    const pending = countPendingInstances(currentToday, currentFuture, template.id);
                    if (pending < targetCount) {
                      const latestDue = getLatestPendingDueDate(currentToday, currentFuture, template.id);
                      const maxSeq = getMaxSequence(currentToday, currentFuture, backlogTasks, template.id);
                      const generateFrom = latestDue ? (() => {
                        const d = new Date(latestDue + "T12:00:00");
                        d.setDate(d.getDate() + 1);
                        return d.toISOString().split("T")[0];
                      })() : currentDay;
                      const needed = targetCount - pending;
                      const dueDates = generateNextDueDates(template, generateFrom, needed);
                      if (dueDates.length > 0) {
                        const newInstances = generateInstancesFromTemplate(template, dueDates, maxSeq + 1);
                        const toToday = newInstances.filter((t) => t.dueDate === currentDay);
                        const toFuture = newInstances.filter((t) => t.dueDate !== currentDay);
                        if (toFuture.length > 0) {
                          return [...currentFuture, ...toFuture];
                        }
                      }
                    }
                    return currentFuture;
                  });
                  return currentToday;
                });
                return prevTemplates;
              });
            }, 50);
          }, 0);
          return prev.map((t) => t.id === id ? updatedTask : t);
        }
        // Regular toggle
        return prev.map((t) => {
          if (t.id !== id) return t;
          const nowCompleted = !t.completed;
          return { ...t, completed: nowCompleted, completedDate: nowCompleted ? nowTimestamp() : null };
        });
      });
      return;
    }
    const setter = section === "backlog" ? setBacklogTasks : section === "ongoing" ? setOngoingTasks : setSomedayTasks;
    setter((prev) => prev.map((t) => {
      if (t.id !== id) return t;
      const nowCompleted = !t.completed;
      return { ...t, completed: nowCompleted, completedDate: nowCompleted ? nowTimestamp() : null };
    }));
  }, [setTodayTasks, setBacklogTasks, setSomedayTasks, setOngoingTasks, setRecurringTemplates, setFutureTasks, backlogTasks, currentDay]);

  const skipRecurring = useCallback((id, section = "today") => {
    const ts = nowTimestamp();
    const setter = section === "backlog" ? setBacklogTasks : setTodayTasks;
    setter((prev) => {
      const task = prev.find((t) => t.id === id);
      if (!task || !task.recurringParentId || task.recurringStatus !== "pending") return prev;
      // Log skip to parent template. Skip is logged against the instance's
      // original due date, so rolled-forward instances log against the
      // scheduled occurrence the user skipped, not the day they happened
      // to dismiss it. The parent template's completions array is the
      // source of truth — we no longer keep an orphan row in Backlog.
      const skipDate = task.originalDueDate || task.dueDate || currentDay;
      setTimeout(() => {
        setRecurringTemplates((prevT) => prevT.map((tmpl) => {
          if (tmpl.id !== task.recurringParentId) return tmpl;
          return { ...tmpl, completions: [...tmpl.completions, { date: skipDate, instanceId: task.id, status: "skipped", timestamp: ts }] };
        }));
      }, 0);
      return prev.filter((t) => t.id !== id);
    });
  }, [setTodayTasks, setBacklogTasks, setRecurringTemplates, currentDay]);

  const changeTag = useCallback((section) => (id, catId, newVal) => {
    const setterMap = { today: setTodayTasks, backlog: setBacklogTasks, someday: setSomedayTasks, ongoing: setOngoingTasks };
    const setter = setterMap[section];
    if (setter) setter((prev) => prev.map((t) => t.id === id ? { ...t, tags: { ...t.tags, [catId]: newVal } } : t));
  }, [setTodayTasks, setBacklogTasks, setSomedayTasks, setOngoingTasks]);

  const editTask = useCallback((section) => (id, updates) => {
    const setterMap = { today: setTodayTasks, backlog: setBacklogTasks, someday: setSomedayTasks, future: setFutureTasks, ongoing: setOngoingTasks };
    const currentSetter = setterMap[section];

    // Check if ongoing status is changing
    if (updates.ongoing !== undefined) {
      if (updates.ongoing && section !== "ongoing") {
        // Moving TO ongoing
        let movedTask = null;
        currentSetter((prev) => {
          const task = prev.find((t) => t.id === id);
          if (task) movedTask = { ...task, ...updates };
          return prev.filter((t) => t.id !== id);
        });
        setTimeout(() => { if (movedTask) setOngoingTasks((prev) => [movedTask, ...prev]); }, 0);
        return;
      } else if (!updates.ongoing && section === "ongoing") {
        // Moving FROM ongoing to appropriate section based on due date
        const newDue = updates.dueDate;
        let targetSection = "someday";
        if (newDue === currentDay) targetSection = "today";
        else if (newDue && newDue > currentDay) targetSection = "future";
        else if (newDue && newDue < currentDay) targetSection = "backlog";

        let movedTask = null;
        currentSetter((prev) => {
          const task = prev.find((t) => t.id === id);
          if (task) movedTask = { ...task, ...updates };
          return prev.filter((t) => t.id !== id);
        });
        setTimeout(() => { if (movedTask) setterMap[targetSection]((prev) => [movedTask, ...prev]); }, 0);
        return;
      }
    }

    // If task is ongoing, skip due-date-based routing
    if (updates.ongoing || (updates.ongoing === undefined && section === "ongoing")) {
      currentSetter((prev) => prev.map((t) => t.id === id ? { ...t, ...updates } : t));
      return;
    }

    // Check if due date is changing and needs re-routing
    if (updates.dueDate !== undefined) {
      let needsMove = false;
      let targetSection = section;
      const newDue = updates.dueDate;

      if (!newDue && section !== "someday") { targetSection = "someday"; needsMove = true; }
      else if (newDue === currentDay && section !== "today") { targetSection = "today"; needsMove = true; }
      else if (newDue && newDue > currentDay && section !== "future") { targetSection = "future"; needsMove = true; }
      else if (newDue && newDue < currentDay && section !== "backlog") { targetSection = "backlog"; needsMove = true; }

      if (needsMove) {
        let movedTask = null;
        currentSetter((prev) => {
          const task = prev.find((t) => t.id === id);
          if (task) movedTask = { ...task, ...updates };
          return prev.filter((t) => t.id !== id);
        });
        setTimeout(() => {
          if (movedTask) {
            setterMap[targetSection]((prev) => [movedTask, ...prev]);
          }
        }, 0);
        return;
      }
    }

    // No re-routing needed, just update in place
    currentSetter((prev) => prev.map((t) => t.id === id ? { ...t, ...updates } : t));
  }, [setTodayTasks, setBacklogTasks, setSomedayTasks, setFutureTasks, setOngoingTasks, currentDay]);

  const deleteTask = useCallback((section) => (id) => {
    const setterMap = { today: setTodayTasks, backlog: setBacklogTasks, someday: setSomedayTasks, ongoing: setOngoingTasks };
    const setter = setterMap[section];
    if (setter) setter((prev) => prev.map((t) => t.id === id ? { ...t, deleted: true, deletedDate: nowTimestamp() } : t));
  }, [setTodayTasks, setBacklogTasks, setSomedayTasks, setOngoingTasks]);

  const completeOngoing = useCallback((id) => {
    setOngoingTasks((prev) => prev.map((t) => t.id === id ? { ...t, ongoingCompleted: true, ongoingCompletedDate: nowTimestamp(), completed: true, completedDate: nowTimestamp() } : t));
  }, [setOngoingTasks]);

  const addTask = useCallback((task) => {
    if (task.ongoing) { setOngoingTasks((prev) => [task, ...prev]); }
    else if (!task.dueDate) { setSomedayTasks((prev) => [task, ...prev]); }
    else if (task.dueDate === currentDay) { setTodayTasks((prev) => [task, ...prev]); }
    else if (new Date(task.dueDate + "T12:00:00") > new Date(currentDay + "T12:00:00")) { setFutureTasks((prev) => [task, ...prev]); }
    else { setBacklogTasks((prev) => [task, ...prev]); }
  }, [setTodayTasks, setBacklogTasks, setSomedayTasks, setFutureTasks, setOngoingTasks, currentDay]);

  // v1.8 Phase 2: commit every non-blank staged row through addTask. addTask
  // prepends, so reverse-iterating the listed order makes the staged order come
  // out on top of each destination. The blank-title filter is a defensive no-op
  // (NewTaskForm already refuses to stage a blank title).
  const commitStagedRows = useCallback(() => {
    const rows = stagedRows.filter((r) => r.title && r.title.trim());
    for (let i = rows.length - 1; i >= 0; i--) addTask(rows[i]);
    setStagedRows([]);
  }, [stagedRows, addTask, setStagedRows]);

  const moveToToday = (task, source) => {
    const setterMap = { backlog: setBacklogTasks, someday: setSomedayTasks, ongoing: setOngoingTasks };
    const setter = setterMap[source];
    if (setter) setter((prev) => prev.filter((t) => t.id !== task.id));
    setTodayTasks((prev) => [{ ...task, dueDate: currentDay }, ...prev]);
  };

  const moveFromToday = (task, destination) => {
    setTodayTasks((prev) => prev.filter((t) => t.id !== task.id));
    const cleaned = { ...task, dayOrder: null };
    if (destination === "backlog") setBacklogTasks((prev) => [...prev, cleaned]);
    else setSomedayTasks((prev) => [...prev, { ...cleaned, dueDate: "" }]);
  };

  const moveToTop = useCallback((section) => (taskId) => {
    const setterMap = { today: setTodayTasks, backlog: setBacklogTasks, someday: setSomedayTasks, ongoing: setOngoingTasks };
    const setter = setterMap[section];
    if (!setter) return;
    setter((prev) => {
      const idx = prev.findIndex((t) => t.id === taskId);
      if (idx <= 0) return prev;
      const updated = [...prev];
      const [moved] = updated.splice(idx, 1);
      updated.unshift(moved);
      return updated;
    });
  }, [setTodayTasks, setBacklogTasks, setSomedayTasks, setOngoingTasks]);

  // ─── v1.7 Phase 4: Multi-select helpers ───

  // Toggle selection of a single task in Today
  const toggleTodaySelect = useCallback((taskId) => {
    setSelectedTodayIds((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  }, []);

  // Exit select mode and clear selection
  const exitSelectMode = useCallback(() => {
    setTodaySelectMode(false);
    setSelectedTodayIds(new Set());
    setBulkFutureDateOpen(false);
  }, []);

  // Briefly show a toast message (auto-clears after a few seconds)
  const showBulkToast = useCallback((message) => {
    const key = Date.now() + Math.random();
    setBulkToast({ message, key });
    setTimeout(() => {
      setBulkToast((curr) => (curr && curr.key === key ? null : curr));
    }, 3500);
  }, []);

  // Bulk move selected Today tasks to a destination section.
  // destination: "backlog" | "someday" | "future" | "ongoing"
  // For "future", futureDueDate must be provided.
  const bulkMoveSelectedTo = useCallback((destination, futureDueDate) => {
    if (selectedTodayIds.size === 0) return;

    // Collect tasks in their current Today order to preserve relative ordering.
    const ids = selectedTodayIds;
    const moved = todayTasks.filter((t) => ids.has(t.id));
    if (moved.length === 0) return;

    if (destination === "ongoing") {
      // Recurring instances cannot become ongoing — skip silently with toast.
      const eligible = moved.filter((t) => !t.recurringParentId);
      const skipped = moved.length - eligible.length;
      if (eligible.length === 0) {
        showBulkToast(`${skipped} recurring task${skipped !== 1 ? "s" : ""} skipped — Recurring and Ongoing are mutually exclusive.`);
        return;
      }
      const movedIds = new Set(eligible.map((t) => t.id));
      const ongoingPayloads = eligible.map((t) => ({
        ...t, ongoing: true, dueDate: "", dayOrder: null,
        ongoingCompletions: t.ongoingCompletions || [],
        ongoingCompleted: false, ongoingCompletedDate: null,
      }));
      setTodayTasks((prev) => prev.filter((t) => !movedIds.has(t.id)));
      setOngoingTasks((prev) => [...ongoingPayloads, ...prev]);
      if (skipped > 0) {
        showBulkToast(`${skipped} recurring task${skipped !== 1 ? "s" : ""} skipped — Recurring and Ongoing are mutually exclusive.`);
      }
      exitSelectMode();
      return;
    }

    const movedIds = new Set(moved.map((t) => t.id));
    setTodayTasks((prev) => prev.filter((t) => !movedIds.has(t.id)));

    if (destination === "backlog") {
      const payloads = moved.map((t) => ({ ...t, dayOrder: null }));
      setBacklogTasks((prev) => [...payloads, ...prev]);
    } else if (destination === "someday") {
      const payloads = moved.map((t) => ({ ...t, dayOrder: null, dueDate: "" }));
      setSomedayTasks((prev) => [...payloads, ...prev]);
    } else if (destination === "future") {
      const due = futureDueDate;
      const payloads = moved.map((t) => {
        const updates = { ...t, dayOrder: null, dueDate: due };
        if (t.dueDate !== due) {
          const history = t.dueDateHistory || [];
          updates.dueDateHistory = [...history, { from: t.dueDate, to: due, changedAt: nowTimestamp() }];
        }
        if (!t.originalDueDate && t.dueDate) updates.originalDueDate = t.dueDate;
        return updates;
      });
      setFutureTasks((prev) => [...payloads, ...prev]);
    }
    exitSelectMode();
  }, [selectedTodayIds, todayTasks, setTodayTasks, setBacklogTasks, setSomedayTasks, setFutureTasks, setOngoingTasks, exitSelectMode, showBulkToast]);

  // Bulk delete selected Today tasks (soft delete).
  const bulkDeleteSelected = useCallback(() => {
    if (selectedTodayIds.size === 0) return;
    const ids = selectedTodayIds;
    const ts = nowTimestamp();
    setTodayTasks((prev) => prev.map((t) => ids.has(t.id) ? { ...t, deleted: true, deletedDate: ts } : t));
    exitSelectMode();
  }, [selectedTodayIds, setTodayTasks, exitSelectMode]);

  // Bulk drag within Today: moves all selected tasks as a contiguous block to the drop point.
  // Returns true if a bulk drag was performed (so individual-drag handler can be short-circuited).
  const performBulkDragReorder = useCallback((draggedId, overId, side) => {
    if (!todaySelectMode || selectedTodayIds.size === 0) return false;
    if (!selectedTodayIds.has(draggedId)) return false;
    if (overId == null || draggedId === overId) return false;
    // If drop target is itself selected, no-op.
    if (selectedTodayIds.has(overId)) return true;

    setTodayTasks((prev) => {
      const selectedSet = selectedTodayIds;
      // Preserve current relative order of selected tasks
      const selectedTasks = prev.filter((t) => selectedSet.has(t.id));
      if (selectedTasks.length === 0) return prev;
      const remaining = prev.filter((t) => !selectedSet.has(t.id));
      const overIdx = remaining.findIndex((t) => t.id === overId);
      if (overIdx === -1) return prev;
      const insertAt = side === "below" ? overIdx + 1 : overIdx;
      const result = [...remaining];
      result.splice(insertAt, 0, ...selectedTasks);
      return result;
    });
    return true;
  }, [todaySelectMode, selectedTodayIds, setTodayTasks]);

  // Escape-key exit and listen for it whenever select mode is on
  useEffect(() => {
    if (!todaySelectMode) return;
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      // Don't hijack Escape if the user is editing an input (e.g. inline task edit)
      const t = document.activeElement;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
      exitSelectMode();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [todaySelectMode, exitSelectMode]);

  // Keep selection clean: prune ids that are no longer in Today (completed, deleted, moved, etc.)
  useEffect(() => {
    if (selectedTodayIds.size === 0) return;
    const validIds = new Set(todayTasks.filter((t) => !t.completed && !t.deleted).map((t) => t.id));
    let changed = false;
    const next = new Set();
    selectedTodayIds.forEach((id) => {
      if (validIds.has(id)) next.add(id);
      else changed = true;
    });
    if (changed) setSelectedTodayIds(next);
  }, [todayTasks, selectedTodayIds]);

  const handleNewDay = useCallback((decisions) => {
    const newToday = getTodayStr();
    const ts = nowTimestamp();
    const toTodayRegular = [];    // regular tasks carried forward
    const toTodayRecurring = [];  // recurring instances for today (go to TOP)
    const toBacklog = [];
    const toArchive = []; // completed and deleted tasks preserved for history

    // Look up a template by id; non-daily templates get v1.7 roll-forward behavior,
    // daily templates retain the v1.6 miss-and-archive behavior.
    const templateById = new Map(recurringTemplates.map((tmpl) => [tmpl.id, tmpl]));
    const rollsForward = (parentId) => {
      const tmpl = templateById.get(parentId);
      return tmpl ? isNonDailyFrequency(tmpl.recurrenceRule?.frequency) : false;
    };

    // ─── Pre-process recurring instances in Today ───
    // Daily pending instances are marked "missed" and archived (v1.6 behavior).
    // Non-daily pending instances roll forward: dueDate moves to newToday, originalDueDate
    // is preserved so the existing drift indicator shows how far it has drifted.
    // Completed/skipped recurring instances always go to archive.
    const recurringMissedLogs = []; // { templateId, instanceId, date }
    todayTasks.forEach((t) => {
      if (!t.recurringParentId) return; // handled below in regular loop
      if (t.completed || t.deleted || t.recurringStatus === "completed" || t.recurringStatus === "skipped") {
        toArchive.push(t);
      } else if (t.recurringStatus === "pending") {
        if (rollsForward(t.recurringParentId)) {
          // Roll forward: update dueDate, keep originalDueDate anchored to first emit
          const rolled = {
            ...t,
            dueDate: newToday,
            originalDueDate: t.originalDueDate || t.dueDate,
          };
          toTodayRecurring.push(rolled);
        } else {
          // Daily — miss and archive
          const missed = { ...t, recurringStatus: "missed" };
          toArchive.push(missed);
          recurringMissedLogs.push({ templateId: t.recurringParentId, instanceId: t.id, date: t.dueDate || currentDay });
        }
      } else {
        toArchive.push(t);
      }
    });

    // ─── Regular task triage ───
    todayTasks.forEach((t) => {
      if (t.recurringParentId) return; // already handled above
      if (t.completed || t.deleted) {
        toArchive.push(t);
        return;
      }
      if (decisions[t.id] === "today") {
        const updates = { ...t, dueDate: newToday };
        if (t.dueDate !== newToday) {
          const history = t.dueDateHistory || [];
          updates.dueDateHistory = [...history, { from: t.dueDate, to: newToday, changedAt: nowTimestamp() }];
        }
        if (!updates.originalDueDate) updates.originalDueDate = t.dueDate;
        toTodayRegular.push(updates);
      } else {
        toBacklog.push(t);
      }
    });

    // ─── Auto-move future tasks whose due date is today or earlier ───
    // Daily pending recurring instances in the gap (older than newToday) are marked
    // missed. Non-daily pending recurring instances in the gap roll forward to today
    // — the roll-forward rule subsumes gap-day handling for non-daily frequencies.
    const remainingFuture = [];
    futureTasks.forEach((t) => {
      if (t.deleted) { remainingFuture.push(t); return; }
      if (t.dueDate && t.dueDate <= newToday) {
        // This task's due date has arrived or passed
        if (t.recurringParentId && t.recurringStatus === "pending") {
          if (t.dueDate === newToday) {
            // Due today — move to Today (at top, as a recurring instance).
            // No drift yet; originalDueDate stays equal to dueDate.
            toTodayRecurring.push(t);
          } else if (rollsForward(t.recurringParentId)) {
            // Non-daily gap-day — roll forward into Today rather than marking missed.
            const rolled = {
              ...t,
              dueDate: newToday,
              originalDueDate: t.originalDueDate || t.dueDate,
            };
            toTodayRecurring.push(rolled);
          } else {
            // Daily gap-day — auto-mark as missed and archive
            const missed = { ...t, recurringStatus: "missed" };
            toArchive.push(missed);
            recurringMissedLogs.push({ templateId: t.recurringParentId, instanceId: t.id, date: t.dueDate });
          }
        } else {
          // Regular future task (or already-completed recurring) — move to Today
          toTodayRegular.push(t);
        }
      } else {
        remainingFuture.push(t);
      }
    });

    // ─── In-day conflict resolution (newest wins) ───
    // If both a rolled-forward instance and a fresh dueDate=newToday instance landed
    // in toTodayRecurring for the same template, the older one (smaller originalDueDate)
    // is marked missed against its originalDueDate. Net effect: each non-daily template
    // contributes at most one pending instance to Today.
    {
      const byTemplate = new Map();
      toTodayRecurring.forEach((t, idx) => {
        if (!t.recurringParentId) return;
        const arr = byTemplate.get(t.recurringParentId) || [];
        arr.push({ task: t, idx });
        byTemplate.set(t.recurringParentId, arr);
      });
      const toDrop = new Set();
      byTemplate.forEach((entries, tid) => {
        if (entries.length < 2) return;
        if (!rollsForward(tid)) return;
        // Sort by originalDueDate ascending (oldest first). Keep the newest, retire the rest.
        entries.sort((a, b) => {
          const ao = a.task.originalDueDate || a.task.dueDate || "";
          const bo = b.task.originalDueDate || b.task.dueDate || "";
          return ao.localeCompare(bo);
        });
        for (let i = 0; i < entries.length - 1; i++) {
          const losing = entries[i].task;
          toDrop.add(entries[i].idx);
          const missed = { ...losing, recurringStatus: "missed" };
          toArchive.push(missed);
          recurringMissedLogs.push({
            templateId: losing.recurringParentId,
            instanceId: losing.id,
            date: losing.originalDueDate || losing.dueDate || currentDay,
          });
        }
      });
      if (toDrop.size > 0) {
        // Rebuild toTodayRecurring without the retired entries
        const kept = toTodayRecurring.filter((_, i) => !toDrop.has(i));
        toTodayRecurring.length = 0;
        toTodayRecurring.push(...kept);
      }
    }

    // Log all missed completions to parent templates
    if (recurringMissedLogs.length > 0) {
      setRecurringTemplates((prev) => prev.map((tmpl) => {
        const logs = recurringMissedLogs.filter((l) => l.templateId === tmpl.id);
        if (logs.length === 0) return tmpl;
        // Sort logs by date so history is chronological
        const sortedLogs = [...logs].sort((a, b) => a.date.localeCompare(b.date));
        const newCompletions = [...tmpl.completions, ...sortedLogs.map((l) => ({
          date: l.date, instanceId: l.instanceId, status: "missed", timestamp: ts,
        }))];
        return { ...tmpl, completions: newCompletions };
      }));
    }

    // Recurring tasks for today go at the TOP of the Today list
    setTodayTasks([...toTodayRecurring, ...toTodayRegular]);
    setBacklogTasks((prev) => [...prev, ...toBacklog, ...toArchive]);
    setFutureTasks(remainingFuture);
    setCurrentDay(newToday);
    setShowNewDay(false);

    // ─── Post-New Day: regenerate recurring instances ───
    // Generate from today forward to maintain target count. For non-daily templates,
    // a pending rolled-forward instance may collide with a freshly-scheduled successor;
    // findRolledForwardConflicts marks the rolled-forward one missed so the new one
    // can take its place ("newest wins").
    setTimeout(() => {
      setRecurringTemplates((prevTemplates) => {
        const activeTemplates = prevTemplates.filter((t) => t.status === "active" && !t.deleted);
        if (activeTemplates.length === 0) return prevTemplates;

        setFutureTasks((currentFuture) => {
          setTodayTasks((currentToday) => {
            // We mutate working copies so successive templates see prior conflict resolutions.
            let workingToday = currentToday;
            let workingFuture = currentFuture;
            let newTodayInstances = [];
            let newFutureInstances = [];
            const conflictMissedLogs = [];

            for (const template of activeTemplates) {
              const targetCount = INSTANCE_COUNTS[template.recurrenceRule.frequency] || 10;
              const pending = countPendingInstances(workingToday, workingFuture, template.id);
              if (pending < targetCount) {
                // Find the latest pending due date to generate after it
                const latestDue = getLatestPendingDueDate(workingToday, workingFuture, template.id);
                const maxSeq = getMaxSequence(workingToday, workingFuture, backlogTasks, template.id);
                // Generate from the day after the latest pending, or from today if none exist
                const generateFrom = latestDue ? (() => {
                  const d = new Date(latestDue + "T12:00:00");
                  d.setDate(d.getDate() + 1);
                  return d.toISOString().split("T")[0];
                })() : newToday;
                const needed = targetCount - pending;
                const dueDates = generateNextDueDates(template, generateFrom, needed);
                if (dueDates.length > 0) {
                  // Conflict check: if a rolled-forward pending instance for this template
                  // has originalDueDate strictly before the first new dueDate AND that new
                  // instance is live (<= newToday), retire the rolled-forward one. Future
                  // placeholders alone do not displace a still-valid rolled-forward.
                  const { conflictIds, missedLogs } = findRolledForwardConflicts(
                    workingToday, workingFuture, template, dueDates[0], newToday
                  );
                  if (conflictIds.size > 0) {
                    workingToday = workingToday.filter((t) => !conflictIds.has(t.id));
                    workingFuture = workingFuture.filter((t) => !conflictIds.has(t.id));
                    conflictMissedLogs.push(...missedLogs);
                  }
                  const instances = generateInstancesFromTemplate(template, dueDates, maxSeq + 1);
                  newTodayInstances.push(...instances.filter((inst) => inst.dueDate === newToday));
                  newFutureInstances.push(...instances.filter((inst) => inst.dueDate !== newToday));
                }
              }
            }

            // Apply conflict resolution: archive missed rolled-forward instances and log them.
            const conflictedIdSet = conflictMissedLogs.length > 0
              ? new Set(conflictMissedLogs.map((l) => l.instanceId))
              : null;
            if (conflictedIdSet) {
              // The conflicted instances were already filtered out of workingToday/workingFuture
              // above; we still need to capture their archived form for backlog history.
              const archivedConflicts = [...currentToday, ...currentFuture]
                .filter((t) => conflictedIdSet.has(t.id))
                .map((t) => ({ ...t, recurringStatus: "missed" }));
              if (archivedConflicts.length > 0) {
                setTimeout(() => setBacklogTasks((prev) => [...prev, ...archivedConflicts]), 0);
              }
              setTimeout(() => {
                setRecurringTemplates((prev2) => prev2.map((tmpl) => {
                  const logs = conflictMissedLogs.filter((l) => l.templateId === tmpl.id);
                  if (logs.length === 0) return tmpl;
                  const sortedLogs = [...logs].sort((a, b) => a.date.localeCompare(b.date));
                  return {
                    ...tmpl,
                    completions: [...tmpl.completions, ...sortedLogs.map((l) => ({
                      date: l.date, instanceId: l.instanceId, status: "missed", timestamp: nowTimestamp(),
                    }))],
                  };
                }));
              }, 0);
            }

            // Add new instances and drop conflicted ones from Today/Future. We read prev inside
            // the setter callbacks so any concurrent edits to those lists aren't clobbered.
            if (newTodayInstances.length > 0 || conflictedIdSet) {
              setTimeout(() => setTodayTasks((prev) => {
                const filtered = conflictedIdSet ? prev.filter((t) => !conflictedIdSet.has(t.id)) : prev;
                return newTodayInstances.length > 0 ? [...newTodayInstances, ...filtered] : filtered;
              }), 0);
            }
            if (newFutureInstances.length > 0 || conflictedIdSet) {
              setTimeout(() => setFutureTasks((prev) => {
                const filtered = conflictedIdSet ? prev.filter((t) => !conflictedIdSet.has(t.id)) : prev;
                return newFutureInstances.length > 0 ? [...filtered, ...newFutureInstances] : filtered;
              }), 0);
            }
            return currentToday;
          });

          return currentFuture;
        });

        return prevTemplates;
      });
    }, 100);
  }, [todayTasks, futureTasks, backlogTasks, recurringTemplates, setTodayTasks, setBacklogTasks, setFutureTasks, setCurrentDay, setRecurringTemplates, currentDay]);

  const toggleSection = (key) => setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }));

  const activeTodayTasks = todayTasks.filter((t) => !t.deleted);
  const uncompletedToday = activeTodayTasks.filter((t) => !t.completed);
  const completedToday = activeTodayTasks.filter((t) => t.completed);
  // Enrich recurring tasks with missed streak from parent template
  const enrichWithMissedStreak = (tasks) => tasks.map((t) => {
    if (!t.recurringParentId) return t;
    const parent = recurringTemplates.find((tmpl) => tmpl.id === t.recurringParentId);
    if (!parent || !parent.completions || parent.completions.length === 0) return t;
    // Count consecutive missed from the end (before any non-missed)
    let streak = 0;
    for (let i = parent.completions.length - 1; i >= 0; i--) {
      if (parent.completions[i].status === "missed") streak++;
      else break;
    }
    return streak > 0 ? { ...t, recurringMissedStreak: streak } : t;
  });
  const sortedToday = [...enrichWithMissedStreak(uncompletedToday), ...completedToday];
  const activeSomedayTasks = somedayTasks.filter((t) => !t.deleted);

  // Date display based on stored currentDay
  const currentDayDate = new Date(currentDay + "T12:00:00");
  const dayName = currentDayDate.toLocaleDateString("en-US", { weekday: "long" });
  const dateStr = currentDayDate.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const todayActual = getTodayStr();
  const isStale = currentDay !== todayActual;
  const daysAgo = isStale ? Math.round((new Date(todayActual + "T12:00:00") - currentDayDate) / (1000 * 60 * 60 * 24)) : 0;

  return (
    <div style={{ maxWidth: "580px", margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "32px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <h1 style={{ fontSize: "26px", fontWeight: 700, color: "#1A1A1A", margin: 0, lineHeight: 1.2 }}>{dayName}</h1>
            {isStale && (
              <span style={{
                fontSize: "11px", fontWeight: 600, padding: "3px 8px", borderRadius: "4px",
                backgroundColor: "#FEF3C7", color: "#B45309",
              }}>{daysAgo === 1 ? "1 day ago" : `${daysAgo} days ago`}</span>
            )}
          </div>
          <p style={{ fontSize: "14px", color: "#8A8A86", margin: "4px 0 0 0" }}>{dateStr}</p>
          {/* ── Test Rig fake-clock controls (Part B) — inert in production ── */}
          {TEST_MODE && (
            <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "10px", flexWrap: "wrap" }}>
              <span style={{ fontSize: "11px", fontWeight: 700, color: "#1D4ED8", letterSpacing: "0.02em" }}>🧪 clock</span>
              <input type="date" value={fakeClock || getClockToday()}
                onChange={(e) => { if (e.target.value) setFakeClock(e.target.value); }}
                style={{ fontSize: "12px", padding: "3px 7px", borderRadius: "6px", border: "1px solid #93C5FD", backgroundColor: "#FFFFFF", color: "#1D4ED8", fontFamily: "inherit" }} />
              <button onClick={() => {
                const base = fakeClock || getClockToday();
                const d = new Date(base + "T12:00:00"); d.setDate(d.getDate() + 1);
                setFakeClock(d.toISOString().split("T")[0]);
              }}
                style={{ fontSize: "12px", fontWeight: 600, padding: "4px 10px", borderRadius: "6px", border: "1px solid #93C5FD", backgroundColor: "#FFFFFF", color: "#1D4ED8", cursor: "pointer", fontFamily: "inherit" }}>
                +1 day
              </button>
              <button onClick={() => handleNewDay({})}
                style={{ fontSize: "12px", fontWeight: 600, padding: "4px 10px", borderRadius: "6px", border: "1px solid #1D4ED8", backgroundColor: "#1D4ED8", color: "#FFFFFF", cursor: "pointer", fontFamily: "inherit" }}>
                ☀ New Day
              </button>
            </div>
          )}
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "4px" }}>
          <button onClick={() => {
            if (isStale) {
              // If stale, advance to today and show New Day modal
              const unc = todayTasks.filter((t) => !t.completed && !t.deleted && !t.recurringParentId);
              if (unc.length === 0) {
                // No regular uncompleted tasks — handle recurring + completed/deleted automatically
                // Pass empty decisions since there's nothing to triage
                handleNewDay({});
              }
              else setShowNewDay(true);
            } else {
              const unc = todayTasks.filter((t) => !t.completed && !t.deleted && !t.recurringParentId);
              if (unc.length === 0) {
                handleNewDay({});
              }
              else setShowNewDay(true);
            }
          }}
            style={{ fontSize: "13px", fontWeight: 600, padding: "8px 16px", borderRadius: "8px", border: "none", backgroundColor: "#1A1A1A", color: "#FFFFFF", cursor: "pointer", fontFamily: "inherit", transition: "background-color 0.15s" }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#333"; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "#1A1A1A"; }}
          >☀ New Day</button>
          {isStale && (
            <span style={{ fontSize: "11px", color: "#B45309", fontWeight: 500 }}>Press to start today</span>
          )}
        </div>
      </div>

      {multiAddMode ? (
        <MultiAddPanel
          categories={categories}
          setCategories={setCategories}
          defaultDueDate={currentDay}
          currentDay={currentDay}
          stagedRows={stagedRows}
          setStagedRows={setStagedRows}
          onCommit={() => { commitStagedRows(); setMultiAddMode(false); }}
          onCancel={() => { setStagedRows([]); setMultiAddMode(false); }}
        />
      ) : (
        <>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "8px" }}>
            <button onClick={() => setMultiAddMode(true)}
              style={{ fontSize: "11px", fontWeight: 600, padding: "3px 10px", borderRadius: "5px", border: "1px solid #EBEBEA", backgroundColor: "#FAFAF9", color: "#8A8A86", cursor: "pointer", fontFamily: "inherit", transition: "background-color 0.1s, color 0.1s" }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#EBEBEA"; e.currentTarget.style.color = "#5A5A56"; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "#FAFAF9"; e.currentTarget.style.color = "#8A8A86"; }}
            >⊞ Add several</button>
          </div>
          <NewTaskForm categories={categories} setCategories={setCategories} onAdd={addTask} defaultDueDate={currentDay} />
        </>
      )}

      {/* Today */}
      <SectionHeader title="Today" count={uncompletedToday.length}>
        {uncompletedToday.length > 0 && (
          todaySelectMode ? (
            <button onClick={exitSelectMode}
              style={{ fontSize: "11px", fontWeight: 600, padding: "3px 10px", borderRadius: "5px", border: "1px solid #EBEBEA", backgroundColor: "#FAFAF9", color: "#8A8A86", cursor: "pointer", fontFamily: "inherit", transition: "background-color 0.1s, color 0.1s" }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#EBEBEA"; e.currentTarget.style.color = "#5A5A56"; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "#FAFAF9"; e.currentTarget.style.color = "#8A8A86"; }}
            >Cancel</button>
          ) : (
            <button onClick={() => setTodaySelectMode(true)}
              style={{ fontSize: "11px", fontWeight: 600, padding: "3px 10px", borderRadius: "5px", border: "1px solid #EBEBEA", backgroundColor: "#FAFAF9", color: "#8A8A86", cursor: "pointer", fontFamily: "inherit", transition: "background-color 0.1s, color 0.1s" }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#EBEBEA"; e.currentTarget.style.color = "#5A5A56"; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "#FAFAF9"; e.currentTarget.style.color = "#8A8A86"; }}
            >☑ Select</button>
          )
        )}
      </SectionHeader>
      <div style={{ backgroundColor: "#FFFFFF", borderRadius: "12px", border: "1px solid #EBEBEA", marginBottom: "24px" }}>
        {sortedToday.length === 0 ? (
          <div style={{ padding: "32px 16px", textAlign: "center", color: "#C4C4C0", fontSize: "14px" }}>No tasks for today. Add one above!</div>
        ) : sortedToday.map((t, idx) => {
          const isSelected = todaySelectMode && selectedTodayIds.has(t.id);
          // In select mode with selections, only selected rows initiate drags
          // (group drag). All uncompleted rows still receive dragover/leave/end so
          // they can act as drop targets.
          const taskDraggable = !t.completed && (!todaySelectMode || isSelected);
          // Wrap onDragEnd in select mode so the source row performs a bulk reorder.
          // Outside select mode, pass through unchanged. When no rows are draggable
          // (select mode with empty selection), no handlers are needed.
          const inBulkMode = todaySelectMode && selectedTodayIds.size > 0;
          const baseHandlers = !t.completed ? todayDrag : undefined;
          const taskDragHandlers = !baseHandlers ? undefined : (
            inBulkMode
              ? {
                  ...todayDrag,
                  onDragEnd: () => {
                    // Read drag state from the hook's refs to avoid stale-state issues —
                    // the React state values may lag behind the most recent onDragOver.
                    const { dragId: dId, overId: oId, dropSide: side } = todayDrag.getDragState();
                    const handled = performBulkDragReorder(dId, oId, side);
                    if (handled && oId != null) {
                      // Clear the over target so the underlying single-drag reorder is skipped.
                      // useDragReorder only reorders when both dragId and overId are non-null.
                      todayDrag.onDragLeave(oId)();
                    }
                    // Always call the inner onDragEnd to reset refs and clear the visual state.
                    todayDrag.onDragEnd();
                  },
                }
              : todayDrag
          );
          return (
            <div key={t.id}
              onMouseEnter={(e) => { if (!todaySelectMode) e.currentTarget.querySelectorAll('[data-move-btn]').forEach(btn => btn.style.opacity = "1"); }}
              onMouseLeave={(e) => { if (!todaySelectMode) e.currentTarget.querySelectorAll('[data-move-btn]').forEach(btn => btn.style.opacity = "0"); }}
            >
              <TaskItem task={t} categories={categories} currentDay={currentDay} onToggle={toggleTask("today")} onChangeTag={changeTag("today")} onEditTask={editTask("today")} onDeleteTask={deleteTask("today")} onMoveToTop={moveToTop("today")}
                onSkipRecurring={t.recurringParentId ? skipRecurring : undefined}
                onNavigateToRecurring={t.recurringParentId ? navigateToRecurring : undefined}
                draggable={taskDraggable} dragHandlers={taskDragHandlers}
                isDragging={todayDrag.dragId === t.id}
                dropIndicator={
                  // Hide indicator on selected rows during a bulk drag — dropping
                  // there is a no-op, showing the bar would be misleading.
                  todayDrag.overId === t.id && todayDrag.dragId !== t.id && !(inBulkMode && isSelected)
                    ? todayDrag.dropSide
                    : null
                }
                moveBtn={<MoveDropdown onMove={(dest) => moveFromToday(t, dest)} />}
                selectMode={todaySelectMode && !t.completed}
                selected={isSelected}
                onSelect={toggleTodaySelect}
                bulkDragCount={isSelected ? selectedTodayIds.size : 0}
              />
            </div>
          );
        })}
      </div>

      {/* Phase 4: Floating bulk-action bar (visible in select mode) */}
      {todaySelectMode && (
        <BulkActionBar
          count={selectedTodayIds.size}
          onCancel={exitSelectMode}
          onMove={(dest) => bulkMoveSelectedTo(dest)}
          onMoveFuture={(date) => bulkMoveSelectedTo("future", date)}
          onDelete={bulkDeleteSelected}
          futureDate={bulkFutureDate}
          setFutureDate={setBulkFutureDate}
          futureDateOpen={bulkFutureDateOpen}
          setFutureDateOpen={setBulkFutureDateOpen}
          currentDay={currentDay}
        />
      )}

      {/* Phase 4: Toast for bulk-action notices (e.g. recurring → ongoing conflict) */}
      {bulkToast && (
        <div style={{
          position: "fixed", bottom: "24px", left: "50%", transform: "translateX(-50%)",
          backgroundColor: "#1A1A1A", color: "#FFFFFF", padding: "10px 16px", borderRadius: "8px",
          fontSize: "13px", fontWeight: 500, boxShadow: "0 4px 16px rgba(0,0,0,0.15)",
          zIndex: 9999, maxWidth: "420px",
        }}>
          {bulkToast.message}
        </div>
      )}

      {/* Ongoing */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 16px", marginBottom: "4px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <h2 style={{ fontSize: "13px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#8A8A86", margin: 0 }}>Ongoing</h2>
          <span style={{ fontSize: "11px", fontWeight: 600, color: "#B0B0AC", backgroundColor: "#F5F5F3", padding: "1px 7px", borderRadius: "10px" }}>{activeOngoingTasks.length}</span>
          {/* Sort pills */}
          <div style={{ display: "flex", gap: "3px", marginLeft: "4px" }}>
            {[{ id: "custom", label: "⠿ Custom" }, { id: "eisenhower", label: "● Priority" }, { id: "lastworked", label: "↻ Recent" }].map((opt) => (
              <button key={opt.id} onClick={() => setOngoingSort(opt.id)}
                style={{
                  fontSize: "10px", fontWeight: 600, padding: "2px 7px", borderRadius: "4px",
                  border: "1px solid", cursor: "pointer", fontFamily: "inherit", transition: "all 0.1s",
                  borderColor: ongoingSort === opt.id ? "#7C3AED" : "#EBEBEA",
                  backgroundColor: ongoingSort === opt.id ? "#F3E8FF" : "transparent",
                  color: ongoingSort === opt.id ? "#7C3AED" : "#AEAEA6",
                }}
              >{opt.label}</button>
            ))}
          </div>
        </div>
        <button onClick={() => toggleSection("ongoing")} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "13px", color: "#8A8A86", fontFamily: "inherit", padding: "4px 8px" }}>
          {expandedSections.ongoing ? "▾" : "▸"}
        </button>
      </div>
      {expandedSections.ongoing && (
        <div style={{ backgroundColor: "#FFFFFF", borderRadius: "12px", border: "1px solid #EBEBEA", marginBottom: "24px", overflow: "hidden" }}>
          {activeOngoingTasks.length === 0 ? (
            <div style={{ padding: "24px 16px", textAlign: "center", color: "#C4C4C0", fontSize: "14px" }}>No ongoing tasks</div>
          ) : activeOngoingTasks.map((t) => (
            <div key={t.id}
              onMouseEnter={(e) => { e.currentTarget.querySelectorAll('[data-move-btn]').forEach(btn => btn.style.opacity = "1"); }}
              onMouseLeave={(e) => { e.currentTarget.querySelectorAll('[data-move-btn]').forEach(btn => btn.style.opacity = "0"); }}
            >
              <TaskItem task={t} categories={categories} currentDay={currentDay} onToggle={toggleTask("ongoing")} onChangeTag={changeTag("ongoing")} onEditTask={editTask("ongoing")} onDeleteTask={deleteTask("ongoing")} onMoveToTop={moveToTop("ongoing")}
                onCompleteOngoing={() => completeOngoing(t.id)}
                draggable={ongoingSort === "custom"}
                dragHandlers={ongoingSort === "custom" ? ongoingDrag : undefined}
                isDragging={ongoingDrag.dragId === t.id}
                dropIndicator={ongoingDrag.overId === t.id && ongoingDrag.dragId !== t.id ? ongoingDrag.dropSide : null}
                moveBtn={
                  <button data-move-btn onClick={() => moveToToday(t, "ongoing")} title="Work on today"
                    style={{ fontSize: "11px", fontWeight: 600, padding: "3px 8px", borderRadius: "5px", border: "1px solid #EBEBEA", backgroundColor: "#FAFAF9", color: "#8A8A86", cursor: "pointer", fontFamily: "inherit", opacity: 0, transition: "opacity 0.15s", flexShrink: 0, marginTop: "2px" }}>→ Today</button>
                }
              />
            </div>
          ))}
        </div>
      )}

      {/* Backlog */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 16px", marginBottom: "4px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <h2 style={{ fontSize: "13px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#8A8A86", margin: 0 }}>Backlog</h2>
          <span style={{ fontSize: "11px", fontWeight: 600, color: "#B0B0AC", backgroundColor: "#F5F5F3", padding: "1px 7px", borderRadius: "10px" }}>{activeBacklogTasks.length}</span>
          {/* Sort pills */}
          <div style={{ display: "flex", gap: "3px", marginLeft: "4px" }}>
            {[{ id: "date", label: "📅 Date" }, { id: "eisenhower", label: "● Priority" }, { id: "custom", label: "⠿ Custom" }].map((opt) => (
              <button key={opt.id} onClick={() => setBacklogSort(opt.id)}
                style={{
                  fontSize: "10px", fontWeight: 600, padding: "2px 7px", borderRadius: "4px",
                  border: "1px solid", cursor: "pointer", fontFamily: "inherit", transition: "all 0.1s",
                  borderColor: backlogSort === opt.id ? "#B45309" : "#EBEBEA",
                  backgroundColor: backlogSort === opt.id ? "#FEF3C7" : "transparent",
                  color: backlogSort === opt.id ? "#B45309" : "#AEAEA6",
                }}
              >{opt.label}</button>
            ))}
          </div>
        </div>
        <button onClick={() => toggleSection("backlog")} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "13px", color: "#8A8A86", fontFamily: "inherit", padding: "4px 8px" }}>
          {expandedSections.backlog ? "▾" : "▸"}
        </button>
      </div>
      {expandedSections.backlog && (
        <div style={{ backgroundColor: "#FFFFFF", borderRadius: "12px", border: "1px solid #EBEBEA", marginBottom: "24px", overflow: "hidden" }}>
          {activeBacklogTasks.length === 0 ? (
            <div style={{ padding: "24px 16px", textAlign: "center", color: "#C4C4C0", fontSize: "14px" }}>No backlog tasks</div>
          ) : backlogSort === "date" ? (
            // Date mode: grouped by creation date
            backlogGroups.map(([date, tasks]) => (
              <div key={date}>
                <div style={{ padding: "10px 16px 4px", fontSize: "12px", fontWeight: 600, color: "#B0B0AC" }}>
                  {date === "No date" ? "No date" : `Created ${formatDate(date)}`}
                </div>
                {tasks.map((t) => (
                  <div key={t.id}
                    onMouseEnter={(e) => { e.currentTarget.querySelectorAll('[data-move-btn]').forEach(btn => btn.style.opacity = "1"); }}
                    onMouseLeave={(e) => { e.currentTarget.querySelectorAll('[data-move-btn]').forEach(btn => btn.style.opacity = "0"); }}
                  >
                    <TaskItem task={t} categories={categories} currentDay={currentDay} onToggle={toggleTask("backlog")} onChangeTag={changeTag("backlog")} onEditTask={editTask("backlog")} onDeleteTask={deleteTask("backlog")} onMoveToTop={moveToTop("backlog")}
                      onSkipRecurring={t.recurringParentId ? ((id) => skipRecurring(id, "backlog")) : undefined}
                      onNavigateToRecurring={t.recurringParentId ? navigateToRecurring : undefined}
                      moveBtn={<button data-move-btn onClick={() => moveToToday(t, "backlog")} title="Move to Today"
                        style={{ fontSize: "11px", fontWeight: 600, padding: "3px 8px", borderRadius: "5px", border: "1px solid #EBEBEA", backgroundColor: "#FAFAF9", color: "#8A8A86", cursor: "pointer", fontFamily: "inherit", opacity: 0, transition: "opacity 0.15s", flexShrink: 0, marginTop: "2px" }}>→ Today</button>}
                    />
                  </div>
                ))}
              </div>
            ))
          ) : (
            // Eisenhower or Custom: flat list with optional drag
            sortedBacklogTasks.map((t) => (
              <div key={t.id}
                onMouseEnter={(e) => { e.currentTarget.querySelectorAll('[data-move-btn]').forEach(btn => btn.style.opacity = "1"); }}
                onMouseLeave={(e) => { e.currentTarget.querySelectorAll('[data-move-btn]').forEach(btn => btn.style.opacity = "0"); }}
              >
                <TaskItem task={t} categories={categories} currentDay={currentDay} onToggle={toggleTask("backlog")} onChangeTag={changeTag("backlog")} onEditTask={editTask("backlog")} onDeleteTask={deleteTask("backlog")} onMoveToTop={moveToTop("backlog")}
                  onSkipRecurring={t.recurringParentId ? ((id) => skipRecurring(id, "backlog")) : undefined}
                  onNavigateToRecurring={t.recurringParentId ? navigateToRecurring : undefined}
                  draggable={backlogSort === "custom"}
                  dragHandlers={backlogSort === "custom" ? backlogDrag : undefined}
                  isDragging={backlogDrag.dragId === t.id}
                  dropIndicator={backlogDrag.overId === t.id && backlogDrag.dragId !== t.id ? backlogDrag.dropSide : null}
                  moveBtn={<button data-move-btn onClick={() => moveToToday(t, "backlog")} title="Move to Today"
                    style={{ fontSize: "11px", fontWeight: 600, padding: "3px 8px", borderRadius: "5px", border: "1px solid #EBEBEA", backgroundColor: "#FAFAF9", color: "#8A8A86", cursor: "pointer", fontFamily: "inherit", opacity: 0, transition: "opacity 0.15s", flexShrink: 0, marginTop: "2px" }}>→ Today</button>}
                />
              </div>
            ))
          )}
        </div>
      )}

      {showNewDay && <NewDayModal tasks={todayTasks} categories={categories} onDecide={handleNewDay} onCancel={() => setShowNewDay(false)} />}
    </div>
  );
}

/* ═══════════════════════════════════════════
   TAB 2: FUTURE NOTEBOOK
   ═══════════════════════════════════════════ */

function FutureTasksTab({ futureTasks, setFutureTasks, somedayTasks, setSomedayTasks, setTodayTasks, setBacklogTasks, setOngoingTasks, categories, setCategories, currentDay, navigateToRecurring }) {
  const addTask = useCallback((task) => {
    if (task.ongoing) { setOngoingTasks((prev) => [task, ...prev]); }
    else if (!task.dueDate) { setSomedayTasks((prev) => [task, ...prev]); }
    else if (task.dueDate === currentDay) { setTodayTasks((prev) => [task, ...prev]); }
    else if (new Date(task.dueDate + "T12:00:00") > new Date(currentDay + "T12:00:00")) { setFutureTasks((prev) => [task, ...prev]); }
    else { setBacklogTasks((prev) => [task, ...prev]); }
  }, [setTodayTasks, setBacklogTasks, setSomedayTasks, setFutureTasks, setOngoingTasks, currentDay]);

  const toggleTask = useCallback((section) => (id) => {
    const setter = section === "future" ? setFutureTasks : setSomedayTasks;
    setter((prev) => prev.map((t) => {
      if (t.id !== id) return t;
      const nowCompleted = !t.completed;
      return { ...t, completed: nowCompleted, completedDate: nowCompleted ? nowTimestamp() : null };
    }));
  }, [setFutureTasks, setSomedayTasks]);

  const changeTag = useCallback((section) => (id, catId, newVal) => {
    const setter = section === "future" ? setFutureTasks : setSomedayTasks;
    setter((prev) => prev.map((t) => t.id === id ? { ...t, tags: { ...t.tags, [catId]: newVal } } : t));
  }, [setFutureTasks, setSomedayTasks]);

  const editTask = useCallback((section) => (id, updates) => {
    const setterMap = { future: setFutureTasks, someday: setSomedayTasks, today: setTodayTasks, backlog: setBacklogTasks };
    const currentSetter = setterMap[section];

    if (updates.dueDate !== undefined) {
      let needsMove = false;
      let targetSection = section;
      const newDue = updates.dueDate;

      if (!newDue && section !== "someday") { targetSection = "someday"; needsMove = true; }
      else if (newDue === currentDay && section !== "today") { targetSection = "today"; needsMove = true; }
      else if (newDue && newDue > currentDay && section !== "future") { targetSection = "future"; needsMove = true; }
      else if (newDue && newDue < currentDay && section !== "backlog") { targetSection = "backlog"; needsMove = true; }

      if (needsMove) {
        let movedTask = null;
        currentSetter((prev) => {
          const task = prev.find((t) => t.id === id);
          if (task) movedTask = { ...task, ...updates };
          return prev.filter((t) => t.id !== id);
        });
        setTimeout(() => {
          if (movedTask) setterMap[targetSection]((prev) => [movedTask, ...prev]);
        }, 0);
        return;
      }
    }

    currentSetter((prev) => prev.map((t) => t.id === id ? { ...t, ...updates } : t));
  }, [setFutureTasks, setSomedayTasks, setTodayTasks, setBacklogTasks, currentDay]);

  const deleteTask = useCallback((section) => (id) => {
    const setter = section === "future" ? setFutureTasks : setSomedayTasks;
    setter((prev) => prev.map((t) => t.id === id ? { ...t, deleted: true, deletedDate: nowTimestamp() } : t));
  }, [setFutureTasks, setSomedayTasks]);

  const moveToToday = (task, source) => {
    const setter = source === "future" ? setFutureTasks : setSomedayTasks;
    setter((prev) => prev.filter((t) => t.id !== task.id));
    setTodayTasks((prev) => [{ ...task, dueDate: currentDay }, ...prev]);
  };

  const moveToTop = useCallback((section) => (taskId) => {
    const setter = section === "future" ? setFutureTasks : setSomedayTasks;
    setter((prev) => {
      const idx = prev.findIndex((t) => t.id === taskId);
      if (idx <= 0) return prev;
      const updated = [...prev];
      const [moved] = updated.splice(idx, 1);
      updated.unshift(moved);
      return updated;
    });
  }, [setFutureTasks, setSomedayTasks]);

  const activeFuture = futureTasks.filter((t) => !t.deleted);
  const activeSomeday = somedayTasks.filter((t) => !t.deleted);

  // Someday sort
  const [somedaySort, setSomedaySort] = useState("date"); // "date" | "eisenhower" | "custom"
  const sortedSomedayTasks = (() => {
    if (somedaySort === "eisenhower") {
      return [...activeSomeday].sort((a, b) => {
        const pa = EISENHOWER_PRIORITY[a.tags?.eisenhower] ?? 99;
        const pb = EISENHOWER_PRIORITY[b.tags?.eisenhower] ?? 99;
        return pa - pb;
      });
    }
    if (somedaySort === "custom") {
      return [...activeSomeday].sort((a, b) => (a.somedayOrder ?? 999) - (b.somedayOrder ?? 999));
    }
    return activeSomeday;
  })();
  const somedayGroups = somedaySort === "date" ? groupByCreatedDate(activeSomeday) : null;
  const somedayDrag = useDragReorder(sortedSomedayTasks, setSomedayTasks);

  const currentDayDate = new Date(currentDay + "T12:00:00");
  const sevenDaysOut = new Date(currentDayDate);
  sevenDaysOut.setDate(sevenDaysOut.getDate() + 7);
  const sevenDaysStr = sevenDaysOut.toISOString().split("T")[0];

  const upcomingTasks = activeFuture.filter((t) => t.dueDate && t.dueDate > currentDay && t.dueDate <= sevenDaysStr);
  const furtherTasks = activeFuture.filter((t) => t.dueDate && t.dueDate > sevenDaysStr);

  // Group by date
  const groupByDueDate = (tasks) => {
    const groups = {};
    tasks.forEach((t) => {
      const key = t.dueDate || "No date";
      if (!groups[key]) groups[key] = [];
      groups[key].push(t);
    });
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  };

  const upcomingGroups = groupByDueDate(upcomingTasks);
  const furtherGroups = groupByDueDate(furtherTasks);

  const renderTaskGroup = (groups, emptyMsg, section) => (
    <div style={{ backgroundColor: "#FFFFFF", borderRadius: "12px", border: "1px solid #EBEBEA", marginBottom: "24px", overflow: "hidden" }}>
      {groups.length === 0 ? (
        <div style={{ padding: "24px 16px", textAlign: "center", color: "#C4C4C0", fontSize: "14px" }}>{emptyMsg}</div>
      ) : groups.map(([date, tasks]) => (
        <div key={date}>
          <div style={{ padding: "10px 16px 4px", fontSize: "12px", fontWeight: 600, color: "#B0B0AC" }}>
            {(() => {
              if (date === "No date") return "No date";
              const d = new Date(date + "T12:00:00");
              const dayName = d.toLocaleDateString("en-US", { weekday: "long" });
              const dateStr = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
              const daysUntil = Math.round((d - currentDayDate) / (1000 * 60 * 60 * 24));
              const label = daysUntil === 1 ? "Tomorrow" : `${daysUntil} days`;
              return `${dayName}, ${dateStr} · ${label}`;
            })()}
          </div>
          {tasks.map((t) => (
            <div key={t.id}
              onMouseEnter={(e) => { e.currentTarget.querySelectorAll('[data-move-btn]').forEach(btn => btn.style.opacity = "1"); }}
              onMouseLeave={(e) => { e.currentTarget.querySelectorAll('[data-move-btn]').forEach(btn => btn.style.opacity = "0"); }}
            >
              <TaskItem task={t} categories={categories} currentDay={currentDay}
                onToggle={toggleTask(section)} onChangeTag={changeTag(section)}
                onEditTask={editTask(section)} onDeleteTask={deleteTask(section)} onMoveToTop={moveToTop(section)}
                onNavigateToRecurring={t.recurringParentId ? navigateToRecurring : undefined}
                moveBtn={
                  <button data-move-btn onClick={() => moveToToday(t, section)} title="Move to Today"
                    style={{ fontSize: "11px", fontWeight: 600, padding: "3px 8px", borderRadius: "5px", border: "1px solid #EBEBEA", backgroundColor: "#FAFAF9", color: "#8A8A86", cursor: "pointer", fontFamily: "inherit", opacity: 0, transition: "opacity 0.15s", flexShrink: 0, marginTop: "2px" }}>→ Today</button>
                }
              />
            </div>
          ))}
        </div>
      ))}
    </div>
  );

  const totalCount = activeFuture.length + activeSomeday.length;

  return (
    <div style={{ maxWidth: "580px", margin: "0 auto" }}>
      <div style={{ marginBottom: "32px" }}>
        <h1 style={{ fontSize: "26px", fontWeight: 700, color: "#1A1A1A", margin: 0, lineHeight: 1.2 }}>Future Notebook</h1>
        <p style={{ fontSize: "14px", color: "#8A8A86", margin: "4px 0 0 0" }}>{totalCount} task{totalCount !== 1 ? "s" : ""} planned</p>
      </div>

      <NewTaskForm categories={categories} setCategories={setCategories} onAdd={addTask} defaultDueDate="" />

      <SectionHeader title="Upcoming — Next 7 Days" count={upcomingTasks.length} />
      {renderTaskGroup(upcomingGroups, "No tasks in the next 7 days", "future")}

      <SectionHeader title="Future — Beyond 7 Days" count={furtherTasks.length} />
      {renderTaskGroup(furtherGroups, "No tasks scheduled beyond 7 days", "future")}

      {/* Someday */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 16px", marginBottom: "4px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <h2 style={{ fontSize: "13px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#8A8A86", margin: 0 }}>Someday</h2>
          <span style={{ fontSize: "11px", fontWeight: 600, color: "#B0B0AC", backgroundColor: "#F5F5F3", padding: "1px 7px", borderRadius: "10px" }}>{activeSomeday.length}</span>
          {/* Sort pills */}
          <div style={{ display: "flex", gap: "3px", marginLeft: "4px" }}>
            {[{ id: "date", label: "📅 Date" }, { id: "eisenhower", label: "● Priority" }, { id: "custom", label: "⠿ Custom" }].map((opt) => (
              <button key={opt.id} onClick={() => setSomedaySort(opt.id)}
                style={{
                  fontSize: "10px", fontWeight: 600, padding: "2px 7px", borderRadius: "4px",
                  border: "1px solid", cursor: "pointer", fontFamily: "inherit", transition: "all 0.1s",
                  borderColor: somedaySort === opt.id ? "#2563EB" : "#EBEBEA",
                  backgroundColor: somedaySort === opt.id ? "#DBEAFE" : "transparent",
                  color: somedaySort === opt.id ? "#2563EB" : "#AEAEA6",
                }}
              >{opt.label}</button>
            ))}
          </div>
        </div>
      </div>
      <div style={{ backgroundColor: "#FFFFFF", borderRadius: "12px", border: "1px solid #EBEBEA", overflow: "hidden" }}>
        {activeSomeday.length === 0 ? (
          <div style={{ padding: "24px 16px", textAlign: "center", color: "#C4C4C0", fontSize: "14px" }}>No someday tasks</div>
        ) : somedaySort === "date" ? (
          // Date mode: grouped by creation date
          somedayGroups.map(([date, tasks]) => (
            <div key={date}>
              <div style={{ padding: "10px 16px 4px", fontSize: "12px", fontWeight: 600, color: "#B0B0AC" }}>
                {date === "No date" ? "No date" : `Created ${formatDate(date)}`}
              </div>
              {tasks.map((t) => (
                <div key={t.id}
                  onMouseEnter={(e) => { e.currentTarget.querySelectorAll('[data-move-btn]').forEach(btn => btn.style.opacity = "1"); }}
                  onMouseLeave={(e) => { e.currentTarget.querySelectorAll('[data-move-btn]').forEach(btn => btn.style.opacity = "0"); }}
                >
                  <TaskItem task={t} categories={categories} currentDay={currentDay}
                    onToggle={toggleTask("someday")} onChangeTag={changeTag("someday")}
                    onEditTask={editTask("someday")} onDeleteTask={deleteTask("someday")} onMoveToTop={moveToTop("someday")}
                    moveBtn={
                      <button data-move-btn onClick={() => moveToToday(t, "someday")} title="Move to Today"
                        style={{ fontSize: "11px", fontWeight: 600, padding: "3px 8px", borderRadius: "5px", border: "1px solid #EBEBEA", backgroundColor: "#FAFAF9", color: "#8A8A86", cursor: "pointer", fontFamily: "inherit", opacity: 0, transition: "opacity 0.15s", flexShrink: 0, marginTop: "2px" }}>→ Today</button>
                    }
                  />
                </div>
              ))}
            </div>
          ))
        ) : (
          // Eisenhower or Custom: flat list with optional drag
          sortedSomedayTasks.map((t) => (
            <div key={t.id}
              onMouseEnter={(e) => { e.currentTarget.querySelectorAll('[data-move-btn]').forEach(btn => btn.style.opacity = "1"); }}
              onMouseLeave={(e) => { e.currentTarget.querySelectorAll('[data-move-btn]').forEach(btn => btn.style.opacity = "0"); }}
            >
              <TaskItem task={t} categories={categories} currentDay={currentDay}
                onToggle={toggleTask("someday")} onChangeTag={changeTag("someday")}
                onEditTask={editTask("someday")} onDeleteTask={deleteTask("someday")} onMoveToTop={moveToTop("someday")}
                draggable={somedaySort === "custom"}
                dragHandlers={somedaySort === "custom" ? somedayDrag : undefined}
                isDragging={somedayDrag.dragId === t.id}
                dropIndicator={somedayDrag.overId === t.id && somedayDrag.dragId !== t.id ? somedayDrag.dropSide : null}
                moveBtn={
                  <button data-move-btn onClick={() => moveToToday(t, "someday")} title="Move to Today"
                    style={{ fontSize: "11px", fontWeight: 600, padding: "3px 8px", borderRadius: "5px", border: "1px solid #EBEBEA", backgroundColor: "#FAFAF9", color: "#8A8A86", cursor: "pointer", fontFamily: "inherit", opacity: 0, transition: "opacity 0.15s", flexShrink: 0, marginTop: "2px" }}>→ Today</button>
                }
              />
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   TAB 3: TASK DATABASE
   ═══════════════════════════════════════════ */

function DatabaseTab({ allTasks, categories }) {
  const [sortCol, setSortCol] = useState(null);
  const [sortDir, setSortDir] = useState("asc");
  const [filterSection, setFilterSection] = useState("All");
  const [rangeFilter, setRangeFilter] = useState("All");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  const columns = [
    { key: "title", label: "Title", width: "20%" },
    { key: "section", label: "Section", width: "8%" },
    { key: "life", label: "Life", width: "9%", isTag: true },
    { key: "eisenhower", label: "E-M Value", width: "9%", isTag: true },
    { key: "project", label: "Project", width: "10%", isTag: true },
    { key: "dueDate", label: "Due", width: "8%" },
    { key: "createdDate", label: "Created", width: "8%" },
    { key: "completedDate", label: "Completed", width: "8%" },
    { key: "deletedDate", label: "Deleted", width: "8%" },
    { key: "dayOrder", label: "Day #", width: "5%" },
    { key: "completed", label: "Done", width: "6%" },
  ];

  const handleSort = (key) => {
    if (sortCol === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortCol(key); setSortDir("asc"); }
  };

  let tasks = [...allTasks];
  if (filterSection === "Deleted") tasks = tasks.filter((t) => t.deleted);
  else if (filterSection === "Waiting") tasks = tasks.filter((t) => t.status === "waiting" && !t.deleted && !t.completed);
  else if (filterSection === "Recurring") tasks = tasks.filter((t) => t.recurringParentId);
  else if (filterSection === "Skipped") tasks = tasks.filter((t) => t.recurringParentId && t.recurringStatus === "skipped");
  else if (filterSection === "Missed") tasks = tasks.filter((t) => t.recurringParentId && t.recurringStatus === "missed");
  else if (filterSection !== "All") tasks = tasks.filter((t) => t.section === filterSection && !t.deleted);
  else if (filterSection === "All") { /* show everything including deleted */ }

  // ── Date-range view filter (v1.8 Phase 1) ─────────────────────────
  // View-only and non-destructive. Anchored on DUE DATE. Undated rows are
  // excluded whenever a range is active. Fixed 30/60/90 windows look
  // backward from today: [today − N, today]. Custom is an arbitrary window
  // that may include future dates; an empty custom range is inactive
  // (behaves like All time). "Today" is read from getTodayStr() so the
  // window obeys the fake clock in the rig build.
  let rangeStart = null, rangeEnd = null, rangeActive = false;
  if (rangeFilter === "custom") {
    rangeStart = customStart || null;
    rangeEnd = customEnd || null;
    rangeActive = !!(rangeStart || rangeEnd);
  } else if (rangeFilter !== "All") {
    const days = parseInt(rangeFilter, 10);
    const anchor = getTodayStr();
    const d = new Date(anchor + "T12:00:00");
    d.setDate(d.getDate() - days);
    rangeStart = d.toISOString().split("T")[0];
    rangeEnd = anchor;
    rangeActive = true;
  }
  if (rangeActive) {
    tasks = tasks.filter((t) => {
      if (!t.dueDate) return false;
      if (rangeStart && t.dueDate < rangeStart) return false;
      if (rangeEnd && t.dueDate > rangeEnd) return false;
      return true;
    });
  }
  const rangeHint = rangeActive
    ? `due ${rangeStart ? formatDateShort(rangeStart) : "any"} – ${rangeEnd ? formatDateShort(rangeEnd) : "any"}`
    : null;

  if (sortCol) {
    tasks.sort((a, b) => {
      const col = columns.find((c) => c.key === sortCol);
      let va = col?.isTag ? (a.tags?.[sortCol] || "") : a[sortCol];
      let vb = col?.isTag ? (b.tags?.[sortCol] || "") : b[sortCol];
      if (va == null) va = "";
      if (vb == null) vb = "";
      if (typeof va === "boolean") { va = va ? 1 : 0; vb = vb ? 1 : 0; }
      if (typeof va === "number") return sortDir === "asc" ? va - vb : vb - va;
      return sortDir === "asc" ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va));
    });
  }

  const sectionColors = { Today: { bg: "#ECFDF5", text: "#059669" }, Ongoing: { bg: "#F3E8FF", text: "#7C3AED" }, Backlog: { bg: "#FEF3C7", text: "#B45309" }, Someday: { bg: "#F3F4F6", text: "#6B7280" }, Future: { bg: "#EEF2FF", text: "#4F46E5" }, Recurring: { bg: "#E0F2FE", text: "#0369A1" }, Completed: { bg: "#ECFDF5", text: "#059669" }, Waiting: { bg: "#FEF3C7", text: "#D97706" }, Deleted: { bg: "#FEE2E2", text: "#DC2626" } };

  return (
    <div>
      <div style={{ display: "flex", gap: "6px", marginBottom: "12px", alignItems: "center", flexWrap: "wrap", rowGap: "6px" }}>
        <span style={{ fontSize: "12px", fontWeight: 600, color: "#AEAEA6", marginRight: "4px" }}>Filter:</span>
        {["All", "Today", "Ongoing", "Backlog", "Someday", "Future", "Recurring", "Skipped", "Missed", "Completed", "Waiting", "Deleted"].map((s) => (
          <button key={s} onClick={() => setFilterSection(s)}
            style={{
              fontSize: "12px", fontWeight: filterSection === s ? 700 : 500, padding: "4px 10px", borderRadius: "6px",
              border: "1px solid", borderColor: filterSection === s ? "#1A1A1A" : "#EBEBEA",
              backgroundColor: filterSection === s ? "#1A1A1A" : "#FFFFFF", color: filterSection === s ? "#FFFFFF" : "#6B6B67",
              cursor: "pointer", fontFamily: "inherit",
            }}>{s}</button>
        ))}
        <span style={{ fontSize: "12px", color: "#C4C4C0", marginLeft: "8px" }}>{tasks.length} tasks</span>
      </div>

      <div style={{ display: "flex", gap: "6px", marginBottom: "16px", alignItems: "center", flexWrap: "wrap", rowGap: "6px" }}>
        <span style={{ fontSize: "12px", fontWeight: 600, color: "#AEAEA6", marginRight: "4px" }}>Range:</span>
        {[["All", "All time"], ["30", "30 days"], ["60", "60 days"], ["90", "90 days"], ["custom", "Custom"]].map(([key, label]) => (
          <button key={key} onClick={() => setRangeFilter(key)}
            style={{
              fontSize: "12px", fontWeight: rangeFilter === key ? 700 : 500, padding: "4px 10px", borderRadius: "6px",
              border: "1px solid", borderColor: rangeFilter === key ? "#1A1A1A" : "#EBEBEA",
              backgroundColor: rangeFilter === key ? "#1A1A1A" : "#FFFFFF", color: rangeFilter === key ? "#FFFFFF" : "#6B6B67",
              cursor: "pointer", fontFamily: "inherit",
            }}>{label}</button>
        ))}
        {rangeFilter === "custom" && (
          <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", flexWrap: "nowrap", flexShrink: 0, marginLeft: "4px" }}>
            <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)}
              style={{ fontSize: "12px", padding: "3px 8px", borderRadius: "6px", border: "1px solid #EBEBEA", backgroundColor: "#FFFFFF", color: "#1A1A1A", fontFamily: "inherit", outline: "none" }} />
            <span style={{ fontSize: "12px", color: "#AEAEA6" }}>to</span>
            <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)}
              style={{ fontSize: "12px", padding: "3px 8px", borderRadius: "6px", border: "1px solid #EBEBEA", backgroundColor: "#FFFFFF", color: "#1A1A1A", fontFamily: "inherit", outline: "none" }} />
          </span>
        )}
        {rangeHint && (
          <span style={{ fontSize: "12px", color: "#C4C4C0", marginLeft: "8px" }}>{rangeHint}</span>
        )}
      </div>

      <div style={{ borderRadius: "10px", border: "1px solid #EBEBEA", overflow: "hidden", backgroundColor: "#FFFFFF" }}>
        <div style={{ display: "flex", borderBottom: "2px solid #EBEBEA", backgroundColor: "#FAFAF9" }}>
          {columns.map((col) => (
            <div key={col.key} onClick={() => handleSort(col.key)}
              style={{
                width: col.width, padding: "10px 10px", fontSize: "11px", fontWeight: 700, textTransform: "uppercase",
                letterSpacing: "0.06em", color: sortCol === col.key ? "#1A1A1A" : "#AEAEA6",
                cursor: "pointer", userSelect: "none", display: "flex", alignItems: "center", gap: "4px",
              }}>
              {col.label}
              {sortCol === col.key && <span style={{ fontSize: "10px" }}>{sortDir === "asc" ? "▲" : "▼"}</span>}
            </div>
          ))}
        </div>
        {tasks.length === 0 ? (
          <div style={{ padding: "32px 16px", textAlign: "center", color: "#C4C4C0", fontSize: "14px" }}>No tasks match this filter</div>
        ) : tasks.map((task) => {
          const sc = sectionColors[task.section] || sectionColors.Someday;
          return (
            <div key={task.id}
              style={{ display: "flex", borderBottom: "1px solid #F5F5F3", opacity: task.deleted ? 0.4 : task.completed ? 0.5 : 1, transition: "background-color 0.1s" }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#FCFCFB"; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
            >
              <div style={{ ...cellStyle, width: "20%", fontWeight: 500, textDecoration: task.completed || task.deleted ? "line-through" : "none" }}>{task.title}</div>
              <div style={{ ...cellStyle, width: "8%" }}>
                <span style={{ fontSize: "11px", fontWeight: 600, padding: "2px 6px", borderRadius: "4px", backgroundColor: sc.bg, color: sc.text }}>{task.deleted ? "Deleted" : task.section}</span>
              </div>
              <div style={{ ...cellStyle, width: "9%" }}><TagBadge categories={categories} categoryId="life" valueId={task.tags?.life} small /></div>
              <div style={{ ...cellStyle, width: "9%" }}><TagBadge categories={categories} categoryId="eisenhower" valueId={task.tags?.eisenhower} small /></div>
              <div style={{ ...cellStyle, width: "10%" }}><TagBadge categories={categories} categoryId="project" valueId={task.tags?.project} small /></div>
              <div style={{ ...cellStyle, width: "8%", color: "#6B6B67", fontSize: "12px" }}>{formatDateShort(task.dueDate)}</div>
              <div style={{ ...cellStyle, width: "8%", color: "#6B6B67", fontSize: "12px" }}>{formatDateShort(task.createdDate)}</div>
              <div style={{ ...cellStyle, width: "8%", color: "#6B6B67", fontSize: "12px" }}>{formatDateShort(task.completedDate)}</div>
              <div style={{ ...cellStyle, width: "8%", color: task.deleted ? "#DC2626" : "#6B6B67", fontSize: "12px" }}>{formatDateShort(task.deletedDate)}</div>
              <div style={{ ...cellStyle, width: "5%", color: "#AEAEA6", fontSize: "12px" }}>{task.dayOrder ?? "—"}</div>
              <div style={{ ...cellStyle, width: "6%" }}>{task.completed ? <span style={{ color: "#059669" }}>✓</span> : <span style={{ color: "#D4D4D0" }}>○</span>}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   EMOJI PICKER
   ═══════════════════════════════════════════ */

const emojiGroups = [
  { name: "Circles & Shapes", emojis: ["🔴","🟠","🟡","🟢","🔵","🟣","⚫","⚪","🟤","🩷","🩵","🩶","💠","🔶","🔷","🔸","🔹","▪️","▫️","◾","◽"] },
  { name: "Symbols", emojis: ["⭐","🌟","✨","💫","⚡","🔥","💧","🌊","❄️","🌈","☀️","🌙","⛅","🍀","🌸","🌺","🌻","🍂","🍁","💎","🎯","🏆","🎨","🎭","🎪"] },
  { name: "Status & Priority", emojis: ["❗","‼️","❓","❕","⚠️","🚨","🛑","🚩","🏁","✅","❌","⭕","🔔","🔕","📌","📍","🔒","🔓","⏰","⏳","📅","📆"] },
  { name: "Work & Tasks", emojis: ["💼","📁","📂","📋","📝","✏️","📎","🔗","📐","📏","🖥️","💻","📱","📧","📞","🔍","🔎","💡","🧩","🔧","⚙️","🛠️","📊","📈","📉"] },
  { name: "People & Hands", emojis: ["👤","👥","🤝","👍","👎","👏","🙌","💪","🧠","👀","💬","💭","🗣️","✋","☝️","👆","👇","👈","👉","✌️","🤞","🫡"] },
  { name: "Hearts & Feelings", emojis: ["❤️","🧡","💛","💚","💙","💜","🖤","🤍","🤎","💔","❤️‍🔥","💕","💖","💗","💘","💝","😊","😎","🤔","😤","😴","🎉","🎊"] },
  { name: "Animals & Nature", emojis: ["🐶","🐱","🐻","🦊","🦁","🐸","🦋","🐝","🐞","🐢","🐙","🦀","🐳","🦈","🐦","🦅","🌲","🌴","🌵","🌿","☘️","🍃"] },
  { name: "Food & Drink", emojis: ["🍎","🍊","🍋","🍇","🍓","🥑","🥕","🌽","🍕","🍔","🌮","🍜","☕","🍵","🧃","🥤","🍷","🍺","🧁","🍰","🍫","🍿"] },
];

function EmojiPicker({ currentEmoji, onSelect }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef(null);

  useState(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  });

  const allEmojis = emojiGroups.flatMap((g) => g.emojis.map((e) => ({ emoji: e, group: g.name })));
  const filtered = search
    ? allEmojis.filter((e) => e.group.toLowerCase().includes(search.toLowerCase()))
    : null;

  return (
    <div ref={ref} style={{ position: "relative", display: "flex", alignItems: "center", gap: "4px" }}>
      <input type="text" value={currentEmoji || ""} readOnly
        style={{ width: "36px", fontSize: "16px", textAlign: "center", border: "1px solid #EBEBEA", borderRadius: "4px", padding: "2px", outline: "none", fontFamily: "inherit", cursor: "default" }}
      />
      <button
        onClick={() => { setOpen((o) => !o); setSearch(""); }}
        title="Browse emojis"
        style={{
          fontSize: "11px", fontWeight: 600, padding: "3px 6px", borderRadius: "4px",
          border: "1px solid #EBEBEA", backgroundColor: "#FAFAF9", color: "#8A8A86",
          cursor: "pointer", fontFamily: "inherit", transition: "background-color 0.1s",
        }}
        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#EBEBEA"; }}
        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "#FAFAF9"; }}
      >Browse</button>
      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 4px)", right: 0, width: "280px", maxHeight: "320px",
          backgroundColor: "#FFFFFF", borderRadius: "10px", border: "1px solid #EBEBEA",
          boxShadow: "0 8px 24px rgba(0,0,0,0.12)", zIndex: 200, overflow: "hidden",
          display: "flex", flexDirection: "column",
        }}>
          <div style={{ padding: "8px 8px 4px" }}>
            <input type="text" placeholder="Search by category..." value={search} onChange={(e) => setSearch(e.target.value)} autoFocus
              style={{
                width: "100%", fontSize: "13px", padding: "6px 8px", border: "1px solid #EBEBEA",
                borderRadius: "6px", outline: "none", fontFamily: "inherit", color: "#1A1A1A",
                boxSizing: "border-box", backgroundColor: "#FAFAF9",
              }}
            />
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: "4px 8px 8px" }}>
            {filtered ? (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "2px" }}>
                {filtered.length === 0 && <div style={{ padding: "12px", color: "#AEAEA6", fontSize: "13px", width: "100%" }}>No matches</div>}
                {filtered.map((e, i) => (
                  <span key={i} onClick={() => { onSelect(e.emoji); setOpen(false); }}
                    style={{ fontSize: "20px", padding: "4px", borderRadius: "6px", cursor: "pointer", transition: "background-color 0.1s", lineHeight: 1 }}
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#F0F0EC"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
                  >{e.emoji}</span>
                ))}
              </div>
            ) : (
              emojiGroups.map((group) => (
                <div key={group.name} style={{ marginBottom: "8px" }}>
                  <div style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#AEAEA6", padding: "4px 0 2px", position: "sticky", top: 0, backgroundColor: "#FFFFFF" }}>
                    {group.name}
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "2px" }}>
                    {group.emojis.map((emoji, i) => (
                      <span key={i} onClick={() => { onSelect(emoji); setOpen(false); }}
                        style={{
                          fontSize: "20px", padding: "4px", borderRadius: "6px", cursor: "pointer",
                          transition: "background-color 0.1s", lineHeight: 1,
                          backgroundColor: emoji === currentEmoji ? "#EEF2FF" : "transparent",
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#F0F0EC"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = emoji === currentEmoji ? "#EEF2FF" : "transparent"; }}
                      >{emoji}</span>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════
   TAB 4: TAG MANAGER
   ═══════════════════════════════════════════ */

function TagsTab({ categories, setCategories }) {
  const [editingCatName, setEditingCatName] = useState(null);
  const [editingValue, setEditingValue] = useState(null);
  const [tempName, setTempName] = useState("");

  const updateCategoryName = (catId, newName) => {
    setCategories((prev) => prev.map((c) => c.id === catId ? { ...c, name: newName } : c));
    setEditingCatName(null);
  };

  const addValue = (catId) => {
    const newVal = { id: generateId(), label: "New Value", previewLabel: "New", display: "color", bg: "#F3F4F6", text: "#6B7280" };
    setCategories((prev) => prev.map((c) => c.id === catId ? { ...c, values: [...c.values, newVal] } : c));
    setEditingValue(newVal.id);
    setTempName("New Value");
  };

  const updateValueLabel = (catId, valId, newLabel) => {
    setCategories((prev) => prev.map((c) => c.id === catId ? { ...c, values: c.values.map((v) => v.id === valId ? { ...v, label: newLabel } : v) } : c));
    setEditingValue(null);
  };

  const [editingPreview, setEditingPreview] = useState(null);
  const [tempPreview, setTempPreview] = useState("");

  const updateValuePreviewLabel = (catId, valId, newPreview) => {
    setCategories((prev) => prev.map((c) => c.id === catId ? { ...c, values: c.values.map((v) => v.id === valId ? { ...v, previewLabel: newPreview } : v) } : c));
    setEditingPreview(null);
  };

  const updateValueColor = (catId, valId, field, color) => {
    setCategories((prev) => prev.map((c) => c.id === catId ? { ...c, values: c.values.map((v) => v.id === valId ? { ...v, [field]: color } : v) } : c));
  };

  const updateValueEmoji = (catId, valId, emoji) => {
    setCategories((prev) => prev.map((c) => c.id === catId ? { ...c, values: c.values.map((v) => v.id === valId ? { ...v, emoji } : v) } : c));
  };

  const updateValueLifeCategory = (catId, valId, lifeCategoryId) => {
    setCategories((prev) => prev.map((c) => c.id === catId ? { ...c, values: c.values.map((v) => v.id === valId ? { ...v, lifeCategoryId: lifeCategoryId || null } : v) } : c));
  };

  const lifeCat = categories.find((c) => c.id === "life");

  const deleteValue = (catId, valId) => {
    setCategories((prev) => prev.map((c) => c.id === catId ? { ...c, values: c.values.filter((v) => v.id !== valId) } : c));
  };

  const addCategory = () => {
    const newCat = { id: generateId(), name: "New Category", values: [] };
    setCategories((prev) => [...prev, newCat]);
    setEditingCatName(newCat.id);
    setTempName("New Category");
  };

  const deleteCategory = (catId) => {
    setCategories((prev) => prev.filter((c) => c.id !== catId));
  };

  const colHeaders = ["Preview", "Name", "Display", "Colors / Emoji", "Actions"];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px", maxWidth: "800px", margin: "0 auto" }}>
      {categories.map((cat) => (
        <div key={cat.id} style={{ backgroundColor: "#FFFFFF", borderRadius: "12px", border: "1px solid #EBEBEA", overflow: "hidden" }}>
          {/* Category header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", borderBottom: "1px solid #F1F1F0", backgroundColor: "#FAFAF9" }}>
            <div>
              {editingCatName === cat.id ? (
                <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                  <input type="text" value={tempName} onChange={(e) => setTempName(e.target.value)} autoFocus
                    onKeyDown={(e) => { if (e.key === "Enter") updateCategoryName(cat.id, tempName); if (e.key === "Escape") setEditingCatName(null); }}
                    style={{ fontSize: "15px", fontWeight: 600, border: "1px solid #EBEBEA", borderRadius: "6px", padding: "4px 8px", outline: "none", fontFamily: "inherit", color: "#1A1A1A" }}
                  />
                  <button onClick={() => updateCategoryName(cat.id, tempName)} style={tinyBtnStyle}>Save</button>
                </div>
              ) : (
                <>
                  <div style={{ fontSize: "15px", fontWeight: 600, color: "#1A1A1A" }}>{cat.name}</div>
                  <div style={{ fontSize: "12px", color: "#AEAEA6", marginTop: "2px" }}>
                    {cat.values.length} values · Display: {cat.values[0]?.display === "emoji" ? "Emoji" : "Color badge"}
                  </div>
                </>
              )}
            </div>
            <div style={{ display: "flex", gap: "6px" }}>
              <button onClick={() => { setEditingCatName(cat.id); setTempName(cat.name); setEditingValue(null); setEditingPreview(null); }} style={smallBtnStyle}>✏ Rename</button>
              <button onClick={() => addValue(cat.id)} style={smallBtnStyle}>+ Add value</button>
              <button onClick={() => deleteCategory(cat.id)} style={{ ...smallBtnStyle, color: "#DC2626", borderColor: "#FECACA" }}>Delete</button>
            </div>
          </div>

          {/* Column headers */}
          {cat.values.length > 0 && (
            <div style={{ display: "flex", padding: "8px 16px", borderBottom: "1px solid #F1F1F0", backgroundColor: "#FDFDFC" }}>
              <div style={{ ...colHeaderStyle, flex: 1 }}>Name</div>
              <div style={{ ...colHeaderStyle, width: "100px" }}>Preview Name</div>
              <div style={{ ...colHeaderStyle, width: "56px" }}>Preview</div>
              {cat.id === "project" && <div style={{ ...colHeaderStyle, width: "100px" }}>Life Category</div>}
              <div style={{ ...colHeaderStyle, width: "70px" }}>Display</div>
              <div style={{ ...colHeaderStyle, width: "170px" }}>Colors / Emoji</div>
              <div style={{ ...colHeaderStyle, width: "130px", textAlign: "right" }}>Actions</div>
            </div>
          )}

          {/* Values */}
          {cat.values.map((val) => (
            <div key={val.id} style={{ display: "flex", alignItems: "center", gap: "0", padding: "10px 16px", borderBottom: "1px solid #F5F5F3", transition: "background-color 0.1s" }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#FCFCFB"; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
            >
              {/* Name (full) */}
              <div style={{ flex: 1, minWidth: 0 }}>
                {editingValue === val.id ? (
                  <input type="text" value={tempName} onChange={(e) => setTempName(e.target.value)} autoFocus
                    onKeyDown={(e) => { if (e.key === "Enter") updateValueLabel(cat.id, val.id, tempName); if (e.key === "Escape") setEditingValue(null); }}
                    style={{ fontSize: "14px", fontWeight: 500, border: "1px solid #EBEBEA", borderRadius: "5px", padding: "2px 6px", outline: "none", fontFamily: "inherit", color: "#1A1A1A", width: "100%", boxSizing: "border-box" }}
                  />
                ) : (
                  <span style={{ fontSize: "14px", fontWeight: 500, color: "#1A1A1A" }}>{val.label}</span>
                )}
              </div>

              {/* Preview Name */}
              <div style={{ width: "100px", flexShrink: 0, paddingRight: "8px" }}>
                {editingPreview === val.id ? (
                  <input type="text" value={tempPreview} onChange={(e) => setTempPreview(e.target.value)} autoFocus
                    onKeyDown={(e) => { if (e.key === "Enter") updateValuePreviewLabel(cat.id, val.id, tempPreview); if (e.key === "Escape") setEditingPreview(null); }}
                    style={{ fontSize: "12px", fontWeight: 500, border: "1px solid #EBEBEA", borderRadius: "5px", padding: "2px 6px", outline: "none", fontFamily: "inherit", color: "#6B6B67", width: "100%", boxSizing: "border-box" }}
                  />
                ) : (
                  <span
                    onClick={() => { setEditingPreview(val.id); setTempPreview(val.previewLabel || val.label); setEditingCatName(null); setEditingValue(null); }}
                    style={{ fontSize: "12px", fontWeight: 500, color: "#6B6B67", cursor: "pointer", borderBottom: "1px dashed #D4D4D0" }}
                    title="Click to edit preview name"
                  >
                    {val.previewLabel || val.label}
                  </span>
                )}
              </div>

              {/* Preview */}
              <div style={{ width: "56px", flexShrink: 0 }}>
                {val.display === "emoji" ? (
                  <span style={{ fontSize: "16px" }}>{val.emoji}</span>
                ) : (
                  <span style={{ display: "inline-block", width: "28px", height: "16px", borderRadius: "4px", backgroundColor: val.bg, border: `1px solid ${val.text}22` }} />
                )}
              </div>

              {/* Life Category (project category only) */}
              {cat.id === "project" && (
                <div style={{ width: "100px", flexShrink: 0 }}>
                  <select value={val.lifeCategoryId || ""} onChange={(e) => updateValueLifeCategory(cat.id, val.id, e.target.value)}
                    style={{ fontSize: "11px", padding: "2px 4px", borderRadius: "4px", border: "1px solid #EBEBEA", fontFamily: "inherit", color: "#6B6B67", cursor: "pointer", outline: "none", width: "90px" }}>
                    <option value="">— None —</option>
                    {lifeCat && lifeCat.values.map((lv) => (
                      <option key={lv.id} value={lv.id}>{lv.label}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Display type */}
              <div style={{ width: "70px", flexShrink: 0 }}>
                <select value={val.display} onChange={(e) => {
                  const newDisplay = e.target.value;
                  setCategories((prev) => prev.map((c) => c.id === cat.id ? { ...c, values: c.values.map((v) => v.id === val.id ? { ...v, display: newDisplay, ...(newDisplay === "emoji" ? { emoji: v.emoji || "⚪" } : { bg: v.bg || "#F3F4F6", text: v.text || "#6B7280" }) } : v) } : c));
                }} style={{ fontSize: "11px", padding: "2px 4px", borderRadius: "4px", border: "1px solid #EBEBEA", fontFamily: "inherit", color: "#6B6B67", cursor: "pointer", outline: "none" }}>
                  <option value="color">Color</option>
                  <option value="emoji">Emoji</option>
                </select>
              </div>

              {/* Colors / Emoji */}
              <div style={{ width: "170px", flexShrink: 0, display: "flex", alignItems: "center", gap: "6px" }}>
                {val.display === "color" ? (
                  <>
                    <div style={{ display: "flex", alignItems: "center", gap: "3px" }}>
                      <span style={{ fontSize: "10px", color: "#AEAEA6" }}>bg</span>
                      <input type="color" value={val.bg} onChange={(e) => updateValueColor(cat.id, val.id, "bg", e.target.value)}
                        style={{ width: "22px", height: "22px", border: "1px solid #EBEBEA", borderRadius: "4px", padding: 0, cursor: "pointer", backgroundColor: "transparent" }}
                      />
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "3px" }}>
                      <span style={{ fontSize: "10px", color: "#AEAEA6" }}>text</span>
                      <input type="color" value={val.text} onChange={(e) => updateValueColor(cat.id, val.id, "text", e.target.value)}
                        style={{ width: "22px", height: "22px", border: "1px solid #EBEBEA", borderRadius: "4px", padding: 0, cursor: "pointer", backgroundColor: "transparent" }}
                      />
                    </div>
                    <button
                      onClick={() => {
                        const { bg, text } = randomTagColors();
                        updateValueColor(cat.id, val.id, "bg", bg);
                        updateValueColor(cat.id, val.id, "text", text);
                      }}
                      title="Generate random color pair"
                      style={{
                        fontSize: "13px", lineHeight: 1, padding: "2px 5px", borderRadius: "4px",
                        border: "1px solid #EBEBEA", backgroundColor: "#FAFAF9", cursor: "pointer",
                        transition: "background-color 0.1s",
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#EBEBEA"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "#FAFAF9"; }}
                    >🎲</button>
                  </>
                ) : (
                  <EmojiPicker currentEmoji={val.emoji} onSelect={(emoji) => updateValueEmoji(cat.id, val.id, emoji)} />
                )}
              </div>

              {/* Actions */}
              <div style={{ width: "130px", flexShrink: 0, display: "flex", gap: "4px", justifyContent: "flex-end" }}>
                {editingValue === val.id ? (
                  <button onClick={() => updateValueLabel(cat.id, val.id, tempName)} style={tinyBtnStyle}>Save</button>
                ) : (
                  <button onClick={() => { setEditingValue(val.id); setTempName(val.label); setEditingCatName(null); setEditingPreview(null); }} style={tinyBtnStyle}>Rename</button>
                )}
                <button onClick={() => deleteValue(cat.id, val.id)} style={{ ...tinyBtnStyle, color: "#DC2626", borderColor: "#FECACA" }}>Delete</button>
              </div>
            </div>
          ))}

          {cat.values.length === 0 && (
            <div style={{ padding: "20px 16px", textAlign: "center", color: "#C4C4C0", fontSize: "13px" }}>No values yet. Click "+ Add value" to get started.</div>
          )}
        </div>
      ))}

      <button onClick={addCategory}
        style={{
          width: "100%", padding: "14px", borderRadius: "12px", border: "1.5px dashed #D5D5CE",
          backgroundColor: "transparent", color: "#AEAEA6", fontSize: "14px", fontWeight: 500,
          cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s",
        }}
        onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#AEAEA6"; e.currentTarget.style.color = "#7A7A72"; }}
        onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#D5D5CE"; e.currentTarget.style.color = "#AEAEA6"; }}
      >+ Add new tag category</button>
    </div>
  );
}

/* ═══════════════════════════════════════════
   RECURRING HELPERS
   ═══════════════════════════════════════════ */

function describeSchedule(rule) {
  if (!rule) return "No schedule";
  const { frequency, schedule } = rule;
  if (frequency === "daily") return "Every day";
  if (frequency === "weekly") {
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const days = (schedule?.days || []).map((d) => dayNames[d]);
    const interval = schedule?.interval || 1;
    if (days.length === 0) {
      if (interval === 1) return "Weekly";
      if (interval === 2) return "Bi-weekly";
      return `Every ${interval} weeks`;
    }
    const dayList = days.join(", ");
    if (interval === 1) return `Weekly on ${dayList}`;
    if (interval === 2) return `Bi-weekly on ${dayList}`;
    return `Every ${interval} weeks on ${dayList}`;
  }
  if (frequency === "monthly") {
    if (schedule?.weekday !== undefined && schedule?.weekNumber !== undefined) {
      const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
      const ordinals = ["1st", "2nd", "3rd", "4th", "Last"];
      return `Monthly on the ${ordinals[schedule.weekNumber - 1] || schedule.weekNumber} ${dayNames[schedule.weekday]}`;
    }
    const day = schedule?.dayOfMonth || 1;
    const suffix = day === 1 || day === 21 || day === 31 ? "st" : day === 2 || day === 22 ? "nd" : day === 3 || day === 23 ? "rd" : "th";
    return `Monthly on the ${day}${suffix}`;
  }
  if (frequency === "quarterly") {
    const day = schedule?.dayOfMonth || 1;
    const suffix = day === 1 || day === 21 || day === 31 ? "st" : day === 2 || day === 22 ? "nd" : day === 3 || day === 23 ? "rd" : "th";
    return `Quarterly on the ${day}${suffix}`;
  }
  if (frequency === "yearly") {
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const month = monthNames[(schedule?.month || 1) - 1];
    const day = schedule?.dayOfMonth || 1;
    return `Yearly on ${month} ${day}`;
  }
  return "Custom schedule";
}

const FREQUENCY_ORDER = { daily: 0, weekly: 1, monthly: 2, quarterly: 3, yearly: 4 };
const FREQUENCY_LABELS = { daily: "Daily", weekly: "Weekly", monthly: "Monthly", quarterly: "Quarterly", yearly: "Yearly" };
const FREQUENCY_COLORS = {
  daily: { bg: "#ECFDF5", text: "#059669", border: "#059669" },
  weekly: { bg: "#EEF2FF", text: "#4F46E5", border: "#4F46E5" },
  monthly: { bg: "#FEF3C7", text: "#B45309", border: "#B45309" },
  quarterly: { bg: "#F3E8FF", text: "#7C3AED", border: "#7C3AED" },
  yearly: { bg: "#FDE8E8", text: "#B91C1C", border: "#B91C1C" },
};

const INSTANCE_COUNTS = { daily: 10, weekly: 10, monthly: 10, quarterly: 10, yearly: 5 };

/**
 * Compute the next `count` due dates for a recurring template starting from `fromDate`.
 * Returns array of YYYY-MM-DD strings.
 */
function generateNextDueDates(template, fromDate, count) {
  const { frequency, schedule } = template.recurrenceRule;
  const dates = [];
  const from = new Date(fromDate + "T12:00:00");

  if (frequency === "daily") {
    const d = new Date(from);
    while (dates.length < count) {
      dates.push(d.toISOString().split("T")[0]);
      d.setDate(d.getDate() + 1);
    }
  } else if (frequency === "weekly") {
    const days = (schedule?.days || []).slice().sort();
    if (days.length === 0) return dates;
    const interval = Math.max(1, Math.min(12, schedule?.interval || 1));
    // Anchor: Sunday of the FIRST scheduled occurrence (the first date on or after
    // template.startDate whose weekday is in `days`). Anchoring on the first actual
    // occurrence (not on startDate itself) ensures that if startDate is, say, Thursday
    // and the schedule is "every 2 weeks on Tue", the very next Tuesday is treated as
    // week 0 — not the Tuesday that already passed in startDate's week. Without this,
    // a start of Thu May 14 + Tue schedule would skip Tue May 19 and emit Tue May 26
    // first, which is wrong.
    const sundayOf = (date) => {
      const s = new Date(date);
      s.setHours(12, 0, 0, 0);
      s.setDate(s.getDate() - s.getDay());
      return s;
    };
    // Find first scheduled occurrence at or after startDate (within 7 days).
    const firstOccurrence = new Date(template.startDate + "T12:00:00");
    for (let i = 0; i < 7; i++) {
      if (days.includes(firstOccurrence.getDay())) break;
      firstOccurrence.setDate(firstOccurrence.getDate() + 1);
    }
    const anchorSunday = sundayOf(firstOccurrence);
    const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;
    const d = new Date(from);
    // Scan up to count * 8 * interval days max to avoid infinite loop on long intervals.
    const maxIter = count * 8 * interval;
    let iter = 0;
    while (dates.length < count && iter < maxIter) {
      if (days.includes(d.getDay())) {
        const candidateSunday = sundayOf(d);
        const weekOffset = Math.round((candidateSunday - anchorSunday) / MS_PER_WEEK);
        if (weekOffset >= 0 && weekOffset % interval === 0) {
          dates.push(d.toISOString().split("T")[0]);
        }
      }
      d.setDate(d.getDate() + 1);
      iter++;
    }
  } else if (frequency === "monthly") {
    const d = new Date(from);
    if (schedule?.weekday !== undefined && schedule?.weekNumber !== undefined) {
      // Nth weekday of month mode
      const targetWeekday = schedule.weekday;
      const targetWeekNum = schedule.weekNumber; // 1-based, 5 = last
      let month = d.getMonth();
      let year = d.getFullYear();
      // If we're past the target in the current month, start from next month
      const maxIter = count * 14;
      let iter = 0;
      while (dates.length < count && iter < maxIter) {
        // Find the Nth weekday in year/month
        const firstOfMonth = new Date(year, month, 1);
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        let occurrences = [];
        for (let day = 1; day <= daysInMonth; day++) {
          const check = new Date(year, month, day);
          if (check.getDay() === targetWeekday) occurrences.push(day);
        }
        let targetDay = null;
        if (targetWeekNum === 5) targetDay = occurrences[occurrences.length - 1]; // Last
        else if (occurrences[targetWeekNum - 1]) targetDay = occurrences[targetWeekNum - 1];
        if (targetDay) {
          const candidate = new Date(year, month, targetDay);
          const candidateStr = candidate.toISOString().split("T")[0];
          if (candidateStr >= fromDate) {
            dates.push(candidateStr);
          }
        }
        month++;
        if (month > 11) { month = 0; year++; }
        iter++;
      }
    } else {
      // Day of month mode
      const targetDay = Math.min(schedule?.dayOfMonth || 1, 28); // clamp to 28 for safety
      let month = d.getMonth();
      let year = d.getFullYear();
      const maxIter = count * 14;
      let iter = 0;
      while (dates.length < count && iter < maxIter) {
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const actualDay = Math.min(targetDay, daysInMonth);
        const candidate = new Date(year, month, actualDay);
        const candidateStr = candidate.toISOString().split("T")[0];
        if (candidateStr >= fromDate) {
          dates.push(candidateStr);
        }
        month++;
        if (month > 11) { month = 0; year++; }
        iter++;
      }
    }
  } else if (frequency === "quarterly") {
    const targetDay = Math.min(schedule?.dayOfMonth || 1, 28);
    const quarterMonths = [0, 3, 6, 9]; // Jan, Apr, Jul, Oct
    const d = new Date(from);
    let year = d.getFullYear();
    const maxIter = count * 8;
    let iter = 0;
    // Start scanning from current year's quarters
    let startYear = year - 1;
    while (dates.length < count && iter < maxIter) {
      for (const qm of quarterMonths) {
        if (dates.length >= count) break;
        const daysInMonth = new Date(startYear, qm + 1, 0).getDate();
        const actualDay = Math.min(targetDay, daysInMonth);
        const candidate = new Date(startYear, qm, actualDay);
        const candidateStr = candidate.toISOString().split("T")[0];
        if (candidateStr >= fromDate) {
          dates.push(candidateStr);
        }
      }
      startYear++;
      iter++;
    }
  } else if (frequency === "yearly") {
    const targetMonth = (schedule?.month || 1) - 1; // 0-indexed
    const targetDay = Math.min(schedule?.dayOfMonth || 1, 28);
    let year = from.getFullYear();
    const maxIter = count * 3;
    let iter = 0;
    while (dates.length < count && iter < maxIter) {
      const daysInMonth = new Date(year, targetMonth + 1, 0).getDate();
      const actualDay = Math.min(targetDay, daysInMonth);
      const candidate = new Date(year, targetMonth, actualDay);
      const candidateStr = candidate.toISOString().split("T")[0];
      if (candidateStr >= fromDate) {
        dates.push(candidateStr);
      }
      year++;
      iter++;
    }
  }
  return dates;
}

/**
 * Create task instance objects from a template and array of due dates.
 */
function generateInstancesFromTemplate(template, dueDates, sequenceStart) {
  return dueDates.map((dueDate, i) => ({
    id: generateId(),
    title: template.title,
    description: template.description,
    tags: { ...template.tags },
    dueDate: dueDate,
    originalDueDate: dueDate,
    dueDateHistory: [],
    createdDate: nowTimestamp(),
    completedDate: null,
    completed: false,
    deleted: false,
    deletedDate: null,
    dayOrder: null,
    ongoing: false,
    ongoingCompletions: [],
    ongoingCompleted: false,
    ongoingCompletedDate: null,
    ongoingOrder: 0,
    status: null,
    statusNote: "",
    // Recurring-specific fields
    recurringParentId: template.id,
    recurringStatus: "pending",        // "pending" | "completed" | "missed" | "skipped"
    recurringSequence: sequenceStart + i,
  }));
}

/**
 * Count pending instances that exist across today + future for a given template.
 */
function countPendingInstances(todayTasks, futureTasks, templateId) {
  let count = 0;
  for (const t of todayTasks) {
    if (t.recurringParentId === templateId && t.recurringStatus === "pending" && !t.deleted) count++;
  }
  for (const t of futureTasks) {
    if (t.recurringParentId === templateId && t.recurringStatus === "pending" && !t.deleted) count++;
  }
  return count;
}

/**
 * Find the highest recurringSequence across all tasks for a template.
 */
function getMaxSequence(todayTasks, futureTasks, backlogTasks, templateId) {
  let max = 0;
  const all = [...todayTasks, ...futureTasks, ...backlogTasks];
  for (const t of all) {
    if (t.recurringParentId === templateId && (t.recurringSequence || 0) > max) {
      max = t.recurringSequence;
    }
  }
  return max;
}

/**
 * Find the latest due date among pending instances for a template.
 */
function getLatestPendingDueDate(todayTasks, futureTasks, templateId) {
  let latest = null;
  for (const t of [...todayTasks, ...futureTasks]) {
    if (t.recurringParentId === templateId && t.recurringStatus === "pending" && !t.deleted) {
      if (!latest || t.dueDate > latest) latest = t.dueDate;
    }
  }
  return latest;
}

/**
 * True for any frequency that participates in v1.7 roll-forward (everything but daily).
 * Daily templates retain the original v1.6 behavior — miss-and-archive on New Day —
 * because a one-day drift on a daily cadence is just the next instance, not a delay.
 */
function isNonDailyFrequency(freq) {
  return freq === "weekly" || freq === "monthly" || freq === "quarterly" || freq === "yearly";
}

/**
 * "Newest wins" conflict resolution at generation time.
 *
 * Given a non-daily template, the earliest dueDate of an instance about to be
 * generated, and the current day, find pending instances of that template whose
 * originalDueDate falls strictly before the incoming dueDate AND where the incoming
 * instance is "live" (dueDate <= currentDay). Those rolled-forward instances are
 * displaced — marked missed against their original due date — so the fresh instance
 * can take their place.
 *
 * The currentDay gate matters: if the new instance is queued for a future date, the
 * rolled-forward one is still legitimately pending in Today and shouldn't be retired
 * just because a future placeholder is being created. The Future→Today transition on
 * a later New Day handles that handoff via the in-day conflict resolution.
 *
 * Returns { conflictIds: Set<string>, missedLogs: [{templateId, instanceId, date}] }.
 */
function findRolledForwardConflicts(todayTasks, futureTasks, template, incomingDueDate, currentDay) {
  const conflictIds = new Set();
  const missedLogs = [];
  if (!template || !isNonDailyFrequency(template.recurrenceRule?.frequency)) {
    return { conflictIds, missedLogs };
  }
  if (!incomingDueDate || !currentDay) return { conflictIds, missedLogs };
  if (incomingDueDate > currentDay) return { conflictIds, missedLogs };
  const scan = (arr) => {
    for (const t of arr) {
      if (t.recurringParentId !== template.id) continue;
      if (t.recurringStatus !== "pending" || t.deleted) continue;
      const orig = t.originalDueDate || t.dueDate;
      if (orig && orig < incomingDueDate) {
        conflictIds.add(t.id);
        missedLogs.push({ templateId: template.id, instanceId: t.id, date: orig });
      }
    }
  };
  scan(todayTasks);
  scan(futureTasks);
  return { conflictIds, missedLogs };
}

/* ═══════════════════════════════════════════
   TAB 5: RECURRING
   ═══════════════════════════════════════════ */

function RecurringTab({ recurringTemplates, setRecurringTemplates, categories, setCategories, currentDay, setTodayTasks, setFutureTasks, todayTasks, futureTasks, backlogTasks }) {
  const [expandedSections, setExpandedSections] = useState({ daily: true, weekly: true, monthly: true, quarterly: true, yearly: true });
  const toggleSection = (key) => setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }));

  // ─── New Recurring Task Form ───
  const [showForm, setShowForm] = useState(false);
  const [formTitle, setFormTitle] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formTags, setFormTags] = useState({});
  const [formFrequency, setFormFrequency] = useState("daily");
  const [formSchedule, setFormSchedule] = useState({});
  const [formStartDate, setFormStartDate] = useState(currentDay);
  const formRef = useRef(null);
  // Inline project creation
  const [addingProject, setAddingProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectColors, setNewProjectColors] = useState(randomTagColors());

  const resetForm = () => {
    setFormTitle(""); setFormDesc(""); setFormTags({}); setFormFrequency("daily");
    setFormSchedule({}); setFormStartDate(currentDay); setShowForm(false); setAddingProject(false);
  };

  const handleAddTemplate = () => {
    if (!formTitle.trim()) return;
    const template = {
      id: generateId(),
      title: formTitle.trim(),
      description: formDesc.trim(),
      tags: { ...formTags },
      recurrenceRule: { frequency: formFrequency, schedule: { ...formSchedule } },
      startDate: formStartDate || currentDay,
      status: "active",
      createdDate: nowTimestamp(),
      deleted: false,
      deletedDate: null,
      completions: [],
    };
    setRecurringTemplates((prev) => [template, ...prev]);
    // Generate initial instances
    const targetCount = INSTANCE_COUNTS[formFrequency] || 10;
    const startFrom = template.startDate >= currentDay ? template.startDate : currentDay;
    const dueDates = generateNextDueDates(template, startFrom, targetCount);
    const instances = generateInstancesFromTemplate(template, dueDates, 1);
    // Route instances to today or future
    const toToday = instances.filter((t) => t.dueDate === currentDay);
    const toFuture = instances.filter((t) => t.dueDate !== currentDay);
    if (toToday.length > 0) setTodayTasks((prev) => [...toToday, ...prev]);
    if (toFuture.length > 0) setFutureTasks((prev) => [...toFuture, ...prev]);
    resetForm();
  };

  const handleBlur = () => {
    setTimeout(() => {
      if (formRef.current && !formRef.current.contains(document.activeElement)) {
        if (!formTitle.trim() && !formDesc.trim() && Object.keys(formTags).length === 0) setShowForm(false);
      }
    }, 0);
  };

  // ─── Editing ───
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editTags, setEditTags] = useState({});
  const [editFrequency, setEditFrequency] = useState("daily");
  const [editSchedule, setEditSchedule] = useState({});
  const [editStartDate, setEditStartDate] = useState("");
  const [editHistoryExpanded, setEditHistoryExpanded] = useState(false);

  const startEdit = (t) => {
    setEditingId(t.id); setEditTitle(t.title); setEditDesc(t.description);
    setEditTags({ ...t.tags }); setEditFrequency(t.recurrenceRule.frequency);
    setEditSchedule({ ...t.recurrenceRule.schedule }); setEditStartDate(t.startDate);
    setEditHistoryExpanded(false);
  };

  const saveEdit = () => {
    const original = recurringTemplates.find((t) => t.id === editingId);
    if (!original) { setEditingId(null); return; }

    const newRule = { frequency: editFrequency, schedule: { ...editSchedule } };
    const newStartDate = editStartDate || original.startDate;
    // Detect schedule-affecting changes. Title/description/tags don't require regeneration.
    const ruleChanged =
      JSON.stringify(original.recurrenceRule) !== JSON.stringify(newRule) ||
      original.startDate !== newStartDate;

    const updatedTemplate = {
      ...original,
      title: editTitle.trim() || original.title,
      description: editDesc.trim(),
      tags: { ...editTags },
      recurrenceRule: newRule,
      startDate: newStartDate,
    };

    setRecurringTemplates((prev) => prev.map((t) => t.id === editingId ? updatedTemplate : t));

    if (ruleChanged && updatedTemplate.status !== "paused") {
      // Wipe pending instances of this template, then regenerate at the new cadence.
      // Completed / missed / skipped instances are preserved for history.
      const tid = editingId;
      setTodayTasks((tasks) => tasks.filter((t) => !(t.recurringParentId === tid && t.recurringStatus === "pending" && !t.deleted)));
      setFutureTasks((tasks) => tasks.filter((t) => !(t.recurringParentId === tid && t.recurringStatus === "pending" && !t.deleted)));

      const targetCount = INSTANCE_COUNTS[updatedTemplate.recurrenceRule.frequency] || 10;
      const generateFrom = updatedTemplate.startDate > currentDay ? updatedTemplate.startDate : currentDay;
      // Defer so the wipe above commits before regeneration reads fresh state.
      setTimeout(() => {
        setTodayTasks((curToday) => {
          setFutureTasks((curFuture) => {
            const maxSeq = getMaxSequence(curToday, curFuture, backlogTasks, tid);
            const dueDates = generateNextDueDates(updatedTemplate, generateFrom, targetCount);
            if (dueDates.length === 0) return curFuture;
            const instances = generateInstancesFromTemplate(updatedTemplate, dueDates, maxSeq + 1);
            const newToday = instances.filter((t) => t.dueDate === currentDay);
            const newFuture = instances.filter((t) => t.dueDate !== currentDay);
            if (newToday.length > 0) {
              setTimeout(() => setTodayTasks((prev) => [...newToday, ...prev]), 0);
            }
            return newFuture.length > 0 ? [...curFuture, ...newFuture] : curFuture;
          });
          return curToday;
        });
      }, 50);
    }

    setEditingId(null);
  };

  const cancelEdit = () => setEditingId(null);

  const togglePause = (id) => {
    setRecurringTemplates((prev) => {
      const template = prev.find((t) => t.id === id);
      if (!template) return prev;
      const wasPaused = template.status === "paused";

      if (!wasPaused) {
        // Pausing: remove all pending instances from today and future
        setTodayTasks((tasks) => tasks.filter((t) => !(t.recurringParentId === id && t.recurringStatus === "pending" && !t.deleted)));
        setFutureTasks((tasks) => tasks.filter((t) => !(t.recurringParentId === id && t.recurringStatus === "pending" && !t.deleted)));
      } else {
        // Unpausing: regenerate instances from today forward
        const updatedTemplate = { ...template, status: "active" };
        const targetCount = INSTANCE_COUNTS[updatedTemplate.recurrenceRule.frequency] || 10;
        setTimeout(() => {
          setTodayTasks((curToday) => {
            setFutureTasks((curFuture) => {
              const pending = countPendingInstances(curToday, curFuture, id);
              if (pending >= targetCount) return curFuture;
              const latestDue = getLatestPendingDueDate(curToday, curFuture, id);
              const maxSeq = getMaxSequence(curToday, curFuture, backlogTasks, id);
              const generateFrom = latestDue ? (() => {
                const d = new Date(latestDue + "T12:00:00");
                d.setDate(d.getDate() + 1);
                return d.toISOString().split("T")[0];
              })() : currentDay;
              const needed = targetCount - pending;
              const dueDates = generateNextDueDates(updatedTemplate, generateFrom, needed);
              if (dueDates.length > 0) {
                const instances = generateInstancesFromTemplate(updatedTemplate, dueDates, maxSeq + 1);
                const newToday = instances.filter((t) => t.dueDate === currentDay);
                const newFuture = instances.filter((t) => t.dueDate !== currentDay);
                if (newToday.length > 0) {
                  setTimeout(() => setTodayTasks((prev) => [...newToday, ...prev]), 0);
                }
                if (newFuture.length > 0) return [...curFuture, ...newFuture];
              }
              return curFuture;
            });
            return curToday;
          });
        }, 50);
      }

      return prev.map((t) => t.id === id ? { ...t, status: wasPaused ? "active" : "paused" } : t);
    });
  };

  const deleteTemplate = (id) => {
    // Soft-delete template and cascade-remove all pending instances
    setRecurringTemplates((prev) => prev.map((t) => t.id === id ? { ...t, deleted: true, deletedDate: nowTimestamp() } : t));
    // Remove pending instances (completed/missed/skipped stay for history)
    setTodayTasks((tasks) => tasks.filter((t) => !(t.recurringParentId === id && t.recurringStatus === "pending" && !t.deleted)));
    setFutureTasks((tasks) => tasks.filter((t) => !(t.recurringParentId === id && t.recurringStatus === "pending" && !t.deleted)));
  };

  const cycleCompletionStatus = (templateId, completionIndex) => {
    // Cycle: completed → missed → skipped → completed
    const statusCycle = { completed: "missed", missed: "skipped", skipped: "completed" };
    setRecurringTemplates((prev) => prev.map((tmpl) => {
      if (tmpl.id !== templateId) return tmpl;
      const updated = [...tmpl.completions];
      const entry = updated[completionIndex];
      if (!entry) return tmpl;
      updated[completionIndex] = { ...entry, status: statusCycle[entry.status] || "completed" };
      return { ...tmpl, completions: updated };
    }));
  };

  // ─── Schedule Config UI ───
  const ScheduleConfig = ({ frequency, schedule, setSchedule }) => {
    if (frequency === "daily") return null;
    if (frequency === "weekly") {
      const days = schedule.days || [];
      const interval = schedule.interval || 1;
      const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      return (
        <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
            <span style={{ fontSize: "11px", color: "#AEAEA6" }}>Every</span>
            <input type="number" min="1" max="12" value={interval}
              onChange={(e) => {
                const v = Math.min(12, Math.max(1, parseInt(e.target.value) || 1));
                setSchedule({ ...schedule, interval: v });
              }}
              style={{ ...pillSelectStyle, width: "48px", fontSize: "11px", padding: "3px 6px", textAlign: "center" }}
            />
            <span style={{ fontSize: "11px", color: "#AEAEA6" }}>week{interval === 1 ? "" : "s"} on:</span>
          </div>
          <div style={{ display: "flex", gap: "4px", alignItems: "center", flexWrap: "wrap" }}>
            {dayLabels.map((label, i) => {
              const active = days.includes(i);
              return (
                <button key={i} onClick={() => {
                  const next = active ? days.filter((d) => d !== i) : [...days, i].sort();
                  setSchedule({ ...schedule, days: next, interval });
                }}
                  style={{
                    fontSize: "11px", fontWeight: 600, padding: "3px 8px", borderRadius: "4px",
                    border: "1px solid", cursor: "pointer", fontFamily: "inherit", transition: "all 0.1s",
                    borderColor: active ? "#4F46E5" : "#EBEBEA",
                    backgroundColor: active ? "#EEF2FF" : "transparent",
                    color: active ? "#4F46E5" : "#AEAEA6",
                  }}
                >{label}</button>
              );
            })}
          </div>
        </div>
      );
    }
    if (frequency === "monthly") {
      const mode = schedule.weekday !== undefined ? "weekday" : "day";
      return (
        <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
          <select value={mode} onChange={(e) => {
            if (e.target.value === "day") setSchedule({ dayOfMonth: schedule.dayOfMonth || 1 });
            else setSchedule({ weekday: 1, weekNumber: 1 });
          }} style={{ ...pillSelectStyle, fontSize: "11px", padding: "3px 6px" }}>
            <option value="day">Day of month</option>
            <option value="weekday">Weekday</option>
          </select>
          {mode === "day" ? (
            <input type="number" min="1" max="31" value={schedule.dayOfMonth || 1}
              onChange={(e) => setSchedule({ dayOfMonth: Math.min(31, Math.max(1, parseInt(e.target.value) || 1)) })}
              style={{ ...pillSelectStyle, width: "60px", fontSize: "11px", padding: "3px 6px" }}
            />
          ) : (
            <>
              <select value={schedule.weekNumber || 1} onChange={(e) => setSchedule({ ...schedule, weekNumber: parseInt(e.target.value) })}
                style={{ ...pillSelectStyle, fontSize: "11px", padding: "3px 6px" }}>
                {["1st", "2nd", "3rd", "4th", "Last"].map((label, i) => (
                  <option key={i} value={i + 1}>{label}</option>
                ))}
              </select>
              <select value={schedule.weekday ?? 1} onChange={(e) => setSchedule({ ...schedule, weekday: parseInt(e.target.value) })}
                style={{ ...pillSelectStyle, fontSize: "11px", padding: "3px 6px" }}>
                {["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map((d, i) => (
                  <option key={i} value={i}>{d}</option>
                ))}
              </select>
            </>
          )}
        </div>
      );
    }
    if (frequency === "quarterly") {
      return (
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <span style={{ fontSize: "11px", color: "#AEAEA6" }}>Day of quarter:</span>
          <input type="number" min="1" max="31" value={schedule.dayOfMonth || 1}
            onChange={(e) => setSchedule({ ...schedule, dayOfMonth: Math.min(31, Math.max(1, parseInt(e.target.value) || 1)) })}
            style={{ ...pillSelectStyle, width: "60px", fontSize: "11px", padding: "3px 6px" }}
          />
        </div>
      );
    }
    if (frequency === "yearly") {
      const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
      return (
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <select value={schedule.month || 1} onChange={(e) => setSchedule({ ...schedule, month: parseInt(e.target.value) })}
            style={{ ...pillSelectStyle, fontSize: "11px", padding: "3px 6px" }}>
            {monthNames.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
          <input type="number" min="1" max="31" value={schedule.dayOfMonth || 1}
            onChange={(e) => setSchedule({ ...schedule, dayOfMonth: Math.min(31, Math.max(1, parseInt(e.target.value) || 1)) })}
            style={{ ...pillSelectStyle, width: "60px", fontSize: "11px", padding: "3px 6px" }}
          />
        </div>
      );
    }
    return null;
  };

  // ─── Template Card ───
  const TemplateCard = ({ template }) => {
    const isEditing = editingId === template.id;
    const isPaused = template.status === "paused";
    const freq = template.recurrenceRule.frequency;
    const fc = FREQUENCY_COLORS[freq] || FREQUENCY_COLORS.daily;
    const completions = template.completions || [];
    const completedCount = completions.filter((c) => c.status === "completed").length;
    const missedCount = completions.filter((c) => c.status === "missed").length;
    const skippedCount = completions.filter((c) => c.status === "skipped").length;
    const totalHistory = completedCount + missedCount + skippedCount;
    const last10 = completions.slice(-10);

    // Current streak (consecutive completed from the end)
    let currentStreak = 0;
    for (let i = completions.length - 1; i >= 0; i--) {
      if (completions[i].status === "completed") currentStreak++;
      else break;
    }

    // Next due date: earliest pending instance
    const pendingInstances = [...todayTasks, ...futureTasks].filter(
      (t) => t.recurringParentId === template.id && t.recurringStatus === "pending" && !t.deleted
    );
    const pendingCount = pendingInstances.length;
    const nextDue = pendingInstances.reduce((earliest, t) => {
      if (!earliest || t.dueDate < earliest) return t.dueDate;
      return earliest;
    }, null);

    // Days until next due
    const daysUntilNext = nextDue ? Math.round(
      (new Date(nextDue + "T12:00:00") - new Date(currentDay + "T12:00:00")) / (1000 * 60 * 60 * 24)
    ) : null;
    const nextDueLabel = daysUntilNext === 0 ? "Today" : daysUntilNext === 1 ? "Tomorrow" : daysUntilNext !== null ? `In ${daysUntilNext} days` : null;

    const eisenhowerVal = getTagValue(categories, "eisenhower", template.tags?.eisenhower);
    const projectVal = getTagValue(categories, "project", template.tags?.project);
    const lifeVal = getTagValue(categories, "life", template.tags?.life);

    if (isEditing) {
      return (
        <div style={{ padding: "16px", borderBottom: "1px solid #F1F1F0", backgroundColor: "#FAFAF9" }}>
          <input type="text" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} autoFocus
            onKeyDown={(e) => { if (e.key === "Enter") saveEdit(); if (e.key === "Escape") cancelEdit(); }}
            style={{ width: "100%", fontSize: "15px", fontWeight: 500, color: "#1A1A1A", border: "none", outline: "none", backgroundColor: "transparent", fontFamily: "inherit", padding: 0, lineHeight: 1.4, marginBottom: "8px" }}
          />
          <input type="text" value={editDesc} onChange={(e) => setEditDesc(e.target.value)} placeholder="Description..."
            onKeyDown={(e) => { if (e.key === "Enter") saveEdit(); if (e.key === "Escape") cancelEdit(); }}
            style={{ width: "100%", fontSize: "13px", color: "#6B6B67", border: "none", outline: "none", backgroundColor: "transparent", fontFamily: "inherit", padding: 0, lineHeight: 1.4, marginBottom: "10px" }}
          />
          <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap", marginBottom: "8px" }}>
            {categories.map((cat) => (
              <select key={cat.id} value={editTags[cat.id] || ""}
                onChange={(e) => setEditTags((prev) => ({ ...prev, [cat.id]: e.target.value || null }))}
                style={{ ...editFieldStyle, fontSize: "11px" }}>
                <option value="">— {cat.name} —</option>
                {cat.values.map((v) => <option key={v.id} value={v.id}>{v.display === "emoji" ? `${v.emoji} ` : ""}{v.label}</option>)}
              </select>
            ))}
          </div>
          <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap", marginBottom: "8px" }}>
            <select value={editFrequency} onChange={(e) => { setEditFrequency(e.target.value); setEditSchedule({}); }}
              style={{ ...editFieldStyle, fontSize: "11px" }}>
              {Object.entries(FREQUENCY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <ScheduleConfig frequency={editFrequency} schedule={editSchedule} setSchedule={setEditSchedule} />
          </div>
          <div style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "8px" }}>
            <span style={{ fontSize: "11px", color: "#AEAEA6" }}>Start date:</span>
            <input type="date" value={editStartDate} onChange={(e) => setEditStartDate(e.target.value)}
              style={{ ...editFieldStyle, fontSize: "11px" }} />
          </div>
          {/* Metadata in edit mode */}
          <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap", marginBottom: "8px" }}>
            {template.createdDate && <span style={{ fontSize: "11px", color: "#C4C4C0" }}>Created {formatDate(template.createdDate)}</span>}
            {totalHistory > 0 && <span style={{ fontSize: "11px", color: "#C4C4C0" }}>· {totalHistory} total entries</span>}
            {pendingCount > 0 && <span style={{ fontSize: "11px", color: "#C4C4C0" }}>· {pendingCount} pending instances</span>}
            {totalHistory > 0 && (
              <span onClick={() => setEditHistoryExpanded((s) => !s)}
                style={{ fontSize: "11px", color: "#4F46E5", cursor: "pointer", fontWeight: 500 }}>
                · Edit history {editHistoryExpanded ? "▾" : "▸"}
              </span>
            )}
          </div>
          {/* Editable completion history */}
          {editHistoryExpanded && completions.length > 0 && (
            <div style={{ marginBottom: "10px", padding: "8px 10px", borderRadius: "8px", border: "1px solid #EBEBEA", backgroundColor: "#FDFDFC", maxHeight: "200px", overflowY: "auto" }}>
              <div style={{ fontSize: "10px", fontWeight: 600, color: "#AEAEA6", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "6px" }}>
                Completion History — click status to change
              </div>
              {completions.map((c, i) => {
                const statusColors = {
                  completed: { bg: "#ECFDF5", text: "#059669", label: "Completed" },
                  missed: { bg: "#FEE2E2", text: "#DC2626", label: "Missed" },
                  skipped: { bg: "#F5F5F3", text: "#6B7280", label: "Skipped" },
                };
                const sc = statusColors[c.status] || statusColors.completed;
                return (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "3px 0", borderBottom: i < completions.length - 1 ? "1px solid #F5F5F3" : "none" }}>
                    <span style={{ fontSize: "11px", color: "#AEAEA6", width: "70px", flexShrink: 0 }}>
                      {formatDateShort(c.date || c.timestamp)}
                    </span>
                    <button onClick={() => cycleCompletionStatus(template.id, i)}
                      style={{
                        fontSize: "10px", fontWeight: 600, padding: "1px 8px", borderRadius: "3px",
                        border: `1px solid ${sc.text}33`, backgroundColor: sc.bg, color: sc.text,
                        cursor: "pointer", fontFamily: "inherit", transition: "all 0.1s", minWidth: "72px",
                      }}
                      title="Click to cycle: Completed → Missed → Skipped"
                    >{sc.label}</button>
                  </div>
                );
              })}
            </div>
          )}
          <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
            <button onClick={() => { deleteTemplate(template.id); setEditingId(null); }}
              style={{ fontSize: "12px", fontWeight: 600, padding: "4px 10px", borderRadius: "6px", border: "1px solid #FECACA", backgroundColor: "transparent", color: "#DC2626", cursor: "pointer", fontFamily: "inherit", transition: "background-color 0.1s" }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#FEF2F2"; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
            >Delete</button>
            <div style={{ flex: 1 }} />
            <button onClick={cancelEdit} style={{ fontSize: "12px", fontWeight: 600, padding: "4px 10px", borderRadius: "6px", border: "none", backgroundColor: "transparent", color: "#AEAEA6", cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
            <button onClick={saveEdit} style={{ fontSize: "12px", fontWeight: 600, padding: "4px 10px", borderRadius: "6px", border: "none", backgroundColor: "#1A1A1A", color: "#FFF", cursor: "pointer", fontFamily: "inherit" }}>Save</button>
          </div>
        </div>
      );
    }

    return (
      <div onDoubleClick={() => startEdit(template)}
        style={{
          padding: "14px 16px", borderBottom: "1px solid #F1F1F0", cursor: "default",
          opacity: isPaused ? 0.55 : 1, transition: "background-color 0.15s, opacity 0.2s",
        }}
        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#FCFCFB"; }}
        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            {/* Title row with frequency badge */}
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "2px" }}>
              <span style={{ fontSize: "15px", fontWeight: 500, color: "#1A1A1A" }}>{template.title}</span>
              <span style={{ fontSize: "9px", fontWeight: 700, padding: "1px 6px", borderRadius: "3px", backgroundColor: fc.bg, color: fc.text, letterSpacing: "0.04em", textTransform: "uppercase" }}>
                {FREQUENCY_LABELS[freq]}
              </span>
              {isPaused && (
                <span style={{ fontSize: "10px", fontWeight: 600, padding: "1px 6px", borderRadius: "3px", backgroundColor: "#F3F4F6", color: "#6B7280" }}>Paused</span>
              )}
            </div>
            {template.description && (
              <div style={{ fontSize: "13px", color: "#8A8A86", lineHeight: 1.4, marginBottom: "3px" }}>{template.description}</div>
            )}
            {/* Schedule + next due */}
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px", flexWrap: "wrap" }}>
              <span style={{ fontSize: "11px", color: "#AEAEA6" }}>{describeSchedule(template.recurrenceRule)}</span>
              {nextDueLabel && !isPaused && (
                <span style={{ fontSize: "10px", fontWeight: 600, padding: "1px 6px", borderRadius: "3px", backgroundColor: daysUntilNext === 0 ? "#ECFDF5" : "#F5F5F3", color: daysUntilNext === 0 ? "#059669" : "#8A8A86" }}>
                  Next: {nextDueLabel}
                </span>
              )}
              {currentStreak >= 3 && (
                <span style={{ fontSize: "10px", fontWeight: 600, padding: "1px 6px", borderRadius: "3px", backgroundColor: "#ECFDF5", color: "#059669" }}>
                  🔥 {currentStreak} streak
                </span>
              )}
            </div>
            {/* Stats line */}
            {totalHistory > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
                <span style={{ fontSize: "11px" }}>
                  <span style={{ color: "#059669", fontWeight: 500 }}>{completedCount}</span>
                  <span style={{ color: "#C4C4C0" }}> done</span>
                </span>
                {missedCount > 0 && (
                  <span style={{ fontSize: "11px" }}>
                    <span style={{ color: "#DC2626", fontWeight: 500 }}>{missedCount}</span>
                    <span style={{ color: "#C4C4C0" }}> missed</span>
                  </span>
                )}
                {skippedCount > 0 && (
                  <span style={{ fontSize: "11px" }}>
                    <span style={{ color: "#AEAEA6", fontWeight: 500 }}>{skippedCount}</span>
                    <span style={{ color: "#C4C4C0" }}> skipped</span>
                  </span>
                )}
                {completedCount > 0 && (
                  <span style={{ fontSize: "11px", color: "#C4C4C0" }}>
                    · {Math.round((completedCount / (completedCount + missedCount)) * 100)}% rate
                  </span>
                )}
              </div>
            )}
            {/* Visual completion history — colored dots */}
            {last10.length > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: "3px" }}>
                <span style={{ fontSize: "10px", color: "#C4C4C0", marginRight: "2px" }}>History:</span>
                {last10.map((c, i) => (
                  <span key={i} title={`${c.status === "completed" ? "Completed" : c.status === "missed" ? "Missed" : "Skipped"} · ${formatDateShort(c.date || c.timestamp)}`}
                    style={{
                      display: "inline-block", width: "14px", height: "14px", borderRadius: "3px",
                      backgroundColor: c.status === "completed" ? "#ECFDF5" : c.status === "missed" ? "#FEE2E2" : "#F5F5F3",
                      border: `1.5px solid ${c.status === "completed" ? "#059669" : c.status === "missed" ? "#DC2626" : "#D4D4D0"}`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: "9px", fontWeight: 700, lineHeight: 1, cursor: "default",
                      color: c.status === "completed" ? "#059669" : c.status === "missed" ? "#DC2626" : "#AEAEA6",
                    }}>
                    {c.status === "completed" ? "✓" : c.status === "missed" ? "✗" : "–"}
                  </span>
                ))}
              </div>
            )}
          </div>
          {/* Tag badges */}
          {projectVal && <TagBadge categories={categories} categoryId="project" valueId={template.tags?.project} />}
          {eisenhowerVal && <span style={{ fontSize: "14px" }} title={eisenhowerVal.label}>{eisenhowerVal.emoji}</span>}
          {lifeVal && <TagBadge categories={categories} categoryId="life" valueId={template.tags?.life} />}
          {/* Pause/Unpause */}
          <button onClick={() => togglePause(template.id)} title={isPaused ? "Unpause" : "Pause"}
            style={{
              fontSize: "11px", fontWeight: 600, padding: "3px 8px", borderRadius: "5px",
              border: "1px solid #EBEBEA", backgroundColor: "#FAFAF9", color: isPaused ? "#059669" : "#8A8A86",
              cursor: "pointer", fontFamily: "inherit", transition: "background-color 0.1s, color 0.1s", flexShrink: 0,
            }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#EBEBEA"; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "#FAFAF9"; }}
          >{isPaused ? "▶ Resume" : "⏸ Pause"}</button>
        </div>
      </div>
    );
  };

  // ─── Render ───
  const activeTemplates = recurringTemplates.filter((t) => !t.deleted);
  const grouped = {};
  Object.keys(FREQUENCY_LABELS).forEach((f) => { grouped[f] = []; });
  activeTemplates.forEach((t) => {
    const freq = t.recurrenceRule?.frequency || "daily";
    if (grouped[freq]) grouped[freq].push(t);
    else grouped.daily.push(t);
  });

  const totalCount = activeTemplates.length;
  const activeCount = activeTemplates.filter((t) => t.status === "active").length;
  const pausedCount = activeTemplates.filter((t) => t.status === "paused").length;
  const nonEmptyFreqs = Object.entries(FREQUENCY_LABELS).filter(([freq]) => grouped[freq].length > 0);

  return (
    <div style={{ maxWidth: "580px", margin: "0 auto" }}>
      <div style={{ marginBottom: "32px" }}>
        <h1 style={{ fontSize: "26px", fontWeight: 700, color: "#1A1A1A", margin: 0, lineHeight: 1.2 }}>Recurring Tasks</h1>
        <p style={{ fontSize: "14px", color: "#8A8A86", margin: "4px 0 0 0" }}>
          {totalCount} template{totalCount !== 1 ? "s" : ""}
          {activeCount > 0 && <span> · {activeCount} active</span>}
          {pausedCount > 0 && <span> · {pausedCount} paused</span>}
        </p>
      </div>

      {/* New Recurring Task Form */}
      <div ref={formRef} onBlur={handleBlur} style={{ backgroundColor: "#FFFFFF", borderRadius: "12px", border: "1px solid #EBEBEA", padding: "16px", marginBottom: "24px" }}>
        <input type="text" placeholder="New recurring task..." value={formTitle} onChange={(e) => setFormTitle(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleAddTemplate(); } }}
          onFocus={() => setShowForm(true)}
          style={{ width: "100%", fontSize: "15px", fontWeight: 500, border: "none", outline: "none", color: "#1A1A1A", fontFamily: "inherit", marginBottom: showForm ? "8px" : "0", boxSizing: "border-box", backgroundColor: "transparent" }}
        />
        {showForm && (
          <>
            <input type="text" placeholder="Description (optional)" value={formDesc} onChange={(e) => setFormDesc(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleAddTemplate(); } }}
              style={{ width: "100%", fontSize: "13px", border: "none", outline: "none", color: "#6B6B67", fontFamily: "inherit", marginBottom: "12px", boxSizing: "border-box", backgroundColor: "transparent" }}
            />
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center", marginBottom: "10px" }}>
              {categories.map((cat) => {
                if (cat.id === "project") {
                  const selectedLife = formTags.life || null;
                  const matchingProjects = selectedLife ? cat.values.filter((v) => v.lifeCategoryId === selectedLife) : [];
                  const otherProjects = selectedLife ? cat.values.filter((v) => v.lifeCategoryId !== selectedLife) : cat.values;
                  return (
                    <React.Fragment key={cat.id}>
                      <select value={formTags[cat.id] || ""} onChange={(e) => {
                        if (e.target.value === "__new__") { setAddingProject(true); setNewProjectName(""); setNewProjectColors(randomTagColors()); }
                        else setFormTags((prev) => ({ ...prev, [cat.id]: e.target.value || null }));
                      }} style={pillSelectStyle}>
                        <option value="">— {cat.name} —</option>
                        {matchingProjects.length > 0 && matchingProjects.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
                        {matchingProjects.length > 0 && otherProjects.length > 0 && <option disabled>────────</option>}
                        {otherProjects.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
                        <option disabled>────────</option>
                        <option value="__new__">+ New Project</option>
                      </select>
                      {addingProject && (
                        <div style={{ display: "flex", gap: "4px", alignItems: "center", padding: "2px 0" }}>
                          <input type="text" value={newProjectName} onChange={(e) => setNewProjectName(e.target.value)} autoFocus placeholder="Project name..."
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && newProjectName.trim()) {
                                e.preventDefault();
                                const newId = generateId();
                                const newVal = { id: newId, label: newProjectName.trim(), previewLabel: newProjectName.trim(), display: "color", bg: newProjectColors.bg, text: newProjectColors.text, lifeCategoryId: formTags.life || null };
                                setCategories((prev) => prev.map((c) => c.id === "project" ? { ...c, values: [...c.values, newVal] } : c));
                                setFormTags((prev) => ({ ...prev, project: newId }));
                                setAddingProject(false);
                              }
                              if (e.key === "Escape") setAddingProject(false);
                            }}
                            style={{ fontSize: "12px", fontWeight: 500, padding: "4px 8px", borderRadius: "5px", border: "1px solid #EBEBEA", outline: "none", fontFamily: "inherit", color: "#1A1A1A", width: "130px" }}
                          />
                          <span style={{ display: "inline-block", width: "16px", height: "16px", borderRadius: "3px", backgroundColor: newProjectColors.bg, border: `1px solid ${newProjectColors.text}44`, flexShrink: 0 }} />
                          <button onClick={() => setNewProjectColors(randomTagColors())} title="Random colors"
                            style={{ fontSize: "12px", lineHeight: 1, padding: "2px 4px", borderRadius: "3px", border: "1px solid #EBEBEA", backgroundColor: "#FAFAF9", cursor: "pointer" }}>🎲</button>
                          <button onClick={() => {
                            if (!newProjectName.trim()) return;
                            const newId = generateId();
                            const newVal = { id: newId, label: newProjectName.trim(), previewLabel: newProjectName.trim(), display: "color", bg: newProjectColors.bg, text: newProjectColors.text, lifeCategoryId: formTags.life || null };
                            setCategories((prev) => prev.map((c) => c.id === "project" ? { ...c, values: [...c.values, newVal] } : c));
                            setFormTags((prev) => ({ ...prev, project: newId }));
                            setAddingProject(false);
                          }} style={{ fontSize: "11px", fontWeight: 600, padding: "3px 8px", borderRadius: "5px", border: "none", backgroundColor: newProjectName.trim() ? "#1A1A1A" : "#D4D4D0", color: "#FFF", cursor: newProjectName.trim() ? "pointer" : "not-allowed", fontFamily: "inherit" }}>Add</button>
                          <button onClick={() => setAddingProject(false)}
                            style={{ fontSize: "11px", fontWeight: 600, padding: "3px 6px", borderRadius: "5px", border: "none", backgroundColor: "transparent", color: "#AEAEA6", cursor: "pointer", fontFamily: "inherit" }}>✕</button>
                        </div>
                      )}
                    </React.Fragment>
                  );
                }
                return (
                  <select key={cat.id} value={formTags[cat.id] || ""} onChange={(e) => setFormTags((prev) => ({ ...prev, [cat.id]: e.target.value || null }))} style={pillSelectStyle}>
                    <option value="">— {cat.name} —</option>
                    {cat.values.map((v) => <option key={v.id} value={v.id}>{v.display === "emoji" ? `${v.emoji} ` : ""}{v.label}</option>)}
                  </select>
                );
              })}
            </div>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center", marginBottom: "10px" }}>
              <span style={{ fontSize: "12px", fontWeight: 600, color: "#8A8A86" }}>Frequency:</span>
              {Object.entries(FREQUENCY_LABELS).map(([k, v]) => {
                const fc = FREQUENCY_COLORS[k];
                const active = formFrequency === k;
                return (
                  <button key={k} onClick={() => { setFormFrequency(k); setFormSchedule({}); }}
                    style={{
                      fontSize: "11px", fontWeight: 600, padding: "3px 10px", borderRadius: "5px",
                      border: "1px solid", cursor: "pointer", fontFamily: "inherit", transition: "all 0.1s",
                      borderColor: active ? fc.border : "#EBEBEA",
                      backgroundColor: active ? fc.bg : "transparent",
                      color: active ? fc.text : "#AEAEA6",
                    }}
                  >{v}</button>
                );
              })}
            </div>
            <div style={{ marginBottom: "10px" }}>
              <ScheduleConfig frequency={formFrequency} schedule={formSchedule} setSchedule={setFormSchedule} />
            </div>
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <span style={{ fontSize: "11px", color: "#AEAEA6" }}>Start date:</span>
              <input type="date" value={formStartDate} onChange={(e) => setFormStartDate(e.target.value)}
                style={{ ...pillSelectStyle, width: "145px" }} />
              <div style={{ flex: 1 }} />
              <button onClick={resetForm}
                style={{ ...pillBtnStyle, backgroundColor: "transparent", color: "#AEAEA6", border: "none" }}>Cancel</button>
              <button onClick={handleAddTemplate}
                style={{ ...pillBtnStyle, backgroundColor: formTitle.trim() ? "#1A1A1A" : "#D4D4D0", color: "#FFF", cursor: formTitle.trim() ? "pointer" : "not-allowed" }}>Add recurring task</button>
            </div>
          </>
        )}
      </div>

      {/* Template sections by frequency — only show sections with templates */}
      {nonEmptyFreqs.length === 0 && (
        <div style={{ padding: "40px 16px", textAlign: "center", color: "#C4C4C0", fontSize: "14px" }}>
          No recurring tasks yet. Create one above to get started.
        </div>
      )}
      {nonEmptyFreqs.map(([freq, label]) => {
        const templates = grouped[freq];
        const fc = FREQUENCY_COLORS[freq];
        const activeSectionCount = templates.filter((t) => t.status === "active").length;
        const pausedSectionCount = templates.filter((t) => t.status === "paused").length;
        return (
          <div key={freq} style={{ marginBottom: "24px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 16px", marginBottom: "4px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <h2 style={{ fontSize: "13px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#8A8A86", margin: 0 }}>{label}</h2>
                <span style={{ fontSize: "11px", fontWeight: 600, color: fc.text, backgroundColor: fc.bg, padding: "1px 7px", borderRadius: "10px" }}>{templates.length}</span>
                {pausedSectionCount > 0 && (
                  <span style={{ fontSize: "10px", color: "#AEAEA6" }}>({pausedSectionCount} paused)</span>
                )}
              </div>
              <button onClick={() => toggleSection(freq)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "13px", color: "#8A8A86", fontFamily: "inherit", padding: "4px 8px" }}>
                {expandedSections[freq] ? "▾" : "▸"}
              </button>
            </div>
            {expandedSections[freq] && (
              <div style={{ backgroundColor: "#FFFFFF", borderRadius: "12px", border: "1px solid #EBEBEA", overflow: "hidden" }}>
                {templates.map((t) => <TemplateCard key={t.id} template={t} />)}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ═══════════════════════════════════════════
   SYNC SETTINGS (v1.8.2, sync Stage 2)
   ───────────────────────────────────────────
   Where the shared notebook file lives on GitHub, plus this device's
   access key. Stored ONLY in this browser's localStorage under its own
   key — never inside the notebook data, never in Export, never in the
   repo. Nothing here loads or saves tasks yet; that is a later stage.
   ═══════════════════════════════════════════ */

const SYNC_CONFIG_KEY = TEST_MODE ? "newday-sync-config-TEST" : "newday-sync-config";
const SYNC_DEFAULTS = { owner: "mini952", repo: "newday-data", path: "notebook.json", token: "", tokenExpires: "" };

function loadSyncConfig() {
  try {
    const raw = localStorage.getItem(SYNC_CONFIG_KEY);
    const data = raw ? JSON.parse(raw) : null;
    return { ...SYNC_DEFAULTS, ...(data && typeof data === "object" ? data : {}) };
  } catch (e) {
    return { ...SYNC_DEFAULTS };
  }
}

function saveSyncConfig(config) {
  try {
    localStorage.setItem(SYNC_CONFIG_KEY, JSON.stringify(config));
    return true;
  } catch (e) {
    console.warn("Failed to save sync settings:", e);
    return false;
  }
}

// Check that the key can read owner/repo, then look for the file.
// Returns { ok, message, detail? } in plain words for the panel.
async function testSyncConnection({ owner, repo, path, token }) {
  if (!token) return { ok: false, message: "Paste an access key first." };
  if (!owner || !repo) return { ok: false, message: "Fill in the owner and repo." };
  const headers = { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" };
  const base = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
  let res;
  try {
    res = await fetch(base, { headers, cache: "no-store" });
  } catch (e) {
    return { ok: false, message: "Couldn't reach GitHub. Check your internet connection and try again." };
  }
  if (res.status === 401) return { ok: false, message: "GitHub didn't accept this key. It may be mistyped, expired, or revoked. Paste it again or make a new one." };
  if (res.status === 403) {
    if (res.headers.get("x-ratelimit-remaining") === "0") return { ok: false, message: "GitHub is limiting requests right now. Wait a few minutes and try again." };
    return { ok: false, message: "This key doesn't have access to that repo. Check that it includes " + repo + "." };
  }
  if (res.status === 404) return { ok: false, message: `Repo ${owner}/${repo} not found, or this key doesn't have access to it. Check the names, and that the key includes ${repo}.` };
  if (!res.ok) return { ok: false, message: `GitHub returned an error (${res.status}). Try again in a minute.` };
  const tokenExpires = readTokenExpiry(res);

  // Repo reachable. Look for the file by listing its folder (cheap: no file
  // content is downloaded).
  const cleanPath = (path || "").replace(/^\/+|\/+$/g, "");
  if (!cleanPath) return { ok: true, tokenExpires, message: `✓ Connected to ${owner}/${repo}.`, detail: "Add a file path to check for the notebook file." };
  const slash = cleanPath.lastIndexOf("/");
  const dir = slash >= 0 ? cleanPath.slice(0, slash) : "";
  const name = slash >= 0 ? cleanPath.slice(slash + 1) : cleanPath;
  let detail = "";
  try {
    const dirRes = await fetch(`${base}/contents/${dir.split("/").map(encodeURIComponent).join("/")}`, { headers, cache: "no-store" });
    if (dirRes.ok) {
      const list = await dirRes.json();
      const file = Array.isArray(list) ? list.find((f) => f.name === name && f.type === "file") : null;
      detail = file
        ? `Found ${cleanPath} (${file.size >= 1024 ? Math.round(file.size / 1024).toLocaleString() + " KB" : file.size + " bytes"}).`
        : `${cleanPath} doesn't exist yet. That's expected until your tasks are uploaded.`;
    } else if (dirRes.status === 404) {
      detail = `${cleanPath} doesn't exist yet. That's expected until your tasks are uploaded.`;
    } else {
      detail = `Couldn't check for ${cleanPath} (GitHub error ${dirRes.status}).`;
    }
  } catch (e) {
    detail = `Couldn't check for ${cleanPath}.`;
  }
  return { ok: true, tokenExpires, message: `✓ Connected to ${owner}/${repo}.`, detail };
}

function SyncSettingsPanel({ onClose }) {
  const [config, setConfig] = useState(loadSyncConfig);
  const [savedToken, setSavedToken] = useState(() => loadSyncConfig().token);
  const [status, setStatus] = useState(null); // { ok, message, detail? }
  const [testing, setTesting] = useState(false);

  const field = (k) => (e) => { setConfig((c) => ({ ...c, [k]: e.target.value })); setStatus(null); };
  const cleaned = () => ({
    owner: config.owner.trim(), repo: config.repo.trim(),
    path: config.path.trim().replace(/^\/+/, ""), token: config.token.trim(),
    tokenExpires: config.tokenExpires || "",
  });

  const handleSave = () => {
    const c = cleaned();
    setConfig(c);
    if (saveSyncConfig(c)) {
      setSavedToken(c.token);
      setStatus({ ok: true, message: "✓ Saved on this device." });
    } else {
      setStatus({ ok: false, message: "Couldn't save the settings in this browser." });
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setStatus({ ok: true, message: "Checking…" });
    const result = await testSyncConnection(cleaned());
    if (result.tokenExpires) setConfig((c) => ({ ...c, tokenExpires: result.tokenExpires }));
    setTesting(false);
    setStatus(result);
  };

  const handleForget = () => {
    const c = { ...cleaned(), token: "", tokenExpires: "" };
    setConfig(c);
    saveSyncConfig(c);
    setSavedToken("");
    setStatus({ ok: true, message: "Key removed from this device." });
  };

  const labelStyle = { fontSize: "12px", fontWeight: 600, color: "#6B6B67", marginBottom: "4px", display: "block" };
  const inputStyle = { width: "100%", fontSize: "14px", padding: "8px 10px", borderRadius: "8px", border: "1px solid #EBEBEA", backgroundColor: "#FAFAF9", color: "#1A1A1A", fontFamily: "inherit", outline: "none" };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.3)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "20px" }}>
      <div data-testid="sync-panel" onClick={(e) => e.stopPropagation()} style={{ backgroundColor: "#FFFFFF", borderRadius: "16px", padding: "28px", maxWidth: "480px", width: "100%", maxHeight: "80vh", overflow: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.15)", fontFamily: "inherit" }}>
        <h2 style={{ fontSize: "20px", fontWeight: 700, color: "#1A1A1A", margin: "0 0 4px 0" }}>⚙ Sync settings</h2>
        <p style={{ fontSize: "13px", color: "#8A8A86", margin: "0 0 20px 0", lineHeight: 1.5 }}>
          Where your shared notebook file lives on GitHub. Your tasks are always kept in this browser too, so you can keep working offline or if the key stops working.
          The key stays on this device and is never included in exports.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "12px" }}>
          <label><span style={labelStyle}>Owner</span>
            <input name="sync-owner" value={config.owner} onChange={field("owner")} style={inputStyle} autoComplete="off" spellCheck={false} />
          </label>
          <label><span style={labelStyle}>Repo</span>
            <input name="sync-repo" value={config.repo} onChange={field("repo")} style={inputStyle} autoComplete="off" spellCheck={false} />
          </label>
        </div>
        <label style={{ display: "block", marginBottom: "12px" }}><span style={labelStyle}>File path</span>
          <input name="sync-path" value={config.path} onChange={field("path")} style={inputStyle} autoComplete="off" spellCheck={false} />
        </label>
        <label style={{ display: "block", marginBottom: "6px" }}><span style={labelStyle}>Access key</span>
          <input name="sync-token" type="password" value={config.token} onChange={field("token")} placeholder="Paste this device's key" style={inputStyle} autoComplete="new-password" spellCheck={false} />
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: "8px", margin: "6px 0 6px 0" }}><span style={{ ...labelStyle, marginBottom: 0 }}>Key expires (optional)</span>
          <input name="sync-expires" type="date" value={config.tokenExpires || ""} onChange={field("tokenExpires")} style={{ ...inputStyle, width: "160px", padding: "5px 8px", fontSize: "13px" }} />
        </label>
        <p style={{ fontSize: "12px", color: savedToken ? "#059669" : "#AEAEA6", margin: "0 0 18px 0" }}>
          {savedToken ? "A key is saved on this device." : "No key saved on this device."}
        </p>
        {status && (
          <div data-testid="sync-status" style={{ fontSize: "13px", lineHeight: 1.5, padding: "10px 12px", borderRadius: "8px", marginBottom: "16px", backgroundColor: status.ok ? "#ECFDF5" : "#FEF2F2", color: status.ok ? "#047857" : "#B91C1C" }}>
            {status.message}
            {status.detail && <div style={{ color: "#6B6B67", marginTop: "2px" }}>{status.detail}</div>}
          </div>
        )}
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <button onClick={handleSave} style={{ ...pillBtnStyle, backgroundColor: "#1A1A1A", color: "#FFF" }}>Save</button>
          <button onClick={handleTest} disabled={testing} style={{ ...bulkBtnStyle, opacity: testing ? 0.6 : 1 }}>{testing ? "Testing…" : "Test connection"}</button>
          <button onClick={handleForget} disabled={!savedToken && !config.token} style={{ ...bulkBtnStyle, color: "#B91C1C", opacity: !savedToken && !config.token ? 0.5 : 1 }}>Forget key</button>
          <div style={{ flex: 1 }} />
          <button onClick={onClose} style={bulkBtnStyle}>Close</button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   GITHUB SYNC ENGINE (v1.8.3, sync Stage 3)
   ───────────────────────────────────────────
   When Sync settings are filled in, the notebook is pulled from and saved
   to the configured file through the GitHub contents API. localStorage is
   still written on every change as the local cache and fallback.

   - Pull: list the file's folder for its SHA (cheap, no 1 MB limit); if it
     differs from the SHA this device last synced, download the file with
     the raw media type (works past 1 MB) and verify its SHA locally.
   - Save: ~2 s after edits stop (and right away when the window is
     hidden), PUT the whole file with the last-known SHA.
   - Safety until the conflict screen exists: if GitHub and this device both
     changed (SHA mismatch on save, or remote changed while local edits are
     unsaved), nothing is written on either side and sync pauses.
   - If the file doesn't exist yet, nothing is created (that is the import
     step); the app keeps working locally.
   Sync bookkeeping (last SHA + a hash of the last-synced content) lives in
   its own localStorage key, never in the notebook data or exports.
   ═══════════════════════════════════════════ */

const SYNC_STATE_KEY = TEST_MODE ? "newday-sync-state-TEST" : "newday-sync-state";
const SYNC_DEBOUNCE_MS = 2000;
const SYNC_FOCUS_THROTTLE_MS = 5000;
const SYNC_DEVICE = typeof navigator !== "undefined" && /iPhone|iPad|Android/i.test(navigator.userAgent) ? "phone" : "mac";

function isSyncConfigured(c) {
  return !!(c && c.token && c.owner && c.repo && c.path);
}

function syncTargetId(c) {
  return `${c.owner}/${c.repo}/${c.path}`;
}

function loadSyncState(config) {
  try {
    const s = JSON.parse(localStorage.getItem(SYNC_STATE_KEY) || "null");
    return s && s.target === syncTargetId(config) && s.sha && s.hash ? s : null;
  } catch (e) {
    return null;
  }
}

function saveSyncState(s) {
  try { localStorage.setItem(SYNC_STATE_KEY, JSON.stringify(s)); } catch (e) { /* ignore */ }
}

// The notebook content that sync compares, in a fixed key order. The file
// itself also carries version and the sync block; those are not "content".
function notebookContentString(d) {
  return JSON.stringify({
    currentDay: d.currentDay, categories: d.categories,
    todayTasks: d.todayTasks, backlogTasks: d.backlogTasks, somedayTasks: d.somedayTasks,
    futureTasks: d.futureTasks, ongoingTasks: d.ongoingTasks, recurringTemplates: d.recurringTemplates,
  });
}

// cyrb53: fast 53-bit string hash, used only to tell "same content or not".
function hashString(str) {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36) + ":" + str.length;
}

function bytesToBase64(bytes) {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

// Git blob SHA of the exact bytes downloaded, so the SHA always matches the
// content we read even if the file changes between two requests.
async function gitBlobSha(bytes) {
  const header = new TextEncoder().encode(`blob ${bytes.length}\0`);
  const buf = new Uint8Array(header.length + bytes.length);
  buf.set(header, 0);
  buf.set(bytes, header.length);
  const digest = await crypto.subtle.digest("SHA-1", buf);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

class SyncHttpError extends Error {
  constructor(status, res) {
    super(`GitHub error ${status}`);
    this.status = status;
    this.rateLimited = status === 429 || (status === 403 && res?.headers?.get("x-ratelimit-remaining") === "0");
  }
}

// GitHub sends the key's expiry as "2027-11-01 04:00:00 UTC" when the
// browser is allowed to read it. Returns "YYYY-MM-DD" or null.
function readTokenExpiry(res) {
  const raw = res?.headers?.get("github-authentication-token-expiration");
  if (!raw) return null;
  const d = new Date(raw.replace(" UTC", "Z").replace(" ", "T"));
  return Number.isNaN(d.getTime()) ? null : d.toISOString().split("T")[0];
}

function ghUrl(config, path) {
  const enc = (p) => p.split("/").filter(Boolean).map(encodeURIComponent).join("/");
  return `https://api.github.com/repos/${encodeURIComponent(config.owner)}/${encodeURIComponent(config.repo)}/contents/${enc(path)}`;
}

function ghHeaders(config, accept) {
  return { Authorization: `Bearer ${config.token}`, Accept: accept || "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" };
}

// { exists, sha, size } for the configured file, via its folder listing.
async function fetchRemoteMeta(config) {
  const path = config.path.replace(/^\/+|\/+$/g, "");
  const slash = path.lastIndexOf("/");
  const dir = slash >= 0 ? path.slice(0, slash) : "";
  const name = slash >= 0 ? path.slice(slash + 1) : path;
  const res = await fetch(ghUrl(config, dir), { headers: ghHeaders(config), cache: "no-store" });
  // A 404 on the repo root means the repo itself can't be reached; on a
  // subfolder it just means the folder (so the file) doesn't exist yet.
  const tokenExpires = readTokenExpiry(res);
  if (res.status === 404 && dir) return { exists: false, tokenExpires };
  if (!res.ok) throw new SyncHttpError(res.status, res);
  const list = await res.json();
  const file = Array.isArray(list) ? list.find((f) => f.name === name && f.type === "file") : null;
  return file ? { exists: true, sha: file.sha, size: file.size, tokenExpires } : { exists: false, tokenExpires };
}

async function fetchRemoteFile(config) {
  const res = await fetch(ghUrl(config, config.path), { headers: ghHeaders(config, "application/vnd.github.raw+json"), cache: "no-store" });
  if (res.status === 404) return null;
  if (!res.ok) throw new SyncHttpError(res.status, res);
  const bytes = new Uint8Array(await res.arrayBuffer());
  return { text: new TextDecoder().decode(bytes), sha: await gitBlobSha(bytes) };
}

async function putRemoteFile(config, text, sha, message) {
  const res = await fetch(ghUrl(config, config.path), {
    method: "PUT",
    headers: { ...ghHeaders(config), "Content-Type": "application/json" },
    body: JSON.stringify({ message, content: bytesToBase64(new TextEncoder().encode(text)), sha }),
    cache: "no-store",
  });
  if (!res.ok) throw new SyncHttpError(res.status, res);
  const body = await res.json();
  return body?.content?.sha;
}

// Parse a remote file into the exact shape the app holds in state (same
// backfills and order fields), or null if it isn't a notebook.
function canonicalNotebook(text, fallbackDay) {
  let data;
  try { data = JSON.parse(text); } catch (e) { return null; }
  if (!data || !Array.isArray(data.todayTasks) || !Array.isArray(data.backlogTasks) || !Array.isArray(data.somedayTasks) || !Array.isArray(data.categories)) return null;
  migrateData(data);
  return {
    currentDay: data.currentDay || fallbackDay,
    categories: data.categories,
    todayTasks: assignDayOrder(data.todayTasks),
    backlogTasks: assignBacklogOrder(data.backlogTasks),
    somedayTasks: assignSomedayOrder(data.somedayTasks),
    futureTasks: data.futureTasks || [],
    ongoingTasks: assignOngoingOrder(data.ongoingTasks || []),
    recurringTemplates: data.recurringTemplates || [],
  };
}

const SYNC_FILE_GONE_MESSAGE = "The synced file was removed from GitHub. Sync is paused; your tasks are safe on this device.";
const SYNC_CONFLICT_MESSAGE = "Your notebook changed both here and on GitHub. Nothing has been overwritten.";
const SYNC_UNSYNCED_DEVICE_MESSAGE = "GitHub already has a notebook, and this device has its own tasks that were never synced. Nothing has been overwritten.";

const SYNC_KEY_REJECTED_MESSAGE = "Your GitHub key was rejected or has expired. Paste a new one in Sync settings. Your edits are saved on this device in the meantime.";

function errorStatus(e) {
  if (e instanceof SyncHttpError) {
    if (e.status === 401) return { kind: "auth", message: SYNC_KEY_REJECTED_MESSAGE };
    if (e.rateLimited) return { kind: "error", message: "GitHub is limiting requests right now. Sync will try again in a few minutes; your edits are saved on this device." };
    if (e.status === 403 || e.status === 404) return { kind: "error", message: "This key doesn't have access to the notebook's repo. Check the key's repository access on GitHub, then Sync settings. Your edits are saved on this device." };
    return { kind: "error", message: `GitHub had a problem (error ${e.status}). Sync will try again; your edits are saved on this device.` };
  }
  return { kind: "offline", message: "You're offline. Edits are saved on this device and will sync when you're back online." };
}

/* ─── Merge (v1.8.4, sync Stage 4) ───
   Three-way merge by item id. "base" is this device's copy of the file as
   it was at the last successful sync (its own localStorage key). For each
   task or template, comparing content + section (order fields and
   updatedAt don't count — position comes from list order):
     - same on both sides            → keep it
     - only GitHub changed vs base   → take GitHub's
     - only this device changed      → take this device's
     - both changed differently      → clash; the user picks
   Deleting (soft delete, or removal from the lists) counts as a change, so
   delete-vs-edit is a clash. With no base (a device that never synced),
   items present on only one side are kept and any difference is a clash.
   currentDay (New Day) and the tag categories merge the same way. */
const SYNC_BASE_KEY = TEST_MODE ? "newday-sync-base-TEST" : "newday-sync-base";

function loadSyncBase(config, st) {
  if (!st) return null;
  try {
    const b = JSON.parse(localStorage.getItem(SYNC_BASE_KEY) || "null");
    if (!b || b.target !== syncTargetId(config) || b.sha !== st.sha || typeof b.content !== "string") return null;
    return JSON.parse(b.content);
  } catch (e) {
    return null;
  }
}

function saveSyncBase(config, sha, content) {
  try {
    localStorage.setItem(SYNC_BASE_KEY, JSON.stringify({ target: syncTargetId(config), sha, content }));
  } catch (e) {
    // Quota: drop the base rather than fail; merges then treat every
    // difference as a clash (safe, just more questions).
    try { localStorage.removeItem(SYNC_BASE_KEY); } catch (e2) { /* ignore */ }
  }
}

function indexNotebookItems(nb) {
  const m = new Map();
  if (!nb) return m;
  ITEM_ARRAY_KEYS.forEach((section) => (nb[section] || []).forEach((item) => {
    if (item && item.id != null && !m.has(item.id)) m.set(item.id, { section, item });
  }));
  return m;
}

function mergeEntryKey(e) {
  return e ? e.section + "|" + itemContentKey(e.item) : "∅";
}

function mergeValue(hasBase, b, l, r) {
  const ls = JSON.stringify(l), rs = JSON.stringify(r);
  if (ls === rs) return { value: r };
  if (hasBase && ls === JSON.stringify(b)) return { value: r, from: "github" };
  if (hasBase && rs === JSON.stringify(b)) return { value: l, from: "mac" };
  return { clash: true, mac: l, github: r };
}

function mergeNotebooks(base, local, remote) {
  const B = indexNotebookItems(base), L = indexNotebookItems(local), R = indexNotebookItems(remote);
  const ids = [...new Set([...L.keys(), ...R.keys()])];
  const resolved = new Map(); // id -> entry | null (removed)
  const clashes = [];
  let fromMac = 0, fromGithub = 0;
  ids.forEach((id) => {
    const b = B.get(id), l = L.get(id) || null, r = R.get(id) || null;
    const lk = mergeEntryKey(l), rk = mergeEntryKey(r);
    if (lk === rk) {
      resolved.set(id, (l.item.updatedAt || "") > (r.item.updatedAt || "") ? l : r);
      return;
    }
    if (base) {
      const bk = mergeEntryKey(b);
      if (lk === bk) { resolved.set(id, r); fromGithub++; return; }
      if (rk === bk) { resolved.set(id, l); fromMac++; return; }
    } else {
      if (!l) { resolved.set(id, r); fromGithub++; return; }
      if (!r) { resolved.set(id, l); fromMac++; return; }
    }
    clashes.push({ id, mac: l, github: r });
  });
  return {
    resolved, clashes, fromMac, fromGithub,
    day: mergeValue(!!base, base?.currentDay, local.currentDay, remote.currentDay),
    categories: mergeValue(!!base, base?.categories, local.categories, remote.categories),
  };
}

function mergeNeedsUser(m) {
  return m.clashes.length > 0 || !!m.day.clash || !!m.categories.clash;
}

// Final list order per section: start from the side that reordered that
// section (GitHub unless only this device did), then slot in items that
// come from the other side after their nearest earlier neighbour.
function mergedSection(section, finalById, base, local, remote) {
  const ids = (nb) => (nb?.[section] || []).map((t) => t?.id);
  const inSection = (id) => finalById.get(id)?.section === section;
  const remoteIds = ids(remote), localIds = ids(local);
  const remoteReordered = !base || JSON.stringify(remoteIds) !== JSON.stringify(ids(base));
  const [primary, secondary] = remoteReordered ? [remoteIds, localIds] : [localIds, remoteIds];
  const out = [];
  const placed = new Set();
  primary.forEach((id) => { if (inSection(id) && !placed.has(id)) { out.push(id); placed.add(id); } });
  let anchor = null;
  secondary.forEach((id) => {
    if (placed.has(id)) { anchor = id; return; }
    if (!inSection(id)) return;
    const at = anchor === null ? 0 : out.indexOf(anchor) + 1;
    out.splice(at, 0, id);
    placed.add(id);
    anchor = id;
  });
  return out.map((id) => finalById.get(id).item);
}

// choices: { [id]: "mac" | "github" }, dayChoice / catChoice likewise.
function buildMergedNotebook(base, local, remote, m, choices, dayChoice, catChoice) {
  const finalById = new Map();
  m.resolved.forEach((e, id) => { if (e) finalById.set(id, e); });
  m.clashes.forEach((c) => {
    const e = choices[c.id] === "mac" ? c.mac : c.github;
    if (e) finalById.set(c.id, e);
  });
  const pick = (v, choice) => (v.clash ? (choice === "mac" ? v.mac : v.github) : v.value);
  const nb = { currentDay: pick(m.day, dayChoice), categories: pick(m.categories, catChoice) };
  ITEM_ARRAY_KEYS.forEach((s) => { nb[s] = mergedSection(s, finalById, base, local, remote); });
  return {
    currentDay: nb.currentDay,
    categories: nb.categories,
    todayTasks: assignDayOrder(nb.todayTasks),
    backlogTasks: assignBacklogOrder(nb.backlogTasks),
    somedayTasks: assignSomedayOrder(nb.somedayTasks),
    futureTasks: nb.futureTasks,
    ongoingTasks: assignOngoingOrder(nb.ongoingTasks),
    recurringTemplates: nb.recurringTemplates,
  };
}

function buildSyncFileText(d) {
  return JSON.stringify({
    version: DATA_VERSION,
    currentDay: d.currentDay,
    sync: { lastWriter: SYNC_DEVICE, lastWrittenAt: nowTimestamp() },
    categories: d.categories,
    todayTasks: d.todayTasks, backlogTasks: d.backlogTasks, somedayTasks: d.somedayTasks,
    futureTasks: d.futureTasks, ongoingTasks: d.ongoingTasks, recurringTemplates: d.recurringTemplates,
  }, null, 2);
}

// The sync controller. `data` is the current notebook (state); applyRemote
// replaces the notebook with a canonical copy WITHOUT re-stamping; onBackup
// downloads an export of the current local notebook.
function useGitHubSync({ data, applyRemote, onBackup, hadLocalData, configVersion }) {
  const [status, setStatus] = useState({ kind: "local", message: "" });
  // conflict: { legacy, remoteSha, remote, base, local, localHash, merge, notice } | null
  const [conflict, setConflict] = useState(null);
  const [conflictOpen, setConflictOpen] = useState(false);
  const [unsaved, setUnsaved] = useState(false);       // local edits GitHub doesn't have yet
  const [tokenExpires, setTokenExpires] = useState(null); // "YYYY-MM-DD" or null
  const cfgRef = useRef(null);
  const stateRef = useRef(null);       // { target, sha, hash } last synced with GitHub
  const contentRef = useRef("");
  const dataRef = useRef(data);
  const busyRef = useRef(false);
  const queuedRef = useRef(null);      // "pull" | "save" waiting for busy to clear
  const pausedRef = useRef(false);
  const missingRef = useRef(false);
  const readyRef = useRef(false);      // first pull finished
  const timerRef = useRef(null);
  const lastPullRef = useRef(0);
  const hadLocalRef = useRef(hadLocalData);
  const applyRef = useRef(applyRemote);
  applyRef.current = applyRemote;
  const backupRef = useRef(onBackup);
  backupRef.current = onBackup;
  const conflictRef = useRef(null);

  const setKind = (kind, message = "") => setStatus((s) => (s.kind === kind && s.message === message ? s : { kind, message }));

  const runQueued = () => {
    const q = queuedRef.current;
    queuedRef.current = null;
    if (q === "pull") pull(); else if (q === "save") save();
  };

  // Remember what GitHub and this device agree on: SHA, content hash, and
  // the content itself (the base for the next merge).
  const recordSynced = (cfg, sha, content) => {
    stateRef.current = { target: syncTargetId(cfg), sha, hash: hashString(content) };
    saveSyncState(stateRef.current);
    saveSyncBase(cfg, sha, content);
    setUnsaved(hashString(contentRef.current) !== stateRef.current.hash);
  };

  // Remember the key's expiry date when GitHub tells us.
  const noteTokenExpiry = (cfg, date) => {
    if (!date || cfg.tokenExpires === date) return;
    cfg.tokenExpires = date;
    saveSyncConfig({ ...loadSyncConfig(), tokenExpires: date });
    setTokenExpires(date);
  };

  const applyLocal = (nb, content) => {
    contentRef.current = content;
    dataRef.current = nb;
    applyRef.current(nb);
  };

  const clearConflict = () => {
    conflictRef.current = null;
    setConflict(null);
    setConflictOpen(false);
    pausedRef.current = false;
  };

  const showConflict = (c) => {
    conflictRef.current = c;
    setConflict(c);
    setConflictOpen(true);
    pausedRef.current = true;
    setKind("conflict", c.legacy ? SYNC_UNSYNCED_DEVICE_MESSAGE : SYNC_CONFLICT_MESSAGE);
  };

  // Download the remote file as a canonical notebook. null = file missing.
  const loadRemote = async (cfg) => {
    const remote = await fetchRemoteFile(cfg);
    if (!remote) return null;
    const canonical = canonicalNotebook(remote.text, dataRef.current.currentDay);
    if (!canonical) return { invalid: true };
    return { sha: remote.sha, canonical, content: notebookContentString(canonical) };
  };

  // Write `merged` over the remote file at `remoteSha` (skipped if it already
  // equals the remote), then make it the local notebook. Throws on HTTP errors.
  const commitMerged = async (cfg, merged, remote) => {
    const content = notebookContentString(merged);
    let sha = remote.sha;
    if (content !== remote.content) {
      sha = await putRemoteFile(cfg, buildSyncFileText(merged), remote.sha, `NewDay: ${SYNC_DEVICE} merge`);
    }
    applyLocal(merged, content);
    recordSynced(cfg, sha, content);
  };

  // Both sides changed. Merge what can be merged; if nothing needs a
  // decision, save it straight away; otherwise open the conflict screen.
  // Nothing is written while the screen is open.
  const handleDivergence = async (cfg, remote, legacy, attempt = 0) => {
    if (!remote) { missingRef.current = true; pausedRef.current = true; setKind("paused", SYNC_FILE_GONE_MESSAGE); return; }
    if (remote.invalid) { pausedRef.current = true; setKind("paused", "The synced file isn't a NewDay notebook. Sync is paused; your tasks are safe on this device."); return; }
    const base = legacy ? null : loadSyncBase(cfg, stateRef.current);
    const local = dataRef.current;
    const localContent = contentRef.current;
    const merge = mergeNotebooks(base, local, remote.canonical);
    if (!legacy && !mergeNeedsUser(merge)) {
      const merged = buildMergedNotebook(base, local, remote.canonical, merge, {}, null, null);
      try {
        await commitMerged(cfg, merged, remote);
        clearConflict();
        if (hashString(contentRef.current) !== stateRef.current.hash) { setKind("pending"); schedule(); } else setKind("synced");
      } catch (e) {
        if (e instanceof SyncHttpError && (e.status === 409 || e.status === 422) && attempt < 3) {
          return handleDivergence(cfg, await loadRemote(cfg), legacy, attempt + 1);
        }
        if (e instanceof SyncHttpError && e.status === 404) { missingRef.current = true; pausedRef.current = true; setKind("paused", SYNC_FILE_GONE_MESSAGE); return; }
        setStatus(errorStatus(e));
      }
      return;
    }
    showConflict({ legacy, remote, base, local, localHash: hashString(localContent), merge, notice: conflictRef.current ? conflictRef.current.notice : null });
  };

  const save = async () => {
    clearTimeout(timerRef.current);
    const cfg = cfgRef.current;
    if (!isSyncConfigured(cfg) || pausedRef.current || missingRef.current || !readyRef.current) return;
    if (busyRef.current) { if (!queuedRef.current) queuedRef.current = "save"; return; }
    const st = stateRef.current;
    if (!st) return; // never synced on this device: never push (import step does that)
    const content = contentRef.current;
    const hash = hashString(content);
    if (hash === st.hash) { setKind("synced"); return; }
    busyRef.current = true;
    setKind("saving");
    try {
      const newSha = await putRemoteFile(cfg, buildSyncFileText(dataRef.current), st.sha, `NewDay: ${SYNC_DEVICE} save`);
      if (cfgRef.current !== cfg) return;
      recordSynced(cfg, newSha, content);
      if (hashString(contentRef.current) !== hash) { setKind("pending"); schedule(); }
      else setKind("synced");
    } catch (e) {
      if (e instanceof SyncHttpError && (e.status === 409 || e.status === 422)) {
        try { await handleDivergence(cfg, await loadRemote(cfg), false); } catch (e2) { setStatus(errorStatus(e2)); }
      } else if (e instanceof SyncHttpError && e.status === 404) {
        missingRef.current = true;
        pausedRef.current = true;
        setKind("paused", SYNC_FILE_GONE_MESSAGE);
      } else {
        setStatus(errorStatus(e));
      }
    } finally {
      busyRef.current = false;
      runQueued();
    }
  };

  const schedule = () => {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(save, SYNC_DEBOUNCE_MS);
  };

  const pull = async (manual = false) => {
    const cfg = cfgRef.current;
    if (!isSyncConfigured(cfg)) { setKind("local"); return; }
    if (busyRef.current) { queuedRef.current = "pull"; return; }
    busyRef.current = true;
    lastPullRef.current = Date.now();
    if (manual || !readyRef.current) setKind("checking");
    try {
      const meta = await fetchRemoteMeta(cfg);
      if (cfgRef.current !== cfg) return;
      noteTokenExpiry(cfg, meta.tokenExpires);
      if (!meta.exists) {
        missingRef.current = true;
        if (conflictRef.current) clearConflict();
        setKind("setup", "Sync is set up. Your tasks will be uploaded in the import step.");
        return;
      }
      missingRef.current = false;
      const st = stateRef.current;
      const localHash = hashString(contentRef.current);
      const dirty = !st || localHash !== st.hash;
      if (st && meta.sha === st.sha) {
        if (conflictRef.current) clearConflict();
        pausedRef.current = false;
        if (dirty) { setKind("pending"); queuedRef.current = "save"; } else setKind("synced");
        return;
      }
      const remote = await loadRemote(cfg);
      if (cfgRef.current !== cfg) return;
      if (!remote) { missingRef.current = true; setKind("setup", "Sync is set up. Your tasks will be uploaded in the import step."); return; }
      if (remote.invalid) {
        pausedRef.current = true;
        setKind("paused", "The synced file isn't a NewDay notebook. Sync is paused; your tasks are safe on this device.");
        return;
      }
      if (remote.content === contentRef.current) { recordSynced(cfg, remote.sha, remote.content); clearConflict(); setKind("synced"); return; }
      const canTakeRemote = st ? !dirty : !hadLocalRef.current;
      if (canTakeRemote) {
        applyLocal(remote.canonical, remote.content);
        recordSynced(cfg, remote.sha, remote.content);
        clearConflict();
        setKind("synced");
        return;
      }
      await handleDivergence(cfg, remote, !st);
    } catch (e) {
      setStatus(errorStatus(e));
    } finally {
      readyRef.current = true;
      busyRef.current = false;
      runQueued();
    }
  };

  // Re-check before writing: if GitHub or this device changed since the
  // screen was built, rebuild it (choices are kept) instead of writing.
  // Returns "saved" | "rechecked" | "error".
  const recheckIfStale = async (cfg, c) => {
    const meta = await fetchRemoteMeta(cfg);
    if (!meta.exists) {
      clearConflict(); missingRef.current = true;
      setKind("setup", "Sync is set up. Your tasks will be uploaded in the import step.");
      return "error";
    }
    if (meta.sha === c.remote.sha && hashString(contentRef.current) === c.localHash) return null;
    const remote = await loadRemote(cfg);
    conflictRef.current = { ...c, notice: "Something changed while you were reviewing, so the list was updated. Please check it again." };
    await handleDivergence(cfg, remote, c.legacy);
    return "rechecked";
  };

  const withBusy = async (fn) => {
    if (busyRef.current) return "busy";
    busyRef.current = true;
    try { return await fn(); }
    catch (e) { setStatus(errorStatus(e)); setConflictOpen(false); return "error"; }
    finally { busyRef.current = false; runQueued(); }
  };

  // User confirmed the conflict screen.
  const resolveConflict = (choices, dayChoice, catChoice) => withBusy(async () => {
    const cfg = cfgRef.current;
    const c = conflictRef.current;
    if (!c) return "error";
    const stale = await recheckIfStale(cfg, c);
    if (stale) return stale;
    const merged = buildMergedNotebook(c.base, c.local, c.remote.canonical, c.merge, choices, dayChoice, catChoice);
    try {
      await commitMerged(cfg, merged, c.remote);
    } catch (e) {
      if (e instanceof SyncHttpError && (e.status === 409 || e.status === 422)) {
        conflictRef.current = { ...c, notice: "GitHub changed while you were reviewing, so the list was updated. Please check it again." };
        await handleDivergence(cfg, await loadRemote(cfg), c.legacy);
        return "rechecked";
      }
      throw e;
    }
    clearConflict();
    if (hashString(contentRef.current) !== stateRef.current.hash) { setKind("pending"); schedule(); } else setKind("synced");
    return "saved";
  });

  // Never-synced device: download a backup of this device's notebook, then
  // switch to GitHub's copy. Nothing is written to GitHub.
  const takeRemoteCopy = () => withBusy(async () => {
    const cfg = cfgRef.current;
    const c = conflictRef.current;
    if (!c) return "error";
    const stale = await recheckIfStale(cfg, c);
    if (stale) return stale;
    backupRef.current();
    applyLocal(c.remote.canonical, c.remote.content);
    recordSynced(cfg, c.remote.sha, c.remote.content);
    clearConflict();
    setKind("synced");
    return "saved";
  });

  // Close the screen without writing anything. Sync stays paused.
  const cancelConflict = () => setConflictOpen(false);

  // Every local change: remember it and schedule a debounced save.
  useEffect(() => {
    contentRef.current = notebookContentString(data);
    dataRef.current = data;
    const cfg = cfgRef.current;
    const hash = stateRef.current ? hashString(contentRef.current) : null;
    setUnsaved(!!stateRef.current && hash !== stateRef.current.hash);
    if (!isSyncConfigured(cfg) || !readyRef.current || pausedRef.current || missingRef.current || !stateRef.current) return;
    if (hash === stateRef.current.hash) return;
    // While offline or the key is rejected, keep the badge (edits are
    // marked unsaved) but still try: a save attempt is how we notice the
    // connection is back.
    setStatus((st) => (st.kind === "offline" || st.kind === "auth" || st.kind === "error" ? st : { kind: "pending", message: "" }));
    schedule();
  }, [data.currentDay, data.categories, data.todayTasks, data.backlogTasks, data.somedayTasks, data.futureTasks, data.ongoingTasks, data.recurringTemplates]);

  // (Re)read settings on mount and whenever the Sync panel closes.
  useEffect(() => {
    const cfg = loadSyncConfig();
    const prev = cfgRef.current;
    const same = prev && prev.token === cfg.token && syncTargetId(prev) === syncTargetId(cfg);
    setTokenExpires(isSyncConfigured(cfg) ? cfg.tokenExpires || null : null);
    if (same) { prev.tokenExpires = cfg.tokenExpires; return; }
    cfgRef.current = cfg;
    clearTimeout(timerRef.current);
    clearConflict();
    missingRef.current = false;
    readyRef.current = false;
    if (!isSyncConfigured(cfg)) { stateRef.current = null; setUnsaved(false); setKind("local"); return; }
    stateRef.current = loadSyncState(cfg);
    setUnsaved(!!stateRef.current && hashString(contentRef.current) !== stateRef.current.hash);
    pull();
  }, [configVersion]);

  // Pull when the window comes back; save right away when it's hidden.
  useEffect(() => {
    const onVisible = () => {
      if (Date.now() - lastPullRef.current < SYNC_FOCUS_THROTTLE_MS) return;
      if (!pausedRef.current) pull();
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") { if (timerRef.current) save(); }
      else onVisible();
    };
    // Back online: sync right away (merge or review screen as usual).
    const onOnline = () => { if (!pausedRef.current) pull(); };
    window.addEventListener("focus", onVisible);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("online", onOnline);
    return () => {
      window.removeEventListener("focus", onVisible);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("online", onOnline);
      clearTimeout(timerRef.current);
    };
  }, []);

  return {
    status, unsaved, tokenExpires, refresh: () => pull(true),
    conflict, conflictOpen, openConflict: () => setConflictOpen(true),
    resolveConflict, takeRemoteCopy, cancelConflict,
  };
}

/* ─── Key expiry reminder (v1.8.5) ───
   Starts 14 days before the key's expiry date (from GitHub's header when the
   browser can read it, or the date typed in Sync settings). Dismissing hides
   it for the rest of the day. */
const KEY_REMINDER_DAYS = 14;
const KEY_REMINDER_DISMISS_KEY = TEST_MODE ? "newday-key-reminder-dismissed-TEST" : "newday-key-reminder-dismissed";

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const ms = new Date(dateStr + "T12:00:00") - new Date(realTodayStr() + "T12:00:00");
  return Number.isNaN(ms) ? null : Math.round(ms / 86400000);
}

function useKeyExpiryReminder(tokenExpires) {
  const [dismissedOn, setDismissedOn] = useState(() => { try { return localStorage.getItem(KEY_REMINDER_DISMISS_KEY); } catch (e) { return null; } });
  const days = daysUntil(tokenExpires);
  const show = days !== null && days <= KEY_REMINDER_DAYS && dismissedOn !== realTodayStr();
  const dismiss = () => {
    const today = realTodayStr();
    try { localStorage.setItem(KEY_REMINDER_DISMISS_KEY, today); } catch (e) { /* ignore */ }
    setDismissedOn(today);
  };
  return { show, days, dismiss };
}

/* ─── App update check ───
   GitHub Pages and the browser can keep serving the old page for a while,
   so the app asks for its own page with caching bypassed and compares
   APP_VERSION. If a newer one is deployed, a banner offers a reload that
   fetches the new page under a fresh URL. */
const UPDATE_CHECK_INTERVAL_MS = 10 * 60 * 1000;
const UPDATE_CHECK_THROTTLE_MS = 60 * 1000;

async function fetchDeployedVersion() {
  if (!/^https?:$/.test(location.protocol)) return null;
  const res = await fetch(`${location.pathname}?check=${Date.now()}`, { cache: "no-store" });
  if (!res.ok) return null;
  const m = (await res.text()).match(/const APP_VERSION = "([^"]+)";/);
  return m ? m[1] : null;
}

async function reloadToVersion(version) {
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    await reg?.update();
  } catch (e) { /* ignore */ }
  location.replace(`${location.pathname}?v=${encodeURIComponent(version)}`);
}

function useUpdateCheck() {
  const [newVersion, setNewVersion] = useState(null);
  const lastRef = useRef(0);
  const check = useCallback(async (force = false) => {
    if (!force && Date.now() - lastRef.current < UPDATE_CHECK_THROTTLE_MS) return;
    lastRef.current = Date.now();
    try {
      const v = await fetchDeployedVersion();
      if (v && v !== APP_VERSION) setNewVersion(v);
    } catch (e) { /* offline: try again later */ }
  }, []);
  useEffect(() => {
    const onVisible = () => { if (document.visibilityState !== "hidden") check(); };
    window.addEventListener("focus", onVisible);
    document.addEventListener("visibilitychange", onVisible);
    const id = setInterval(onVisible, UPDATE_CHECK_INTERVAL_MS);
    return () => {
      window.removeEventListener("focus", onVisible);
      document.removeEventListener("visibilitychange", onVisible);
      clearInterval(id);
    };
  }, [check]);
  return { newVersion, check };
}

const SYNC_STATUS_LABELS = {
  local: { text: "Local only", color: "#AEAEA6", dot: "#D4D4D0", title: "Sync isn't set up. Tasks are saved in this browser." },
  checking: { text: "Checking…", color: "#8A8A86", dot: "#D4D4D0", title: "Checking GitHub for changes." },
  setup: { text: "Sync set up", color: "#8A8A86", dot: "#93C5FD", title: "Sync is set up. Your tasks will be uploaded in the import step." },
  synced: { text: "Synced", color: "#059669", dot: "#10B981", title: "Up to date with GitHub." },
  pending: { text: "Unsaved", color: "#B45309", dot: "#F59E0B", title: "Changes will be saved to GitHub in a moment." },
  saving: { text: "Saving…", color: "#B45309", dot: "#F59E0B", title: "Saving to GitHub." },
  paused: { text: "Sync paused", color: "#B91C1C", dot: "#EF4444", title: "Sync is paused. Your edits are safe on this device." },
  conflict: { text: "Needs review", color: "#B91C1C", dot: "#EF4444", title: "Changes on both sides need your review." },
  offline: { text: "Offline", color: "#B45309", dot: "#F59E0B", title: "Can't reach GitHub. Working locally." },
  auth: { text: "Key problem", color: "#B91C1C", dot: "#EF4444", title: SYNC_KEY_REJECTED_MESSAGE },
  error: { text: "Not synced", color: "#B91C1C", dot: "#EF4444", title: "GitHub returned an error. Working locally." },
};

/* ─── Conflict screen (v1.8.4, sync Stage 4) ─── */
const SECTION_LABELS = { todayTasks: "Today", futureTasks: "Future", backlogTasks: "Backlog", somedayTasks: "Someday", ongoingTasks: "Ongoing", recurringTemplates: "Recurring template" };

function formatStamp(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function describeEntry(entry, categories) {
  if (!entry) return null;
  const t = entry.item;
  const isTemplate = entry.section === "recurringTemplates";
  const status = t.deleted ? "Deleted"
    : isTemplate ? (t.status === "paused" ? "Paused" : "Active")
    : (t.completed || t.ongoingCompleted) ? "Done"
    : t.status === "waiting" ? "Waiting"
    : "Open";
  const tags = Object.entries(t.tags || {}).filter(([, v]) => v)
    .map(([cat, v]) => getTagValue(categories, cat, v)?.label || v).join(", ");
  return {
    Title: t.title || "(untitled)",
    Section: SECTION_LABELS[entry.section] || entry.section,
    "Due date": isTemplate ? (t.recurrenceRule?.frequency || "—") : formatDate(t.dueDate),
    Status: status,
    Notes: [t.description, t.statusNote].filter(Boolean).join(" · ") || "—",
    Tags: tags || "—",
    Reminders: (Array.isArray(t.reminders) && t.reminders.length) ? t.reminders.map(formatStamp).join(", ") : "—",
  };
}

const CONFLICT_FIELDS = ["Title", "Section", "Due date", "Status", "Notes", "Tags", "Reminders"];

function ChoiceButton({ selected, onClick, children, testId }) {
  return (
    <button data-testid={testId} data-selected={selected ? "true" : "false"} onClick={onClick}
      style={{ ...smallBtnStyle, backgroundColor: selected ? "#1A1A1A" : "#FFFFFF", color: selected ? "#FFFFFF" : "#6B6B67", borderColor: selected ? "#1A1A1A" : "#EBEBEA" }}>
      {selected ? "✓ " : ""}{children}
    </button>
  );
}

function ConflictSide({ title, desc, other, stamp }) {
  return (
    <div style={{ flex: 1, minWidth: 0, border: "1px solid #EBEBEA", borderRadius: "8px", padding: "8px 10px", backgroundColor: "#FFFFFF" }}>
      <div style={{ fontSize: "11px", fontWeight: 700, color: "#8A8A86", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "6px" }}>
        {title}{stamp ? <span style={{ fontWeight: 500, textTransform: "none", letterSpacing: 0 }}> · changed {stamp}</span> : null}
      </div>
      {!desc ? (
        <div style={{ fontSize: "13px", color: "#B91C1C", fontStyle: "italic" }}>Removed</div>
      ) : CONFLICT_FIELDS.map((f) => {
        const differs = !other || other[f] !== desc[f];
        return (
          <div key={f} data-differs={differs ? "true" : "false"} style={{ display: "flex", gap: "8px", fontSize: "12px", lineHeight: 1.5, padding: "1px 4px", borderRadius: "4px", backgroundColor: differs ? "#FEF3C7" : "transparent" }}>
            <span style={{ width: "70px", flexShrink: 0, color: "#AEAEA6" }}>{f}</span>
            <span style={{ color: "#1A1A1A", wordBreak: "break-word" }}>{desc[f]}</span>
          </div>
        );
      })}
    </div>
  );
}

function ConflictScreen({ conflict, categories, onResolve, onUseRemote, onCancel }) {
  const { merge, legacy } = conflict;
  const [mode, setMode] = useState(legacy ? "ask" : "merge");
  const [choices, setChoices] = useState({});
  const [dayChoice, setDayChoice] = useState(null);
  const [catChoice, setCatChoice] = useState(null);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState(null);

  const clashes = merge.clashes;
  const choose = (id, side) => setChoices((c) => ({ ...c, [id]: side }));
  const chooseAll = (side) => {
    setChoices(Object.fromEntries(clashes.map((c) => [c.id, side])));
    if (merge.categories.clash) setCatChoice(side);
  };
  const pickDay = (side) => {
    setDayChoice(side);
    // The day decides the default for anything still undecided.
    setChoices((c) => { const n = { ...c }; clashes.forEach((x) => { if (!n[x.id]) n[x.id] = side; }); return n; });
    if (merge.categories.clash && !catChoice) setCatChoice(side);
  };
  const undecided = clashes.filter((c) => !choices[c.id]).length
    + (merge.day.clash && !dayChoice ? 1 : 0) + (merge.categories.clash && !catChoice ? 1 : 0);

  const run = async (fn) => {
    setWorking(true); setError(null);
    const r = await fn();
    setWorking(false);
    if (r === "error") setError("Couldn't reach GitHub. Nothing was changed. Try again in a moment.");
  };

  const dayLabel = (d) => (d ? new Date(d + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }) : "—");
  const autoCount = merge.fromMac + merge.fromGithub;

  return (
    <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.3)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "20px" }}>
      <div data-testid="conflict-screen" style={{ backgroundColor: "#FFFFFF", borderRadius: "16px", padding: "28px", maxWidth: "760px", width: "100%", maxHeight: "86vh", overflow: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.15)", fontFamily: "inherit" }}>
        <h2 style={{ fontSize: "20px", fontWeight: 700, color: "#1A1A1A", margin: "0 0 6px 0" }}>Sync: review changes</h2>
        {conflict.notice && (
          <div data-testid="conflict-notice" style={{ fontSize: "13px", padding: "8px 12px", borderRadius: "8px", backgroundColor: "#EEF2FF", color: "#3730A3", marginBottom: "12px" }}>{conflict.notice}</div>
        )}

        {mode === "ask" ? (
          <>
            <p style={{ fontSize: "14px", color: "#6B6B67", margin: "0 0 18px 0", lineHeight: 1.5 }}>
              GitHub already has a notebook, and this device has its own tasks that were never synced. Nothing has been changed yet.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "18px" }}>
              <button data-testid="use-remote" disabled={working} onClick={() => run(onUseRemote)} style={{ ...pillBtnStyle, backgroundColor: "#1A1A1A", color: "#FFF", textAlign: "left" }}>
                Use GitHub's copy
                <div style={{ fontSize: "12px", fontWeight: 400, opacity: 0.8 }}>A backup of this device's tasks downloads first, then this device switches to GitHub's notebook.</div>
              </button>
              <button data-testid="merge-both" disabled={working} onClick={() => setMode("merge")} style={{ ...bulkBtnStyle, textAlign: "left" }}>
                Merge both
                <div style={{ fontSize: "12px", fontWeight: 400 }}>Keep tasks from both sides; you pick where the same task differs.</div>
              </button>
            </div>
          </>
        ) : (
          <>
            <p style={{ fontSize: "14px", color: "#6B6B67", margin: "0 0 16px 0", lineHeight: 1.5 }}>
              Your notebook changed both on this device and on GitHub.
              {autoCount > 0 && <> {autoCount} change{autoCount === 1 ? "" : "s"} merged on {autoCount === 1 ? "its" : "their"} own.</>}
              {clashes.length > 0 ? <> {clashes.length} task{clashes.length === 1 ? " was" : "s were"} changed on both sides; pick which version to keep.</> : <> Nothing clashes.</>}
              {" "}Nothing is saved until you press Save.
            </p>

            {merge.day.clash && (
              <div data-testid="day-clash" style={{ border: "1px solid #FDE68A", backgroundColor: "#FFFBEB", borderRadius: "10px", padding: "12px 14px", marginBottom: "16px" }}>
                <div style={{ fontSize: "14px", fontWeight: 600, color: "#92400E", marginBottom: "4px" }}>☀ New Day ran on both sides</div>
                <div style={{ fontSize: "13px", color: "#92400E", marginBottom: "10px" }}>
                  This device is on {dayLabel(merge.day.mac)}; GitHub is on {dayLabel(merge.day.github)}. Pick which day to keep. Undecided tasks below follow your pick.
                </div>
                <div style={{ display: "flex", gap: "8px" }}>
                  <ChoiceButton testId="day-mac" selected={dayChoice === "mac"} onClick={() => pickDay("mac")}>Keep this device's day ({dayLabel(merge.day.mac)})</ChoiceButton>
                  <ChoiceButton testId="day-github" selected={dayChoice === "github"} onClick={() => pickDay("github")}>Keep GitHub's day ({dayLabel(merge.day.github)})</ChoiceButton>
                </div>
              </div>
            )}

            {(clashes.length > 1 || (clashes.length > 0 && merge.categories.clash)) && (
              <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
                <button data-testid="all-mac" onClick={() => chooseAll("mac")} style={bulkBtnStyle}>All this device's</button>
                <button data-testid="all-github" onClick={() => chooseAll("github")} style={bulkBtnStyle}>All GitHub's</button>
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "18px" }}>
              {merge.categories.clash && (
                <div data-testid="clash-categories" style={{ border: "1px solid #EBEBEA", borderRadius: "10px", padding: "12px", backgroundColor: "#FAFAF9" }}>
                  <div style={{ fontSize: "14px", fontWeight: 600, color: "#1A1A1A", marginBottom: "8px" }}>🏷 Tag categories changed on both sides</div>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <ChoiceButton selected={catChoice === "mac"} onClick={() => setCatChoice("mac")}>Keep this device's</ChoiceButton>
                    <ChoiceButton selected={catChoice === "github"} onClick={() => setCatChoice("github")}>Keep GitHub's</ChoiceButton>
                  </div>
                </div>
              )}
              {clashes.map((c) => {
                const mac = describeEntry(c.mac, categories);
                const gh = describeEntry(c.github, categories);
                return (
                  <div key={c.id} data-testid="clash" data-id={c.id} style={{ border: "1px solid #EBEBEA", borderRadius: "10px", padding: "12px", backgroundColor: "#FAFAF9" }}>
                    <div style={{ fontSize: "14px", fontWeight: 600, color: "#1A1A1A", marginBottom: "8px" }}>{(mac || gh).Title}</div>
                    <div style={{ display: "flex", gap: "10px", marginBottom: "10px", flexWrap: "wrap" }}>
                      <ConflictSide title="This device" desc={mac} other={gh} stamp={formatStamp(c.mac?.item.updatedAt)} />
                      <ConflictSide title="GitHub" desc={gh} other={mac} stamp={formatStamp(c.github?.item.updatedAt)} />
                    </div>
                    <div style={{ display: "flex", gap: "8px" }}>
                      <ChoiceButton testId="keep-mac" selected={choices[c.id] === "mac"} onClick={() => choose(c.id, "mac")}>Keep this device's</ChoiceButton>
                      <ChoiceButton testId="keep-github" selected={choices[c.id] === "github"} onClick={() => choose(c.id, "github")}>Keep GitHub's</ChoiceButton>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {error && <div style={{ fontSize: "13px", color: "#B91C1C", marginBottom: "12px" }}>{error}</div>}
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <button data-testid="conflict-cancel" disabled={working} onClick={onCancel} style={bulkBtnStyle}>Cancel</button>
          <span style={{ fontSize: "12px", color: "#AEAEA6" }}>Cancel changes nothing; sync stays paused.</span>
          <div style={{ flex: 1 }} />
          {mode === "merge" && (
            <button data-testid="conflict-save" disabled={working || undecided > 0}
              onClick={() => run(() => onResolve(choices, dayChoice, catChoice))}
              style={{ ...pillBtnStyle, backgroundColor: undecided > 0 ? "#D4D4D0" : "#1A1A1A", color: "#FFF", cursor: undecided > 0 ? "default" : "pointer" }}>
              {working ? "Saving…" : undecided > 0 ? `${undecided} left to pick` : "Save merged notebook"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   MAIN APP
   ═══════════════════════════════════════════ */

export default function TodoApp() {
  const [activeTab, setActiveTab] = useState("notebook");

  // v1.8 Phase 2: multi-add staging state lifted here (Persistence Level A) so
  // the staged rows and mode flag survive tab switches — NotebookTab unmounts
  // when another tab is active. Not persisted to localStorage; DATA_VERSION 5.
  const [multiAddMode, setMultiAddMode] = useState(false);
  const [stagedRows, setStagedRows] = useState([]);

  // Test Rig UI state (inert unless TEST_MODE). Part A: storage isolation
  // + reset/seed + inspector. Part B: the fake clock (below), its header
  // controls, the blue banner indicator, and the full sample seed.
  const [rigOpen, setRigOpen] = useState(false);
  const [rigInspect, setRigInspect] = useState(false);
  // Fake clock: React state drives re-render; the module-level mirror
  // (__fakeClockDate, seeded synchronously at module load from the -TEST
  // island) is what getClockToday() actually reads. setFakeClock keeps the
  // two in sync and persists to the rig's own storage key.
  const [fakeClock, setFakeClockState] = useState(() => (TEST_MODE ? __fakeClockDate : null));
  const setFakeClock = useCallback((dateStr) => {
    writeFakeClock(dateStr);
    setFakeClockState(dateStr || null);
  }, []);

  // Default demo data (used on first run only)
  const ts = nowTimestamp();
  const defaultToday = assignDayOrder([
    { id: "d1", title: "Review PR #42", description: "Check the new auth flow", tags: { life: "work", eisenhower: "ui", project: "alpha" }, dueDate: getTodayStr(), originalDueDate: getTodayStr(), dueDateHistory: [], createdDate: ts, completedDate: null, completed: false },
    { id: "d2", title: "Buy groceries", description: "Milk, eggs, bread", tags: { life: "personal", eisenhower: "un" }, dueDate: getTodayStr(), originalDueDate: getTodayStr(), dueDateHistory: [], createdDate: ts, completedDate: null, completed: false },
    { id: "d3", title: "Write blog post", description: "Draft about React patterns", tags: { life: "work", eisenhower: "ni", project: "alpha" }, dueDate: getTodayStr(), originalDueDate: getTodayStr(), dueDateHistory: [], createdDate: ts, completedDate: null, completed: false },
  ]);
  const defaultBacklog = [
    { id: "d4", title: "Fix login bug", description: "Users can't reset password", tags: { life: "work", eisenhower: "ui", project: "beta" }, dueDate: "2026-02-23", originalDueDate: "2026-02-21", dueDateHistory: [{ from: "2026-02-21", to: "2026-02-23", changedAt: "2026-02-22T09:00:00.000Z" }], createdDate: "2026-02-20T09:30:00.000Z", completedDate: null, completed: false },
    { id: "d5", title: "Call dentist", description: "Schedule cleaning", tags: { life: "personal", eisenhower: "un" }, dueDate: "2026-02-22", originalDueDate: "2026-02-22", dueDateHistory: [], createdDate: "2026-02-18T14:00:00.000Z", completedDate: null, completed: false },
    { id: "d6", title: "Update resume", description: "", tags: { life: "personal", eisenhower: "ni" }, dueDate: "2026-02-22", originalDueDate: "2026-02-22", dueDateHistory: [], createdDate: "2026-02-18T10:15:00.000Z", completedDate: null, completed: false },
  ];
  const defaultSomeday = [
    { id: "d7", title: "Learn Rust", description: "Work through the book", tags: { life: "learning", eisenhower: "nn" }, dueDate: "", originalDueDate: "", dueDateHistory: [], createdDate: "2026-02-10T08:00:00.000Z", completedDate: null, completed: false },
    { id: "d8", title: "Reorganize garage", description: "", tags: { life: "personal", eisenhower: "nn" }, dueDate: "", originalDueDate: "", dueDateHistory: [], createdDate: "2026-02-14T11:00:00.000Z", completedDate: null, completed: false },
  ];

  // Load saved data or fall back to defaults
  // Read once on mount (it was re-read and re-parsed on every render).
  const [saved] = useState(loadFromStorage);

  const [categories, setCategories] = useState(saved?.categories || defaultTagCategories);
  const [currentDay, setCurrentDay] = useState(saved?.currentDay || getTodayStr());
  const [todayTasks, setTodayTasksRaw] = useState(saved?.todayTasks ? assignDayOrder(saved.todayTasks) : backfillSyncFieldsAll(defaultToday, ts));
  const setTodayTasks = useCallback((updater) => {
    setTodayTasksRaw((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      return assignDayOrder(stampChangedItems(prev, next));
    });
  }, []);
  const [backlogTasks, setBacklogTasksRaw] = useState(saved?.backlogTasks ? assignBacklogOrder(saved.backlogTasks) : assignBacklogOrder(backfillSyncFieldsAll(defaultBacklog, ts)));
  const setBacklogTasks = useCallback((updater) => {
    setBacklogTasksRaw((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      return assignBacklogOrder(stampChangedItems(prev, next));
    });
  }, []);
  const [somedayTasks, setSomedayTasksRaw] = useState(saved?.somedayTasks ? assignSomedayOrder(saved.somedayTasks) : assignSomedayOrder(backfillSyncFieldsAll(defaultSomeday, ts)));
  const setSomedayTasks = useCallback((updater) => {
    setSomedayTasksRaw((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      return assignSomedayOrder(stampChangedItems(prev, next));
    });
  }, []);
  const [futureTasks, setFutureTasksRaw] = useState(saved?.futureTasks || []);
  const setFutureTasks = useCallback((updater) => {
    setFutureTasksRaw((prev) => stampChangedItems(prev, typeof updater === "function" ? updater(prev) : updater));
  }, []);
  const [ongoingTasks, setOngoingTasksRaw] = useState(saved?.ongoingTasks ? assignOngoingOrder(saved.ongoingTasks) : []);
  const setOngoingTasks = useCallback((updater) => {
    setOngoingTasksRaw((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      return assignOngoingOrder(stampChangedItems(prev, next));
    });
  }, []);
  const [recurringTemplates, setRecurringTemplatesRaw] = useState(saved?.recurringTemplates || []);
  const setRecurringTemplates = useCallback((updater) => {
    setRecurringTemplatesRaw((prev) => stampChangedItems(prev, typeof updater === "function" ? updater(prev) : updater));
  }, []);

  // Auto-save to localStorage whenever data changes
  useEffect(() => {
    saveToStorage({ todayTasks, backlogTasks, somedayTasks, futureTasks, ongoingTasks, recurringTemplates, categories, currentDay });
  }, [todayTasks, backlogTasks, somedayTasks, futureTasks, ongoingTasks, recurringTemplates, categories, currentDay]);

  // Export data as JSON file
  const handleExport = () => {
    const data = { version: DATA_VERSION, exportedAt: nowTimestamp(), todayTasks, backlogTasks, somedayTasks, futureTasks, ongoingTasks, recurringTemplates, categories, currentDay };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `newday-notebook-backup-${getTodayStr()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Import data from JSON file
  const fileInputRef = useRef(null);
  const [importStatus, setImportStatus] = useState(null);
  const [syncOpen, setSyncOpen] = useState(false);
  const [syncConfigVersion, setSyncConfigVersion] = useState(0);

  // GitHub sync (inert until Sync settings are filled in). Remote copies are
  // set with the raw setters so their updatedAt values are kept as-is.
  const applyRemoteNotebook = useCallback((nb) => {
    setCurrentDay(nb.currentDay);
    setCategories(nb.categories);
    setTodayTasksRaw(nb.todayTasks);
    setBacklogTasksRaw(nb.backlogTasks);
    setSomedayTasksRaw(nb.somedayTasks);
    setFutureTasksRaw(nb.futureTasks);
    setOngoingTasksRaw(nb.ongoingTasks);
    setRecurringTemplatesRaw(nb.recurringTemplates);
  }, []);
  const sync = useGitHubSync({
    data: { currentDay, categories, todayTasks, backlogTasks, somedayTasks, futureTasks, ongoingTasks, recurringTemplates },
    applyRemote: applyRemoteNotebook,
    onBackup: () => handleExport(),
    hadLocalData: !!saved,
    configVersion: syncConfigVersion,
  });
  const update = useUpdateCheck();
  const syncLabel = SYNC_STATUS_LABELS[sync.status.kind] || SYNC_STATUS_LABELS.local;
  const syncUnsavedNote = sync.unsaved && ["offline", "auth", "error"].includes(sync.status.kind) ? " · unsaved" : "";
  const keyReminder = useKeyExpiryReminder(sync.tokenExpires);

  const handleImport = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = JSON.parse(evt.target.result);
        if (!data.todayTasks || !data.backlogTasks || !data.somedayTasks || !data.categories) {
          setImportStatus("error");
          setTimeout(() => setImportStatus(null), 3000);
          return;
        }
        // Run the same backfills as a load, then set the lists directly so the
        // file's own updatedAt values are kept rather than re-stamped as new.
        migrateData(data);
        setTodayTasksRaw(assignDayOrder(data.todayTasks));
        setBacklogTasksRaw(assignBacklogOrder(data.backlogTasks));
        setSomedayTasksRaw(assignSomedayOrder(data.somedayTasks));
        setFutureTasksRaw(data.futureTasks || []);
        setOngoingTasksRaw(assignOngoingOrder(data.ongoingTasks || []));
        setRecurringTemplatesRaw(data.recurringTemplates || []);
        setCategories(data.categories);
        if (data.currentDay) setCurrentDay(data.currentDay);
        setImportStatus("success");
        setTimeout(() => setImportStatus(null), 3000);
      } catch {
        setImportStatus("error");
        setTimeout(() => setImportStatus(null), 3000);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  // Combine all tasks for the database view
  const allTasks = [
    ...todayTasks.map((t) => ({ ...t, section: t.deleted ? "Deleted" : t.completed ? "Completed" : t.recurringParentId ? "Recurring" : "Today" })),
    ...backlogTasks.map((t) => ({ ...t, section: t.deleted ? "Deleted" : t.completed ? "Completed" : t.recurringParentId ? "Recurring" : "Backlog" })),
    ...somedayTasks.map((t) => ({ ...t, section: t.deleted ? "Deleted" : t.completed ? "Completed" : "Someday" })),
    ...futureTasks.map((t) => ({ ...t, section: t.deleted ? "Deleted" : t.completed ? "Completed" : t.recurringParentId ? "Recurring" : "Future" })),
    ...ongoingTasks.map((t) => ({ ...t, section: t.deleted ? "Deleted" : t.ongoingCompleted ? "Completed" : t.completed ? "Completed" : "Ongoing" })),
  ];

  const navigateToRecurring = useCallback((templateId) => {
    setActiveTab("recurring");
    // Template highlighting could be added later — for now just navigate
  }, []);

  // ── Test Rig handlers (Part A) ──────────────────────────────────
  // These only ever run in the rig build and only ever touch the
  // isolated "-TEST" storage island (via STORAGE_KEY + the autosave
  // effect). They cannot reach production data.
  const rigSeed = useCallback(() => {
    const now = nowTimestamp();
    // Fixed, reproducible anchor: Monday, March 2, 2026. Every seeded date is
    // relative to this, so the scenario is identical every run regardless of
    // the real date. The fake clock and the notebook date both start here.
    const A = "2026-03-02";
    const dayShift = (base, n) => {
      const d = new Date(base + "T12:00:00"); d.setDate(d.getDate() + n);
      return d.toISOString().split("T")[0];
    };
    const mk = (id, title, description, tags, dueDate, extra = {}) => ({
      id, title, description, tags,
      dueDate, originalDueDate: dueDate, dueDateHistory: [],
      createdDate: now, completedDate: null, completed: false, deleted: false, ...extra,
    });

    // ── Recurring templates: daily + weekly + biweekly + monthly + quarterly ──
    const base = { status: "active", createdDate: now, deleted: false, deletedDate: null, completions: [] };
    const tmplDaily = { ...base, id: "rig-tpl-daily", title: "Morning standup", description: "Team sync", tags: { life: "work", eisenhower: "ni" }, recurrenceRule: { frequency: "daily", schedule: {} }, startDate: A };
    const tmplWeekly = { ...base, id: "rig-tpl-weekly", title: "Weekly review", description: "Review the week", tags: { life: "work", eisenhower: "ni" }, recurrenceRule: { frequency: "weekly", schedule: { days: [5], interval: 1 } }, startDate: A };
    const tmplBiweekly = { ...base, id: "rig-tpl-biweekly", title: "Biweekly 1:1", description: "Manager 1:1", tags: { life: "work", eisenhower: "ni" }, recurrenceRule: { frequency: "weekly", schedule: { days: [2], interval: 2 } }, startDate: A };
    const tmplMonthly = { ...base, id: "rig-tpl-monthly", title: "Pay rent", description: "", tags: { life: "finance", eisenhower: "ui" }, recurrenceRule: { frequency: "monthly", schedule: { dayOfMonth: 15 } }, startDate: A };
    const tmplQuarterly = { ...base, id: "rig-tpl-quarterly", title: "Quarterly report", description: "", tags: { life: "work", eisenhower: "ni", project: "beta" }, recurrenceRule: { frequency: "quarterly", schedule: { dayOfMonth: 1 } }, startDate: A };
    const templates = [tmplDaily, tmplWeekly, tmplBiweekly, tmplMonthly, tmplQuarterly];

    // Generate each template's initial instances exactly the way
    // handleAddTemplate does, so the seeded data matches real app behavior.
    const recToday = [];
    const recFuture = [];
    for (const tmpl of templates) {
      const count = INSTANCE_COUNTS[tmpl.recurrenceRule.frequency] || 10;
      const startFrom = tmpl.startDate >= A ? tmpl.startDate : A;
      const dueDates = generateNextDueDates(tmpl, startFrom, count);
      const inst = generateInstancesFromTemplate(tmpl, dueDates, 1);
      for (const t of inst) (t.dueDate === A ? recToday : recFuture).push(t);
    }

    // ── 6 plain Today tasks ──
    const today = [
      mk("rig-t1", "Review PR #42", "Check the new auth flow", { life: "work", eisenhower: "ui", project: "alpha" }, A),
      mk("rig-t2", "Buy groceries", "Milk, eggs, bread", { life: "personal", eisenhower: "un" }, A),
      mk("rig-t3", "Write blog post", "Draft about React patterns", { life: "work", eisenhower: "ni", project: "alpha" }, A),
      mk("rig-t4", "Reply to emails", "Clear the inbox", { life: "work", eisenhower: "un" }, A),
      mk("rig-t5", "Gym session", "Leg day", { life: "health", eisenhower: "ni" }, A),
      mk("rig-t6", "Read chapter 4", "", { life: "learning", eisenhower: "nn" }, A),
    ];

    // ── 5 Future tasks (plain, spread across the coming weeks) ──
    const future = [
      mk("rig-f1", "Dentist appointment", "Cleaning", { life: "health", eisenhower: "ui" }, dayShift(A, 3)),
      mk("rig-f2", "Project Alpha demo", "", { life: "work", eisenhower: "ui", project: "alpha" }, dayShift(A, 5)),
      mk("rig-f3", "Quarterly review prep", "", { life: "work", eisenhower: "ni" }, dayShift(A, 9)),
      mk("rig-f4", "Renew passport", "", { life: "personal", eisenhower: "ni" }, dayShift(A, 20)),
      mk("rig-f5", "Plan vacation", "", { life: "personal", eisenhower: "nn" }, dayShift(A, 45)),
    ];

    // ── 2 Someday ──
    const someday = [
      mk("rig-s1", "Learn Rust", "Work through the book", { life: "learning", eisenhower: "nn" }, ""),
      mk("rig-s2", "Reorganize garage", "", { life: "personal", eisenhower: "nn" }, ""),
    ];

    // ── 2 Ongoing ──
    const ongoingExtra = { ongoing: true, ongoingCompletions: [], ongoingCompleted: false, ongoingCompletedDate: null };
    const ongoing = [
      mk("rig-o1", "Learn Spanish", "15 min a day", { life: "learning", eisenhower: "ni" }, "", { ...ongoingExtra, ongoingOrder: 1 }),
      mk("rig-o2", "Daily journaling", "", { life: "personal", eisenhower: "nn" }, "", { ...ongoingExtra, ongoingOrder: 2 }),
    ];

    // ── 3 recurring-archive instances in Backlog (>=1 skipped) ──
    // Past daily-standup instances that already resolved. These give v1.8
    // Phase 1's Skipped/Missed filter real data to surface.
    const archive = [
      { ...mk("rig-a1", "Morning standup", "Team sync", { life: "work", eisenhower: "ni" }, dayShift(A, -3)), recurringParentId: "rig-tpl-daily", recurringStatus: "skipped", recurringSequence: 101 },
      { ...mk("rig-a2", "Morning standup", "Team sync", { life: "work", eisenhower: "ni" }, dayShift(A, -2)), recurringParentId: "rig-tpl-daily", recurringStatus: "missed", recurringSequence: 102 },
      { ...mk("rig-a3", "Morning standup", "Team sync", { life: "work", eisenhower: "ni" }, dayShift(A, -1)), recurringParentId: "rig-tpl-daily", recurringStatus: "completed", recurringSequence: 103, completed: true, completedDate: dayShift(A, -1) + "T09:00:00.000Z" },
    ];
    // Mirror the archive into the daily template's completion history so the
    // recurring log stays consistent with the archived instances.
    tmplDaily.completions = [
      { date: dayShift(A, -3), instanceId: "rig-a1", status: "skipped", timestamp: now },
      { date: dayShift(A, -2), instanceId: "rig-a2", status: "missed", timestamp: now },
      { date: dayShift(A, -1), instanceId: "rig-a3", status: "completed", timestamp: now },
    ];

    // Commit. Fake clock and notebook date both anchor to A; advancing the
    // clock from here and hitting New Day exercises the full rollover path.
    setFakeClock(A);
    setCurrentDay(A);
    setRecurringTemplates(templates);
    setTodayTasks([...recToday, ...today]);
    setFutureTasks([...recFuture, ...future]);
    setSomedayTasks(someday);
    setOngoingTasks(ongoing);
    setBacklogTasks(archive);
  }, [setFakeClock, setTodayTasks, setFutureTasks, setSomedayTasks, setBacklogTasks, setOngoingTasks, setRecurringTemplates, setCurrentDay]);

  const rigReset = useCallback(() => {
    setTodayTasks([]);
    setFutureTasks([]);
    setSomedayTasks([]);
    setBacklogTasks([]);
    setOngoingTasks([]);
    setRecurringTemplates([]);
    setFakeClock(null);
    setCurrentDay(getTodayStr());
  }, [setTodayTasks, setFutureTasks, setSomedayTasks, setBacklogTasks, setOngoingTasks, setRecurringTemplates, setFakeClock, setCurrentDay]);

  const rigCounts = { today: todayTasks.length, future: futureTasks.length, someday: somedayTasks.length, backlog: backlogTasks.length, ongoing: ongoingTasks.length, templates: recurringTemplates.length };

  const tabs = [
    { id: "notebook", label: "Daily Notebook", icon: "📓" },
    { id: "future", label: "Future Notebook", icon: "📅" },
    { id: "recurring", label: "Recurring", icon: "🔄" },
    { id: "database", label: "Task Database", icon: "📊" },
    { id: "tags", label: "Tag Manager", icon: "🏷" },
  ];

  return (
    <div style={{ fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif", backgroundColor: "#FAFAF9", minHeight: "100vh", padding: "0 20px 80px" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />

      {/* ── Test Rig banner + tools (Part A) — inert in production ── */}
      {TEST_MODE && (
        <div style={{ maxWidth: "780px", margin: "0 auto", paddingTop: "16px" }}>
          <div style={{ border: "1px solid #BFDBFE", backgroundColor: "#EFF6FF", borderRadius: "10px", overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px 14px" }}>
              <span style={{ fontSize: "13px", fontWeight: 700, color: "#1D4ED8", letterSpacing: "0.02em" }}>🧪 TEST RIG</span>
              <span style={{ fontSize: "12px", color: "#3B6FB5" }}>
                Isolated data island — storage key <code style={{ fontFamily: "monospace", backgroundColor: "#DBEAFE", padding: "1px 5px", borderRadius: "4px" }}>newday-notebook-TEST</code>. Your real notebook is untouched.
              </span>
              <div style={{ flex: 1 }} />
              {(() => {
                const fc = fakeClock || getClockToday();
                const ahead = currentDay && fc > currentDay;
                return (
                  <span title={ahead ? "Fake clock is ahead of the notebook date — press New Day to catch up" : "Fake clock (matches the notebook date)"}
                    style={{
                      fontSize: "12px", fontWeight: 700, padding: "3px 9px", borderRadius: "6px", whiteSpace: "nowrap",
                      backgroundColor: ahead ? "#2563EB" : "#DBEAFE",
                      color: ahead ? "#FFFFFF" : "#3B6FB5",
                      border: ahead ? "1px solid #1D4ED8" : "1px solid #BFDBFE",
                    }}>
                    🕐 {fc}{ahead ? " ▲ ahead" : ""}
                  </span>
                );
              })()}
              <button onClick={() => setRigOpen((o) => !o)}
                style={{ fontSize: "12px", fontWeight: 600, padding: "5px 12px", borderRadius: "6px", border: "1px solid #93C5FD", backgroundColor: "#FFFFFF", color: "#1D4ED8", cursor: "pointer", fontFamily: "inherit" }}>
                {rigOpen ? "Hide tools ▲" : "Tools ▼"}
              </button>
            </div>
            {rigOpen && (
              <div style={{ borderTop: "1px solid #BFDBFE", padding: "12px 14px", display: "flex", flexDirection: "column", gap: "12px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                  <button onClick={rigSeed}
                    style={{ fontSize: "12px", fontWeight: 600, padding: "6px 12px", borderRadius: "6px", border: "1px solid #93C5FD", backgroundColor: "#FFFFFF", color: "#1D4ED8", cursor: "pointer", fontFamily: "inherit" }}>
                    Seed sample data
                  </button>
                  <button onClick={rigReset}
                    style={{ fontSize: "12px", fontWeight: 600, padding: "6px 12px", borderRadius: "6px", border: "1px solid #93C5FD", backgroundColor: "#FFFFFF", color: "#1D4ED8", cursor: "pointer", fontFamily: "inherit" }}>
                    Reset island (empty)
                  </button>
                  <button onClick={() => setRigInspect((o) => !o)}
                    style={{ fontSize: "12px", fontWeight: 600, padding: "6px 12px", borderRadius: "6px", border: "1px solid #93C5FD", backgroundColor: "#FFFFFF", color: "#1D4ED8", cursor: "pointer", fontFamily: "inherit" }}>
                    {rigInspect ? "Hide inspector" : "State inspector"}
                  </button>
                  <span style={{ fontSize: "12px", color: "#3B6FB5" }}>
                    today {rigCounts.today} · future {rigCounts.future} · someday {rigCounts.someday} · backlog {rigCounts.backlog} · ongoing {rigCounts.ongoing} · templates {rigCounts.templates}
                  </span>
                </div>
                {rigInspect && (
                  <pre style={{ margin: 0, maxHeight: "260px", overflow: "auto", fontFamily: "monospace", fontSize: "11px", lineHeight: 1.5, color: "#1E3A5F", backgroundColor: "#FFFFFF", border: "1px solid #DBEAFE", borderRadius: "8px", padding: "10px" }}>
{JSON.stringify({ currentDay, todayTasks, futureTasks, somedayTasks, backlogTasks, ongoingTasks, recurringTemplates }, null, 2)}
                  </pre>
                )}
                <div style={{ fontSize: "11px", color: "#8AA6C9" }}>
                  Part A: storage isolation, reset/seed, inspector. Part B: fake clock (controls at the date, above), blue indicator, full sample seed.
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab bar */}
      <div style={{ maxWidth: activeTab === "database" ? "900px" : "780px", margin: "0 auto", position: "sticky", top: 0, backgroundColor: "#FAFAF9", zIndex: 50, borderBottom: "1px solid #EBEBEA", padding: "20px 0 0 0", marginBottom: "24px", transition: "max-width 0.2s" }}>
        <div style={{ display: "flex", alignItems: "center" }}>
          {tabs.map((tab) => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              style={{
                fontSize: "14px", fontWeight: activeTab === tab.id ? 600 : 500, padding: "10px 20px",
                border: "none", backgroundColor: "transparent", color: activeTab === tab.id ? "#1A1A1A" : "#AEAEA6",
                cursor: "pointer", fontFamily: "inherit",
                borderBottom: activeTab === tab.id ? "2px solid #1A1A1A" : "2px solid transparent",
                marginBottom: "-1px", transition: "all 0.15s", display: "flex", alignItems: "center", gap: "6px",
              }}
              onMouseEnter={(e) => { if (activeTab !== tab.id) e.currentTarget.style.color = "#6B6B67"; }}
              onMouseLeave={(e) => { if (activeTab !== tab.id) e.currentTarget.style.color = "#AEAEA6"; }}
            >
              <span style={{ fontSize: "15px" }}>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
          <div style={{ flex: 1 }} />
          <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px" }}>
            {importStatus && (
              <span style={{ fontSize: "11px", fontWeight: 600, color: importStatus === "success" ? "#059669" : "#DC2626" }}>
                {importStatus === "success" ? "✓ Imported" : "✗ Invalid file"}
              </span>
            )}
            <button onClick={handleExport}
              style={{
                fontSize: "11px", fontWeight: 600, padding: "4px 10px", borderRadius: "6px",
                border: "1px solid #EBEBEA", backgroundColor: "#FFFFFF", color: "#8A8A86",
                cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: "4px",
                transition: "background-color 0.1s, color 0.1s",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#F0F0EC"; e.currentTarget.style.color = "#5A5A56"; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "#FFFFFF"; e.currentTarget.style.color = "#8A8A86"; }}
            >
              ↓ Export
            </button>
            <button onClick={() => fileInputRef.current?.click()}
              style={{
                fontSize: "11px", fontWeight: 600, padding: "4px 10px", borderRadius: "6px",
                border: "1px solid #EBEBEA", backgroundColor: "#FFFFFF", color: "#8A8A86",
                cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: "4px",
                transition: "background-color 0.1s, color 0.1s",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#F0F0EC"; e.currentTarget.style.color = "#5A5A56"; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "#FFFFFF"; e.currentTarget.style.color = "#8A8A86"; }}
            >
              ↑ Import
            </button>
            <input ref={fileInputRef} type="file" accept=".json" onChange={handleImport} style={{ display: "none" }} />
            <span data-testid="sync-indicator" data-kind={sync.status.kind} title={sync.status.message || syncLabel.title}
              style={{ fontSize: "11px", fontWeight: 600, color: syncLabel.color, display: "flex", alignItems: "center", gap: "4px", padding: "0 4px", userSelect: "none" }}>
              <span style={{ width: "7px", height: "7px", borderRadius: "50%", backgroundColor: syncLabel.dot, display: "inline-block" }} />
              {syncLabel.text}{syncUnsavedNote}
            </span>
            <button onClick={() => { sync.refresh(); update.check(true); }} title="Check GitHub and the app for updates"
              style={{
                fontSize: "11px", fontWeight: 600, padding: "4px 10px", borderRadius: "6px",
                border: "1px solid #EBEBEA", backgroundColor: "#FFFFFF", color: "#8A8A86",
                cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: "4px",
                transition: "background-color 0.1s, color 0.1s",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#F0F0EC"; e.currentTarget.style.color = "#5A5A56"; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "#FFFFFF"; e.currentTarget.style.color = "#8A8A86"; }}
            >
              ⟳ Refresh
            </button>
            <button onClick={() => setSyncOpen(true)} title="Sync settings"
              style={{
                fontSize: "11px", fontWeight: 600, padding: "4px 10px", borderRadius: "6px",
                border: "1px solid #EBEBEA", backgroundColor: "#FFFFFF", color: "#8A8A86",
                cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: "4px",
                transition: "background-color 0.1s, color 0.1s",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#F0F0EC"; e.currentTarget.style.color = "#5A5A56"; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "#FFFFFF"; e.currentTarget.style.color = "#8A8A86"; }}
            >
              ⚙ Sync
            </button>
            <span style={{ fontSize: "10px", fontWeight: 600, color: "#C4C4C0", letterSpacing: "0.04em", marginLeft: "4px", userSelect: "none" }}>v{APP_VERSION}</span>
          </div>
        </div>
      </div>

      {update.newVersion && (
        <div data-testid="update-banner" style={{ maxWidth: "780px", margin: "-12px auto 16px", padding: "10px 14px", borderRadius: "10px", backgroundColor: "#EEF2FF", color: "#3730A3", fontSize: "13px", display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ flex: 1 }}>A new version of NewDay (v{update.newVersion}) is available.</span>
          <button onClick={() => reloadToVersion(update.newVersion)} style={{ ...smallBtnStyle, color: "#3730A3", borderColor: "#C7D2FE" }}>Reload now</button>
        </div>
      )}
      {sync.status.kind === "paused" && (
        <div data-testid="sync-banner" style={{ maxWidth: "780px", margin: "-12px auto 16px", padding: "10px 14px", borderRadius: "10px", backgroundColor: "#FEF2F2", color: "#991B1B", fontSize: "13px", lineHeight: 1.5 }}>
          {sync.status.message}
        </div>
      )}
      {sync.status.kind === "auth" && (
        <div data-testid="key-banner" style={{ maxWidth: "780px", margin: "-12px auto 16px", padding: "10px 14px", borderRadius: "10px", backgroundColor: "#FEF2F2", color: "#991B1B", fontSize: "13px", lineHeight: 1.5, display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ flex: 1 }}>{sync.status.message}</span>
          <button data-testid="open-sync" onClick={() => setSyncOpen(true)} style={{ ...smallBtnStyle, color: "#991B1B", borderColor: "#FECACA" }}>Open Sync settings</button>
        </div>
      )}
      {(sync.status.kind === "offline" || sync.status.kind === "error") && (
        <div data-testid="sync-error-note" style={{ maxWidth: "780px", margin: "-12px auto 16px", fontSize: "12px", color: sync.status.kind === "offline" ? "#B45309" : "#B91C1C", textAlign: "right" }}>
          {sync.status.message}
        </div>
      )}
      {keyReminder.show && sync.status.kind !== "auth" && (
        <div data-testid="expiry-banner" style={{ maxWidth: "780px", margin: "-12px auto 16px", padding: "10px 14px", borderRadius: "10px", backgroundColor: "#FFFBEB", color: "#92400E", fontSize: "13px", lineHeight: 1.5, display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ flex: 1 }}>
            {keyReminder.days < 0 ? `Your GitHub key expired on ${formatDate(sync.tokenExpires)}.`
              : keyReminder.days === 0 ? "Your GitHub key expires today."
              : `Your GitHub key expires in ${keyReminder.days} day${keyReminder.days === 1 ? "" : "s"} (${formatDate(sync.tokenExpires)}).`}
            {" "}Make a new one on GitHub and paste it in Sync settings.
          </span>
          <button onClick={() => setSyncOpen(true)} style={{ ...smallBtnStyle, color: "#92400E", borderColor: "#FDE68A" }}>Sync settings</button>
          <button data-testid="expiry-dismiss" onClick={keyReminder.dismiss} style={{ ...smallBtnStyle, color: "#92400E", borderColor: "#FDE68A" }}>Not today</button>
        </div>
      )}
      {sync.status.kind === "conflict" && !sync.conflictOpen && (
        <div data-testid="sync-banner" style={{ maxWidth: "780px", margin: "-12px auto 16px", padding: "10px 14px", borderRadius: "10px", backgroundColor: "#FEF2F2", color: "#991B1B", fontSize: "13px", lineHeight: 1.5, display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ flex: 1 }}>{sync.status.message} Sync is paused until you review.</span>
          <button data-testid="review-changes" onClick={sync.openConflict} style={{ ...smallBtnStyle, color: "#991B1B", borderColor: "#FECACA" }}>Review changes</button>
        </div>
      )}
      {sync.conflict && sync.conflictOpen && (
        <ConflictScreen key={sync.conflict.legacy ? "legacy" : "merge"} conflict={sync.conflict} categories={categories}
          onResolve={sync.resolveConflict} onUseRemote={sync.takeRemoteCopy} onCancel={sync.cancelConflict} />
      )}
      {sync.status.kind === "setup" && (
        <div data-testid="sync-note" style={{ maxWidth: "780px", margin: "-12px auto 16px", fontSize: "12px", color: "#AEAEA6", textAlign: "right" }}>
          {sync.status.message}
        </div>
      )}
      <div style={{ maxWidth: activeTab === "database" ? "900px" : "780px", margin: "0 auto", transition: "max-width 0.2s" }}>
        {activeTab === "notebook" && (
          <NotebookTab todayTasks={todayTasks} setTodayTasks={setTodayTasks} backlogTasks={backlogTasks} setBacklogTasks={setBacklogTasks}
            somedayTasks={somedayTasks} setSomedayTasks={setSomedayTasks} futureTasks={futureTasks} setFutureTasks={setFutureTasks}
            ongoingTasks={ongoingTasks} setOngoingTasks={setOngoingTasks}
            recurringTemplates={recurringTemplates} setRecurringTemplates={setRecurringTemplates}
            categories={categories} setCategories={setCategories} currentDay={currentDay} setCurrentDay={setCurrentDay}
            navigateToRecurring={navigateToRecurring} fakeClock={fakeClock} setFakeClock={setFakeClock}
            multiAddMode={multiAddMode} setMultiAddMode={setMultiAddMode}
            stagedRows={stagedRows} setStagedRows={setStagedRows} />
        )}
        {activeTab === "future" && (
          <FutureTasksTab futureTasks={futureTasks} setFutureTasks={setFutureTasks}
            somedayTasks={somedayTasks} setSomedayTasks={setSomedayTasks}
            setTodayTasks={setTodayTasks} setBacklogTasks={setBacklogTasks}
            setOngoingTasks={setOngoingTasks}
            categories={categories} setCategories={setCategories} currentDay={currentDay}
            navigateToRecurring={navigateToRecurring} />
        )}
        {activeTab === "recurring" && (
          <RecurringTab recurringTemplates={recurringTemplates} setRecurringTemplates={setRecurringTemplates}
            categories={categories} setCategories={setCategories} currentDay={currentDay}
            setTodayTasks={setTodayTasks} setFutureTasks={setFutureTasks}
            todayTasks={todayTasks} futureTasks={futureTasks} backlogTasks={backlogTasks} />
        )}
        {activeTab === "database" && <DatabaseTab allTasks={allTasks} categories={categories} />}
        {activeTab === "tags" && <TagsTab categories={categories} setCategories={setCategories} />}
      </div>
      {syncOpen && <SyncSettingsPanel onClose={() => { setSyncOpen(false); setSyncConfigVersion((v) => v + 1); }} />}
    </div>
  );
}

/* ═══════════════════════════════════════════
   SHARED STYLES
   ═══════════════════════════════════════════ */

const cellStyle = { padding: "10px 10px", fontSize: "13px", color: "#1A1A1A", display: "flex", alignItems: "center" };
const pillSelectStyle = { fontSize: "12px", fontWeight: 500, padding: "5px 10px", borderRadius: "6px", border: "1px solid #EBEBEA", backgroundColor: "#FAFAF9", color: "#6B6B67", fontFamily: "inherit", cursor: "pointer", outline: "none" };
const pillBtnStyle = { fontSize: "13px", fontWeight: 600, padding: "6px 14px", borderRadius: "7px", border: "none", cursor: "pointer", fontFamily: "inherit" };
const bulkBtnStyle = { fontSize: "12px", fontWeight: 600, padding: "6px 12px", borderRadius: "6px", border: "1px solid #EBEBEA", backgroundColor: "#FAFAF9", color: "#6B6B67", cursor: "pointer", fontFamily: "inherit" };
const smallBtnStyle = { fontSize: "12px", fontWeight: 600, padding: "4px 10px", borderRadius: "6px", border: "1px solid #EBEBEA", backgroundColor: "#FFFFFF", color: "#6B6B67", cursor: "pointer", fontFamily: "inherit" };
const tinyBtnStyle = { fontSize: "11px", fontWeight: 600, padding: "2px 8px", borderRadius: "5px", border: "1px solid #EBEBEA", backgroundColor: "#FFFFFF", color: "#6B6B67", cursor: "pointer", fontFamily: "inherit" };
const colHeaderStyle = { fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#AEAEA6" };

