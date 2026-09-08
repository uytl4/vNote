window.VNoteNotes = (function () {
  'use strict';

  var DB = window.VNoteDB;
  var U = window.VNoteUtil;
  var STORE = 'notes';

  var state = { statusFilter: 'all', query: '', editingId: null, pinned: false, favorite: false };

  var CATEGORIES = ['General', 'OCS', 'Kubernetes', 'Elasticsearch', 'Linux', 'Telecom', 'CDR', 'Other', 'Study'];

  function tbody() { return document.getElementById('notes-tbody'); }
  function emptyEl() { return document.getElementById('notes-empty'); }

  function getAllActive() {
    return DB.getAll(STORE).then(function (rows) { return rows.filter(function (r) { return !r.deleted; }); });
  }

  function matches(note) {
    if (state.statusFilter !== 'all' && note.status !== state.statusFilter) return false;
    if (!state.query) return true;
    var q = state.query.toLowerCase();
    var inTitle = (note.title || '').toLowerCase().indexOf(q) !== -1;
    var inTags = (note.tags || []).join(' ').toLowerCase().indexOf(q) !== -1;
    return inTitle || inTags;
  }

  function statusBadgeClass(status) {
    if (status === 'Completed') return 'badge-success';
    if (status === 'In Progress') return 'badge-accent';
    if (status === 'Archived') return 'badge';
    return 'badge';
  }
  function priorityBadgeClass(p) {
    if (p === 'Critical' || p === 'High') return 'badge-danger';
    if (p === 'Medium') return 'badge-warning';
    return 'badge';
  }

  function render() {
    return getAllActive().then(function (rows) {
      rows = rows.filter(matches).sort(function (a, b) { return (b.updatedAt || '').localeCompare(a.updatedAt || ''); });
      var body = tbody();
      if (!body) return rows;

      if (!rows.length) {
        body.innerHTML = '';
        if (emptyEl()) emptyEl().hidden = false;
        return rows;
      }
      if (emptyEl()) emptyEl().hidden = true;

      body.innerHTML = rows.map(function (n) {
        return '<tr data-id="' + n.id + '">' +
          '<td>' +
          '<button class="btn btn-sm note-pin-toggle" data-id="' + n.id + '" title="Pin" style="opacity:' + (n.pinned ? '1' : '0.35') + '; padding:2px 4px;">📌</button> ' +
          '<button class="btn btn-sm note-favorite-toggle" data-id="' + n.id + '" title="Favorite" style="opacity:' + (n.favorite ? '1' : '0.35') + '; padding:2px 4px;">⭐</button> ' +
          '<a class="note-open" data-id="' + n.id + '">' + U.escapeHtml(n.title || 'Untitled') + '</a></td>' +
          '<td>' + U.escapeHtml(n.category || '') + '</td>' +
          '<td>' + U.escapeHtml((n.tags || []).join(', ')) + '</td>' +
          '<td><span class="badge ' + priorityBadgeClass(n.priority) + '">' + U.escapeHtml(n.priority || 'Low') + '</span></td>' +
          '<td><span class="badge ' + statusBadgeClass(n.status) + '">' + U.escapeHtml(n.status || 'Draft') + '</span></td>' +
          '<td>' + U.relativeTime(n.updatedAt) + '</td>' +
          '<td><button class="btn btn-sm note-trash" data-id="' + n.id + '">🗑️</button></td>' +
          '</tr>';
      }).join('');

      body.querySelectorAll('.note-pin-toggle').forEach(function (el) {
        el.addEventListener('click', function (e) { e.stopPropagation(); togglePin(el.dataset.id).then(render); });
      });
      body.querySelectorAll('.note-favorite-toggle').forEach(function (el) {
        el.addEventListener('click', function (e) { e.stopPropagation(); toggleFavorite(el.dataset.id).then(render); });
      });
      body.querySelectorAll('.note-open').forEach(function (el) {
        el.addEventListener('click', function () { openEditor(el.dataset.id); });
      });
      body.querySelectorAll('.note-trash').forEach(function (el) {
        el.addEventListener('click', function (e) {
          e.stopPropagation();
          softDelete(el.dataset.id).then(render);
        });
      });

      return rows;
    });
  }

  /* ---------------- Editor ---------------- */

  var overlay, titleInput, categorySelect, tagsInput, prioritySelect, statusSelect, contentInput, saveStatusEl, pinBtn, favoriteBtn;

  function cacheEls() {
    overlay = document.getElementById('overlay-note-editor');
    titleInput = document.getElementById('note-title');
    categorySelect = document.getElementById('note-category');
    tagsInput = document.getElementById('note-tags');
    prioritySelect = document.getElementById('note-priority');
    statusSelect = document.getElementById('note-status');
    contentInput = document.getElementById('note-content');
    saveStatusEl = document.getElementById('note-save-status');
    pinBtn = document.getElementById('note-pin-btn');
    favoriteBtn = document.getElementById('note-favorite-btn');

    if (categorySelect && !categorySelect.dataset.filled) {
      categorySelect.innerHTML = CATEGORIES.map(function (c) { return '<option>' + c + '</option>'; }).join('');
      categorySelect.dataset.filled = '1';
    }
  }

  function openEditor(id, presetCategory) {
    cacheEls();
    state.editingId = id || null;
    saveStatusEl.textContent = '';

    if (id) {
      DB.get(STORE, id).then(function (note) {
        if (!note) return;
        titleInput.value = note.title || '';
        categorySelect.value = note.category || 'General';
        tagsInput.value = (note.tags || []).join(', ');
        prioritySelect.value = note.priority || 'Medium';
        statusSelect.value = note.status || 'Draft';
        contentInput.value = note.content || '';
        state.pinned = !!note.pinned;
        state.favorite = !!note.favorite;
        updatePinFavoriteButtons();
        overlay.classList.add('open');
        titleInput.focus();
        renderBacklinks(note);
        switchTab('edit');
      });
    } else {
      document.getElementById('note-backlinks').hidden = true;
      titleInput.value = '';
      categorySelect.value = presetCategory || 'General';
      tagsInput.value = '';
      prioritySelect.value = 'Medium';
      statusSelect.value = 'Draft';
      contentInput.value = '';
      state.pinned = false;
      state.favorite = false;
      updatePinFavoriteButtons();
      overlay.classList.add('open');
      titleInput.focus();
      switchTab('edit');
    }
  }

  function updatePinFavoriteButtons() {
    pinBtn.classList.toggle('active', state.pinned);
    favoriteBtn.classList.toggle('active', state.favorite);
  }

  /* ---------------- Markdown toolbar / preview ---------------- */

  var MD_SNIPPETS = {
    h1: { before: '# ', after: '', block: true },
    h2: { before: '## ', after: '', block: true },
    bold: { before: '**', after: '**' },
    italic: { before: '*', after: '*' },
    strike: { before: '~~', after: '~~' },
    highlight: { before: '==', after: '==' },
    quote: { before: '> ', after: '', block: true },
    bullet: { before: '- ', after: '', block: true },
    number: { before: '1. ', after: '', block: true },
    checkbox: { before: '- [ ] ', after: '', block: true },
    code: { before: '`', after: '`' },
    link: { before: '[', after: '](https://)' },
    wikilink: { before: '[[', after: ']]' }
  };

  function insertMarkdown(type) {
    var ta = contentInput;
    var start = ta.selectionStart, end = ta.selectionEnd;
    var value = ta.value;
    var selected = value.slice(start, end);

    if (type === 'codeblock') {
      var block = '```bash\n' + (selected || 'command') + '\n```';
      ta.value = value.slice(0, start) + block + value.slice(end);
      ta.selectionStart = start + 4; ta.selectionEnd = start + 4 + (selected || 'command').length;
    } else if (type === 'table') {
      var tbl = '| Column 1 | Column 2 |\n| --- | --- |\n| value 1 | value 2 |';
      ta.value = value.slice(0, start) + tbl + value.slice(end);
      ta.selectionStart = ta.selectionEnd = start + tbl.length;
    } else if (type === 'callout') {
      var callout = '> [!NOTE] ' + (selected || 'Ghi chú quan trọng');
      ta.value = value.slice(0, start) + callout + value.slice(end);
      ta.selectionStart = ta.selectionEnd = start + callout.length;
    } else {
      var sn = MD_SNIPPETS[type];
      if (!sn) return;
      var mid = selected || (sn.block ? '' : type);
      var text = sn.before + mid + sn.after;
      ta.value = value.slice(0, start) + text + value.slice(end);
      ta.selectionStart = start + sn.before.length;
      ta.selectionEnd = ta.selectionStart + mid.length;
    }
    ta.focus();
    scheduleAutosave();
  }

  function switchTab(tab) {
    document.querySelectorAll('#note-editor-tabs .chip').forEach(function (c) { c.classList.toggle('active', c.dataset.tab === tab); });
    document.getElementById('note-md-toolbar').hidden = tab !== 'edit';
    contentInput.hidden = tab !== 'edit';
    var preview = document.getElementById('note-preview');
    preview.hidden = tab !== 'preview';
    if (tab === 'preview') renderPreview();
  }

  function renderPreview() {
    var preview = document.getElementById('note-preview');
    preview.innerHTML = window.VNoteMarkdown.render(contentInput.value);
    preview.querySelectorAll('.md-copy-code').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var code = btn.closest('.md-code-block').querySelector('code').textContent;
        if (navigator.clipboard) navigator.clipboard.writeText(code);
        if (window.VNoteApp) window.VNoteApp.showToast('Đã copy code block');
      });
    });
    preview.querySelectorAll('.wiki-link').forEach(function (span) {
      span.addEventListener('click', function () {
        var title = span.dataset.wiki;
        getAllActive().then(function (all) {
          var match = all.find(function (n) { return n.title.toLowerCase() === title.toLowerCase(); });
          if (match) openEditor(match.id);
          else if (window.VNoteApp) window.VNoteApp.showToast('Chưa có note "' + title + '" — note sẽ hiện trên Knowledge Graph dưới dạng ghost cho tới khi bạn tạo nó.');
        });
      });
    });
  }

  var autosaveTimer = null;
  function scheduleAutosave() {
    clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(function () {
      if (state.editingId && titleInput.value.trim()) save();
    }, 1500);
  }

  function closeEditor() {
    overlay.classList.remove('open');
    state.editingId = null;
  }

  function renderBacklinks(note) {
    var el = document.getElementById('note-backlinks');
    if (!window.VNoteGraph) { el.hidden = true; return; }
    getAllActive().then(function (all) {
      var backlinks = window.VNoteGraph.getBacklinks(note.title, all).filter(function (n) { return n.id !== note.id; });
      if (!backlinks.length) { el.hidden = true; return; }
      el.hidden = false;
      el.innerHTML = '<strong>Backlinks (' + backlinks.length + '):</strong> ' + backlinks.map(function (n) {
        return '<a class="backlink-open" data-id="' + n.id + '" style="color:var(--accent); cursor:pointer; margin-right:10px;">' + U.escapeHtml(n.title) + '</a>';
      }).join('');
      el.querySelectorAll('.backlink-open').forEach(function (a) {
        a.addEventListener('click', function () { openEditor(a.dataset.id); });
      });
    });
  }

  function save() {
    cacheEls();
    var title = titleInput.value.trim();
    if (!title) { titleInput.focus(); return Promise.resolve(); }

    var now = new Date().toISOString();
    var record = {
      id: state.editingId || DB.uid(),
      title: title,
      category: categorySelect.value,
      tags: U.parseTags(tagsInput.value),
      priority: prioritySelect.value,
      status: statusSelect.value,
      content: contentInput.value,
      pinned: state.pinned,
      favorite: state.favorite,
      deleted: false,
      createdAt: now,
      updatedAt: now
    };

    var chain = state.editingId ? DB.get(STORE, state.editingId) : Promise.resolve(null);
    return chain.then(function (existing) {
      if (existing) {
        record.createdAt = existing.createdAt || now;
      }
      saveStatusEl.textContent = 'Saving...';
      var versionSave = (existing && (existing.title !== record.title || existing.content !== record.content))
        ? DB.put('note_versions', { id: DB.uid(), noteId: existing.id, title: existing.title, content: existing.content, savedAt: existing.updatedAt || now })
        : Promise.resolve();
      return versionSave.then(function () { return DB.put(STORE, record); });
    }).then(function () {
      saveStatusEl.textContent = 'Saved ✓';
      state.editingId = record.id;
      return render();
    }).then(function () {
      if (window.VNoteApp) window.VNoteApp.onDataChanged();
    });
  }

  function getVersions(noteId) {
    return DB.getAll('note_versions').then(function (rows) {
      return rows.filter(function (v) { return v.noteId === noteId; }).sort(function (a, b) { return (b.savedAt || '').localeCompare(a.savedAt || ''); });
    });
  }

  function openHistory() {
    if (!state.editingId) return;
    var overlay = document.getElementById('overlay-note-history');
    var list = document.getElementById('note-history-list');
    getVersions(state.editingId).then(function (versions) {
      if (!versions.length) {
        list.innerHTML = '<div class="modal-empty">Chưa có version cũ nào — version mới được lưu mỗi khi bạn Save một thay đổi.</div>';
      } else {
        list.innerHTML = versions.map(function (v, i) {
          return '<div class="modal-item" style="cursor:default;"><span>🕓</span>' +
            '<span class="title">' + U.escapeHtml(v.title) + '</span>' +
            '<span class="item-meta">' + U.formatDate(v.savedAt) + '</span>' +
            '<button class="btn btn-sm" data-view-version="' + i + '" style="margin-left:8px;">View</button>' +
            '<button class="btn btn-sm" data-restore-version="' + i + '">Restore</button>' +
            '<button class="btn btn-sm" data-duplicate-version="' + i + '">Duplicate</button></div>';
        }).join('');
        list.querySelectorAll('[data-view-version]').forEach(function (btn) {
          btn.addEventListener('click', function () {
            var v = versions[Number(btn.dataset.viewVersion)];
            alert(v.title + '\n\n' + v.content);
          });
        });
        list.querySelectorAll('[data-restore-version]').forEach(function (btn) {
          btn.addEventListener('click', function () {
            var v = versions[Number(btn.dataset.restoreVersion)];
            titleInput.value = v.title;
            contentInput.value = v.content;
            overlay.classList.remove('open');
            save();
          });
        });
        list.querySelectorAll('[data-duplicate-version]').forEach(function (btn) {
          btn.addEventListener('click', function () {
            var v = versions[Number(btn.dataset.duplicateVersion)];
            var now = new Date().toISOString();
            DB.put(STORE, {
              id: DB.uid(), title: v.title + ' (from history)', category: 'General', tags: [], priority: 'Low',
              status: 'Draft', content: v.content, pinned: false, favorite: false, deleted: false, createdAt: now, updatedAt: now
            }).then(function () {
              overlay.classList.remove('open');
              render();
              if (window.VNoteApp) window.VNoteApp.onDataChanged();
              if (window.VNoteApp) window.VNoteApp.showToast('Đã tạo note mới từ version cũ');
            });
          });
        });
      }
      overlay.classList.add('open');
    });
  }

  function togglePin(id) {
    return DB.get(STORE, id).then(function (n) {
      if (!n) return;
      n.pinned = !n.pinned;
      n.updatedAt = new Date().toISOString();
      return DB.put(STORE, n);
    });
  }

  function toggleFavorite(id) {
    return DB.get(STORE, id).then(function (n) {
      if (!n) return;
      n.favorite = !n.favorite;
      n.updatedAt = new Date().toISOString();
      return DB.put(STORE, n);
    });
  }

  function duplicate(id) {
    return DB.get(STORE, id).then(function (n) {
      if (!n) return;
      var now = new Date().toISOString();
      var copy = Object.assign({}, n, { id: DB.uid(), title: n.title + ' (copy)', createdAt: now, updatedAt: now });
      return DB.put(STORE, copy);
    });
  }

  function softDelete(id) {
    return DB.get(STORE, id).then(function (n) {
      if (!n) return;
      n.deleted = true;
      n.deletedAt = new Date().toISOString();
      return DB.put(STORE, n);
    }).then(function () { if (window.VNoteApp) window.VNoteApp.onDataChanged(); });
  }

  function restore(id) {
    return DB.get(STORE, id).then(function (n) {
      if (!n) return;
      n.deleted = false;
      delete n.deletedAt;
      return DB.put(STORE, n);
    }).then(function () { if (window.VNoteApp) window.VNoteApp.onDataChanged(); });
  }

  function permanentDelete(id) {
    return DB.remove(STORE, id).then(function () { if (window.VNoteApp) window.VNoteApp.onDataChanged(); });
  }

  function setStatusFilter(status) { state.statusFilter = status; return render(); }
  function setQuery(q) { state.query = q; return render(); }

  function seedIfEmpty() {
    return DB.getAll(STORE).then(function (rows) {
      if (rows.length) return false;
      var now = new Date().toISOString();
      var demo = [
        { title: 'OCS Architecture Overview', category: 'OCS', tags: ['ocs', 'diameter'], priority: 'Medium', status: 'Completed', pinned: false, favorite: false, content: '# OCS Architecture\n\nTổng quan kiến trúc OCS: PCRF, GGSN, Diameter Gx/Gy.\n\nXem thêm [[Diameter CCR / CCA cheat sheet]] và [[Kubernetes Useful Commands]] khi triển khai trên K8s.' },
        { title: 'Kubernetes Useful Commands', category: 'Kubernetes', tags: ['k8s', 'cheatsheet'], priority: 'Low', status: 'Completed', pinned: true, favorite: false, content: '```bash\nkubectl get pods -A\nkubectl rollout restart deploy/<name>\n```' },
        { title: 'Elasticsearch Troubleshooting', category: 'Elasticsearch', tags: ['elasticsearch'], priority: 'High', status: 'In Progress', pinned: false, favorite: false, content: '# Elasticsearch slow query checklist\n\n- Check shard allocation\n- Check heap usage' },
        { title: 'Linux AWK Commands', category: 'Linux', tags: ['awk', 'linux'], priority: 'Low', status: 'Completed', pinned: true, favorite: false, content: "awk -F';' '{print $1}' file.dat" },
        { title: 'Diameter CCR / CCA cheat sheet', category: 'OCS', tags: ['diameter'], priority: 'Medium', status: 'Completed', pinned: false, favorite: true, content: '# CCR / CCA\n\nCredit-Control-Request / Answer flow. Liên quan tới [[CDR Troubleshooting — REQUEST_TIMEOUT]].' },
        { title: 'CDR Troubleshooting — REQUEST_TIMEOUT', category: 'CDR', tags: ['cdr', 'timeout'], priority: 'Critical', status: 'Draft', pinned: false, favorite: true, content: '# Problem\n\nREQUEST_TIMEOUT xuất hiện tăng đột biến trên CDR. Xem [[OCS Architecture Overview]] và [[Elasticsearch Troubleshooting]] để tra log. Chưa có note [[PCRF Session Debug]].' },
        { title: "Daily Note", category: 'General', tags: ['daily'], priority: 'Low', status: 'Draft', pinned: false, favorite: false, content: '## Priority\n\n## Today\'s Work\n\n## Issues\n\n## Learning\n\n## Ideas\n\n## Completed\n\n## Tomorrow' },
        { title: 'File Compare Example', category: 'Other', tags: ['file-tools'], priority: 'Low', status: 'Completed', pinned: false, favorite: false, content: 'Ví dụ so sánh file_A.dat và file_B.dat theo key MSISDN.' },
        { title: 'File Splitter Example', category: 'Other', tags: ['file-tools'], priority: 'Low', status: 'Completed', pinned: false, favorite: false, content: 'Ví dụ chia file CDR 100k dòng thành các phần 500,000 lines/file.' }
      ];
      return Promise.all(demo.map(function (d, i) {
        return DB.put(STORE, Object.assign({ id: DB.uid(), deleted: false, createdAt: now, updatedAt: now }, d));
      })).then(function () { return true; });
    });
  }

  function clearAll() {
    return DB.clearStore(STORE);
  }

  function bindOnce() {
    cacheEls();
    document.getElementById('btn-new-note').addEventListener('click', function () { openEditor(null); });
    document.getElementById('btn-new-note-empty').addEventListener('click', function () { openEditor(null); });
    document.getElementById('note-cancel').addEventListener('click', closeEditor);
    document.getElementById('note-save').addEventListener('click', save);
    document.getElementById('note-history-btn').addEventListener('click', openHistory);
    pinBtn.addEventListener('click', function () {
      state.pinned = !state.pinned;
      updatePinFavoriteButtons();
      if (state.editingId) save();
    });
    favoriteBtn.addEventListener('click', function () {
      state.favorite = !state.favorite;
      updatePinFavoriteButtons();
      if (state.editingId) save();
    });
    document.getElementById('note-history-close').addEventListener('click', function () {
      document.getElementById('overlay-note-history').classList.remove('open');
    });
    document.getElementById('note-delete').addEventListener('click', function () {
      if (state.editingId) softDelete(state.editingId).then(function () { closeEditor(); render(); });
      else closeEditor();
    });
    document.getElementById('notes-filter').addEventListener('click', function (e) {
      var chip = e.target.closest('.chip');
      if (!chip) return;
      document.querySelectorAll('#notes-filter .chip').forEach(function (c) { c.classList.remove('active'); });
      chip.classList.add('active');
      setStatusFilter(chip.dataset.status);
    });
    var quickFilter = document.getElementById('notes-quick-filter');
    quickFilter.addEventListener('input', U.debounce(function () { setQuery(quickFilter.value); }, 150));

    contentInput.addEventListener('keydown', function (e) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        e.stopPropagation();
        save();
      }
    });
    contentInput.addEventListener('input', scheduleAutosave);
    titleInput.addEventListener('input', scheduleAutosave);
    tagsInput.addEventListener('input', scheduleAutosave);

    document.getElementById('note-editor-tabs').addEventListener('click', function (e) {
      var chip = e.target.closest('.chip');
      if (chip) switchTab(chip.dataset.tab);
    });
    document.getElementById('note-md-toolbar').addEventListener('click', function (e) {
      var btn = e.target.closest('[data-md]');
      if (btn) insertMarkdown(btn.dataset.md);
    });
  }

  return {
    render: render,
    openEditor: openEditor,
    togglePin: togglePin,
    toggleFavorite: toggleFavorite,
    duplicate: duplicate,
    softDelete: softDelete,
    restore: restore,
    permanentDelete: permanentDelete,
    getAllActive: getAllActive,
    seedIfEmpty: seedIfEmpty,
    clearAll: clearAll,
    bindOnce: bindOnce
  };
})();
