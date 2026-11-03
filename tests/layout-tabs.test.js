// v1.9.2: page layouts, tab names, folder-tab outline. Made-up data; fake GitHub.
// Optional: SAMPLE=<notebook json> to render a fuller sample, SHOTS=<folder> for screenshots.
const puppeteer = require("puppeteer-core");
const fs = require("fs");
const { FakeGitHub, attachFake } = require("./fake-github.js");
const APP_URL = process.env.APP_URL || "http://localhost:8765/index.html";
const SHOTS = process.env.SHOTS || "";
const results = []; const pageErrors = [];
let sec = "?";
const ok = (n, c, x = "") => { results.push([sec, !!c]); console.log((c ? "PASS " : "FAIL ") + `[${sec}] ` + n + (x && !c ? "  :: " + x : "")); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const T = (id, title, extra = {}) => ({ id, title, description: "", tags: {}, dueDate: "2026-11-02", originalDueDate: "2026-11-02", dueDateHistory: [], createdDate: "2026-11-01T14:00:00.000Z", completedDate: null, completed: false, deleted: false, status: null, statusNote: "", ongoing: false, ongoingCompletions: [], ongoingCompleted: false, ongoingCompletedDate: null, recurringParentId: null, recurringStatus: null, recurringSequence: null, updatedAt: "2026-11-01T14:00:00.000Z", reminders: [], ...extra });
const CATS = [{ id: "life", name: "Life Category", values: [{ id: "work", label: "Work", bg: "#EEF2FF", text: "#4F46E5" }] }];
const MADE_UP = { version: 6, currentDay: "2026-11-02", categories: CATS, todayTasks: [T("a", "Sample task one"), T("b", "Sample task two")], backlogTasks: [T("c", "Finished sample", { completed: true, completedDate: "2026-11-01T15:00:00.000Z" })], somedayTasks: [], futureTasks: [T("d", "Later sample", { dueDate: "2026-11-05", originalDueDate: "2026-11-05" })], ongoingTasks: [], recurringTemplates: [] };
const NB = process.env.SAMPLE ? JSON.parse(fs.readFileSync(process.env.SAMPLE, "utf8")) : MADE_UP;
const CFG = { owner: "mini952", repo: "newday-data", path: "notebook.json", token: "fake-key-v192", tokenExpires: "" };
const NOW = process.env.NOW || "2026-11-02T17:00:00Z"; // noon Eastern, matches the sample's currentDay
const TABS = [
  ["notebook", "Daily Notebook", "notebook"], ["future", "Future Notebook", "notebook"], ["recurring", "Recurring Notebook", "notebook"],
  ["database", "Task Database", "database"], ["tags", "Tag Database", "database"],
];
const WIDTH = { notebook: 720, database: 940 }; // 680 / 900 of content + 20px padding each side

async function open(browser, width, fake) {
  const ctx = await browser.createBrowserContext();
  const p = await ctx.newPage();
  await p.setViewport({ width, height: 820 });
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
  return { p, ctx };
}
async function go(p, id) { await p.click(`[data-testid="tab-${id}"]`); await sleep(350); }
const geo = (p) => p.evaluate(() => {
  const row = document.querySelector('[data-testid="tab-row"]'), page = document.querySelector('[data-testid="page"]');
  const svg = document.querySelector('[data-testid="tab-outline"]'), act = document.querySelector('button[data-active="true"]');
  const R = row.getBoundingClientRect(), P = page.getBoundingClientRect(), S = svg ? svg.getBoundingClientRect() : null, A = act.getBoundingClientRect();
  const inner = row.querySelector('div[style*="flex"]');
  return { rowL: R.left, rowR: R.right, rowB: R.bottom, pageL: P.left, pageR: P.right, pageT: P.top, svgW: S && S.width, svgL: S && S.left, flush: svg && svg.dataset.flush, actL: A.left, actB: A.bottom,
    rowOverflow: inner.scrollWidth - inner.clientWidth, docOverflow: document.documentElement.scrollWidth - window.innerWidth,
    actTransition: getComputedStyle(act).transitionProperty, labels: [...row.querySelectorAll('button[data-testid^="tab-"]')].map((b) => b.innerText.replace(/\s+/g, " ").replace(/^\S+\s/, "").trim()),
    lineCounts: [...row.querySelectorAll('button[data-testid^="tab-"]')].map((b) => b.querySelectorAll("span > span").length) };
});
async function shot(p, name) { if (!SHOTS) return; await p.evaluate(() => window.scrollTo(0, 0)); await sleep(250); await p.screenshot({ path: `${SHOTS}/v192-${name}.png` }); }

(async () => {
  const browser = await puppeteer.launch({ executablePath: process.env.CHROME || "/usr/bin/google-chrome", headless: "new", args: ["--no-sandbox"] });
  try {
    const fake = new FakeGitHub(); fake.set("notebook.json", JSON.stringify(NB, null, 2)); fake.set("notebook-test.json", JSON.stringify(MADE_UP, null, 2));
    for (const width of [1280, 1024, 800]) {
      sec = `layout@${width}`;
      const { p, ctx } = await open(browser, width, fake);
      for (const [id, label, type] of TABS) {
        await go(p, id);
        const g = await geo(p);
        const want = Math.min(WIDTH[type], width - 40);
        ok(`${label}: page ${Math.round(g.pageR - g.pageL)}px (want ${want})`, Math.abs(g.pageR - g.pageL - want) < 1, JSON.stringify(g));
        ok(`${label}: tab row edges match the page`, Math.abs(g.rowL - g.pageL) < 0.5 && Math.abs(g.rowR - g.pageR) < 0.5 && Math.abs(g.rowB - g.pageT) < 0.5, JSON.stringify(g));
        ok(`${label}: outline spans the row, active tab sits on the page edge`, g.svgW && Math.abs(g.svgW - (g.rowR - g.rowL)) < 1 && Math.abs(g.svgL - g.rowL) < 0.5 && Math.abs(g.actB - g.rowB) < 0.5, JSON.stringify(g));
        ok(`${label}: left edge ${id === "notebook" ? "runs straight (flush)" : "has a flare"}`, g.flush === (id === "notebook" ? "true" : "false") && (id !== "notebook" || Math.abs(g.actL - g.pageL) < 0.5), JSON.stringify(g));
        ok(`${label}: nothing overflows`, g.rowOverflow <= 0 && g.docOverflow <= 0, JSON.stringify(g));
        if (id === "database") { const hd = await p.evaluate(() => [...[...document.querySelectorAll("div")].find((d) => d.textContent.trim() === "Title" && d.style.width).parentElement.children].filter((d) => /^(Completed|Deleted)$/.test(d.textContent.trim())).map((d) => d.scrollWidth - d.clientWidth));
          ok("Task Database: COMPLETED and DELETED fit (table scrolls sideways if the window is narrow)", hd.length === 2 && hd.every((o) => o <= 0), JSON.stringify(hd)); }
        if (width === 1280) ok(`${label}: active tab has no background/border fade`, !/background|border|all/.test(g.actTransition), g.actTransition);
        if (width === 1280 && id === "notebook") {
          ok("tab names are the five two-word names", JSON.stringify(g.labels) === JSON.stringify(TABS.map((t) => t[1])), JSON.stringify(g.labels));
          ok("each tab name is on two lines", g.lineCounts.every((n) => n === 2), JSON.stringify(g.lineCounts));
        }
        if (width === 1280) await shot(p, id === "notebook" ? "daily" : id === "future" ? "future-active" : id === "recurring" ? "recurring-notebook" : id === "database" ? "task-database" : "tag-database");
      }
      if (width === 1280) {
        await go(p, "recurring");
        ok('Recurring page heading reads "Recurring Notebook"', (await p.$eval("h1", (e) => e.textContent)) === "Recurring Notebook");
        const text = await p.evaluate(() => document.body.innerText);
        ok('no "Tag Manager" or "Recurring Tasks" left on screen', !/Tag Manager|Recurring Tasks/.test(text));
        await go(p, "database");
        const hdr = await p.evaluate(() => [...[...document.querySelectorAll("div")].find((d) => d.textContent.trim() === "Title" && d.style.width).parentElement.children].filter((d) => /^(Completed|Deleted|Title|Project)$/.test(d.textContent.trim())).map((d) => ({ t: d.textContent.trim(), w: d.style.width, over: d.scrollWidth - d.clientWidth })));
        ok("Task Database widths: Title 19%, Project 7%, Completed 10%, Deleted 9%", ["Title:19%", "Project:7%", "Completed:10%", "Deleted:9%"].every((k) => hdr.some((h) => `${h.t}:${h.w}` === k)), JSON.stringify(hdr));
        ok("COMPLETED and DELETED headers fit their columns", hdr.filter((h) => /Completed|Deleted/.test(h.t)).every((h) => h.over <= 0), JSON.stringify(hdr));
        ok("page title shows v1.9.3", (await p.title()).includes("v1.9.3"), await p.title());
        // resize while open: outline follows
        await go(p, "future"); await p.setViewport({ width: 900, height: 820 }); await sleep(400);
        let g = await geo(p);
        ok("after resizing the window, the outline still matches the row", Math.abs(g.svgW - (g.rowR - g.rowL)) < 1 && Math.abs(g.rowL - g.pageL) < 0.5, JSON.stringify(g));
        await p.setViewport({ width: 1280, height: 820 }); await sleep(400);
        // scrolled: the sticky row keeps its outline
        await p.evaluate(() => window.scrollTo(0, 400)); await sleep(300);
        g = await geo(p);
        ok("scrolled: tab row stays at the top with its outline", g.svgW > 0 && Math.abs(g.rowB - g.actB) < 0.5);
        await p.evaluate(() => window.scrollTo(0, 0));
        // ☰ menu
        await go(p, "notebook");
        await p.click('[data-testid="menu-button"]'); await p.waitForSelector('[data-testid="app-menu"]', { timeout: 3000 });
        ok("☰ menu opens over the page", !!(await p.$('[data-testid="app-menu"]')));
        await shot(p, "menu-open");
        await p.keyboard.press("Escape"); await sleep(200);
        // test mode + orange bar
        await p.click('[data-testid="menu-button"]'); await p.waitForSelector('[data-testid="app-menu"]');
        const tm = await p.$('[data-testid="menu-testmode"]');
        if (tm) { await tm.click(); await p.waitForSelector('[data-testid="testmode-bar"]', { timeout: 20000 }); await p.waitForSelector('[data-testid="tab-row"]'); await sleep(800); await p.evaluate(() => document.fonts.ready);
          const t = await p.evaluate(() => { const b = document.querySelector('[data-testid="testmode-bar"]').getBoundingClientRect(), r = document.querySelector('[data-testid="tab-row"]').getBoundingClientRect(); return { barTop: b.top, barH: b.height, barW: b.width, rowTop: r.top }; });
          ok("test mode: orange bar full width on top, tab row just below it", t.barTop === 0 && t.barH === 36 && Math.round(t.barW) === 1280 && t.rowTop >= 36, JSON.stringify(t));
          g = await geo(p); ok("test mode: page and tab row still line up", Math.abs(g.rowL - g.pageL) < 0.5 && Math.abs(g.rowB - g.pageT) < 0.5, JSON.stringify(g));
          await shot(p, "test-mode");
          await p.click('[data-testid="testmode-exit"]'); await sleep(1500);
        } else ok("test mode menu item found", false);
      }
      await ctx.close();
    }
    sec = "all";
    ok("no page errors", pageErrors.length === 0, pageErrors.join(" | "));
  } catch (e) { console.log("ERROR", e && e.stack ? e.stack.slice(0, 600) : e); results.push(["all", false]); }
  await browser.close();
  const by = {}; for (const [s, c] of results) { by[s] = by[s] || [0, 0]; by[s][1]++; if (c) by[s][0]++; }
  const pass = results.filter((r) => r[1]).length;
  console.log("Per section:", JSON.stringify(by)); console.log(`${pass}/${results.length} passed`);
  process.exit(pass === results.length ? 0 : 1);
})();
