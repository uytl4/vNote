window.VNoteCommands = (function () {
  'use strict';

  var DB = window.VNoteDB;
  var U = window.VNoteUtil;
  var STORE = 'commands';
  var state = { category: 'all', editingId: null };

  var CATEGORIES = ['Linux', 'Kubernetes', 'Elasticsearch', 'Kafka', 'MySQL', 'Git', 'Docker', 'OCS', 'Telecom', 'Other'];
  var DANGER_PATTERNS = [/\brm\s+-rf\b/i, /\brm\s/i, /\bdelete\b/i, /kubectl\s+delete/i, /systemctl\s+(stop|restart)/i, /\bDROP\b/, /\bTRUNCATE\b/];

  function detectDanger(cmd) {
    return DANGER_PATTERNS.some(function (re) { return re.test(cmd || ''); }) ? 'Dangerous' : 'Safe';
  }

  function getAll() { return DB.getAll(STORE); }

  function render() {
    return getAll().then(function (rows) {
      if (state.category !== 'all') rows = rows.filter(function (r) { return r.category === state.category; });
      rows.sort(function (a, b) { return (a.name || '').localeCompare(b.name || ''); });
      var body = document.getElementById('commands-tbody');
      var empty = document.getElementById('commands-empty');
      if (!rows.length) { body.innerHTML = ''; if (empty) empty.hidden = false; return rows; }
      if (empty) empty.hidden = true;
      body.innerHTML = rows.map(function (c) {
        return '<tr><td><a class="cmd-open" data-id="' + c.id + '">' + U.escapeHtml(c.name) + '</a></td>' +
          '<td><code>' + U.escapeHtml(c.command) + '</code></td>' +
          '<td>' + U.escapeHtml(c.category) + '</td>' +
          '<td><span class="badge ' + (c.danger === 'Dangerous' ? 'badge-danger' : 'badge-success') + '">' + c.danger + '</span></td>' +
          '<td><button class="btn btn-sm cmd-copy" data-id="' + c.id + '">Copy</button> <button class="btn btn-sm cmd-trash" data-id="' + c.id + '">🗑️</button></td></tr>';
      }).join('');
      body.querySelectorAll('.cmd-open').forEach(function (el) { el.addEventListener('click', function () { openEditor(el.dataset.id); }); });
      body.querySelectorAll('.cmd-trash').forEach(function (el) { el.addEventListener('click', function (e) { e.stopPropagation(); DB.remove(STORE, el.dataset.id).then(render); }); });
      body.querySelectorAll('.cmd-copy').forEach(function (el) {
        el.addEventListener('click', function (e) {
          e.stopPropagation();
          var row = rows.find(function (r) { return r.id === el.dataset.id; });
          if (row) window.VNoteApp.confirmAndCopy(row.command, row.danger === 'Dangerous');
        });
      });
      return rows;
    });
  }

  var overlay, nameInput, commandInput, descInput, categorySelect, tagsInput, exampleInput, dangerSelect;
  function cacheEls() {
    overlay = document.getElementById('overlay-command-editor');
    nameInput = document.getElementById('cmd-name');
    commandInput = document.getElementById('cmd-command');
    descInput = document.getElementById('cmd-description');
    categorySelect = document.getElementById('cmd-category');
    tagsInput = document.getElementById('cmd-tags');
    exampleInput = document.getElementById('cmd-example');
    dangerSelect = document.getElementById('cmd-danger');
    if (categorySelect && !categorySelect.dataset.filled) {
      categorySelect.innerHTML = CATEGORIES.map(function (c) { return '<option>' + c + '</option>'; }).join('');
      categorySelect.dataset.filled = '1';
    }
  }

  function openEditor(id) {
    cacheEls();
    state.editingId = id || null;
    if (id) {
      DB.get(STORE, id).then(function (c) {
        if (!c) return;
        nameInput.value = c.name || ''; commandInput.value = c.command || ''; descInput.value = c.description || '';
        categorySelect.value = c.category || 'Linux'; tagsInput.value = (c.tags || []).join(', ');
        exampleInput.value = c.example || ''; dangerSelect.value = c.danger || 'Safe';
        overlay.classList.add('open'); nameInput.focus();
      });
    } else {
      nameInput.value = ''; commandInput.value = ''; descInput.value = ''; categorySelect.value = 'Linux';
      tagsInput.value = ''; exampleInput.value = ''; dangerSelect.value = 'Safe';
      overlay.classList.add('open'); nameInput.focus();
    }
  }
  function closeEditor() { overlay.classList.remove('open'); state.editingId = null; }

  function save() {
    cacheEls();
    var name = nameInput.value.trim();
    var command = commandInput.value.trim();
    if (!name || !command) { (name ? commandInput : nameInput).focus(); return Promise.resolve(); }
    var record = {
      id: state.editingId || DB.uid(), name: name, command: command, description: descInput.value,
      category: categorySelect.value, tags: U.parseTags(tagsInput.value), example: exampleInput.value,
      danger: dangerSelect.value || detectDanger(command), createdAt: new Date().toISOString()
    };
    return DB.put(STORE, record).then(function () { closeEditor(); return render(); }).then(function () { window.VNoteApp.onDataChanged(); });
  }

  commandInput_autoDanger();
  function commandInput_autoDanger() {
    document.addEventListener('input', function (e) {
      if (e.target && e.target.id === 'cmd-command') {
        cacheEls();
        dangerSelect.value = detectDanger(commandInput.value);
      }
    });
  }

  function seedIfEmpty() {
    return getAll().then(function (rows) {
      if (rows.length) return false;
      var now = new Date().toISOString();
      var demo = [
        { name: 'List all pods', command: 'kubectl get pods -A', description: 'Liệt kê pod ở mọi namespace', category: 'Kubernetes', tags: ['k8s'], example: 'kubectl get pods -A' },
        { name: 'Tail service log', command: 'journalctl -u ocs -f', description: 'Xem log realtime của service OCS', category: 'Linux', tags: ['log'], example: '' },
        { name: 'Delete pod', command: 'kubectl delete pod <name>', description: 'Xoá 1 pod theo tên', category: 'Kubernetes', tags: ['k8s'], example: '' },
        { name: 'Restart service', command: 'systemctl restart ocs', description: 'Khởi động lại service OCS', category: 'Linux', tags: [], example: '' },
        { name: 'Cluster health', command: 'curl -s localhost:9200/_cluster/health?pretty', description: 'Kiểm tra tình trạng cluster Elasticsearch', category: 'Elasticsearch', tags: ['health'], example: '' }
      ];
      return Promise.all(demo.map(function (d) {
        return DB.put(STORE, Object.assign({ id: DB.uid(), createdAt: now, danger: detectDanger(d.command) }, d));
      })).then(function () { return true; });
    });
  }

  function clearAll() { return DB.clearStore(STORE); }

  function bindOnce() {
    cacheEls();
    document.getElementById('btn-new-command').addEventListener('click', function () { openEditor(null); });
    document.getElementById('cmd-cancel').addEventListener('click', closeEditor);
    document.getElementById('cmd-save').addEventListener('click', save);
    document.getElementById('cmd-delete').addEventListener('click', function () {
      if (state.editingId) DB.remove(STORE, state.editingId).then(function () { closeEditor(); render(); window.VNoteApp.onDataChanged(); });
      else closeEditor();
    });
    document.getElementById('commands-filter').addEventListener('click', function (e) {
      var chip = e.target.closest('.chip'); if (!chip) return;
      document.querySelectorAll('#commands-filter .chip').forEach(function (c) { c.classList.remove('active'); });
      chip.classList.add('active');
      state.category = chip.dataset.category;
      render();
    });
  }

  return { render: render, openEditor: openEditor, getAll: getAll, seedIfEmpty: seedIfEmpty, clearAll: clearAll, bindOnce: bindOnce, detectDanger: detectDanger, CATEGORIES: CATEGORIES };
})();
