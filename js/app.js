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
    'pinned': { icon: '📌', title: 'Pinned', desc: 'Ghi chú đã ghim để truy cập nhanh.', action: 'New Note', actionView: 'notes' },
    'favorites': { icon: '⭐', title: 'Favorites', desc: 'Các mục bạn đã đánh dấu yêu thích.', action: 'New Note', actionView: 'notes' },
    'daily-notes': { icon: '📅', title: 'Daily Notes', desc: 'Tự động tạo theo Daily/YYYY/MM/YYYY-MM-DD.md với template: Priority, Today\'s Work, Issues, Learning, Ideas, Completed, Tomorrow.', action: "Create Today's Note", actionView: 'daily-notes' },
    'work-ocs': { icon: '💼', title: 'WORK · OCS', desc: 'Ghi chú &amp; troubleshooting thuộc nhóm OCS.', action: 'New Note', actionView: 'notes' },
    'work-kubernetes': { icon: '💼', title: 'WORK · Kubernetes', desc: 'Ghi chú &amp; troubleshooting thuộc nhóm Kubernetes.', action: 'New Note', actionView: 'notes' },
    'work-elasticsearch': { icon: '💼', title: 'WORK · Elasticsearch', desc: 'Ghi chú &amp; troubleshooting thuộc nhóm Elasticsearch.', action: 'New Note', actionView: 'notes' },
    'work-linux': { icon: '💼', title: 'WORK · Linux', desc: 'Ghi chú &amp; troubleshooting thuộc nhóm Linux.', action: 'New Note', actionView: 'notes' },
    'work-telecom': { icon: '💼', title: 'WORK · Telecom', desc: 'Ghi chú &amp; troubleshooting thuộc nhóm Telecom.', action: 'New Note', actionView: 'notes' },
    'work-cdr': { icon: '💼', title: 'WORK · CDR', desc: 'Ghi chú &amp; troubleshooting thuộc nhóm CDR.', action: 'New Note', actionView: 'notes' },
    'work-other': { icon: '💼', title: 'WORK · Other', desc: 'Các ghi chú công việc khác.', action: 'New Note', actionView: 'notes' },
    'study': { icon: '📚', title: 'Study', desc: 'Ghi chú học tập, tách biệt với công việc.', action: 'New Note', actionView: 'notes' },
    'projects': { icon: '📁', title: 'Projects', desc: 'Nhóm task, note, command, snippet theo dự án.', action: 'New Project', actionView: 'projects' },
    'analytics': { icon: '📈', title: 'Analytics', desc: 'Thống kê hoạt động: notes, tasks, file operations theo thời gian.' },
    'trash': { icon: '🗑️', title: 'Trash', desc: 'Mục đã xoá — có thể khôi phục hoặc xoá vĩnh viễn.', action: 'Empty Trash', actionView: 'trash' },
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

    var actionBtn = meta.action
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
  });

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
    [overlaySearch, overlayPalette, overlayCapture].forEach(function (o) { o.classList.remove('open'); });
  }
  [overlaySearch, overlayPalette, overlayCapture].forEach(function (overlay) {
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) closeAllOverlays();
    });
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
    if (text) showToast('Đã lưu ' + captureType + ' (demo — chưa nối IndexedDB)');
  });

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

})();
