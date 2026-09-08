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

**Not implemented yet (next phases)**

- Projects, Commands, Snippets, Troubleshooting, Flashcards: still mock UI, not yet backed by IndexedDB CRUD.
- File Tools engines (Compare, Splitter, Analyzer, Converter, Viewer, Data Cleaner) — chunked/streamed processing via Web Workers.
- ZIP/Markdown export formats (JSON backup only for now), Version History.
- Knowledge Graph rendering ([[wiki-link]] parsing, backlinks, graph view).

## Structure

```
index.html
css/
  app.css          layout & base styles
  components.css   buttons, cards, tables, modals, toasts
  dark.css         dark theme variables
  responsive.css   mobile/tablet breakpoints
js/
  util.js          escapeHtml, tag parsing, date formatting, debounce, file download
  db.js            IndexedDB wrapper (open/get/put/remove, export/import)
  notes.js         Notes CRUD + rendering
  tasks.js         Tasks CRUD + rendering
  app.js           navigation, theme, modals, shortcuts, dashboard, search, settings wiring
```
