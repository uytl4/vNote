# vNote

Personal Knowledge & Work Center — 100% static web app (HTML/CSS/JS), offline-first, no backend, no CDN.

Author: **UyTL4**

## Run

Open `index.html` directly in a browser, or serve the folder statically:

```bash
python3 -m http.server 8080
```

## Features

- **Notes**: create/edit/delete, Markdown editor with a formatting toolbar (headings, bold/italic/strike/highlight, quote, lists, checkboxes, tables, links, `[[Note]]` cross-links, inline code, fenced code blocks with a Copy button, callouts) and a live Edit/Preview toggle, tags, category, priority, status, pin/favorite, autosave, and full Version History (view/restore/duplicate any past version).
- **Daily Notes**: one-click "Create Today's Note" from a fixed template (Priority / Today's Work / Issues / Learning / Ideas / Completed / Tomorrow).
- **WORK categories**: fully editable — add, rename, and delete categories from the sidebar's "Manage categories" modal. Renaming cascades to every note filed under the old name; deleting reassigns its notes to `General`.
- **Tasks**: Today/Upcoming/Overdue/Completed views, priority, due date, project link.
- **Projects**: group tasks together, with progress computed from linked tasks.
- **Command Center**: a library of shell/kubectl/etc. commands with one-click copy; commands matching known dangerous patterns (`rm -rf`, `kubectl delete`, `systemctl restart`, `DROP`, `TRUNCATE`, …) require confirmation before copying.
- **Snippets**: reusable code snippets by language, with one-click copy.
- **Troubleshooting**: incident log using a structured Problem/Symptoms/Environment/Logs/Investigation/Root Cause/Solution/Preventive Action template.
- **Dashboard**: live stats and widgets (today's tasks, recent/pinned/favorite notes, overdue tasks, recently used commands) computed from real data.
- **Global Search** (`Ctrl+K`), **Command Palette** (`Ctrl+Shift+P`), **Quick Capture** (`Ctrl+Shift+N`, saves directly into Notes/Tasks/Commands/Troubleshooting).
- **Storage**: everything lives in this browser's IndexedDB. Settings → Backup: **Backup Now** (.json) or **Full Backup** (.zip — a JSON dump plus one `.md` file per note, no external library used to build it), and **Import** accepts either back. Trash holds deleted notes/tasks for restore or permanent delete.
- **Theme**: light by default, with a dark mode toggle (persisted).
- Responsive: collapsible sidebar on desktop, drawer + bottom nav on mobile.

## Structure

```
index.html
css/
  app.css              layout & base styles
  components.css       buttons, cards, tables, modals, toasts, markdown preview
  dark.css             dark theme variables
  responsive.css       mobile/tablet breakpoints
js/
  util.js              escapeHtml, tag parsing, date formatting, debounce, file download
  db.js                IndexedDB wrapper (open/get/put/remove, export/import)
  markdown.js          Dependency-free Markdown -> HTML renderer for the note preview
  zip.js               Dependency-free ZIP writer (store method) + central-directory reader, used by Backup
  notes.js             Notes CRUD, Markdown editor, autosave, version history
  tasks.js             Tasks CRUD + rendering
  projects.js          Projects CRUD + rendering
  categories.js        Editable WORK categories (add/rename/delete), dynamic sidebar
  commands.js          Command Center CRUD, danger detection
  snippets.js          Snippets CRUD
  troubleshooting.js   Troubleshooting case CRUD
  app.js               navigation, theme, modals, shortcuts, dashboard, search, settings wiring
```
