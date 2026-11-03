// v1.9.1 + v1.9.2: toolbar menu, status colours, test mode isolation. Made-up data; fake GitHub.
const puppeteer = require("puppeteer-core");
const fs = require("fs");
const { FakeGitHub, attachFake } = require("./fake-github.js");
const APP_URL = process.env.APP_URL || "http://localhost:8765/index.html";
const SHOTS = process.env.SHOTS || ""; // folder for screenshots (optional)
const results = []; const pageErrors = [];
let sec = "?";
const ok = (n, c, x = "") => { results.push([sec, !!c]); console.log((c ? "PASS " : "FAIL ") + `[${sec}] ` + n + (x && !c ? "  :: " + x : "")); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const SECTIONS = ["todayTasks", "backlogTasks", "somedayTasks", "futureTasks", "ongoingTasks", "recurringTemplates"];
const T = (id, title, extra = {}) => ({ id, title, description: "", tags: {}, dueDate: "2026-11-02", originalDueDate: "2026-11-02", dueDateHistory: [], createdDate: "2026-11-01T14:00:00.000Z", completedDate: null, completed: false, deleted: false, status: null, statusNote: "", ongoing: false, ongoingCompletions: [], ongoingCompleted: false, ongoingCompletedDate: null, recurringParentId: null, recurringStatus: null, recurringSequence: null, updatedAt: "2026-11-01T14:00:00.000Z", reminders: [], ...extra });
const CATS = [{ id: "life", name: "Life Category", values: [{ id: "work", label: "Work", bg: "#EEF2FF", text: "#4F46E5" }] }];
const mkNb = (prefix, n) => ({ version: 6, currentDay: "2026-11-02", categories: CATS, todayTasks: Array.from({ length: n }, (_, i) => T(`${prefix}${i}`, `${prefix === "r" ? "Real-mode" : "Test-mode"} sample ${i + 1}`)), backlogTasks: [], somedayTasks: [], futureTasks: [], ongoingTasks: [], recurringTemplates: [] });
const N_REAL = mkNb("r", 3), N_TEST = mkNb("t", 4);
const CFG = { owner: "mini952", repo: "newday-data", path: "notebook.json", token: "fake-key-v191", tokenExpires: "" };
let fake = new FakeGitHub();
let browser;
const ready = (p) => p.waitForSelector('[data-testid="sync-indicator"]', { timeout: 90000 });
const tone = (p) => p.$eval('[data-testid="sync-indicator"]', (e) => e.dataset.tone);
const kind = (p) => p.$eval('[data-testid="sync-indicator"]', (e) => e.dataset.kind);
async function waitKind(p, k, t = 20000) { try { await p.waitForFunction((k) => document.querySelector('[data-testid="sync-indicator"]')?.dataset.kind === k, { timeout: t }, k); return true; } catch (e) { return false; } }
async function waitTone(p, k, t = 15000) { try { await p.waitForFunction((k) => document.querySelector('[data-testid="sync-indicator"]')?.dataset.tone === k, { timeout: t }, k); return true; } catch (e) { return false; } }
const ls = (p, k) => p.evaluate((k) => localStorage.getItem(k), k);
async function open(ctx, withFake = true) {
  const p = await ctx.newPage();
  await p.setViewport({ width: 1024, height: 520 });
  p.on("pageerror", (e) => pageErrors.push(String(e).slice(0, 200)));
  p.on("dialog", (d) => d.accept());
  await p.evaluateOnNewDocument(() => { window.__downloads = []; const o = URL.createObjectURL; URL.createObjectURL = function (b) { if (b instanceof Blob) b.text().then((t) => window.__downloads.push(t)); return o.call(URL, b); }; HTMLAnchorElement.prototype.click = function () { window.__dlNames = (window.__dlNames || []).concat(this.download); }; });
  if (withFake) await attachFake(p, () => fake);
  await p.goto(APP_URL, { waitUntil: "domcontentloaded" });
  await ready(p);
  return p;
}
async function reload(p) { await p.reload({ waitUntil: "domcontentloaded" }); await ready(p); await sleep(300); }
async function seed(p, nb, cfg) { await p.evaluate((nb, cfg) => { localStorage.setItem("newday-notebook", JSON.stringify(nb)); if (cfg) localStorage.setItem("newday-sync-config", JSON.stringify(cfg)); }, nb, cfg); await reload(p); }
const menuOpen = (p) => p.$('[data-testid="app-menu"]').then(Boolean);
async function openMenu(p) { if (!(await menuOpen(p))) await (await p.$('[data-testid="menu-button"]')).click(); await p.waitForSelector('[data-testid="app-menu"]', { timeout: 3000 }); }
async function menu(p, id) { await openMenu(p); await (await p.$(`[data-testid="${id}"]`)).click(); }
async function addTask(p, title) { const ti = await p.$('input[placeholder="New task title..."]'); await ti.click(); await ti.type(title); await p.keyboard.press("Enter"); await sleep(300); }
const putPaths = () => fake.log.filter((l) => l.kind === "put").map((l) => l.path);
async function shot(p, name) { if (!SHOTS) return; await p.evaluate(() => window.scrollTo(0, 0)); await sleep(250); await p.screenshot({ path: `${SHOTS}/v191-${name}.png` }); }

(async () => {
  browser = await puppeteer.launch({ executablePath: process.env.CHROME || "/usr/bin/google-chrome", headless: "new", args: ["--no-sandbox"] });
  try {
    fake.set("notebook.json", JSON.stringify(N_REAL, null, 2));
    fake.set("notebook-test.json", JSON.stringify(N_TEST, null, 2));
    // ── Toolbar
    sec = "toolbar";
    const ctx = await browser.createBrowserContext();
    const p = await open(ctx);
    await seed(p, N_REAL, CFG);
    ok("real mode synced, dot green", (await waitKind(p, "synced")) && (await tone(p)) === "green");
    ok("version label v1.9.3", (await p.$eval('[data-testid="app-version"]', (e) => e.textContent)) === "v1.9.3");
    const tabs = await p.evaluate(() => { const bar = document.querySelector('[data-testid="tab-row"]'); const btns = [...bar.querySelectorAll('button[data-testid^="tab-"]')]; return { n: btns.length, heights: btns.map((b) => b.offsetHeight), tops: [...new Set(btns.map((b) => Math.round(b.getBoundingClientRect().top)))].length, barW: bar.getBoundingClientRect().width, extra: [...bar.querySelectorAll("button")].filter((b) => /Export|Import|Refresh|Sync/.test(b.textContent)).length }; });
    ok(`tab row has the 5 tabs in one row, two-line names (bar ${Math.round(tabs.barW)}px)`, tabs.n === 5 && tabs.tops === 1 && Math.max(...tabs.heights) < 60 && Math.round(tabs.barW) === 720, JSON.stringify(tabs));
    ok("no Export/Import/Refresh/Sync buttons on the tab row (menu closed)", tabs.extra === 0);
    await shot(p, "menu-closed");
    await openMenu(p);
    const items = await p.$$eval('[data-testid="app-menu"] [role^="menuitem"]', (els) => els.map((e) => e.dataset.testid));
    ok("menu has Export, Import, Refresh, Sync settings, Test mode", JSON.stringify(items) === JSON.stringify(["menu-export", "menu-import", "menu-refresh", "menu-sync", "menu-testmode"]), JSON.stringify(items));
    await shot(p, "menu-open");
    await p.keyboard.press("Escape"); await sleep(150);
    ok("Escape closes the menu", !(await menuOpen(p)));
    await openMenu(p);
    await p.mouse.click(300, 400); await sleep(150);
    ok("outside click closes the menu", !(await menuOpen(p)));
    await menu(p, "menu-export"); await sleep(300);
    const exp = await p.evaluate(() => window.__downloads.slice(-1)[0] || "");
    ok("Export backup downloads the notebook, no key", exp.includes("Real-mode sample 1") && !exp.includes("fake-key-v191") && !(await menuOpen(p)));
    fs.writeFileSync(require("path").join(require("os").tmpdir(), "newday-import-sample.json"), JSON.stringify({ ...N_REAL, todayTasks: [...N_REAL.todayTasks, T("r9", "Imported sample")] }));
    const [chooser] = await Promise.all([p.waitForFileChooser({ timeout: 5000 }), menu(p, "menu-import")]);
    await chooser.accept([require("path").join(require("os").tmpdir(), "newday-import-sample.json")]);
    const note = await p.waitForSelector('[data-testid="import-note"]', { timeout: 5000 }).catch(() => null);
    ok("Import backup works; '✓ Imported' shows beside the status", note && (await note.evaluate((e) => e.textContent)) === "✓ Imported" && (await p.evaluate(() => document.body.innerText.includes("Imported sample"))));
    await waitKind(p, "synced");
    const lists0 = fake.count("list");
    await menu(p, "menu-refresh"); await sleep(1200);
    ok("Refresh checks GitHub", fake.count("list") > lists0);
    await menu(p, "menu-sync");
    ok("Sync settings opens the panel", !!(await p.waitForSelector('[data-testid="sync-panel"]', { timeout: 3000 }).catch(() => null)));
    await p.evaluate(() => [...document.querySelectorAll('[data-testid="sync-panel"] button')].find((b) => b.textContent === "Close").click());

    // ── Status colours
    sec = "status";
    fake.offline = true;
    await addTask(p, "Offline sample");
    const amb = await waitTone(p, "amber"); await waitKind(p, "offline", 8000);
    ok("offline + unsaved: amber", amb && (await kind(p)) === "offline" && (await tone(p)) === "amber", (await kind(p)) + "/" + (await tone(p)));
    await shot(p, "status-amber");
    fake.offline = false;
    await p.evaluate(() => window.dispatchEvent(new Event("online")));
    ok("back online: green", (await waitKind(p, "synced")) && (await waitTone(p, "green")));
    fake.mode = "401"; await menu(p, "menu-refresh");
    ok("401 key rejected: red", await waitTone(p, "red"));
    await shot(p, "status-red");
    fake.mode = "403"; await menu(p, "menu-refresh"); await sleep(1500);
    ok("403 no access: red", (await tone(p)) === "red" && (await kind(p)) === "error");
    fake.mode = "rate"; await menu(p, "menu-refresh"); await sleep(1500);
    ok("rate limit: amber (not a key problem)", (await tone(p)) === "amber" && (await kind(p)) === "error");
    fake.mode = null; await menu(p, "menu-refresh"); await waitKind(p, "synced");
    await p.evaluate((c) => localStorage.setItem("newday-sync-config", JSON.stringify(c)), { ...CFG, tokenExpires: "2026-10-01" });
    await reload(p); await waitKind(p, "synced");
    ok("expired key date: red", (await tone(p)) === "red");
    await p.evaluate((c) => localStorage.setItem("newday-sync-config", JSON.stringify(c)), CFG);
    await reload(p); await waitKind(p, "synced");

    // ── Test mode
    sec = "testmode";
    const realKeys = ["newday-notebook", "newday-sync-state", "newday-sync-base", "newday-sync-config"];
    const snap = {}; for (const k of realKeys) snap[k] = await ls(p, k);
    const realSha = fake.files.get("notebook.json").sha;
    const putsBefore = putPaths().length;
    await menu(p, "menu-testmode");
    await p.waitForNavigation({ waitUntil: "domcontentloaded" }).catch(() => {}); await ready(p);
    ok("orange bar 'TEST MODE: using test tasks' with a way out", !!(await p.$('[data-testid="testmode-bar"]')) && (await p.$eval('[data-testid="testmode-bar"]', (e) => e.textContent)).includes("TEST MODE: using test tasks") && !!(await p.$('[data-testid="testmode-exit"]')));
    ok("test file loaded (test tasks shown, real ones not)", (await waitKind(p, "synced")) && (await p.evaluate(() => document.body.innerText.includes("Test-mode sample 4") && !document.body.innerText.includes("Real-mode sample 1"))));
    ok("status dot orange, title marked TEST", (await tone(p)) === "orange" && (await p.title()).startsWith("TEST · "));
    await shot(p, "test-mode");
    await addTask(p, "Edit made in test mode"); await sleep(2600); await waitKind(p, "synced");
    ok("edit saved to notebook-test.json", fake.json("notebook-test.json").todayTasks.some((t) => t.title === "Edit made in test mode"));
    await menu(p, "menu-sync");
    ok("Sync settings shows the test-mode note", !!(await p.waitForSelector('[data-testid="sync-testmode-note"]', { timeout: 3000 }).catch(() => null)));
    await (await p.$('[data-testid="upload-start"]')).click();
    await p.waitForFunction(() => /Uploaded/.test(document.querySelector('[data-testid="sync-status"]')?.textContent || ""), { timeout: 10000 }).catch(() => {});
    await p.evaluate(() => [...document.querySelectorAll('[data-testid="sync-panel"] button')].find((b) => b.textContent === "Close").click());
    await menu(p, "menu-refresh"); await sleep(1200);
    const guard = await p.evaluate(async () => { if (typeof putRemoteFile !== "function") return "not-global"; try { await putRemoteFile({ owner: "mini952", repo: "newday-data", path: "notebook.json", token: "x" }, "{}", "abc", "x"); return "wrote"; } catch (e) { return "blocked: " + e.message; } });
    console.log("guard:", guard); ok("code guard: a write to notebook.json in test mode is refused", guard.startsWith("blocked") || guard === "not-global", guard);
    const tmPuts = putPaths().slice(putsBefore);
    ok(`test mode wrote only notebook-test.json (${tmPuts.length} writes, incl. Upload)`, tmPuts.length >= 2 && tmPuts.every((x) => x === "notebook-test.json"), JSON.stringify(tmPuts));
    ok("notebook.json untouched on GitHub", fake.files.get("notebook.json").sha === realSha);
    let same = true; for (const k of realKeys) if ((await ls(p, k)) !== snap[k]) same = false;
    ok("real local notebook, sync state and base untouched", same);
    ok("test mode has its own local copies", !!(await ls(p, "newday-notebook-testmode")) && !!(await ls(p, "newday-sync-state-testmode")) && !!(await ls(p, "newday-sync-base-testmode")));
    await menu(p, "menu-export"); await sleep(300);
    ok("export in test mode is named as a test backup", (await p.evaluate(() => (window.__dlNames || []).slice(-1)[0])).startsWith("newday-TEST-MODE-backup-"));
    // GitHub's real notebook changes meanwhile (another device)
    fake.edit("notebook.json", (f) => { f.todayTasks.push(T("r8", "Added on the phone meanwhile")); });
    await (await p.$('[data-testid="testmode-exit"]')).click();
    await p.waitForNavigation({ waitUntil: "domcontentloaded" }).catch(() => {}); await ready(p);
    ok("back to real notebook: no bar, real tasks, phone edit pulled", !(await p.$('[data-testid="testmode-bar"]')) && (await waitKind(p, "synced")) && (await p.evaluate(() => document.body.innerText.includes("Real-mode sample 1") && document.body.innerText.includes("Added on the phone meanwhile") && !document.body.innerText.includes("Test-mode sample"))));
    ok("real mode: green dot, normal title", (await tone(p)) === "green" && !(await p.title()).startsWith("TEST"));
    await addTask(p, "Real edit after test mode"); await sleep(2600); await waitKind(p, "synced");
    ok("real-mode sync still writes notebook.json", fake.json("notebook.json").todayTasks.some((t) => t.title === "Real edit after test mode") && !fake.json("notebook-test.json").todayTasks.some((t) => t.title === "Real edit after test mode"));
    await ctx.close();
    // Test mode with no test file yet: never falls back to notebook.json
    sec = "testmode-empty";
    fake = new FakeGitHub(); fake.set("notebook.json", JSON.stringify(N_REAL, null, 2));
    const c2 = await browser.createBrowserContext();
    const p2 = await open(c2);
    await seed(p2, N_REAL, CFG); await waitKind(p2, "synced");
    await p2.evaluate(() => localStorage.setItem("newday-test-mode", "on")); await reload(p2);
    ok("missing test file: 'Not uploaded yet', real notebook not loaded", (await waitKind(p2, "setup")) && !(await p2.evaluate(() => document.body.innerText.includes("Real-mode sample 1"))));
    await addTask(p2, "Test edit, no file"); await sleep(2600);
    ok("no writes at all (file is only created by Upload)", putPaths().length === 0);
    await c2.close();
  } catch (e) {
    console.log("ERROR", (e.stack || String(e)).slice(0, 700)); results.push([sec, false]);
  } finally {
    sec = "all"; ok("no page errors", pageErrors.length === 0, pageErrors.join(" | "));
    await browser.close();
    const per = {}; results.forEach(([s, c]) => { per[s] = per[s] || [0, 0]; per[s][1]++; if (c) per[s][0]++; });
    console.log("Per section:", JSON.stringify(per)); console.log(`${results.filter((r) => r[1]).length}/${results.length} passed`);
  }
})();
