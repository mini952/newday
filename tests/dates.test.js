// Date quirk check at 8 PM ET (01:00 UTC next day). Made-up data only.
const puppeteer = require("puppeteer-core");
const APP_URL = process.env.APP_URL || "http://localhost:8765/index.html";
const FIXED = Date.parse(process.env.NOW || "2026-11-03T01:00:00Z"); // 8:00 PM ET Mon Nov 2
const results = []; const pageErrors = [];
const ok = (n, c, x = "") => { results.push(!!c); console.log((c ? "PASS " : "FAIL ") + n + (x ? "  :: " + x : "")); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const T = (id, title, extra = {}) => ({ id, title, description: "", tags: {}, dueDate: "2026-11-02", originalDueDate: "2026-11-02", dueDateHistory: [], createdDate: "2026-11-01T14:00:00.000Z", completedDate: null, completed: false, deleted: false, status: null, statusNote: "", ongoing: false, ongoingCompletions: [], ongoingCompleted: false, ongoingCompletedDate: null, recurringParentId: null, recurringStatus: null, recurringSequence: null, updatedAt: "2026-11-01T14:00:00.000Z", reminders: [], ...extra });
const NB = {
  version: 6, currentDay: "2026-11-02",
  categories: [{ id: "life", name: "Life Category", values: [{ id: "work", label: "Work", bg: "#EEF2FF", text: "#4F46E5" }] }],
  todayTasks: [T("q1", "Sample open task"), T("q2", "Sample overdue task", { dueDate: "2026-11-01", originalDueDate: "2026-11-01" }), T("q3", "Sample done this evening", { completed: true, completedDate: "2026-11-03T00:45:00.000Z" })],
  backlogTasks: [T("q4", "Sample created this evening", { dueDate: "2026-10-30", originalDueDate: "2026-10-30", createdDate: "2026-11-03T00:30:00.000Z" })],
  somedayTasks: [], futureTasks: [T("q5", "Sample due tomorrow", { dueDate: "2026-11-03", originalDueDate: "2026-11-03" })],
  ongoingTasks: [], recurringTemplates: [{ id: "rt1", title: "Sample daily habit", description: "", tags: {}, recurrenceRule: { frequency: "daily", schedule: {} }, startDate: "2026-10-01", status: "active", deleted: false, deletedDate: null, completions: [], createdDate: "2026-10-01T12:00:00.000Z", updatedAt: "2026-10-01T12:00:00.000Z", reminders: [] }],
};
(async () => {
  const b = await puppeteer.launch({ executablePath: process.env.CHROME || "/usr/bin/google-chrome", headless: "new", args: ["--no-sandbox"] });
  const ctx = await b.createBrowserContext();
  const p = await ctx.newPage();
  await p.emulateTimezone("America/New_York");
  p.on("pageerror", (e) => pageErrors.push(String(e).slice(0, 200)));
  await p.evaluateOnNewDocument((fixed) => {
    const R = Date, start = R.now();
    class FakeDate extends R { constructor(...a) { if (a.length === 0) super(fixed + (R.now() - start)); else super(...a); } static now() { return fixed + (R.now() - start); } }
    window.Date = FakeDate;
    window.__downloads = []; const o = URL.createObjectURL;
    URL.createObjectURL = function (x) { return o.call(URL, x); };
    HTMLAnchorElement.prototype.click = function () { window.__downloads.push(this.download); };
  }, FIXED);
  await p.goto(APP_URL, { waitUntil: "domcontentloaded" });
  await p.waitForSelector('[data-testid="sync-indicator"]', { timeout: 90000 });
  await p.evaluate((nb) => localStorage.setItem("newday-notebook", JSON.stringify(nb)), NB);
  await p.reload({ waitUntil: "domcontentloaded" }); await p.waitForSelector('[data-testid="sync-indicator"]', { timeout: 90000 }); await sleep(800);
  const body = () => p.evaluate(() => document.body.innerText);
  console.log("App", APP_URL, "| browser clock:", await p.evaluate(() => new Date().toString().slice(0, 24)), "| UTC:", await p.evaluate(() => new Date().toISOString()));
  const txt = await body();
  if (process.env.EXPECT_STALE) { ok("after midnight ET the notebook day is stale ('1 day ago')", txt.includes("1 day ago")); await b.close(); return; }
  ok("1. 'Today' at 8 PM: header not marked stale ('1 day ago' / 'Press to start today')", !txt.includes("1 day ago") && !txt.includes("Press to start today"));
  ok("2. Backlog groups a task created 7:30 PM ET Nov 2 under Nov 2", txt.includes("Nov 2, 2026") && !/Created\s+Nov 3/i.test(txt), (txt.match(/Created[^\n]*/g) || []).join(" | "));
  ok("3. Overdue badge for due Nov 1 (vs notebook day)", /1d|1 day/i.test(txt));
  // completed task edit field
  const span = await p.waitForSelector('::-p-xpath(//span[text()="Sample done this evening"])');
  await span.evaluate((e) => e.dispatchEvent(new MouseEvent("dblclick", { bubbles: true })));
  await sleep(400);
  const dates = await p.$$eval('input[type="date"]', (els) => els.map((e) => e.value));
  ok("4. Edit form shows completed date Nov 2 (done 7:45 PM ET)", dates.includes("2026-11-02") && !dates.includes("2026-11-03"), JSON.stringify(dates));
  await p.evaluate(() => [...document.querySelectorAll("button")].find((x) => x.textContent.trim() === "Save").click());
  await sleep(500);
  const q3 = await p.evaluate(() => JSON.parse(localStorage.getItem("newday-notebook")).todayTasks.find((t) => t.id === "q3"));
  ok("5. Saving that edit keeps the completed date on Nov 2 (ET)", new Date(q3.completedDate).toLocaleDateString("en-CA", { timeZone: "America/New_York" }) === "2026-11-02", q3.completedDate);
  // new task default date
  const ti = await p.$('input[placeholder="New task title..."]');
  await ti.type("Sample added at 8pm"); await p.keyboard.press("Enter"); await sleep(500);
  const nb1 = await p.evaluate(() => JSON.parse(localStorage.getItem("newday-notebook")));
  const added = [...nb1.todayTasks, ...nb1.futureTasks].find((t) => t.title === "Sample added at 8pm");
  ok("6. New task typed at 8 PM lands in Today, due Nov 2", nb1.todayTasks.some((t) => t.title === "Sample added at 8pm") && added.dueDate === "2026-11-02", added && `dueDate ${added.dueDate}, in ${nb1.todayTasks.includes(added) ? "Today" : "Future"}`);
  // export filename
  await p.evaluate(() => { const b = [...document.querySelectorAll("button")].find((x) => x.textContent.includes("Export")); if (b) b.click(); else { document.querySelector('[data-testid="menu-button"]').click(); } });
  await sleep(200);
  await p.evaluate(() => { const b = [...document.querySelectorAll("button")].find((x) => x.textContent.includes("Export")); b && b.click(); });
  const dl = await p.evaluate(() => window.__downloads.slice(-1)[0]);
  ok("7. Export file is named for Nov 2", dl === "newday-notebook-backup-2026-11-02.json", dl);
  // New Day at 8 PM (same day): should not jump to Nov 3 or pull tomorrow's Future task
  await p.evaluate(() => [...document.querySelectorAll("button")].find((x) => x.textContent.trim() === "☀ New Day").click());
  await sleep(500);
  console.log("buttons:", await p.evaluate(() => [...document.querySelectorAll("button")].map((b) => b.textContent.trim()).filter((t) => /day/i.test(t)).join(" | ")));
  const sd = await p.evaluate(() => !![...document.querySelectorAll("button")].find((x) => x.textContent.trim() === "Start New Day"));
  if (sd) { await p.evaluate(() => [...document.querySelectorAll("button")].find((x) => x.textContent.trim() === "Start New Day").click()); await sleep(800); }
  console.log("modal shown:", !!sd);
  const nb2 = await p.evaluate(() => JSON.parse(localStorage.getItem("newday-notebook")));
  console.log("today ids", nb2.todayTasks.map((t) => t.id + ":" + t.dueDate).join(" "), "future", nb2.futureTasks.map((t) => t.id + ":" + t.dueDate).join(" "));
  ok("8. New Day at 8 PM keeps notebook day Nov 2", nb2.currentDay === "2026-11-02", nb2.currentDay);
  ok("9. Tomorrow's Future task is not pulled into Today early", nb2.futureTasks.some((t) => t.id === "q5") && !nb2.todayTasks.some((t) => t.id === "q5"));
  const inst = nb2.todayTasks.concat(nb2.futureTasks).filter((t) => t.recurringParentId === "rt1").map((t) => t.dueDate).sort();
  ok("10. Daily recurring instances start at Nov 2", inst[0] === "2026-11-02", inst.slice(0, 2).join(","));
  ok("no page errors", pageErrors.length === 0, pageErrors.join(" | "));
  await b.close();
  console.log(`${results.filter(Boolean).length}/${results.length} passed`);
})();
