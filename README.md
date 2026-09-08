# vNote Ultra Web

Personal Knowledge, Work & File Operations Center — 100% static web app (HTML/CSS/JS), offline-first, no backend, no CDN.

## Run

Open `index.html` directly in a browser, or serve the folder statically:

```bash
python3 -m http.server 8080
```

## Status

**Phase 1 — Interface shell (this commit)**

- Sidebar / Topbar / Dashboard / Status bar layout, matching the VS Code / Obsidian / Notion-style spec.
- Dark / Light theme toggle (persisted in `localStorage`).
- Responsive layout: collapsible sidebar on desktop, drawer + bottom nav on mobile.
- All sidebar destinations are navigable (Notes, Tasks, Command Center, Snippets, Troubleshooting, Flashcards, Knowledge Graph, File Tools, Settings, …); views without hand-built mock content render a generic placeholder.
- Global Search (`Ctrl+K`), Command Palette (`Ctrl+Shift+P`), Quick Capture (`Ctrl+Shift+N`), Focus Mode (`Ctrl+Shift+F`).
- All data shown is mock/demo — nothing persists yet.

**Not implemented yet (next phases)**

- IndexedDB data layer (notes, tasks, projects, commands, snippets, troubleshooting, flashcards).
- Markdown editor with autosave.
- File Tools engines (Compare, Splitter, Analyzer, Converter, Viewer, Data Cleaner) — chunked/streamed processing via Web Workers.
- Import/Export, Backup/Restore, Trash, Version History.
- Knowledge Graph rendering.

## Structure

```
index.html
css/
  app.css          layout & base styles
  components.css   buttons, cards, tables, modals, toasts
  dark.css         dark theme variables
  responsive.css   mobile/tablet breakpoints
js/
  app.js           navigation, theme, modals, shortcuts (no data layer yet)
```
