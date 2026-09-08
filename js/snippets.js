window.VNoteSnippets = (function () {
  'use strict';

  var DB = window.VNoteDB;
  var U = window.VNoteUtil;
  var STORE = 'snippets';
  var state = { editingId: null };
  var LANGUAGES = ['AWK', 'Shell', 'Python', 'SQL', 'Java', 'Kibana', 'Elasticsearch', 'Kubernetes', 'YAML', 'JSON', 'JavaScript'];

  function getAll() { return DB.getAll(STORE); }

  function render() {
    return getAll().then(function (rows) {
      rows.sort(function (a, b) { return (b.updatedAt || '').localeCompare(a.updatedAt || ''); });
      var body = document.getElementById('snippets-tbody');
      var empty = document.getElementById('snippets-empty');
      if (!rows.length) { body.innerHTML = ''; if (empty) empty.hidden = false; return rows; }
      if (empty) empty.hidden = true;
      body.innerHTML = rows.map(function (s) {
        return '<tr><td><a class="snip-open" data-id="' + s.id + '">' + U.escapeHtml(s.name) + '</a></td>' +
          '<td><span class="badge">' + U.escapeHtml(s.language) + '</span></td>' +
          '<td>' + U.escapeHtml((s.tags || []).join(', ')) + '</td>' +
          '<td>' + U.relativeTime(s.updatedAt) + '</td>' +
          '<td><button class="btn btn-sm snip-copy" data-id="' + s.id + '">Copy</button> <button class="btn btn-sm snip-trash" data-id="' + s.id + '">🗑️</button></td></tr>';
      }).join('');
      body.querySelectorAll('.snip-open').forEach(function (el) { el.addEventListener('click', function () { openEditor(el.dataset.id); }); });
      body.querySelectorAll('.snip-trash').forEach(function (el) { el.addEventListener('click', function (e) { e.stopPropagation(); DB.remove(STORE, el.dataset.id).then(render); }); });
      body.querySelectorAll('.snip-copy').forEach(function (el) {
        el.addEventListener('click', function (e) {
          e.stopPropagation();
          var row = rows.find(function (r) { return r.id === el.dataset.id; });
          if (row) window.VNoteApp.confirmAndCopy(row.code, false);
        });
      });
      return rows;
    });
  }

  var overlay, nameInput, descInput, languageSelect, tagsInput, codeInput;
  function cacheEls() {
    overlay = document.getElementById('overlay-snippet-editor');
    nameInput = document.getElementById('snip-name');
    descInput = document.getElementById('snip-description');
    languageSelect = document.getElementById('snip-language');
    tagsInput = document.getElementById('snip-tags');
    codeInput = document.getElementById('snip-code');
    if (languageSelect && !languageSelect.dataset.filled) {
      languageSelect.innerHTML = LANGUAGES.map(function (l) { return '<option>' + l + '</option>'; }).join('');
      languageSelect.dataset.filled = '1';
    }
  }

  function openEditor(id) {
    cacheEls();
    state.editingId = id || null;
    if (id) {
      DB.get(STORE, id).then(function (s) {
        if (!s) return;
        nameInput.value = s.name || ''; descInput.value = s.description || ''; languageSelect.value = s.language || 'Shell';
        tagsInput.value = (s.tags || []).join(', '); codeInput.value = s.code || '';
        overlay.classList.add('open'); nameInput.focus();
      });
    } else {
      nameInput.value = ''; descInput.value = ''; languageSelect.value = 'Shell'; tagsInput.value = ''; codeInput.value = '';
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
      id: state.editingId || DB.uid(), name: name, description: descInput.value, language: languageSelect.value,
      tags: U.parseTags(tagsInput.value), code: codeInput.value, createdAt: now, updatedAt: now
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
        { name: 'Extract MSISDN from CDR', description: 'Lấy cột đầu tiên phân cách bởi ;', language: 'AWK', tags: ['cdr', 'awk'], code: "awk -F';' '{print $1}' file.dat" },
        { name: 'Bulk index Elasticsearch', description: 'Bulk API mẫu', language: 'Kibana', tags: ['elasticsearch'], code: 'POST _bulk\n{"index":{"_index":"cdr"}}\n{"field":"value"}' },
        { name: 'Rolling restart deployment', description: 'Restart không downtime', language: 'Shell', tags: ['k8s'], code: 'kubectl rollout restart deploy/<name>' }
      ];
      return Promise.all(demo.map(function (d) { return DB.put(STORE, Object.assign({ id: DB.uid(), createdAt: now, updatedAt: now }, d)); })).then(function () { return true; });
    });
  }

  function clearAll() { return DB.clearStore(STORE); }

  function bindOnce() {
    cacheEls();
    document.getElementById('btn-new-snippet').addEventListener('click', function () { openEditor(null); });
    document.getElementById('snip-cancel').addEventListener('click', closeEditor);
    document.getElementById('snip-save').addEventListener('click', save);
    document.getElementById('snip-delete').addEventListener('click', function () {
      if (state.editingId) DB.remove(STORE, state.editingId).then(function () { closeEditor(); render(); window.VNoteApp.onDataChanged(); });
      else closeEditor();
    });
  }

  return { render: render, openEditor: openEditor, getAll: getAll, seedIfEmpty: seedIfEmpty, clearAll: clearAll, bindOnce: bindOnce };
})();
