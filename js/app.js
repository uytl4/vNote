(function () {
  'use strict';

  var app = document.getElementById('app');
  var workspace = document.getElementById('workspace');
  var sidebar = document.getElementById('sidebar');

  /* ---------------------------------------------------------------- */
  /* Generic view registry — placeholder screens not hand-authored    */
  /* in index.html. Real data wiring (IndexedDB, workers) lands later.*/
  /* ---------------------------------------------------------------- */

  var GENERIC_VIEWS = {
    'daily-notes': { icon: '📅', title: 'Daily Notes', desc: 'Tự động tạo theo Daily/YYYY/MM/YYYY-MM-DD.md với template: Priority, Today\'s Work, Issues, Learning, Ideas, Completed, Tomorrow.', dailyNote: true },
    'work-ocs': { icon: '💼', title: 'WORK · OCS', desc: 'Ghi chú &amp; troubleshooting thuộc nhóm OCS.', action: 'New Note', actionView: 'notes' },
    'work-kubernetes': { icon: '💼', title: 'WORK · Kubernetes', desc: 'Ghi chú &amp; troubleshooting thuộc nhóm Kubernetes.', action: 'New Note', actionView: 'notes' },
    'work-elasticsearch': { icon: '💼', title: 'WORK · Elasticsearch', desc: 'Ghi chú &amp; troubleshooting thuộc nhóm Elasticsearch.', action: 'New Note', actionView: 'notes' },
    'work-linux': { icon: '💼', title: 'WORK · Linux', desc: 'Ghi chú &amp; troubleshooting thuộc nhóm Linux.', action: 'New Note', actionView: 'notes' },
    'work-telecom': { icon: '💼', title: 'WORK · Telecom', desc: 'Ghi chú &amp; troubleshooting thuộc nhóm Telecom.', action: 'New Note', actionView: 'notes' },
    'work-cdr': { icon: '💼', title: 'WORK · CDR', desc: 'Ghi chú &amp; troubleshooting thuộc nhóm CDR.', action: 'New Note', actionView: 'notes' },
    'work-other': { icon: '💼', title: 'WORK · Other', desc: 'Các ghi chú công việc khác.', action: 'New Note', actionView: 'notes' },
    'study': { icon: '📚', title: 'Study', desc: 'Ghi chú học tập, tách biệt với công việc.', action: 'New Note', actionView: 'notes' },
    'analytics': { icon: '📈', title: 'Analytics', desc: 'Thống kê hoạt động: notes, tasks, file operations theo thời gian.' },
    'knowledge-graph': { icon: '🧠', title: 'Knowledge Graph', desc: 'Liên kết [[wiki-links]] giữa các note tự động tạo backlinks &amp; graph. Hỗ trợ Zoom, Pan, Search Node, Focus Node.', graph: true },
    'file-splitter': { icon: '✂️', title: 'File Splitter', desc: 'Split by Lines / Size / Records / Column — xử lý theo chunk, không load toàn bộ file vào RAM.', tool: true, options: ['Preserve header', 'Keep records intact'] },
    'file-analyzer': { icon: '📊', title: 'File Analyzer', desc: 'Phân tích file: encoding, line ending, delimiter, số dòng/cột, thống kê từng cột.', tool: true, options: ['Auto-detect delimiter', 'Deep column analysis'] },
    'file-converter': { icon: '🔄', title: 'File Converter', desc: 'Chuyển đổi CSV ⇄ TXT ⇄ TSV ⇄ JSON ⇄ JSONL, encoding &amp; line ending.', tool: true, options: ['UTF-8 → UTF-16', 'CRLF → LF', 'Change delimiter'] },
    'file-viewer': { icon: '👁️', title: 'File Viewer', desc: 'Xem text/log/csv/json/yaml/code/office/archive/image, kèm Raw/Hex Viewer cho file nhị phân.', tool: true, options: ['Detect encoding', 'Show line numbers', 'Raw / Hex fallback'] },
    'data-cleaner': { icon: '🧹', title: 'Data Cleaner', desc: 'Remove empty/duplicate lines, trim whitespace, remove BOM, normalize line ending, find/replace, regex.', tool: true, options: ['Remove duplicate lines', 'Trim whitespace', 'Normalize line ending'] }
  };

  function buildGenericView(id, meta) {
    var section = document.createElement('section');
    section.className = 'view';
    section.dataset.viewId = id;

    var actionBtn = meta.dailyNote
      ? '<button class="btn btn-primary" data-action="create-daily-note">＋ Create Today\'s Note</button>'
      : meta.action
      ? '<button class="btn btn-primary" data-view-link="' + meta.actionView + '">＋ ' + meta.action + '</button>'
      : '';

    var body = '';
    if (meta.graph) {
      body =
        '<div class="toolbar">' +
        '<button class="btn btn-sm" data-toast="Zoom (demo)">🔍 Zoom</button>' +
        '<button class="btn btn-sm" data-toast="Pan (demo)">✋ Pan</button>' +
        '<input class="btn btn-sm" style="cursor:text" placeholder="Search node…">' +
        '<span class="spacer"></span>' +
        '<button class="btn btn-sm" data-toast="Focus Node (demo)">🎯 Focus Node</button>' +
        '</div>' +
        '<div class="empty-state"><div class="empty-icon">🕸️</div>' +
        '<h3>Graph sẽ hiển thị khi có đủ liên kết [[wiki-link]]</h3>' +
        '<p>Tạo note và dùng cú pháp [[Tên Note]] để tự động sinh backlinks và node trên graph.</p></div>';
    } else if (meta.tool) {
      var opts = (meta.options || []).map(function (o) {
        return '<label class="chip"><input type="checkbox"> ' + o + '</label>';
      }).join('');
      body =
        '<div class="dropzone"><div class="dz-icon">📂</div>Drop file here or <u>Choose File</u> · hỗ trợ nhiều file</div>' +
        '<div class="toolbar">' + opts + '</div>' +
        '<button class="btn btn-primary" data-toast="Engine sẽ được nối trong bản tiếp theo">▶ Run</button>';
    } else {
      body =
        '<div class="empty-state"><div class="empty-icon">' + meta.icon + '</div>' +
        '<h3>Chưa có dữ liệu</h3>' +
        '<p>' + meta.desc + '</p>' +
        actionBtn +
        '</div>';
    }

    section.innerHTML =
      '<div class="view-header"><div><h1>' + meta.icon + ' ' + meta.title + '</h1><p>' + meta.desc + '</p></div>' +
      (meta.tool || meta.graph ? '' : '') +
      '</div>' + body;

    workspace.appendChild(section);
    return section;
  }

  function ensureView(id) {
    var existing = workspace.querySelector('.view[data-view-id="' + id + '"]');
    if (existing) return existing;
    var meta = GENERIC_VIEWS[id];
    if (!meta) meta = { icon: '❔', title: id, desc: 'Chưa có nội dung cho mục này.' };
    return buildGenericView(id, meta);
  }

  /* ---------------------------------------------------------------- */
  /* Navigation                                                       */
  /* ---------------------------------------------------------------- */

  function navigateTo(viewId) {
    if (!viewId) return;
    ensureView(viewId);

    workspace.querySelectorAll('.view').forEach(function (v) {
      v.classList.toggle('active', v.dataset.viewId === viewId);
    });
    document.querySelectorAll('.nav-item[data-view]').forEach(function (el) {
      el.classList.toggle('active', el.dataset.view === viewId);
    });
    document.querySelectorAll('.mobile-nav [data-view]').forEach(function (el) {
      el.classList.toggle('active', el.dataset.view === viewId);
    });

    var activeNav = document.querySelector('.nav-item[data-view="' + viewId + '"]');
    if (activeNav) {
      var group = activeNav.closest('details.nav-group');
      if (group) group.open = true;
    }

    workspace.scrollTop = 0;
    closeMobileSidebar();
    refreshView(viewId);
  }

  function refreshView(viewId) {
    if (viewId === 'dashboard') refreshDashboard();
    else if (viewId === 'notes') window.VNoteNotes.render();
    else if (viewId === 'tasks') window.VNoteTasks.render();
    else if (viewId === 'pinned' || viewId === 'favorites') refreshPinnedFavorites();
    else if (viewId === 'trash') refreshTrash();
    else if (viewId === 'command-center') window.VNoteCommands.render();
    else if (viewId === 'snippets') window.VNoteSnippets.render();
    else if (viewId === 'troubleshooting') window.VNoteTroubleshooting.render();
    else if (viewId === 'flashcards') window.VNoteFlashcards.render();
    else if (viewId === 'projects') window.VNoteProjects.render();
  }

  document.addEventListener('click', function (e) {
    var navEl = e.target.closest('[data-view], [data-view-link]');
    if (navEl) {
      var viewId = navEl.dataset.view || navEl.dataset.viewLink;
      navigateTo(viewId);
    }

    var toastEl = e.target.closest('[data-toast]');
    if (toastEl) {
      showToast(toastEl.dataset.toast);
    }

    var copyEl = e.target.closest('[data-copy]');
    if (copyEl) {
      copyToClipboard(copyEl.dataset.copy);
    }

    if (e.target.closest('[data-action="create-daily-note"]')) {
      createDailyNote();
    }
  });

  function createDailyNote() {
    var DB = window.VNoteDB;
    var today = window.VNoteTasks.todayStr();
    var now = new Date().toISOString();
    DB.getAll('notes').then(function (notes) {
      var existing = notes.find(function (n) { return n.title === 'Daily Note ' + today && !n.deleted; });
      if (existing) { navigateTo('notes'); window.VNoteNotes.openEditor(existing.id); return; }
      var content = '## Priority\n\n## Today\'s Work\n\n## Issues\n\n## Learning\n\n## Ideas\n\n## Completed\n\n## Tomorrow\n';
      var note = {
        id: DB.uid(), title: 'Daily Note ' + today, category: 'General', tags: ['daily'],
        priority: 'Low', status: 'Draft', content: content, pinned: false, favorite: false,
        deleted: false, createdAt: now, updatedAt: now
      };
      DB.put('notes', note).then(function () {
        onDataChanged();
        navigateTo('notes');
        window.VNoteNotes.openEditor(note.id);
      });
    });
  }

  function copyToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () {
        showToast('Đã copy: ' + text);
      }, function () {
        showToast('Không thể copy (trình duyệt chặn clipboard)');
      });
    } else {
      showToast('Clipboard API không khả dụng');
    }
  }

  /* ---------------------------------------------------------------- */
  /* Theme                                                             */
  /* ---------------------------------------------------------------- */

  var themeBtn = document.getElementById('btn-theme-toggle');
  function applyThemeIcon() {
    var theme = document.documentElement.getAttribute('data-theme');
    themeBtn.textContent = theme === 'dark' ? '🌙' : '☀️';
  }
  function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    try { localStorage.setItem('vnote-theme', theme); } catch (e) {}
    applyThemeIcon();
  }
  themeBtn.addEventListener('click', function () {
    var current = document.documentElement.getAttribute('data-theme');
    setTheme(current === 'dark' ? 'light' : 'dark');
  });
  applyThemeIcon();

  /* ---------------------------------------------------------------- */
  /* Sidebar collapse (desktop) + drawer (mobile)                      */
  /* ---------------------------------------------------------------- */

  var isMobile = function () { return window.innerWidth <= 768; };

  document.getElementById('btn-sidebar-toggle').addEventListener('click', function () {
    if (isMobile()) {
      app.classList.toggle('sidebar-open');
    } else {
      app.classList.toggle('sidebar-collapsed');
    }
  });

  document.getElementById('sidebar-backdrop').addEventListener('click', closeMobileSidebar);

  function closeMobileSidebar() {
    if (isMobile()) app.classList.remove('sidebar-open');
  }

  /* ---------------------------------------------------------------- */
  /* Focus mode                                                        */
  /* ---------------------------------------------------------------- */

  function toggleFocusMode() {
    app.classList.toggle('focus-mode');
  }
  document.getElementById('btn-focus-mode').addEventListener('click', toggleFocusMode);

  /* ---------------------------------------------------------------- */
  /* Toast                                                             */
  /* ---------------------------------------------------------------- */

  var toastEl = document.getElementById('toast');
  var toastTimer = null;
  function showToast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('show'); }, 2200);
  }

  /* ---------------------------------------------------------------- */
  /* Overlays / modals                                                 */
  /* ---------------------------------------------------------------- */

  var overlaySearch = document.getElementById('overlay-search');
  var overlayPalette = document.getElementById('overlay-palette');
  var overlayCapture = document.getElementById('overlay-capture');

  function openOverlay(el, focusEl) {
    closeAllOverlays();
    el.classList.add('open');
    if (focusEl) setTimeout(function () { focusEl.focus(); }, 0);
  }
  function closeAllOverlays() {
    document.querySelectorAll('.overlay.open').forEach(function (o) { o.classList.remove('open'); });
  }
  document.addEventListener('click', function (e) {
    if (e.target.classList && e.target.classList.contains('overlay')) closeAllOverlays();
  });

  document.getElementById('btn-open-search').addEventListener('click', function () {
    openOverlay(overlaySearch, document.getElementById('search-input'));
  });
  document.getElementById('mn-search').addEventListener('click', function () {
    openOverlay(overlaySearch, document.getElementById('search-input'));
  });

  overlaySearch.querySelectorAll('.modal-item').forEach(function (item) {
    item.addEventListener('click', function () {
      closeAllOverlays();
      showToast('Mở: ' + item.querySelector('.title').textContent);
    });
  });

  /* ---- Command palette ---- */

  var PALETTE_COMMANDS = [
    { label: 'New Note', run: function () { navigateTo('notes'); } },
    { label: "Daily Note", run: function () { navigateTo('daily-notes'); } },
    { label: 'New Task', run: function () { navigateTo('tasks'); } },
    { label: 'New Project', run: function () { navigateTo('projects'); } },
    { label: 'New Troubleshooting', run: function () { navigateTo('troubleshooting'); } },
    { label: 'New Snippet', run: function () { navigateTo('snippets'); } },
    { label: 'New Command', run: function () { navigateTo('command-center'); } },
    { label: 'Search', run: function () { openOverlay(overlaySearch, document.getElementById('search-input')); } },
    { label: 'Dashboard', run: function () { navigateTo('dashboard'); } },
    { label: 'File Compare', run: function () { navigateTo('file-compare'); } },
    { label: 'File Splitter', run: function () { navigateTo('file-splitter'); } },
    { label: 'File Analyzer', run: function () { navigateTo('file-analyzer'); } },
    { label: 'File Converter', run: function () { navigateTo('file-converter'); } },
    { label: 'File Viewer', run: function () { navigateTo('file-viewer'); } },
    { label: 'Backup', run: function () { navigateTo('settings'); showToast('Backup Now (demo)'); } },
    { label: 'Restore', run: function () { navigateTo('settings'); showToast('Restore (demo)'); } },
    { label: 'Settings', run: function () { navigateTo('settings'); } },
    { label: 'Dark Mode', run: function () { setTheme('dark'); } },
    { label: 'Light Mode', run: function () { setTheme('light'); } }
  ];

  var paletteInput = document.getElementById('palette-input');
  var paletteResults = document.getElementById('palette-results');

  function renderPalette(filter) {
    var f = (filter || '').toLowerCase();
    var matches = PALETTE_COMMANDS.filter(function (c) { return c.label.toLowerCase().indexOf(f) !== -1; });
    if (!matches.length) {
      paletteResults.innerHTML = '<div class="modal-empty">No matching command</div>';
      return;
    }
    paletteResults.innerHTML = matches.map(function (c, i) {
      return '<div class="modal-item' + (i === 0 ? ' selected' : '') + '" data-idx="' + i + '"><span>⌘</span><span class="title">' + c.label + '</span></div>';
    }).join('');
    paletteResults.querySelectorAll('.modal-item').forEach(function (el, i) {
      el.addEventListener('click', function () {
        closeAllOverlays();
        matches[i].run();
      });
    });
    paletteResults.dataset.count = matches.length;
    paletteResults._matches = matches;
  }

  paletteInput.addEventListener('input', function () { renderPalette(paletteInput.value); });

  paletteInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
      var first = paletteResults.querySelector('.modal-item');
      if (first) first.click();
    }
  });

  document.getElementById('btn-command-palette').addEventListener('click', openPalette);
  function openPalette() {
    paletteInput.value = '';
    renderPalette('');
    openOverlay(overlayPalette, paletteInput);
  }

  /* ---- Quick capture ---- */

  var captureTextarea = document.getElementById('capture-textarea');
  var captureType = 'Note';

  document.querySelectorAll('.qc-type-row .chip').forEach(function (chip) {
    chip.addEventListener('click', function () {
      document.querySelectorAll('.qc-type-row .chip').forEach(function (c) { c.classList.remove('active'); });
      chip.classList.add('active');
      captureType = chip.dataset.type;
    });
  });

  document.getElementById('btn-quick-capture').addEventListener('click', openCapture);
  function openCapture() {
    captureTextarea.value = '';
    openOverlay(overlayCapture, captureTextarea);
  }

  document.getElementById('capture-cancel').addEventListener('click', closeAllOverlays);
  document.getElementById('capture-save').addEventListener('click', function () {
    var text = captureTextarea.value.trim();
    closeAllOverlays();
    if (text) captureQuick(text, captureType);
  });

  document.getElementById('dash-capture-save').addEventListener('click', function () {
    var ta = document.getElementById('dash-capture-text');
    var type = document.getElementById('dash-capture-type').value;
    var text = ta.value.trim();
    if (!text) return;
    ta.value = '';
    captureQuick(text, type);
  });

  function captureQuick(text, type) {
    var DB = window.VNoteDB;
    var now = new Date().toISOString();
    var firstLine = text.split('\n')[0].slice(0, 80);
    var promise;

    if (type === 'Task') {
      promise = DB.put('tasks', {
        id: DB.uid(), title: firstLine, description: text, priority: 'Medium',
        dueDate: window.VNoteTasks.todayStr(), status: 'TODO', project: '', tags: ['quick-capture'],
        deleted: false, createdAt: now, updatedAt: now
      });
    } else if (type === 'Command') {
      promise = DB.put('commands', {
        id: DB.uid(), name: firstLine, command: text, description: '', category: 'Other',
        tags: ['quick-capture'], danger: 'Safe', createdAt: now
      });
    } else if (type === 'Issue') {
      promise = DB.put('troubleshooting', {
        id: DB.uid(), title: firstLine, system: '', component: '', environment: '', severity: 'MEDIUM',
        symptoms: text, status: 'OPEN', createdAt: now
      });
    } else {
      promise = DB.put('notes', {
        id: DB.uid(), title: firstLine || 'Untitled', category: type === 'Idea' ? 'Other' : 'General',
        tags: [type.toLowerCase()], priority: 'Medium', status: 'Draft', content: text,
        pinned: false, favorite: false, deleted: false, createdAt: now, updatedAt: now
      });
    }

    promise.then(function () {
      showToast('Đã lưu ' + type);
      onDataChanged();
    });
  }

  /* ---------------------------------------------------------------- */
  /* Keyboard shortcuts                                                */
  /* ---------------------------------------------------------------- */

  document.addEventListener('keydown', function (e) {
    var mod = e.ctrlKey || e.metaKey;

    if (mod && !e.shiftKey && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      openOverlay(overlaySearch, document.getElementById('search-input'));
      return;
    }
    if (mod && !e.shiftKey && e.key.toLowerCase() === 's') {
      e.preventDefault();
      showToast('Saved ✓');
      return;
    }
    if (mod && e.shiftKey && e.key.toLowerCase() === 'n') {
      e.preventDefault();
      openCapture();
      return;
    }
    if (mod && e.shiftKey && e.key.toLowerCase() === 'p') {
      e.preventDefault();
      openPalette();
      return;
    }
    if (mod && e.shiftKey && e.key.toLowerCase() === 'f') {
      e.preventDefault();
      toggleFocusMode();
      return;
    }
    if (mod && e.shiftKey && e.key.toLowerCase() === 'c') {
      e.preventDefault();
      navigateTo('file-compare');
      return;
    }
    if (mod && e.shiftKey && e.key.toLowerCase() === 'a') {
      e.preventDefault();
      navigateTo('file-analyzer');
      return;
    }
    if (e.key === 'Escape') {
      closeAllOverlays();
    }
  });

  /* ---------------------------------------------------------------- */
  /* Dashboard / Pinned / Favorites / Trash — live data                */
  /* ---------------------------------------------------------------- */

  function listRow(title, meta, badgeHtml) {
    return '<li class="list-row"><span class="dot"></span><span class="title">' + window.VNoteUtil.escapeHtml(title) + '</span>' +
      (badgeHtml || (meta ? '<span class="meta">' + window.VNoteUtil.escapeHtml(meta) + '</span>' : '')) + '</li>';
  }

  function refreshDashboard() {
    var U = window.VNoteUtil;
    Promise.all([window.VNoteNotes.getAllActive(), window.VNoteTasks.getAllActive()]).then(function (res) {
      var notes = res[0], tasks = res[1];
      var today = window.VNoteTasks.todayStr();

      var completed = tasks.filter(function (t) { return t.status === 'DONE'; });
      var todayTasks = tasks.filter(function (t) { return t.dueDate === today; });
      var overdue = tasks.filter(function (t) { return t.status !== 'DONE' && t.status !== 'CANCELLED' && t.dueDate && t.dueDate < today; });
      var pinned = notes.filter(function (n) { return n.pinned; });
      var favorites = notes.filter(function (n) { return n.favorite; });
      var recentNotes = notes.slice().sort(function (a, b) { return (b.updatedAt || '').localeCompare(a.updatedAt || ''); }).slice(0, 5);

      setText('stat-tasks', tasks.length);
      setText('stat-completed', completed.length);
      setText('stat-notes', notes.length);

      setHtml('widget-today-tasks', todayTasks.length ? todayTasks.slice(0, 5).map(function (t) {
        return listRow(t.title, null, '<span class="badge ' + (t.priority === 'High' || t.priority === 'Critical' ? 'badge-danger' : t.priority === 'Medium' ? 'badge-warning' : 'badge') + '">' + t.priority + '</span>');
      }).join('') : '<li class="modal-empty" style="padding:8px 0;">Không có task nào hôm nay</li>');

      setHtml('widget-recent-notes', recentNotes.length ? recentNotes.map(function (n) {
        return listRow(n.title, U.relativeTime(n.updatedAt));
      }).join('') : '<li class="modal-empty" style="padding:8px 0;">Chưa có note</li>');

      setHtml('widget-pinned-notes', pinned.length ? pinned.slice(0, 5).map(function (n) { return listRow(n.title); }).join('') : '<li class="modal-empty" style="padding:8px 0;">Chưa ghim note nào</li>');
      setHtml('widget-favorite-notes', favorites.length ? favorites.slice(0, 5).map(function (n) { return listRow(n.title); }).join('') : '<li class="modal-empty" style="padding:8px 0;">Chưa có favorite</li>');
      setHtml('widget-overdue-tasks', overdue.length ? overdue.slice(0, 5).map(function (t) {
        return listRow(t.title, null, '<span class="badge badge-danger">' + t.dueDate + '</span>');
      }).join('') : '<li class="modal-empty" style="padding:8px 0;">Không có task quá hạn 🎉</li>');

      setText('status-notes-count', notes.length);
      setText('status-tasks-count', tasks.length);
      var words = notes.reduce(function (sum, n) { return sum + (n.content ? n.content.trim().split(/\s+/).filter(Boolean).length : 0); }, 0);
      setText('status-words-count', words.toLocaleString('vi-VN'));
    });
  }

  function refreshPinnedFavorites() {
    window.VNoteNotes.getAllActive().then(function (notes) {
      renderNoteTable('pinned-tbody', 'pinned-empty', notes.filter(function (n) { return n.pinned; }));
      renderNoteTable('favorites-tbody', 'favorites-empty', notes.filter(function (n) { return n.favorite; }));
    });
  }

  function renderNoteTable(tbodyId, emptyId, rows) {
    var U = window.VNoteUtil;
    var body = document.getElementById(tbodyId);
    var empty = document.getElementById(emptyId);
    if (!body) return;
    if (!rows.length) {
      body.innerHTML = '';
      if (empty) empty.hidden = false;
      return;
    }
    if (empty) empty.hidden = true;
    body.innerHTML = rows.map(function (n) {
      return '<tr><td><a class="note-open-generic" data-id="' + n.id + '">' + U.escapeHtml(n.title) + '</a></td>' +
        '<td>' + U.escapeHtml(n.category || '') + '</td>' +
        '<td><span class="badge">' + U.escapeHtml(n.status || '') + '</span></td>' +
        '<td>' + U.relativeTime(n.updatedAt) + '</td></tr>';
    }).join('');
    body.querySelectorAll('.note-open-generic').forEach(function (el) {
      el.addEventListener('click', function () { window.VNoteNotes.openEditor(el.dataset.id); });
    });
  }

  function refreshTrash() {
    var U = window.VNoteUtil;
    Promise.all([window.VNoteDB.getAll('notes'), window.VNoteDB.getAll('tasks')]).then(function (res) {
      var deletedNotes = res[0].filter(function (n) { return n.deleted; }).map(function (n) { return Object.assign({ type: 'Note' }, n); });
      var deletedTasks = res[1].filter(function (t) { return t.deleted; }).map(function (t) { return Object.assign({ type: 'Task' }, t); });
      var rows = deletedNotes.concat(deletedTasks).sort(function (a, b) { return (b.deletedAt || '').localeCompare(a.deletedAt || ''); });
      var body = document.getElementById('trash-tbody');
      var empty = document.getElementById('trash-empty');
      if (!rows.length) {
        body.innerHTML = '';
        empty.hidden = false;
        return;
      }
      empty.hidden = true;
      body.innerHTML = rows.map(function (r) {
        return '<tr><td>' + U.escapeHtml(r.title) + '</td><td>' + r.type + '</td><td>' + U.relativeTime(r.deletedAt) + '</td>' +
          '<td><button class="btn btn-sm" data-restore="' + r.id + '" data-type="' + r.type + '">Restore</button> ' +
          '<button class="btn btn-sm" data-purge="' + r.id + '" data-type="' + r.type + '">Delete forever</button></td></tr>';
      }).join('');
      body.querySelectorAll('[data-restore]').forEach(function (el) {
        el.addEventListener('click', function () {
          var fn = el.dataset.type === 'Note' ? window.VNoteNotes.restore : window.VNoteTasks.restore;
          fn(el.dataset.restore).then(refreshTrash);
        });
      });
      body.querySelectorAll('[data-purge]').forEach(function (el) {
        el.addEventListener('click', function () {
          var fn = el.dataset.type === 'Note' ? window.VNoteNotes.permanentDelete : window.VNoteTasks.permanentDelete;
          fn(el.dataset.purge).then(refreshTrash);
        });
      });
    });
  }

  document.getElementById('btn-empty-trash').addEventListener('click', function () {
    Promise.all([window.VNoteDB.getAll('notes'), window.VNoteDB.getAll('tasks')]).then(function (res) {
      var notes = res[0].filter(function (n) { return n.deleted; });
      var tasks = res[1].filter(function (t) { return t.deleted; });
      return Promise.all(
        notes.map(function (n) { return window.VNoteNotes.permanentDelete(n.id); })
          .concat(tasks.map(function (t) { return window.VNoteTasks.permanentDelete(t.id); }))
      );
    }).then(function () {
      showToast('Đã dọn Trash');
      refreshTrash();
    });
  });

  function setText(id, value) { var el = document.getElementById(id); if (el) el.textContent = value; }
  function setHtml(id, html) { var el = document.getElementById(id); if (el) el.innerHTML = html; }

  function onDataChanged() {
    refreshDashboard();
    var activeView = document.querySelector('.view.active');
    if (activeView) refreshView(activeView.dataset.viewId);
  }
  window.VNoteApp = { onDataChanged: onDataChanged };

  /* ---------------------------------------------------------------- */
  /* Global search — live data                                        */
  /* ---------------------------------------------------------------- */

  function runSearch(query) {
    var resultsEl = document.getElementById('search-results');
    var q = query.trim().toLowerCase();
    Promise.all([window.VNoteNotes.getAllActive(), window.VNoteTasks.getAllActive()]).then(function (res) {
      var notes = res[0].map(function (n) { return { icon: '📝', title: n.title, meta: 'Note', open: function () { window.VNoteNotes.openEditor(n.id); } }; });
      var tasks = res[1].map(function (t) { return { icon: '✅', title: t.title, meta: 'Task', open: function () { window.VNoteTasks.openEditor(t.id); } }; });
      var all = notes.concat(tasks);
      var filtered = q ? all.filter(function (i) { return i.title.toLowerCase().indexOf(q) !== -1; }) : all.slice(0, 8);

      if (!filtered.length) {
        resultsEl.innerHTML = '<div class="modal-empty">Không tìm thấy kết quả</div>';
        return;
      }
      resultsEl.innerHTML = filtered.slice(0, 20).map(function (item, i) {
        return '<div class="modal-item" data-idx="' + i + '"><span>' + item.icon + '</span><span class="title">' +
          window.VNoteUtil.escapeHtml(item.title) + '</span><span class="item-meta">' + item.meta + '</span></div>';
      }).join('');
      resultsEl.querySelectorAll('.modal-item').forEach(function (el, i) {
        el.addEventListener('click', function () { closeAllOverlays(); filtered[i].open(); });
      });
    });
  }

  document.getElementById('search-input').addEventListener('input', window.VNoteUtil.debounce(function (e) {
    runSearch(e.target.value);
  }, 120));

  document.getElementById('btn-open-search').addEventListener('click', function () { runSearch(''); });
  document.getElementById('mn-search').addEventListener('click', function () { runSearch(''); });

  /* ---------------------------------------------------------------- */
  /* Settings — export / import / demo data                            */
  /* ---------------------------------------------------------------- */

  document.getElementById('btn-backup-now').addEventListener('click', function () {
    window.VNoteDB.exportAll().then(function (dump) {
      var stamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19);
      window.VNoteUtil.downloadText('vnote_backup_' + stamp + '.json', JSON.stringify(dump, null, 2));
      showToast('Đã tạo file backup');
    });
  });

  document.getElementById('btn-import-file').addEventListener('click', function () {
    document.getElementById('input-import-file').click();
  });

  document.getElementById('input-import-file').addEventListener('change', function (e) {
    var file = e.target.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var dump = JSON.parse(reader.result);
        window.VNoteDB.importAll(dump).then(function () {
          showToast('Đã import dữ liệu');
          onDataChanged();
        });
      } catch (err) {
        showToast('File không hợp lệ');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  });

  document.getElementById('btn-load-demo').addEventListener('click', function () {
    Promise.all([
      window.VNoteNotes.seedIfEmpty(), window.VNoteTasks.seedIfEmpty(), window.VNoteProjects.seedIfEmpty(),
      window.VNoteCommands.seedIfEmpty(), window.VNoteSnippets.seedIfEmpty(), window.VNoteTroubleshooting.seedIfEmpty(),
      window.VNoteFlashcards.seedIfEmpty()
    ]).then(function () {
      showToast('Đã nạp demo data');
      onDataChanged();
    });
  });

  document.getElementById('btn-clear-demo').addEventListener('click', function () {
    Promise.all([
      window.VNoteNotes.clearAll(), window.VNoteTasks.clearAll(), window.VNoteProjects.clearAll(),
      window.VNoteCommands.clearAll(), window.VNoteSnippets.clearAll(), window.VNoteTroubleshooting.clearAll(),
      window.VNoteFlashcards.clearAll()
    ]).then(function () {
      showToast('Đã xoá toàn bộ dữ liệu');
      onDataChanged();
    });
  });

  /* ---------------------------------------------------------------- */
  /* Confirm dialog — used before copying a dangerous command          */
  /* ---------------------------------------------------------------- */

  function showConfirm(message) {
    var overlay = document.getElementById('overlay-confirm');
    var msgEl = document.getElementById('confirm-message');
    msgEl.textContent = message;
    openOverlay(overlay);
    return new Promise(function (resolve) {
      function onYes() { cleanup(); resolve(true); }
      function onNo() { cleanup(); resolve(false); }
      function cleanup() {
        closeAllOverlays();
        document.getElementById('confirm-yes').removeEventListener('click', onYes);
        document.getElementById('confirm-no').removeEventListener('click', onNo);
      }
      document.getElementById('confirm-yes').addEventListener('click', onYes);
      document.getElementById('confirm-no').addEventListener('click', onNo);
    });
  }

  function confirmAndCopy(text, isDangerous) {
    if (!isDangerous) { copyToClipboard(text); return; }
    showConfirm('Đây là lệnh có thể gây nguy hiểm:\n\n' + text + '\n\nBạn có chắc muốn copy?').then(function (ok) {
      if (ok) copyToClipboard(text);
    });
  }
  window.VNoteApp.confirmAndCopy = confirmAndCopy;

  /* ---------------------------------------------------------------- */
  /* Boot                                                              */
  /* ---------------------------------------------------------------- */

  window.VNoteNotes.bindOnce();
  window.VNoteTasks.bindOnce();
  window.VNoteProjects.bindOnce();
  window.VNoteCommands.bindOnce();
  window.VNoteSnippets.bindOnce();
  window.VNoteTroubleshooting.bindOnce();
  window.VNoteFlashcards.bindOnce();

  window.VNoteDB.open().then(function () {
    return Promise.all([
      window.VNoteNotes.seedIfEmpty(),
      window.VNoteTasks.seedIfEmpty(),
      window.VNoteProjects.seedIfEmpty(),
      window.VNoteCommands.seedIfEmpty(),
      window.VNoteSnippets.seedIfEmpty(),
      window.VNoteTroubleshooting.seedIfEmpty(),
      window.VNoteFlashcards.seedIfEmpty()
    ]);
  }).then(function () {
    refreshDashboard();
  });

})();
