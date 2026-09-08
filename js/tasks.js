window.VNoteTasks = (function () {
  'use strict';

  var DB = window.VNoteDB;
  var U = window.VNoteUtil;
  var STORE = 'tasks';

  var state = { range: 'today', editingId: null };

  function tbody() { return document.getElementById('tasks-tbody'); }
  function emptyEl() { return document.getElementById('tasks-empty'); }

  function getAllActive() {
    return DB.getAll(STORE).then(function (rows) { return rows.filter(function (r) { return !r.deleted; }); });
  }

  function todayStr() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function matchesRange(t) {
    var today = todayStr();
    var isDone = t.status === 'DONE' || t.status === 'CANCELLED';
    if (state.range === 'today') return t.dueDate === today;
    if (state.range === 'upcoming') return !isDone && t.dueDate && t.dueDate > today;
    if (state.range === 'overdue') return !isDone && t.dueDate && t.dueDate < today;
    if (state.range === 'completed') return t.status === 'DONE';
    return true;
  }

  function priorityBadgeClass(p) {
    if (p === 'High' || p === 'Critical') return 'badge-danger';
    if (p === 'Medium') return 'badge-warning';
    return 'badge';
  }
  function statusBadgeClass(s, dueDate) {
    if (s === 'DONE') return 'badge-success';
    if (s === 'IN PROGRESS') return 'badge-accent';
    if (dueDate && dueDate < todayStr() && s !== 'CANCELLED') return 'badge-danger';
    return 'badge';
  }
  function statusLabel(t) {
    if (t.status !== 'DONE' && t.status !== 'CANCELLED' && t.dueDate && t.dueDate < todayStr()) return 'Overdue';
    return t.status || 'TODO';
  }

  function render() {
    return getAllActive().then(function (rows) {
      rows = rows.filter(matchesRange).sort(function (a, b) { return (a.dueDate || '9999').localeCompare(b.dueDate || '9999'); });
      var body = tbody();
      if (!body) return rows;

      if (!rows.length) {
        body.innerHTML = '';
        if (emptyEl()) emptyEl().hidden = false;
        return rows;
      }
      if (emptyEl()) emptyEl().hidden = true;

      body.innerHTML = rows.map(function (t) {
        return '<tr data-id="' + t.id + '">' +
          '<td><input type="checkbox" class="task-done" data-id="' + t.id + '" ' + (t.status === 'DONE' ? 'checked' : '') + '></td>' +
          '<td><a class="task-open" data-id="' + t.id + '">' + U.escapeHtml(t.title) + '</a></td>' +
          '<td>' + U.escapeHtml(t.project || '') + '</td>' +
          '<td><span class="badge ' + priorityBadgeClass(t.priority) + '">' + U.escapeHtml(t.priority || 'Low') + '</span></td>' +
          '<td>' + U.escapeHtml(t.dueDate || '—') + '</td>' +
          '<td><span class="badge ' + statusBadgeClass(t.status, t.dueDate) + '">' + U.escapeHtml(statusLabel(t)) + '</span></td>' +
          '<td><button class="btn btn-sm task-trash" data-id="' + t.id + '">🗑️</button></td>' +
          '</tr>';
      }).join('');

      body.querySelectorAll('.task-open').forEach(function (el) {
        el.addEventListener('click', function () { openEditor(el.dataset.id); });
      });
      body.querySelectorAll('.task-done').forEach(function (el) {
        el.addEventListener('click', function (e) {
          e.stopPropagation();
          toggleDone(el.dataset.id).then(render);
        });
      });
      body.querySelectorAll('.task-trash').forEach(function (el) {
        el.addEventListener('click', function (e) {
          e.stopPropagation();
          softDelete(el.dataset.id).then(render);
        });
      });

      return rows;
    });
  }

  /* ---------------- Editor ---------------- */

  var overlay, titleInput, descInput, priorityInput, dueInput, statusInput, projectInput, tagsInput;

  function cacheEls() {
    overlay = document.getElementById('overlay-task-editor');
    titleInput = document.getElementById('task-title');
    descInput = document.getElementById('task-description');
    priorityInput = document.getElementById('task-priority');
    dueInput = document.getElementById('task-due');
    statusInput = document.getElementById('task-status');
    projectInput = document.getElementById('task-project');
    tagsInput = document.getElementById('task-tags');
  }

  function openEditor(id) {
    cacheEls();
    state.editingId = id || null;
    if (id) {
      DB.get(STORE, id).then(function (t) {
        if (!t) return;
        titleInput.value = t.title || '';
        descInput.value = t.description || '';
        priorityInput.value = t.priority || 'Medium';
        dueInput.value = t.dueDate || '';
        statusInput.value = t.status || 'TODO';
        projectInput.value = t.project || '';
        tagsInput.value = (t.tags || []).join(', ');
        overlay.classList.add('open');
        titleInput.focus();
      });
    } else {
      titleInput.value = '';
      descInput.value = '';
      priorityInput.value = 'Medium';
      dueInput.value = todayStr();
      statusInput.value = 'TODO';
      projectInput.value = '';
      tagsInput.value = '';
      overlay.classList.add('open');
      titleInput.focus();
    }
  }

  function closeEditor() { overlay.classList.remove('open'); state.editingId = null; }

  function save() {
    cacheEls();
    var title = titleInput.value.trim();
    if (!title) { titleInput.focus(); return Promise.resolve(); }
    var now = new Date().toISOString();
    var record = {
      id: state.editingId || DB.uid(),
      title: title,
      description: descInput.value,
      priority: priorityInput.value,
      dueDate: dueInput.value,
      status: statusInput.value,
      project: projectInput.value,
      tags: U.parseTags(tagsInput.value),
      deleted: false,
      createdAt: now,
      updatedAt: now
    };
    var chain = state.editingId ? DB.get(STORE, state.editingId) : Promise.resolve(null);
    return chain.then(function (existing) {
      if (existing) record.createdAt = existing.createdAt || now;
      return DB.put(STORE, record);
    }).then(function () {
      closeEditor();
      return render();
    }).then(function () {
      if (window.VNoteApp) window.VNoteApp.onDataChanged();
    });
  }

  function toggleDone(id) {
    return DB.get(STORE, id).then(function (t) {
      if (!t) return;
      t.status = t.status === 'DONE' ? 'TODO' : 'DONE';
      t.updatedAt = new Date().toISOString();
      return DB.put(STORE, t);
    }).then(function () { if (window.VNoteApp) window.VNoteApp.onDataChanged(); });
  }

  function softDelete(id) {
    return DB.get(STORE, id).then(function (t) {
      if (!t) return;
      t.deleted = true;
      t.deletedAt = new Date().toISOString();
      return DB.put(STORE, t);
    }).then(function () { if (window.VNoteApp) window.VNoteApp.onDataChanged(); });
  }

  function restore(id) {
    return DB.get(STORE, id).then(function (t) {
      if (!t) return;
      t.deleted = false;
      delete t.deletedAt;
      return DB.put(STORE, t);
    }).then(function () { if (window.VNoteApp) window.VNoteApp.onDataChanged(); });
  }

  function permanentDelete(id) {
    return DB.remove(STORE, id).then(function () { if (window.VNoteApp) window.VNoteApp.onDataChanged(); });
  }

  function setRange(range) { state.range = range; return render(); }

  function seedIfEmpty() {
    return DB.getAll(STORE).then(function (rows) {
      if (rows.length) return false;
      var now = new Date().toISOString();
      var today = todayStr();
      var y = new Date(Date.now() - 2 * 86400000);
      var yesterday2 = y.getFullYear() + '-' + String(y.getMonth() + 1).padStart(2, '0') + '-' + String(y.getDate()).padStart(2, '0');
      var demo = [
        { title: 'Kiểm tra alarm CCR/CCA trên PCRF', priority: 'High', dueDate: today, status: 'IN PROGRESS', project: 'OCS Monitoring', tags: ['ocs'] },
        { title: 'Viết note tổng hợp lệnh kubectl', priority: 'Medium', dueDate: today, status: 'TODO', project: 'Documentation', tags: ['k8s'] },
        { title: 'Đối chiếu CDR ngày 07/09', priority: 'Low', dueDate: today, status: 'DONE', project: 'Telecom Ops', tags: ['cdr'] },
        { title: 'Update runbook cho GGSN', priority: 'High', dueDate: yesterday2, status: 'TODO', project: 'Documentation', tags: ['ggsn'] }
      ];
      return Promise.all(demo.map(function (d) {
        return DB.put(STORE, Object.assign({ id: DB.uid(), deleted: false, description: '', createdAt: now, updatedAt: now }, d));
      })).then(function () { return true; });
    });
  }

  function clearAll() { return DB.clearStore(STORE); }

  function bindOnce() {
    cacheEls();
    document.getElementById('btn-new-task').addEventListener('click', function () { openEditor(null); });
    document.getElementById('task-cancel').addEventListener('click', closeEditor);
    document.getElementById('task-save').addEventListener('click', save);
    document.getElementById('task-delete').addEventListener('click', function () {
      if (state.editingId) softDelete(state.editingId).then(function () { closeEditor(); render(); });
      else closeEditor();
    });
    document.getElementById('tasks-filter').addEventListener('click', function (e) {
      var chip = e.target.closest('.chip');
      if (!chip) return;
      document.querySelectorAll('#tasks-filter .chip').forEach(function (c) { c.classList.remove('active'); });
      chip.classList.add('active');
      setRange(chip.dataset.range);
    });
  }

  return {
    render: render,
    openEditor: openEditor,
    toggleDone: toggleDone,
    softDelete: softDelete,
    restore: restore,
    permanentDelete: permanentDelete,
    getAllActive: getAllActive,
    seedIfEmpty: seedIfEmpty,
    clearAll: clearAll,
    bindOnce: bindOnce,
    todayStr: todayStr
  };
})();
