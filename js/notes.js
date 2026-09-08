window.VNoteNotes = (function () {
  'use strict';

  var DB = window.VNoteDB;
  var U = window.VNoteUtil;
  var STORE = 'notes';

  var state = { statusFilter: 'all', query: '', editingId: null };

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
          '<td>' + (n.pinned ? '📌 ' : '') + (n.favorite ? '⭐ ' : '') + '<a class="note-open" data-id="' + n.id + '">' + U.escapeHtml(n.title || 'Untitled') + '</a></td>' +
          '<td>' + U.escapeHtml(n.category || '') + '</td>' +
          '<td>' + U.escapeHtml((n.tags || []).join(', ')) + '</td>' +
          '<td><span class="badge ' + priorityBadgeClass(n.priority) + '">' + U.escapeHtml(n.priority || 'Low') + '</span></td>' +
          '<td><span class="badge ' + statusBadgeClass(n.status) + '">' + U.escapeHtml(n.status || 'Draft') + '</span></td>' +
          '<td>' + U.relativeTime(n.updatedAt) + '</td>' +
          '<td><button class="btn btn-sm note-trash" data-id="' + n.id + '">🗑️</button></td>' +
          '</tr>';
      }).join('');

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

  var overlay, titleInput, categorySelect, tagsInput, prioritySelect, statusSelect, contentInput, saveStatusEl;

  function cacheEls() {
    overlay = document.getElementById('overlay-note-editor');
    titleInput = document.getElementById('note-title');
    categorySelect = document.getElementById('note-category');
    tagsInput = document.getElementById('note-tags');
    prioritySelect = document.getElementById('note-priority');
    statusSelect = document.getElementById('note-status');
    contentInput = document.getElementById('note-content');
    saveStatusEl = document.getElementById('note-save-status');

    if (categorySelect && !categorySelect.dataset.filled) {
      categorySelect.innerHTML = CATEGORIES.map(function (c) { return '<option>' + c + '</option>'; }).join('');
      categorySelect.dataset.filled = '1';
    }
  }

  function openEditor(id) {
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
        overlay.classList.add('open');
        titleInput.focus();
      });
    } else {
      titleInput.value = '';
      categorySelect.value = 'General';
      tagsInput.value = '';
      prioritySelect.value = 'Medium';
      statusSelect.value = 'Draft';
      contentInput.value = '';
      overlay.classList.add('open');
      overlay.classList.add('open');
      titleInput.focus();
    }
  }

  function closeEditor() {
    overlay.classList.remove('open');
    state.editingId = null;
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
      pinned: false,
      favorite: false,
      deleted: false,
      createdAt: now,
      updatedAt: now
    };

    var chain = state.editingId ? DB.get(STORE, state.editingId) : Promise.resolve(null);
    return chain.then(function (existing) {
      if (existing) {
        record.pinned = !!existing.pinned;
        record.favorite = !!existing.favorite;
        record.createdAt = existing.createdAt || now;
      }
      saveStatusEl.textContent = 'Saving...';
      return DB.put(STORE, record);
    }).then(function () {
      saveStatusEl.textContent = 'Saved ✓';
      state.editingId = record.id;
      return render();
    }).then(function () {
      if (window.VNoteApp) window.VNoteApp.onDataChanged();
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
        { title: 'OCS Architecture Overview', category: 'OCS', tags: ['ocs', 'diameter'], priority: 'Medium', status: 'Completed', pinned: false, favorite: false, content: '# OCS Architecture\n\nTổng quan kiến trúc OCS: PCRF, GGSN, Diameter Gx/Gy.' },
        { title: 'Kubernetes Useful Commands', category: 'Kubernetes', tags: ['k8s', 'cheatsheet'], priority: 'Low', status: 'Completed', pinned: true, favorite: false, content: '```bash\nkubectl get pods -A\nkubectl rollout restart deploy/<name>\n```' },
        { title: 'Elasticsearch Troubleshooting', category: 'Elasticsearch', tags: ['elasticsearch'], priority: 'High', status: 'In Progress', pinned: false, favorite: false, content: '# Elasticsearch slow query checklist\n\n- Check shard allocation\n- Check heap usage' },
        { title: 'Linux AWK Commands', category: 'Linux', tags: ['awk', 'linux'], priority: 'Low', status: 'Completed', pinned: true, favorite: false, content: "awk -F';' '{print $1}' file.dat" },
        { title: 'Diameter CCR / CCA cheat sheet', category: 'OCS', tags: ['diameter'], priority: 'Medium', status: 'Completed', pinned: false, favorite: true, content: '# CCR / CCA\n\nCredit-Control-Request / Answer flow.' },
        { title: 'CDR Troubleshooting — REQUEST_TIMEOUT', category: 'CDR', tags: ['cdr', 'timeout'], priority: 'Critical', status: 'Draft', pinned: false, favorite: true, content: '# Problem\n\nREQUEST_TIMEOUT xuất hiện tăng đột biến trên CDR.' },
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
    document.getElementById('note-cancel').addEventListener('click', closeEditor);
    document.getElementById('note-save').addEventListener('click', save);
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
