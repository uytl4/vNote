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
    'study': { icon: '📚', title: 'Study', desc: 'Ghi chú học tập, tách biệt với công việc.', categoryFilter: 'Study' }
  };

  function buildGenericView(id, meta) {
    var section = document.createElement('section');
    section.className = 'view';
    section.dataset.viewId = id;

    var actionBtn = meta.dailyNote
      ? '<button class="btn btn-primary" data-action="create-daily-note">＋ Create Today\'s Note</button>'
      : meta.categoryFilter
      ? '<button class="btn btn-primary" data-action="new-note-in-category" data-category="' + meta.categoryFilter + '">＋ New Note</button>'
      : meta.action
      ? '<button class="btn btn-primary" data-view-link="' + meta.actionView + '">＋ ' + meta.action + '</button>'
      : '';

    var body = '';
    if (meta.categoryFilter) {
      body =
        '<table class="table"><thead><tr><th>Title</th><th>Tags</th><th>Status</th><th>Updated</th><th></th></tr></thead>' +
        '<tbody id="cat-tbody-' + id + '"></tbody></table>' +
        '<div class="empty-state" id="cat-empty-' + id + '" hidden><div class="empty-icon">' + meta.icon + '</div>' +
        '<h3>Chưa có note nào trong mục này</h3><p>' + meta.desc + '</p>' +
        '<button class="btn btn-primary" data-action="new-note-in-category" data-category="' + meta.categoryFilter + '">＋ New Note</button></div>';
    } else {
      body =
        '<div class="empty-state"><div class="empty-icon">' + meta.icon + '</div>' +
        '<h3>Chưa có dữ liệu</h3>' +
        '<p>' + meta.desc + '</p>' +
        actionBtn +
        '</div>';
    }

    section.innerHTML =
      '<div class="view-header"><div><h1>' + meta.icon + ' ' + meta.title + '</h1><p>' + meta.desc + '</p></div>' + actionBtn + '</div>' + body;

    workspace.appendChild(section);
    return section;
  }

  function ensureView(id) {
    var existing = workspace.querySelector('.view[data-view-id="' + id + '"]');
    if (existing) return existing;

    if (id.indexOf('work-cat-') === 0) {
      var catId = id.slice('work-cat-'.length);
      var cat = window.VNoteCategories.findCached(catId);
      var meta = {
        icon: '💼', title: 'WORK · ' + (cat ? cat.name : '?'),
        desc: 'Ghi chú &amp; troubleshooting thuộc nhóm ' + (cat ? cat.name : ''),
        categoryFilter: cat ? cat.name : ''
      };
      return buildGenericView(id, meta);
    }

    var meta = GENERIC_VIEWS[id];
    if (!meta) meta = { icon: '❔', title: id, desc: 'Chưa có nội dung cho mục này.' };
    return buildGenericView(id, meta);
  }

  function invalidateView(viewId) {
    var el = workspace.querySelector('.view[data-view-id="' + viewId + '"]');
    if (el) el.remove();
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
    else if (viewId === 'projects') window.VNoteProjects.render();
    else if (viewId === 'analytics') refreshAnalytics();
    else if (GENERIC_VIEWS[viewId] && GENERIC_VIEWS[viewId].categoryFilter) refreshCategoryView(viewId, GENERIC_VIEWS[viewId].categoryFilter);
    else if (viewId.indexOf('work-cat-') === 0) {
      var cat = window.VNoteCategories.findCached(viewId.slice('work-cat-'.length));
      if (cat) refreshCategoryView(viewId, cat.name);
    }
    window.VNoteCategories.renderSidebar();
  }

  function refreshCategoryView(viewId, category) {
    window.VNoteNotes.getAllActive().then(function (notes) {
      renderNoteTable('cat-tbody-' + viewId, 'cat-empty-' + viewId, notes.filter(function (n) { return n.category === category; }), onDataChanged);
    });
  }

  function refreshAnalytics() {
    Promise.all([
      window.VNoteNotes.getAllActive(), window.VNoteTasks.getAllActive(), window.VNoteCommands.getAll(),
      window.VNoteSnippets.getAll(), window.VNoteTroubleshooting.getAll()
    ]).then(function (res) {
      var counts = { notes: res[0].length, tasks: res[1].length, commands: res[2].length, snippets: res[3].length, troubleshooting: res[4].length };

      setHtml('analytics-stats',
        ['notes', 'tasks', 'commands', 'snippets', 'troubleshooting'].map(function (k) {
          return '<div class="stat-card"><div class="stat-value">' + counts[k] + '</div><div class="stat-label">' + k[0].toUpperCase() + k.slice(1) + '</div></div>';
        }).join(''));
    });
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

    var newNoteInCategoryBtn = e.target.closest('[data-action="new-note-in-category"]');
    if (newNoteInCategoryBtn) {
      window.VNoteNotes.openEditor(null, newNoteInCategoryBtn.dataset.category);
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

  function openSearch() {
    var input = document.getElementById('search-input');
    openOverlay(overlaySearch, input);
    runSearch(input.value || '');
  }

  document.getElementById('btn-open-search').addEventListener('click', openSearch);
  document.getElementById('mn-search').addEventListener('click', openSearch);

  /* ---- Command palette ---- */

  /* Mở view rồi mở luôn editor tạo mới của module tương ứng. */
  function createIn(viewId, moduleName) {
    return function () {
      navigateTo(viewId);
      var mod = window[moduleName];
      if (mod && mod.openEditor) setTimeout(function () { mod.openEditor(null); }, 0);
    };
  }

  var PALETTE_COMMANDS = [
    { label: 'New Note', run: createIn('notes', 'VNoteNotes') },
    { label: 'Daily Note', run: function () { navigateTo('daily-notes'); createDailyNote(); } },
    { label: 'New Task', run: createIn('tasks', 'VNoteTasks') },
    { label: 'New Project', run: createIn('projects', 'VNoteProjects') },
    { label: 'New Troubleshooting', run: createIn('troubleshooting', 'VNoteTroubleshooting') },
    { label: 'New Snippet', run: createIn('snippets', 'VNoteSnippets') },
    { label: 'New Command', run: createIn('command-center', 'VNoteCommands') },
    { label: 'Search', run: openSearch },
    { label: 'Dashboard', run: function () { navigateTo('dashboard'); } },
    { label: 'Backup (JSON)', run: function () { navigateTo('settings'); doBackupJson(); } },
    { label: 'Backup (ZIP)', run: function () { navigateTo('settings'); doBackupZip(); } },
    { label: 'Restore / Import', run: function () { navigateTo('settings'); doOpenImport(); } },
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
      openSearch();
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
      renderNoteTable('pinned-tbody', 'pinned-empty', notes.filter(function (n) { return n.pinned; }), onDataChanged);
      renderNoteTable('favorites-tbody', 'favorites-empty', notes.filter(function (n) { return n.favorite; }), onDataChanged);
    });
  }

  function renderNoteTable(tbodyId, emptyId, rows, onChanged) {
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
        '<td>' + U.relativeTime(n.updatedAt) + '</td>' +
        '<td><button class="btn btn-sm note-trash-generic" data-id="' + n.id + '">🗑️</button></td></tr>';
    }).join('');
    body.querySelectorAll('.note-open-generic').forEach(function (el) {
      el.addEventListener('click', function () { window.VNoteNotes.openEditor(el.dataset.id); });
    });
    body.querySelectorAll('.note-trash-generic').forEach(function (el) {
      el.addEventListener('click', function (e) {
        e.stopPropagation();
        window.VNoteNotes.softDelete(el.dataset.id).then(function () { if (onChanged) onChanged(); });
      });
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
  window.VNoteApp = { onDataChanged: onDataChanged, showToast: showToast, navigateTo: navigateTo, invalidateView: invalidateView };

  /* ---------------------------------------------------------------- */
  /* Global search — live data, all stores, filter syntax              */
  /* ---------------------------------------------------------------- */

  var FILTER_KEYS = { tag: 'tag', tags: 'tag', category: 'category', cat: 'category', status: 'status', priority: 'priority', type: 'type', is: 'type' };

  function parseQuery(raw) {
    var q = { tag: [], category: [], status: [], priority: [], type: [], terms: [] };
    var normalized = (raw || '').trim().replace(/\s*:\s*/g, ':');
    if (!normalized) return q;
    normalized.split(/\s+/).forEach(function (tok) {
      if (!tok) return;
      var idx = tok.indexOf(':');
      if (idx > 0) {
        var key = FILTER_KEYS[tok.slice(0, idx).toLowerCase()];
        var val = tok.slice(idx + 1).toLowerCase();
        if (key && val) { q[key].push(val); return; }
      }
      q.terms.push(tok.toLowerCase());
    });
    return q;
  }

  function searchItems() {
    return Promise.all([
      window.VNoteNotes.getAllActive(),
      window.VNoteTasks.getAllActive(),
      window.VNoteCommands.getAll(),
      window.VNoteSnippets.getAll(),
      window.VNoteTroubleshooting.getAll(),
      window.VNoteProjects.getAll()
    ]).then(function (res) {
      var items = [];

      res[0].forEach(function (n) {
        items.push({
          icon: '📝', type: 'note', meta: 'Note', title: n.title || '', tags: n.tags || [],
          category: n.category || '', status: n.status || '', priority: n.priority || '',
          body: n.content || '', at: n.updatedAt || n.createdAt || '',
          open: function () { window.VNoteNotes.openEditor(n.id); }
        });
      });

      res[1].forEach(function (t) {
        items.push({
          icon: '✅', type: 'task', meta: 'Task', title: t.title || '', tags: t.tags || [],
          category: t.project || '', status: t.status || '', priority: t.priority || '',
          body: (t.project || '') + ' ' + (t.dueDate || ''), at: t.updatedAt || t.createdAt || '',
          open: function () { window.VNoteTasks.openEditor(t.id); }
        });
      });

      res[2].forEach(function (c) {
        items.push({
          icon: '⌨️', type: 'command', meta: 'Command', title: c.name || '', tags: c.tags || [],
          category: c.category || '', status: '', priority: c.danger || '',
          body: (c.command || '') + ' ' + (c.description || '') + ' ' + (c.example || ''),
          at: c.updatedAt || c.createdAt || '',
          open: function () { window.VNoteCommands.openEditor(c.id); }
        });
      });

      res[3].forEach(function (s) {
        items.push({
          icon: '🧩', type: 'snippet', meta: 'Snippet', title: s.name || '', tags: s.tags || [],
          category: s.language || '', status: '', priority: '',
          body: (s.code || '') + ' ' + (s.description || ''), at: s.updatedAt || s.createdAt || '',
          open: function () { window.VNoteSnippets.openEditor(s.id); }
        });
      });

      res[4].forEach(function (t) {
        items.push({
          icon: '🛠️', type: 'troubleshooting', meta: 'Troubleshooting', title: t.title || '', tags: t.tags || [],
          category: t.system || '', status: t.status || '', priority: t.severity || '',
          body: (t.content || '') + ' ' + (t.component || ''), at: t.updatedAt || t.createdAt || '',
          open: function () { window.VNoteTroubleshooting.openEditor(t.id); }
        });
      });

      res[5].forEach(function (p) {
        items.push({
          icon: '📁', type: 'project', meta: 'Project', title: p.name || '', tags: [],
          category: '', status: p.status || '', priority: '',
          body: p.description || '', at: p.updatedAt || p.createdAt || '',
          open: function () { window.VNoteProjects.openEditor(p.id); }
        });
      });

      return items;
    });
  }

  function matchesFilters(item, q) {
    function anyOf(values, target) {
      if (!values.length) return true;
      var t = String(target || '').toLowerCase();
      return values.some(function (v) { return t === v || t.indexOf(v) !== -1; });
    }
    if (q.tag.length) {
      var tags = (item.tags || []).map(function (t) { return String(t).toLowerCase(); });
      var ok = q.tag.every(function (v) {
        return tags.some(function (t) { return t === v || t.indexOf(v) !== -1; });
      });
      if (!ok) return false;
    }
    return anyOf(q.category, item.category) && anyOf(q.status, item.status) &&
      anyOf(q.priority, item.priority) && anyOf(q.type, item.type);
  }

  /* Ranking per spec: exact title > title > tag > content */
  function scoreItem(item, terms) {
    if (!terms.length) return 1;
    var title = String(item.title || '').toLowerCase();
    var body = String(item.body || '').toLowerCase();
    var tags = (item.tags || []).map(function (t) { return String(t).toLowerCase(); }).join(' ');
    var total = 0;
    for (var i = 0; i < terms.length; i++) {
      var term = terms[i], s = 0;
      if (title === term) s = 100;
      else if (title.indexOf(term) === 0) s = 80;
      else if (title.indexOf(term) !== -1) s = 60;
      else if (tags.indexOf(term) !== -1) s = 40;
      else if (body.indexOf(term) !== -1) s = 20;
      if (!s) return 0;
      total += s;
    }
    return total;
  }

  function runSearch(query) {
    var resultsEl = document.getElementById('search-results');
    var q = parseQuery(query);
    var hasQuery = !!(q.terms.length || q.tag.length || q.category.length || q.status.length || q.priority.length || q.type.length);

    return searchItems().then(function (items) {
      var scored = [];
      items.forEach(function (item) {
        if (!matchesFilters(item, q)) return;
        var s = scoreItem(item, q.terms);
        if (!s) return;
        scored.push({ item: item, score: s });
      });

      scored.sort(function (a, b) {
        if (b.score !== a.score) return b.score - a.score;
        return String(b.item.at).localeCompare(String(a.item.at));
      });

      var filtered = scored.map(function (r) { return r.item; });
      if (!hasQuery) filtered = filtered.slice(0, 8);

      if (!filtered.length) {
        resultsEl.innerHTML = '<div class="modal-empty">Không tìm thấy kết quả</div>';
        return;
      }
      filtered = filtered.slice(0, 20);
      resultsEl.innerHTML = filtered.map(function (item, i) {
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

  document.getElementById('search-input').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
      var first = document.querySelector('#search-results .modal-item');
      if (first) first.click();
    }
  });


  /* ---------------------------------------------------------------- */
  /* Settings — export / import / demo data                            */
  /* ---------------------------------------------------------------- */

  function doBackupJson() {
    return window.VNoteDB.exportAll().then(function (dump) {
      var stamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19);
      window.VNoteUtil.downloadText('vnote_backup_' + stamp + '.json', JSON.stringify(dump, null, 2));
      showToast('Đã tạo file backup');
    });
  }

  function doBackupZip() {
    return Promise.all([window.VNoteDB.exportAll(), window.VNoteNotes.getAllActive()]).then(function (res) {
      var dump = res[0], notes = res[1];
      var encoder = new TextEncoder();
      var entries = [{ name: 'data.json', data: encoder.encode(JSON.stringify(dump, null, 2)) }];
      notes.forEach(function (n, i) {
        var safeName = (n.title || 'untitled').replace(/[\\/:*?"<>|]/g, '_').slice(0, 80);
        var frontmatter = '---\ntitle: ' + n.title + '\ncategory: ' + (n.category || '') + '\ntags: ' + (n.tags || []).join(', ') + '\nstatus: ' + (n.status || '') + '\n---\n\n';
        entries.push({ name: 'notes/' + safeName + '_' + i + '.md', data: encoder.encode(frontmatter + (n.content || '')) });
      });
      var blob = window.VNoteZip.createZip(entries);
      var stamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19);
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a'); a.href = url; a.download = 'vnote_backup_' + stamp + '.zip';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
      showToast('Đã tạo backup ZIP (data.json + notes/*.md)');
    });
  }

  function doOpenImport() {
    document.getElementById('input-import-file').click();
  }

  document.getElementById('btn-backup-now').addEventListener('click', doBackupJson);
  document.getElementById('btn-backup-zip').addEventListener('click', doBackupZip);
  document.getElementById('btn-import-file').addEventListener('click', doOpenImport);

  document.getElementById('input-import-file').addEventListener('change', function (e) {
    var file = e.target.files[0];
    if (!file) return;

    if (/\.zip$/i.test(file.name)) {
      file.arrayBuffer().then(function (buf) {
        var entries = window.VNoteZip.listZipEntries(buf);
        var dataEntry = entries && entries.find(function (en) { return en.name === 'data.json'; });
        if (!dataEntry) { showToast('Không tìm thấy data.json trong file ZIP'); return; }
        var bytes = window.VNoteZip.extractStoredEntry(buf, dataEntry);
        if (!bytes) { showToast('data.json trong ZIP bị nén — không thể đọc'); return; }
        var dump = JSON.parse(new TextDecoder('utf-8').decode(bytes));
        window.VNoteDB.importAll(dump).then(function () { showToast('Đã import dữ liệu từ ZIP'); onDataChanged(); });
      });
    } else {
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
    }
    e.target.value = '';
  });

  document.getElementById('btn-load-demo').addEventListener('click', function () {
    Promise.all([
      window.VNoteNotes.seedIfEmpty(), window.VNoteTasks.seedIfEmpty(), window.VNoteProjects.seedIfEmpty(),
      window.VNoteCommands.seedIfEmpty(), window.VNoteSnippets.seedIfEmpty(), window.VNoteTroubleshooting.seedIfEmpty()
    ]).then(function () {
      showToast('Đã nạp demo data');
      onDataChanged();
    });
  });

  document.getElementById('btn-clear-demo').addEventListener('click', function () {
    Promise.all([
      window.VNoteNotes.clearAll(), window.VNoteTasks.clearAll(), window.VNoteProjects.clearAll(),
      window.VNoteCommands.clearAll(), window.VNoteSnippets.clearAll(), window.VNoteTroubleshooting.clearAll()
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
  window.VNoteCategories.bindOnce();

  window.VNoteDB.open().then(function () {
    return Promise.all([
      window.VNoteNotes.seedIfEmpty(),
      window.VNoteTasks.seedIfEmpty(),
      window.VNoteProjects.seedIfEmpty(),
      window.VNoteCommands.seedIfEmpty(),
      window.VNoteSnippets.seedIfEmpty(),
      window.VNoteTroubleshooting.seedIfEmpty(),
      window.VNoteCategories.seedIfEmpty()
    ]);
  }).then(function () {
    refreshDashboard();
  });

})();
