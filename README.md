# NewDay Notebook

A personal, single-user daily task manager. It's desktop-first, runs entirely in
your browser with no server and no login, and stores all of its data on-device in
`localStorage`. Built to grow through the phases laid out in `PROJECT_PLAN.md`.

The core pillars this project is being built toward:

1. **A fresh start every day** — tasks live in "Today," and the New Day button
   lets you decide, one task at a time, what carries forward and what gets shelved.
2. **Organize without friction** — a multi-tag system (Life Category, Eisenhower,
   Project), an Ongoing section, recurring templates, and a searchable Task Database.
3. **Nothing falls through the cracks** — Backlog, Someday, Future, drift/overdue
   indicators, soft delete, and JSON export/import keep the whole picture visible.

This repository is currently at **v1.8** (shipped). See `PROJECT_PLAN.md` for the
status block, the full changelog, and what's parked for future versions.

---

## What's in here

```
index.html              The whole app — one self-contained file (served by GitHub Pages).
testrig.html            A test-rig build (TEST_MODE on) with isolated storage; not the default page.
app.jsx                 The single source of truth for the app. build.py produces both HTML files from this.
build.py                Emits index.html + testrig.html from app.jsx (applies the Babel-standalone strip rules).
manifest.webmanifest    PWA manifest — gives the installed dock app its icon, name, and standalone window.
sw.js                   Service worker — makes the app installable (dock/standalone) and adds an offline shell fallback.
icon.png / icon-192 / icon-512   App icons (gradient sunrise) referenced by the manifest.
README.md               You are here.
PROJECT_PLAN.md         The living source of truth: status, versioning workflow, features, and changelog.
IMPLEMENTATION_PLAN.md  The working plan for whatever development cycle is currently open (stable name, rotating content).
```

---

## How to run it

### The easy way — open `index.html`
Double-click it, or open the file in a browser. It pulls React and Babel from a
CDN, so it needs an internet connection to render. Your data saves to that
browser's `localStorage`.

### The real way — GitHub Pages
Served live at `https://mini952.github.io/newday/`. Editing a file and pushing it
makes the change live on the next load — this is how it's meant to run day-to-day,
and it's the URL to pin to your dock (see below).

> **⚠️ Data lives per-origin, and origins don't share.** `localStorage` is scoped
> to the exact origin the app is loaded from. A file opened from `file://` and the
> app served from `https://mini952.github.io/newday/` are **different origins**, so
> they keep **separate** data. Pick one way to run it (the Pages URL) and stick to
> it. To move existing data between origins, use the in-app **Export** on the old
> one and **Import** on the new one.

---

## Putting it on GitHub Pages (no terminal needed)

1. Go to https://github.com and sign in.
2. The repo is `mini952/newday` (public).
3. Upload the file **contents** of this folder (not the enclosing folder) via
   **Add file → Upload files**, then **Commit**.
4. **Settings → Pages**. Source = **Deploy from a branch**, Branch = **main**,
   Folder = **/ (root)**. **Save**.
5. Wait ~1 minute, refresh. Pages shows the live URL:
   `https://mini952.github.io/newday/`.

### Add a dock shortcut
Open the live URL in Chrome: **⋮ → Cast, save, and share → Install page as app**.
The manifest gives it the sunrise icon and opens it in its own window.

---

## How the data works

The app never stores its data in the repo. Everything you create lives in the
browser's `localStorage` under the key `newday-notebook` (the test rig uses a
separate `newday-notebook-TEST` island, so it can never touch real data). The repo
is the source of truth for the **app and its docs**, never for your **task data** —
that stays on-device. Use in-app JSON Export for backups.

---

## Tooling

- **`build.py`** — run `python3 build.py` from the repo root after editing
  `app.jsx`. It regenerates `index.html` (production) and `testrig.html` (test rig)
  from the single source, stripping the top-level React `import` line and the
  `export default` keyword so Babel-standalone renders correctly. Not needed to
  *use* the app — only to rebuild it after a source change.
