window.VNoteTroubleshooting = (function () {
  'use strict';

  var DB = window.VNoteDB;
  var U = window.VNoteUtil;
  var STORE = 'troubleshooting';
  var state = { editingId: null };

  var TEMPLATE = '# Problem\n\n# Symptoms\n\n# Environment\n\n# Logs\n\n# Investigation\n\n# Root Cause\n\n# Solution\n\n# Preventive Action\n\n# Related Commands\n\n# Related Notes\n';

  function getAll() { return DB.getAll(STORE); }

  function severityBadge(s) {
    if (s === 'CRITICAL') return 'badge-danger';
    if (s === 'HIGH') return 'badge-danger';
    if (s === 'MEDIUM') return 'badge-warning';
    return 'badge';
  }
  function statusBadge(s) {
    if (s === 'RESOLVED' || s === 'CLOSED') return 'badge-success';
    if (s === 'INVESTIGATING') return 'badge-accent';
    return 'badge';
  }

  function render() {
    return getAll().then(function (rows) {
      rows.sort(function (a, b) { return (b.createdAt || '').localeCompare(a.createdAt || ''); });
      var grid = document.getElementById('troubleshooting-grid');
      var empty = document.getElementById('troubleshooting-empty');
      if (!rows.length) { grid.innerHTML = ''; if (empty) empty.hidden = false; return rows; }
      if (empty) empty.hidden = true;
      grid.innerHTML = rows.map(function (t) {
        return '<div class="card ts-open" data-id="' + t.id + '" style="cursor:pointer;">' +
          '<div class="card-title">' + U.escapeHtml(t.title) + ' <span class="badge ' + severityBadge(t.severity) + '">' + t.severity + '</span></div>' +
          '<p style="color:var(--text-secondary); margin:0 0 8px;">System: ' + U.escapeHtml(t.system || '—') + ' · Component: ' + U.escapeHtml(t.component || '—') + '</p>' +
          '<span class="badge ' + statusBadge(t.status) + '">' + t.status + '</span></div>';
      }).join('');
      grid.querySelectorAll('.ts-open').forEach(function (el) { el.addEventListener('click', function () { openEditor(el.dataset.id); }); });
      return rows;
    });
  }

  var overlay, titleInput, systemInput, componentInput, environmentInput, severitySelect, statusSelect, contentInput;
  function cacheEls() {
    overlay = document.getElementById('overlay-ts-editor');
    titleInput = document.getElementById('ts-title');
    systemInput = document.getElementById('ts-system');
    componentInput = document.getElementById('ts-component');
    environmentInput = document.getElementById('ts-environment');
    severitySelect = document.getElementById('ts-severity');
    statusSelect = document.getElementById('ts-status');
    contentInput = document.getElementById('ts-content');
  }

  function openEditor(id) {
    cacheEls();
    state.editingId = id || null;
    if (id) {
      DB.get(STORE, id).then(function (t) {
        if (!t) return;
        titleInput.value = t.title || ''; systemInput.value = t.system || ''; componentInput.value = t.component || '';
        environmentInput.value = t.environment || ''; severitySelect.value = t.severity || 'MEDIUM';
        statusSelect.value = t.status || 'OPEN'; contentInput.value = t.content || TEMPLATE;
        overlay.classList.add('open'); titleInput.focus();
      });
    } else {
      titleInput.value = ''; systemInput.value = ''; componentInput.value = ''; environmentInput.value = '';
      severitySelect.value = 'MEDIUM'; statusSelect.value = 'OPEN'; contentInput.value = TEMPLATE;
      overlay.classList.add('open'); titleInput.focus();
    }
  }
  function closeEditor() { overlay.classList.remove('open'); state.editingId = null; }

  function save() {
    cacheEls();
    var title = titleInput.value.trim();
    if (!title) { titleInput.focus(); return Promise.resolve(); }
    var now = new Date().toISOString();
    var record = {
      id: state.editingId || DB.uid(), title: title, system: systemInput.value, component: componentInput.value,
      environment: environmentInput.value, severity: severitySelect.value, status: statusSelect.value,
      content: contentInput.value, createdAt: now
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
        { title: 'REQUEST_TIMEOUT trên Diameter CCR', system: 'OCS', component: 'PCRF', environment: 'Production', severity: 'CRITICAL', status: 'INVESTIGATING', content: TEMPLATE.replace('# Problem\n', '# Problem\nREQUEST_TIMEOUT tăng đột biến trên Diameter CCR.\n') },
        { title: 'Elasticsearch cluster yellow', system: 'Elasticsearch', component: 'Shard allocation', environment: 'Production', severity: 'MEDIUM', status: 'RESOLVED', content: TEMPLATE },
        { title: 'Kafka consumer lag tăng đột biến', system: 'Kafka', component: 'Consumer group', environment: 'Production', severity: 'MEDIUM', status: 'OPEN', content: TEMPLATE }
      ];
      return Promise.all(demo.map(function (d) { return DB.put(STORE, Object.assign({ id: DB.uid(), createdAt: now }, d)); })).then(function () { return true; });
    });
  }

  function clearAll() { return DB.clearStore(STORE); }

  function bindOnce() {
    cacheEls();
    document.getElementById('btn-new-ts').addEventListener('click', function () { openEditor(null); });
    document.getElementById('ts-cancel').addEventListener('click', closeEditor);
    document.getElementById('ts-save').addEventListener('click', save);
    document.getElementById('ts-delete').addEventListener('click', function () {
      if (state.editingId) DB.remove(STORE, state.editingId).then(function () { closeEditor(); render(); window.VNoteApp.onDataChanged(); });
      else closeEditor();
    });
  }

  return { render: render, openEditor: openEditor, getAll: getAll, seedIfEmpty: seedIfEmpty, clearAll: clearAll, bindOnce: bindOnce };
})();
