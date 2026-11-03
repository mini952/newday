# Browser tests

These tests open the built app in headless Chrome. They use only made-up sample
tasks, and GitHub is replaced by an in-memory stand-in (`fake-github.js`), so no
real data or keys are involved and nothing is sent to GitHub.

## Run

```sh
npm install --no-save puppeteer-core@22
python3 build.py
python3 -m http.server 8765 &          # serve the repo folder
node tests/dates.test.js               # local-date checks at 8 PM Eastern
NOW=2026-11-03T04:30:00Z node tests/dates.test.js   # 11:30 PM Eastern
node tests/toolbar-testmode.test.js    # ☰ menu, status colours, Test mode
node tests/layout-tabs.test.js         # v1.9.2 page widths, tab names, tab outline
```

Options (environment variables):
- `APP_URL`: page to test (default `http://localhost:8765/index.html`)
- `CHROME`: path to Chrome (default `/usr/bin/google-chrome`)
- `NOW`: fake clock for `dates.test.js` (ISO time; default 8 PM Eastern, Nov 2 2026)
- `SHOTS`: folder to save screenshots from `toolbar-testmode.test.js` and `layout-tabs.test.js`
- `SAMPLE`: a notebook JSON file to render in `layout-tabs.test.js` (defaults to made-up tasks; never point it at real data you plan to share)
