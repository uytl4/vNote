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

- **Shared engine** (`js/file-tools/parsers.js`): `streamLines`/`streamBytes` read a `File` in chunks (`File.slice()` + `arrayBuffer()`), decode incrementally with `TextDecoder(..., {stream:true})`, and yield to the event loop between chunks — so the UI stays responsive and the whole file is never held in memory as one string. Encoding (UTF-8/UTF-8 BOM/UTF-16 LE/UTF-16 BE, with a Windows-1252/ANSI override), line-ending, and delimiter are auto-detected, with manual overrides in the UI. This same engine also runs inside the Web Workers added in Phase 7 below.
- **File Compare**: Full Text / Line by Line / Column by Column (index-aligned, with per-column diff detail) and Key-Based Record Compare (pick key column(s) + compare columns after loading File A's header) — all with Ignore whitespace/blank lines/case/trim/record order/duplicates. Same/Added/Deleted/Modified counts and a filterable result table, Export Added/Deleted/Modified/All (CSV/JSON), "Create Note From Result", progress bar + Cancel, and MD5/SHA-256 hashing with an identical-files check.
- **File Splitter**: split by line count or size (MB), optional header-preservation per part, per-part download links, and "Download All as ZIP" (a small dependency-free ZIP writer in `js/file-tools/zip.js`, store method — no external library).
- **File Analyzer**: file info (encoding/line-ending/lines/columns/delimiter/empty & duplicate lines) plus per-column analysis (detected type, empty/unique counts, min/max), sampled for very wide/long files.
- **File Converter**: CSV ⇄ TSV ⇄ TXT ⇄ JSON ⇄ JSONL, configurable delimiters, output line ending, and UTF-8/UTF-16 output encoding.
- **File Viewer**: text (with line numbers), JSON pretty-print, image preview, a hex/ASCII dump for binary or unrecognized files, and a ZIP central-directory listing (entries stored without compression can be opened directly; DEFLATE entries are listed but not decompressed, since that needs an inflate implementation this project doesn't bundle).
- **Data Cleaner**: remove empty/duplicate lines, trim whitespace, sort, normalize line ending, and find/replace (literal or regex).
- **File Process History**: every run above is logged to the `history` store and shown on the Analytics page.

**Phase 5 — Knowledge Graph**

- `js/graph.js` parses `[[Note Title]]` links out of note content, resolves them to real notes by title (case-insensitive), and creates a "ghost" node for a link that doesn't match any note yet (styled dashed/gray, like Obsidian's unresolved links).
- A dependency-free force-directed layout (Fruchterman-Reingold-style repulsion/attraction, ~150 iterations) lays the graph out on a `<canvas>`; capped at 300 nodes to keep the O(n²) simulation fast.
- Mouse-wheel zoom, drag-to-pan, click a node to jump straight into that note's editor, a node search box that dims non-matches, and "Focus Node" to center + zoom on a match.
- The Note editor now shows a live **Backlinks** panel: every other note whose content links to the one you're editing, each clickable.
- WORK · OCS/Kubernetes/Elasticsearch/Linux/Telecom/CDR/Other and Study (previously static placeholders) now list the real notes filed under that category.

**Phase 6 — Version History, ZIP/Markdown backup**

- **Version History**: every time a note's title or content changes, the previous version is saved to a new `note_versions` IndexedDB store before the new one is written. The editor's "🕓 History" button lists all past versions with View / Restore / Duplicate.
- **Settings → Backup → Full Backup (.zip)**: exports a ZIP (via the same dependency-free writer used by File Splitter) containing `data.json` (the full store dump) plus one `.md` file per active note under `notes/` (with a small YAML-style frontmatter block) — satisfying the spec's JSON + Markdown + ZIP export formats in one file.
- **Import** now accepts either a `.json` backup or a `.zip` full backup (it reads `data.json` back out of the ZIP's central directory); round-tripped and verified to restore every note after a Clear Demo Data.

**Phase 7 — Real Web Workers, Data Cleaner Filter**

- File Analyzer, File Compare, and File Splitter now run their heavy work in dedicated Web Workers (`workers/analyzer-worker.js`, `workers/compare-worker.js`, `workers/file-worker.js` — matching the spec's own project structure), reusing the same `streamLines` engine so the UI thread is completely free during a large-file run.
- **File:// fallback**: Chromium refuses to construct a `Worker` when the page is opened directly via `file://` (`SecurityError: ... cannot be accessed from origin 'null'`) — confirmed with a direct test. Each of the three tools catches that failure and transparently re-runs the exact same logic on the main thread instead (the original streaming implementation, kept as a fallback), so the app keeps working when someone just double-clicks `index.html`, and gets true multi-threading when served over http(s). Verified byte-identical results both ways on the same test files.
- **Data Cleaner** gained the "Filter" operation from spec section 35: keep or remove lines matching plain text or a `/regex/`.

**Not implemented yet**

- File Converter and Data Cleaner still stream on the main thread only (no worker variant yet) — they don't block the UI thanks to cooperative yielding, but aren't multi-threaded.

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
  graph.js             Knowledge Graph: [[wiki-link]] parsing, backlinks, force-directed canvas graph
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
workers/
  analyzer-worker.js   File Analyzer, off the main thread
  compare-worker.js    File Compare, off the main thread
  file-worker.js       File Splitter, off the main thread
```
