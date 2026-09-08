window.VNoteProjects = (function () {
  'use strict';

  var DB = window.VNoteDB;
  var U = window.VNoteUtil;
  var STORE = 'projects';
  var state = { editingId: null };

  function getAll() { return DB.getAll(STORE); }

  function render() {
    return Promise.all([getAll(), window.VNoteTasks.getAllActive()]).then(function (res) {
      var rows = res[0], tasks = res[1];
      rows.sort(function (a, b) { return (b.updatedAt || '').localeCompare(a.updatedAt || ''); });
      var grid = document.getElementById('projects-grid');
      var empty = document.getElementById('projects-empty');
      if (!rows.length) { grid.innerHTML = ''; if (empty) empty.hidden = false; return rows; }
      if (empty) empty.hidden = true;
      grid.innerHTML = rows.map(function (p) {
        var linkedTasks = tasks.filter(function (t) { return t.project === p.name; });
        var done = linkedTasks.filter(function (t) { return t.status === 'DONE'; }).length;
        var pct = linkedTasks.length ? Math.round((done / linkedTasks.length) * 100) : 0;
        return '<div class="card proj-open" data-id="' + p.id + '" style="cursor:pointer;">' +
          '<div class="card-title">' + U.escapeHtml(p.name) + ' <span class="badge">' + U.escapeHtml(p.status || 'Active') + '</span></div>' +
          '<p style="color:var(--text-secondary); margin:0 0 10px;">' + U.escapeHtml(p.description || '') + '</p>' +
          '<div class="progress-bar"><div class="fill" style="width:' + pct + '%"></div></div>' +
          '<p style="color:var(--text-muted); font-size:11px; margin:8px 0 0;">' + done + '/' + linkedTasks.length + ' tasks done · Due ' + U.escapeHtml(p.dueDate || '—') + '</p>' +
          '</div>';
      }).join('');
      grid.querySelectorAll('.proj-open').forEach(function (el) { el.addEventListener('click', function () { openEditor(el.dataset.id); }); });
      return rows;
    });
  }

  var overlay, nameInput, descInput, startInput, dueInput, statusSelect;
  function cacheEls() {
    overlay = document.getElementById('overlay-project-editor');
    nameInput = document.getElementById('proj-name');
    descInput = document.getElementById('proj-description');
    startInput = document.getElementById('proj-start');
    dueInput = document.getElementById('proj-due');
    statusSelect = document.getElementById('proj-status');
  }

  function openEditor(id) {
    cacheEls();
    state.editingId = id || null;
    if (id) {
      DB.get(STORE, id).then(function (p) {
        if (!p) return;
        nameInput.value = p.name || ''; descInput.value = p.description || ''; startInput.value = p.startDate || '';
        dueInput.value = p.dueDate || ''; statusSelect.value = p.status || 'Active';
        overlay.classList.add('open'); nameInput.focus();
      });
    } else {
      nameInput.value = ''; descInput.value = ''; startInput.value = ''; dueInput.value = ''; statusSelect.value = 'Active';
      overlay.classList.add('open'); nameInput.focus();
    }
  }
  function closeEditor() { overlay.classList.remove('open'); state.editingId = null; }

  function save() {
    cacheEls();
    var name = nameInput.value.trim();
    if (!name) { nameInput.focus(); return Promise.resolve(); }
    var now = new Date().toISOString();
    var record = {
      id: state.editingId || DB.uid(), name: name, description: descInput.value, startDate: startInput.value,
      dueDate: dueInput.value, status: statusSelect.value, createdAt: now, updatedAt: now
    };
    var chain = state.editingId ? DB.get(STORE, state.editingId) : Promise.resolve(null);
    return chain.then(function (existing) {
      if (existing) record.createdAt = existing.createdAt || now;
      return DB.put(STORE, record);
    }).then(function () { closeEditor(); return render(); }).then(function () { window.VNoteApp.onDataChanged(); });
  }

  function seedIfEmpty() {
    return getAll().then(function (rows) {
      if (rows.length) return false;
      var now = new Date().toISOString();
      var demo = [
        { name: 'OCS Monitoring', description: 'Theo dõi alarm & health OCS/PCRF', status: 'Active', startDate: '', dueDate: '' },
        { name: 'Documentation', description: 'Tổng hợp runbook & cheatsheet nội bộ', status: 'Active', startDate: '', dueDate: '' },
        { name: 'Telecom Ops', description: 'Đối chiếu CDR định kỳ', status: 'Active', startDate: '', dueDate: '' }
      ];
      return Promise.all(demo.map(function (d) { return DB.put(STORE, Object.assign({ id: DB.uid(), createdAt: now, updatedAt: now }, d)); })).then(function () { return true; });
    });
  }

  function clearAll() { return DB.clearStore(STORE); }

  function bindOnce() {
    cacheEls();
    document.getElementById('btn-new-project').addEventListener('click', function () { openEditor(null); });
    document.getElementById('proj-cancel').addEventListener('click', closeEditor);
    document.getElementById('proj-save').addEventListener('click', save);
    document.getElementById('proj-delete').addEventListener('click', function () {
      if (state.editingId) DB.remove(STORE, state.editingId).then(function () { closeEditor(); render(); window.VNoteApp.onDataChanged(); });
      else closeEditor();
    });
  }

  return { render: render, openEditor: openEditor, getAll: getAll, seedIfEmpty: seedIfEmpty, clearAll: clearAll, bindOnce: bindOnce };
})();
