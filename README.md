# NewDay Notebook

A personal, single-user daily task manager. It's desktop-first and runs in your
browser with no server and no login. Tasks are saved on-device in `localStorage`,
and can optionally sync through a private GitHub repo so the Mac and the phone
share one notebook (see **Syncing between devices** below). Built to grow through
the phases laid out in `PROJECT_PLAN.md`.

The core pillars this project is being built toward:

1. **A fresh start every day** — tasks live in "Today," and the ☀ New Day button
   asks what to do with each unfinished task: move it back to **Today** or into the
   **Backlog** (one at a time, or all at once).
2. **Organize without friction** — a multi-tag system (Life Category, Eisenhower,
   Project), an Ongoing section, recurring templates, and a searchable Task Database.
3. **Nothing falls through the cracks** — Backlog, Someday, Future, drift/overdue
   indicators, soft delete, and JSON export/import keep the whole picture visible.

This repository is currently at **v1.9.2** (shipped). See `PROJECT_PLAN.md` for the
status block, the full changelog, and what's parked for future versions.

---

## What's in here

```
index.html              The whole app — one self-contained file (served by GitHub Pages).
testrig.html            A test-rig build (TEST_MODE on) with isolated storage; not the default page.
app.jsx                 The single source of truth for the app. build.py produces both HTML files from this.
build.py                Emits index.html + testrig.html from app.jsx (applies the Babel-standalone strip rules).
manifest.webmanifest    PWA manifest — gives the installed dock app its icon, name, and standalone window.
sw.js                   Service worker — makes the app installable (dock/standalone) and lets it open offline.
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
browser's `localStorage`. (The installed Pages app keeps those files cached, so
it also opens offline once it has been opened online.)

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

This repo (`mini952/newday`, public) holds only the **app and its docs**, never
your **task data**. On each device, tasks live in the browser's `localStorage`
under the key `newday-notebook` (the test rig uses a separate
`newday-notebook-TEST` island, so it can never touch real data). With sync set
up, the shared copy is `notebook.json` in the **private** repo
`mini952/newday-data`. Each device's access key is kept only in that browser and
is never included in exports. Use in-app **↓ Export** for backups.

---

## Syncing between devices

Sync is optional. Without a key the app works exactly as before, on this device only.

### 1. Make a key (one per device)
On GitHub: **Settings → Developer settings → Personal access tokens → Fine-grained
tokens → Generate new token**. Choose **Only select repositories → newday-data**,
and set **Repository permissions → Contents** to **Read and write**. Pick an
expiration date and note it down. Copy the key; GitHub shows it only once.

### 2. Paste it into the app
1. Open the **☰** menu (top right) and choose **Sync settings**. Owner `mini952`, Repo `newday-data`, and File
   path `notebook.json` are already filled in.
2. Paste the key into **Access key**.
3. **Key expires (optional):** enter the key's expiry date. The app reminds you
   from 14 days before. Browsers usually can't read the date from GitHub, so
   typing it in is what makes the reminder work.
4. Press **Test connection**. You should see "✓ Connected to mini952/newday-data",
   then either "Found notebook.json" or "notebook.json doesn't exist yet".
5. Press **Save**, then **Close**.

### 3. First upload (one time only, on the device that has your current tasks)
1. Choose **☰ → Export backup** and keep the downloaded file as a backup (off GitHub's
   public repo).
2. Open **☰ → Sync settings** and press **Upload this device's data as the starting file**.
   If GitHub has no notebook yet (or an empty one), it uploads right away and
   shows how many items went into each section. If a notebook is already there,
   it asks before replacing it, and nothing changes unless you say OK.
3. Press **Close**. The status next to the version label should say **Synced** with a green dot.

### 4. Every other device
Do steps 1 and 2 with that device's own key, then **Close**. The app loads the
notebook from GitHub. If that device already had tasks of its own, it asks first:
**Use GitHub's copy** (it downloads a backup of this device's tasks first) or
**Merge both**.

### Everyday use
- Edits save to GitHub a couple of seconds after you make them. The app checks
  for changes when you come back to it, or when you choose **☰ → Refresh**.
- If the same task changed on two devices, a review screen lets you pick which
  version to keep. Nothing is overwritten without asking.
- Offline, the badge says **Offline · unsaved**. Edits stay on the device and
  sync on their own when you're back online.
- **Key problem** means GitHub rejected the key, usually because it expired.
  Make a new one and paste it in **☰ → Sync settings**.
- Tasks can carry reminder times (open a task, **+ Add time**). The app stores
  them and shows 🔔 with a count; Task Tracker sends the reminders.
- The dot next to the status: **green** synced, **amber** offline or not saved
  yet, **red** a key problem.

### Test mode
**☰ → Test mode** switches the app to a separate practice notebook
(`notebook-test.json` in newday-data) with its own copy on this device. An orange
**TEST MODE: using test tasks** bar stays on screen; press **Back to my real
notebook** (or switch Test mode off) to return. Test mode never writes to
`notebook.json`.

---

## Tooling

- **`build.py`** — run `python3 build.py` from the repo root after editing
  `app.jsx`. It regenerates `index.html` (production) and `testrig.html` (test rig)
  from the single source, stripping the top-level React `import` line and the
  `export default` keyword so Babel-standalone renders correctly. Not needed to
  *use* the app — only to rebuild it after a source change.
