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

**Not implemented yet**

- Data Cleaner's "Filter" (conditional row filtering by expression) from spec section 35.
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
```

**TOEIC Reading Test**

- New sidebar entry **🎯 TOEIC Test** (`js/toeic.js`, `css/toeic.css`): a Part 5–7 (questions 101–200) mock-exam runner.
- Ships with three ETS sets from the shared Google Drive folders, grouped on the page: ETS 2024 (10 RC tests + full Reading book), ETS 2023 (10 tests + RC book) and ETS 2022 (10 tests). Reading only — Listening audio/transcripts and the Speaking/Writing files are not used. The 2022/2023 PDFs contain both LC and RC, so each card notes to scroll to READING TEST (Part 5). Only Drive file ids are stored — the test content is not copied into this repo; it is shown through Drive's own `/preview` viewer. You can also add any other test by Drive link or by uploading a local PDF (kept as a Blob in IndexedDB store `toeic_files`, excluded from JSON backup).
- Exam screen: PDF on the left, bubble answer sheet on the right; modes Full (75'), Part 5, Part 6, Part 7 with a custom time limit (0 = untimed); countdown with auto-submit; keyboard `A`–`D` to answer, `↑`/`↓` to move, `F` to flag; autosave + resume of unfinished attempts (timer pauses while you're on another view/tab).
- ETS 2023 and 2022 come with their Reading answer keys pre-filled (`js/toeic-keys.js`, transcribed from the answer-key images in Drive — only the A–D letters, no test content); each has a link to the original key image for checking. ETS 2024 has no key in the source, so you paste one (🔑) — `101B 102D …`, `1A 2C …`, or a plain `BDAC…` string. Attempts can be scored or re-scored after submitting.
- Result screen: correct/wrong/blank, per-part bars, an *estimated* Reading scaled score (full test only; approximate conversion), and a review sheet with your answer vs. the key, filterable by wrong/blank/flagged. History is listed on the TOEIC page and logged to Analytics.

**TOEIC Reading — standalone site, offline & iPhone (`toeic-web/`)**

- `toeic-web/` is a self-contained copy of the TOEIC runner (open `toeic-web/index.html`); vNote now loads its TOEIC code from there (`toeic-web/js/toeic.js`, `toeic-keys.js`, `pdfview.js`, `css/toeic.css`) so there is a single source.
- Offline: "📁 Gắn PDF từ máy" accepts many PDFs at once and matches each to its test by the original Drive file name; files are kept in IndexedDB (`toeic_files`). Local PDFs are rendered with the bundled pdf.js 3.11.174 legacy build (`toeic-web/vendor/pdfjs`, Apache-2.0) — lazy page rendering, zoom, page jump, last-page memory — which also fixes iOS Safari only showing page 1 of an iframed PDF. Works from `file://` (worker falls back to the main thread).
- Answer keys: ETS 2024 keys added, worked out by AI from the test text (labelled 🤖 in the UI); keys can also be loaded from a .txt/.csv/.json file in the key dialog.
- Phone layout: compact A–D answer bar for the current question and a slide-up full answer sheet; safe-area insets; PWA manifest + service worker (`toeic-web/sw.js`) so the site works offline after the first visit when served over https (e.g. GitHub Pages).
