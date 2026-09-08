# vNote Ultra Web

Personal Knowledge, Work & File Operations Center — 100% static web app (HTML/CSS/JS), offline-first, no backend, no CDN.

## Run

Open `index.html` directly in a browser, or serve the folder statically:

```bash
python3 -m http.server 8080
```

## Status

**Phase 1 — Interface shell**

- Sidebar / Topbar / Dashboard / Status bar layout, matching the VS Code / Obsidian / Notion-style spec.
- Dark / Light theme toggle (persisted in `localStorage`).
- Responsive layout: collapsible sidebar on desktop, drawer + bottom nav on mobile.
- All sidebar destinations are navigable; views without hand-built content render a generic placeholder.
- Global Search (`Ctrl+K`), Command Palette (`Ctrl+Shift+P`), Quick Capture (`Ctrl+Shift+N`), Focus Mode (`Ctrl+Shift+F`).

**Phase 2 — IndexedDB data layer (this commit)**

- Real persistence via IndexedDB (`js/db.js`): stores for notes, tasks, projects, commands, snippets, troubleshooting, flashcards, tags, history, settings.
- **Notes**: create/edit/delete (soft-delete to Trash)/pin/favorite, markdown content, tags, category, priority, status, live filter — all backed by IndexedDB.
- **Tasks**: create/edit/soft-delete, Today/Upcoming/Overdue/Completed views, checkbox toggle.
- **Trash**: restore or permanently delete notes/tasks, Empty Trash.
- **Pinned / Favorites**: live-filtered from real notes.
- **Dashboard**: stat cards and widgets (Today's Tasks, Recent Notes, Pinned, Favorites, Overdue) computed from real data.
- **Global Search**: live full-text match over notes + tasks.
- **Quick Capture** (topbar, dashboard widget, `Ctrl+Shift+N`): saves directly into the matching store (Note/Task/Command/Issue/Idea).
- **Command Center / Snippets**: Copy buttons use the real Clipboard API.
- **Daily Notes**: "Create Today's Note" generates (or reopens) a note from the daily template.
- **Settings → Backup**: Export (`Backup Now`) downloads a full JSON dump of every store; Import reads a JSON backup back in (existing data is never overwritten — imported records get fresh ids).
- **Settings → Demo Data**: Load Demo Data / Clear Demo Data. The app also seeds demo notes/tasks automatically on first run.

**Phase 3 — Commands / Snippets / Troubleshooting / Flashcards / Projects**

- All five now have real IndexedDB CRUD (see `js/commands.js`, `js/snippets.js`, `js/troubleshooting.js`, `js/flashcards.js`, `js/projects.js`), replacing the earlier mock tables.
- Command Center auto-detects dangerous commands (`rm -rf`, `kubectl delete`, `systemctl restart`, `DROP`, `TRUNCATE`, …) and asks for confirmation before copying one.
- Flashcards has a working study/review loop (Again/Hard/Good/Easy) with a simple Leitner-box scheduler and a live study dashboard.
- Projects shows per-project task progress computed from real linked tasks.
- Analytics is now real: entity counts plus a File Process History table (see below) fed by every File Tools run.

**Phase 4 — File Tools (this commit)**

All six tools under 📂 FILE TOOLS are real, working implementations — not mockups:

- **Shared engine** (`js/file-tools/parsers.js`): `streamLines`/`streamBytes` read a `File` in chunks (`File.slice()` + `arrayBuffer()`), decode incrementally with `TextDecoder(..., {stream:true})`, and yield to the event loop between chunks — so the UI stays responsive and the whole file is never held in memory as one string. Encoding (UTF-8/UTF-8 BOM/UTF-16 LE/UTF-16 BE, with a Windows-1252/ANSI override), line-ending, and delimiter are auto-detected, with manual overrides in the UI.
  - *Known simplification*: this streams on the main thread with cooperative yielding rather than in a dedicated Web Worker (the spec's `workers/*.js`). It does not block the UI for typical multi-hundred-MB files, but a true worker would be a further hardening step for very large files or multi-core throughput.
- **File Compare**: Full Text / Line by Line / Column by Column (index-aligned, with per-column diff detail) and Key-Based Record Compare (pick key column(s) + compare columns after loading File A's header) — all with Ignore whitespace/blank lines/case/trim/record order/duplicates. Same/Added/Deleted/Modified counts and a filterable result table, Export Added/Deleted/Modified/All (CSV/JSON), "Create Note From Result", progress bar + Cancel, and MD5/SHA-256 hashing with an identical-files check.
- **File Splitter**: split by line count or size (MB), optional header-preservation per part, per-part download links, and "Download All as ZIP" (a small dependency-free ZIP writer in `js/file-tools/zip.js`, store method — no external library).
- **File Analyzer**: file info (encoding/line-ending/lines/columns/delimiter/empty & duplicate lines) plus per-column analysis (detected type, empty/unique counts, min/max), sampled for very wide/long files.
- **File Converter**: CSV ⇄ TSV ⇄ TXT ⇄ JSON ⇄ JSONL, configurable delimiters, output line ending, and UTF-8/UTF-16 output encoding.
- **File Viewer**: text (with line numbers), JSON pretty-print, image preview, a hex/ASCII dump for binary or unrecognized files, and a ZIP central-directory listing (entries stored without compression can be opened directly; DEFLATE entries are listed but not decompressed, since that needs an inflate implementation this project doesn't bundle).
- **Data Cleaner**: remove empty/duplicate lines, trim whitespace, sort, normalize line ending, and find/replace (literal or regex).
- **File Process History**: every run above is logged to the `history` store and shown on the Analytics page.

**Not implemented yet (next phases)**

- Knowledge Graph rendering ([[wiki-link]] parsing, backlinks, graph view) — still a placeholder view.
- Data Cleaner's "Filter" (conditional row filtering by expression) from spec section 35 is not implemented.
- Backup/Export as ZIP or Markdown (JSON backup only for now), Note Version History.
- True Web Worker offload for File Tools (see the simplification note above).

## Structure

```
index.html
css/
  app.css              layout & base styles
  components.css       buttons, cards, tables, modals, toasts, file-tools widgets
  dark.css             dark theme variables
  responsive.css       mobile/tablet breakpoints
js/
  util.js              escapeHtml, tag parsing, date formatting, debounce, file download
  db.js                IndexedDB wrapper (open/get/put/remove, export/import)
  notes.js             Notes CRUD + rendering
  tasks.js             Tasks CRUD + rendering
  projects.js          Projects CRUD + rendering
  commands.js          Command Center CRUD, danger detection
  snippets.js          Snippets CRUD
  troubleshooting.js   Troubleshooting case CRUD
  flashcards.js        Flashcards CRUD + spaced-repetition review flow
  file-tools/
    parsers.js         streamLines/streamBytes engine, encoding/delimiter/type detection
    hash.js             incremental MD5 + SHA-256
    zip.js              dependency-free ZIP writer (store) + central-directory reader
    viewer.js           File Viewer
    analyzer.js          File Analyzer
    converter.js         File Converter
    cleaner.js           Data Cleaner
    compare.js           File Compare
    splitter.js          File Splitter
  app.js               navigation, theme, modals, shortcuts, dashboard, search, settings wiring
```
