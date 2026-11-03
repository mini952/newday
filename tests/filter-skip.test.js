// v1.9.3: Future Notebook repeat-type filter + Skip in the task editor. Made-up data; fake GitHub.
const puppeteer = require("puppeteer-core");
const { FakeGitHub, attachFake } = require("./fake-github.js");
const APP_URL = process.env.APP_URL || "http://localhost:8765/index.html";
const SHOTS = process.env.SHOTS || "";
const results = []; const pageErrors = [];
let sec = "?";
const ok = (n, c, x = "") => { results.push([sec, !!c]); console.log((c ? "PASS " : "FAIL ") + `[${sec}] ` + n + (x && !c ? "  :: " + x : "")); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const DAY = "2026-11-03";
const T = (id, title, dueDate, extra = {}) => ({ id, title, description: "", tags: {}, dueDate, originalDueDate: dueDate, dueDateHistory: [], createdDate: "2026-11-01T14:00:00.000Z", completedDate: null, completed: false, deleted: false, status: null, statusNote: "", ongoing: false, ongoingCompletions: [], ongoingCompleted: false, ongoingCompletedDate: null, recurringParentId: null, recurringStatus: null, recurringSequence: null, updatedAt: "2026-11-01T14:00:00.000Z", reminders: [], ...extra });
const R = (id, title, dueDate, parent, seq, extra = {}) => T(id, title, dueDate, { recurringParentId: parent, recurringStatus: "pending", recurringSequence: seq, ...extra });
const TPL = (id, title, frequency, schedule = {}) => ({ id, title, description: "", tags: {}, recurrenceRule: { frequency, schedule }, startDate: "2026-10-01", status: "active", createdDate: "2026-10-01T14:00:00.000Z", deleted: false, deletedDate: null, completions: [], updatedAt: "2026-10-01T14:00:00.000Z", reminders: [] });
const CATS = [{ id: "life", name: "Life Category", values: [{ id: "work", label: "Work", bg: "#EEF2FF", text: "#4F46E5" }] }];
// Upcoming = Nov 4–10, Future = after Nov 10.
const NB = {
  version: 6, currentDay: DAY, categories: CATS,
  recurringTemplates: [TPL("tp-d", "Sample daily", "daily"), TPL("tp-w", "Sample weekly", "weekly", { days: [0], interval: 1 }), TPL("tp-b", "Sample every two weeks", "weekly", { days: [3], interval: 2 }),
    TPL("tp-m", "Sample monthly", "monthly"), TPL("tp-q", "Sample quarterly", "quarterly"), TPL("tp-y", "Sample yearly", "yearly")],
  todayTasks: [R("td1", "Daily sample today", DAY, "tp-d", 1), T("to1", "One-time sample today", DAY),
    R("td2", "Done daily sample", DAY, "tp-d", 0, { completed: true, completedDate: "2026-11-03T13:00:00.000Z", recurringStatus: "completed" }),
    R("td3", "Skipped-status daily sample", DAY, "tp-d", 0, { recurringStatus: "skipped" })],
  backlogTasks: [R("bk1", "Monthly sample overdue", "2026-11-01", "tp-m", 1), T("bk2", "One-time sample backlog", "2026-10-30")],
  somedayTasks: [T("sd1", "Someday sample one", ""), T("sd2", "Someday sample two", "")],
  futureTasks: [
    R("fd1", "Daily sample", "2026-11-04", "tp-d", 2), R("fd2", "Daily sample", "2026-11-05", "tp-d", 3), R("fd3", "Daily sample", "2026-11-12", "tp-d", 4),
    R("fw1", "Weekly sample", "2026-11-08", "tp-w", 1), R("fw2", "Weekly sample", "2026-11-15", "tp-w", 2),
    R("fb1", "Biweekly sample", "2026-11-04", "tp-b", 1), R("fb2", "Biweekly sample", "2026-11-18", "tp-b", 2),
    R("fm1", "Monthly sample", "2026-12-01", "tp-m", 2), R("fq1", "Quarterly sample", "2027-01-01", "tp-q", 1), R("fy1", "Yearly sample", "2027-03-15", "tp-y", 1),
    T("fo1", "One-time sample soon", "2026-11-06"), T("fo2", "One-time sample later", "2026-12-20"),
  ],
  ongoingTasks: [],
};
const CFG = { owner: "mini952", repo: "newday-data", path: "notebook.json", token: "fake-key-v193", tokenExpires: "" };
const NOW = process.env.NOW || "2026-11-03T17:00:00Z"; // noon Eastern

async function open(browser, width = 1280) {
  const fake = new FakeGitHub(); fake.set("notebook.json", JSON.stringify(NB, null, 2));
  const ctx = await browser.createBrowserContext();
  const p = await ctx.newPage();
  await p.setViewport({ width, height: 900 });
  p.on("pageerror", (e) => pageErrors.push(String(e).slice(0, 200)));
  p.on("dialog", (d) => d.accept());
  await p.evaluateOnNewDocument((iso) => { const off = new Date(iso).getTime() - Date.now(); const R = Date; class D extends R { constructor(...a) { if (a.length) super(...a); else super(R.now() + off); } static now() { return R.now() + off; } } window.Date = D; }, NOW);
  await attachFake(p, () => fake);
  await p.goto(APP_URL, { waitUntil: "domcontentloaded" });
  await p.waitForSelector('[data-testid="sync-indicator"]', { timeout: 90000 });
  await p.evaluate((nb, cfg) => { localStorage.setItem("newday-notebook", JSON.stringify(nb)); localStorage.setItem("newday-sync-config", JSON.stringify(cfg)); }, NB, CFG);
  await p.reload({ waitUntil: "domcontentloaded" });
  await p.waitForSelector('[data-testid="sync-indicator"]', { timeout: 90000 });
  await p.waitForFunction(() => document.querySelector('[data-testid="sync-indicator"]').dataset.kind === "synced", { timeout: 20000 }).catch(() => {});
  await p.evaluate(() => document.fonts.ready); await sleep(400);
  return { p, ctx, fake };
}
const go = async (p, id) => { await p.click(`[data-testid="tab-${id}"]`); await sleep(300); };
const pill = (p, k) => p.click(`[data-testid="repeat-${k}"]`).then(() => sleep(150));
// Titles in a Future section (by its header text), plus header counts and pill states.
const view = (p) => p.evaluate(() => {
  const h2s = [...document.querySelectorAll("h2")];
  const listAfter = (txt) => { const h = h2s.find((e) => e.textContent.startsWith(txt)); let row = h.parentElement; while (row && !row.nextElementSibling) row = row.parentElement; if (!row.nextElementSibling.querySelector) return []; let box = row.nextElementSibling; return [...box.querySelectorAll("[draggable]")].map((d) => d.innerText.split("\n")[0].trim()); };
  const titlesIn = (txt) => { const h = h2s.find((e) => e.textContent.startsWith(txt)); let hdr = h.closest('div[style*="padding: 0px 16px"]'); const box = hdr.nextElementSibling; return [...box.querySelectorAll("div")].filter((d) => d.style.padding === "14px 16px" || d.style.paddingLeft === "13px").map((d) => d.innerText); };
  const pills = Object.fromEntries([...document.querySelectorAll('[data-testid="repeat-filter"] button')].map((b) => [b.dataset.testid.replace("repeat-", ""), b.getAttribute("aria-pressed") === "true"]));
  const sub = [...document.querySelectorAll("p")].find((e) => /tasks? planned/.test(e.textContent));
  return { up: titlesIn("Upcoming"), fut: titlesIn("Future —"), some: titlesIn("Someday"), upCount: +document.querySelector('[data-testid="upcoming-count"]').textContent, futCount: +document.querySelector('[data-testid="future-count"]').textContent, pills, total: sub && sub.textContent };
});
const has = (list, s) => list.some((t) => t.includes(s));
const count = (list, s) => list.filter((t) => t.includes(s)).length;
async function shot(p, name) { if (!SHOTS) return; await p.screenshot({ path: `${SHOTS}/v193-${name}.png`, fullPage: true }); }
const stored = (p) => p.evaluate(() => JSON.parse(localStorage.getItem("newday-notebook")));
async function dbl(p, title) {
  const h = await p.evaluateHandle((t) => [...document.querySelectorAll("span, div")].find((e) => e.children.length === 0 && e.textContent.trim() === t), title);
  const el = h.asElement(); if (!el) return false;
  await el.click({ clickCount: 2 }); await sleep(250); return true;
}
const editorOpen = (p) => p.evaluate(() => [...document.querySelectorAll("button")].some((b) => b.textContent === "Delete" && b.offsetParent));
const editorSkip = (p) => p.$('[data-testid="editor-skip"]');
const closeEditor = async (p) => { const c = await p.evaluateHandle(() => [...document.querySelectorAll("button")].find((b) => b.textContent === "Cancel" && b.offsetParent)); if (c.asElement()) await c.asElement().click(); await sleep(200); };

(async () => {
  const browser = await puppeteer.launch({ executablePath: process.env.CHROME || "/usr/bin/google-chrome", headless: "new", args: ["--no-sandbox"] });
  try {
    // ── Filter ──
    sec = "filter";
    let { p, ctx } = await open(browser);
    await go(p, "future");
    let v = await view(p);
    const total0 = v.total;
    ok("default: all pills on", Object.keys(v.pills).length === 6 && Object.values(v.pills).every(Boolean), JSON.stringify(v.pills));
    ok("default: Upcoming 5 (2 daily, weekly, every-2-weeks, one-time)", v.upCount === 5 && v.up.length === 5, JSON.stringify(v));
    ok("default: Future 7", v.futCount === 7 && v.fut.length === 7, JSON.stringify(v));
    ok("total reads 14 tasks planned", /^14 tasks planned/.test(total0), total0);
    await shot(p, "future-all-on");
    await pill(p, "daily"); v = await view(p);
    ok("Daily off: no dailies in Upcoming or Future", !has(v.up, "Daily sample") && !has(v.fut, "Daily sample"), JSON.stringify(v));
    ok("Daily off: counts 3 / 6", v.upCount === 3 && v.futCount === 6, JSON.stringify([v.upCount, v.futCount]));
    ok("Daily off: Daily and All pills off, others on", v.pills.daily === false && v.pills.all === false && v.pills.weekly && v.pills.yearly, JSON.stringify(v.pills));
    ok("Daily off: total unchanged", v.total === total0, v.total);
    ok("Daily off: one-time tasks still shown", has(v.up, "One-time sample soon") && has(v.fut, "One-time sample later"));
    await shot(p, "future-daily-off");
    await pill(p, "weekly"); v = await view(p);
    ok("Weekly off hides weekly AND every-2-weeks instances", !has(v.up, "Weekly sample") && !has(v.up, "Biweekly sample") && !has(v.fut, "Weekly sample") && !has(v.fut, "Biweekly sample"), JSON.stringify(v));
    for (const [k, name] of [["monthly", "Monthly sample"], ["quarterly", "Quarterly sample"], ["yearly", "Yearly sample"]]) {
      ok(`${k} on before toggle: shown`, has(v.fut, name));
      await pill(p, k); v = await view(p);
      ok(`${k} off: hidden from Future`, !has(v.fut, name), JSON.stringify(v.fut));
    }
    ok("everything off: only one-time tasks left", v.up.length === 1 && v.fut.length === 1 && v.upCount === 1 && v.futCount === 1, JSON.stringify(v));
    ok("everything off: Someday unchanged (2)", v.some.length === 2, JSON.stringify(v.some));
    ok("everything off: total unchanged", v.total === total0);
    await pill(p, "daily"); v = await view(p);
    ok("Daily back on: dailies return in both lists", count(v.up, "Daily sample") === 2 && count(v.fut, "Daily sample") === 1, JSON.stringify(v));
    await pill(p, "all"); v = await view(p);
    ok("All: every type back on", Object.values(v.pills).every(Boolean) && v.upCount === 5 && v.futCount === 7, JSON.stringify(v));
    // Pills sit on the header line and do not move when the count changes width
    const pos = async () => p.evaluate(() => { const f = document.querySelector('[data-testid="repeat-filter"]').getBoundingClientRect(), h = [...document.querySelectorAll("h2")].find((e) => e.textContent.startsWith("Upcoming")).getBoundingClientRect(); return { left: f.left, sameLine: Math.abs((f.top + f.bottom) / 2 - (h.top + h.bottom) / 2) < 4, over: document.documentElement.scrollWidth - window.innerWidth }; });
    const a = await pos();
    ok("1280: pills beside the header on one line", a.sameLine, JSON.stringify(a));
    await pill(p, "daily"); await pill(p, "weekly"); const b = await pos();
    ok("pills keep their place when the count changes", Math.abs(a.left - b.left) < 0.5, JSON.stringify([a, b]));
    // Hidden state resets on reload
    await p.reload({ waitUntil: "domcontentloaded" }); await p.waitForSelector('[data-testid="sync-indicator"]'); await sleep(800);
    await go(p, "future"); v = await view(p);
    ok("reload: filter back to All", Object.values(v.pills).every(Boolean) && v.upCount === 5 && v.futCount === 7, JSON.stringify(v));
    const saved = await stored(p);
    ok("filter not saved in the notebook data", !JSON.stringify(saved).includes("hiddenRepeat"));
    await ctx.close();
    // Narrow windows: pills wrap, nothing overflows
    for (const w of [800, 520]) {
      ({ p, ctx } = await open(browser, w)); await go(p, "future");
      const n = await p.evaluate(() => { const f = document.querySelector('[data-testid="repeat-filter"]'); const pg = document.querySelector('[data-testid="page"]').getBoundingClientRect(); const r = { right: Math.max(...[...f.children].map((c) => c.getBoundingClientRect().right)) }; return { over: document.documentElement.scrollWidth - window.innerWidth, inside: r.right <= pg.right + 0.5, btnOver: [...f.querySelectorAll("button")].map((b) => b.scrollWidth - b.clientWidth) }; });
      // At 520px the v1.9.2 tab row itself is wider than the window (known, separate), so only the page-level overflow check runs at 800px.
      ok(`${w}px: pills wrap inside the page${w >= 800 ? ", no overflow" : ""}`, (w < 800 || n.over <= 0) && n.inside && n.btnOver.every((o) => o <= 0), JSON.stringify(n));
      if (w === 520) await shot(p, "future-narrow");
      await ctx.close();
    }

    // ── Skip in editor ──
    sec = "skip";
    ({ p, ctx } = await open(browser));
    ok("Today: open editor on one-time task", await dbl(p, "One-time sample today") && await editorOpen(p));
    ok("Today: no Skip for a one-time task", !(await editorSkip(p))); await closeEditor(p);
    ok("Today: open editor on completed recurring", await dbl(p, "Done daily sample") && await editorOpen(p));
    ok("Today: no Skip for a completed instance", !(await editorSkip(p))); await closeEditor(p);
    if (await dbl(p, "Skipped-status daily sample")) { ok("Today: no Skip for an already-skipped instance", await editorOpen(p) && !(await editorSkip(p))); await closeEditor(p); }
    else ok("Today: skipped instance not shown, so no Skip", true);
    ok("Backlog: no Skip for a one-time task", await dbl(p, "One-time sample backlog") && await editorOpen(p) && !(await editorSkip(p))); await closeEditor(p);
    ok("Today: pending recurring shows Skip", await dbl(p, "Daily sample today") && !!(await editorSkip(p)));
    const order = await p.evaluate(() => { const s = document.querySelector('[data-testid="editor-skip"]'); const btns = [...s.parentElement.querySelectorAll("button")].map((b) => b.textContent); return btns; });
    ok("Today: Skip sits right after Delete", order[0] === "Delete" && order[1] === "Skip", JSON.stringify(order));
    if (SHOTS) { await p.evaluate(() => window.scrollTo(0, 0)); await p.screenshot({ path: `${SHOTS}/v193-today-editor-skip.png` }); }
    await (await editorSkip(p)).click(); await sleep(600);
    let nb = await stored(p);
    ok("Today: Skip removes the instance from Today and closes the editor", !nb.todayTasks.some((t) => t.id === "td1") && !(await editorOpen(p)));
    ok("Today: skip logged on the template", nb.recurringTemplates.find((t) => t.id === "tp-d").completions.some((c) => c.instanceId === "td1" && c.status === "skipped"));
    ok("Today: other tasks untouched", nb.todayTasks.some((t) => t.id === "to1") && nb.backlogTasks.some((t) => t.id === "bk1"));
    ok("Backlog: pending recurring shows Skip", await dbl(p, "Monthly sample overdue") && !!(await editorSkip(p)));
    if (SHOTS) { const y = await p.evaluate(() => { const s = document.querySelector('[data-testid="editor-skip"]'); s.scrollIntoView({ block: "center" }); return 0; }); await sleep(200); await p.screenshot({ path: `${SHOTS}/v193-backlog-editor-skip.png` }); }
    await (await editorSkip(p)).click(); await sleep(600);
    nb = await stored(p);
    ok("Backlog: Skip removes the instance and closes the editor", !nb.backlogTasks.some((t) => t.id === "bk1") && !(await editorOpen(p)));
    ok("Backlog: skip logged on the template", nb.recurringTemplates.find((t) => t.id === "tp-m").completions.some((c) => c.instanceId === "bk1" && c.status === "skipped"));
    await go(p, "future");
    ok("Future editor has no Skip (Future has no hover Skip either)", await dbl(p, "One-time sample soon") && await editorOpen(p) && !(await editorSkip(p)));
    await ctx.close();
    sec = "all";
    ok("no page errors", pageErrors.length === 0, pageErrors.join(" | "));
  } catch (e) { console.log("ERROR", e && e.stack ? e.stack.slice(0, 600) : e); results.push(["all", false]); }
  await browser.close();
  const by = {}; for (const [s, c] of results) { by[s] = by[s] || [0, 0]; by[s][1]++; if (c) by[s][0]++; }
  const pass = results.filter((r) => r[1]).length;
  console.log("Per section:", JSON.stringify(by)); console.log(`${pass}/${results.length} passed`);
  process.exit(pass === results.length ? 0 : 1);
})();
