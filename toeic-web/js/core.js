/* Minimal storage, helpers and app shell for the standalone TOEIC Reading site.
 * Exposes the same globals the test module (toeic.js) expects:
 * VNoteDB (IndexedDB), VNoteUtil (helpers), VNoteApp (toast). */

window.VNoteDB = (function () {
  'use strict';
  var DB_NAME = 'toeic-reading';
  var DB_VERSION = 1;
  var STORES = ['toeic_tests', 'toeic_attempts', 'toeic_files', 'history'];
  var dbPromise = null;

  function open() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise(function (resolve, reject) {
      var req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = function (e) {
        var db = e.target.result;
        STORES.forEach(function (n) { if (!db.objectStoreNames.contains(n)) db.createObjectStore(n, { keyPath: 'id' }); });
      };
      req.onsuccess = function (e) { resolve(e.target.result); };
      req.onerror = function (e) { reject(e.target.error); };
    });
    return dbPromise;
  }
  function store(name, mode) { return open().then(function (db) { return db.transaction(name, mode).objectStore(name); }); }
  function wrap(req) {
    return new Promise(function (resolve, reject) {
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    });
  }
  return {
    getAll: function (n) { return store(n, 'readonly').then(function (s) { return wrap(s.getAll()); }); },
    get: function (n, id) { return store(n, 'readonly').then(function (s) { return wrap(s.get(id)); }); },
    put: function (n, v) { return store(n, 'readwrite').then(function (s) { return wrap(s.put(v)); }); },
    remove: function (n, id) { return store(n, 'readwrite').then(function (s) { return wrap(s.delete(id)); }); },
    uid: function () { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
  };
})();

window.VNoteUtil = (function () {
  'use strict';
  return {
    escapeHtml: function (str) {
      return String(str == null ? '' : str).replace(/[&<>"']/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
      });
    },
    formatDate: function (iso) {
      if (!iso) return '';
      var d = new Date(iso);
      if (isNaN(d.getTime())) return '';
      return d.toLocaleDateString('vi-VN') + ' ' + d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    }
  };
})();

window.VNoteApp = (function () {
  'use strict';
  var toastEl, timer;
  function showToast(msg) {
    toastEl = toastEl || document.getElementById('toast');
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(timer);
    timer = setTimeout(function () { toastEl.classList.remove('show'); }, 2400);
  }

  /* ---- theme ---- */
  function applyTheme(t) {
    if (t) document.documentElement.setAttribute('data-theme', t);
    else document.documentElement.removeAttribute('data-theme');
  }
  function currentTheme() {
    var t = document.documentElement.getAttribute('data-theme');
    if (t) return t;
    return window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  try { applyTheme(localStorage.getItem('toeic-theme')); } catch (e) { /* storage blocked */ }

  /* ---- backup: tests (answer keys) + attempts, without local PDF blobs ---- */
  function exportBackup() {
    var DB = window.VNoteDB;
    Promise.all([DB.getAll('toeic_tests'), DB.getAll('toeic_attempts')]).then(function (r) {
      var dump = { app: 'toeic-reading', exportedAt: new Date().toISOString(), toeic_tests: r[0], toeic_attempts: r[1] };
      var blob = new Blob([JSON.stringify(dump, null, 2)], { type: 'application/json' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'toeic-reading-backup-' + new Date().toISOString().slice(0, 10) + '.json';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
      showToast('Đã xuất bản sao lưu');
    });
  }
  function importBackup(file) {
    var DB = window.VNoteDB;
    file.text().then(function (txt) {
      var dump = JSON.parse(txt);
      if (!dump || dump.app !== 'toeic-reading') throw new Error('File không phải bản sao lưu TOEIC Reading');
      var writes = [];
      (dump.toeic_tests || []).forEach(function (t) { writes.push(DB.put('toeic_tests', t)); });
      (dump.toeic_attempts || []).forEach(function (a) { writes.push(DB.put('toeic_attempts', a)); });
      return Promise.all(writes).then(function () { return writes.length; });
    }).then(function (n) {
      showToast('Đã khôi phục ' + n + ' mục');
      window.VNoteToeic.render();
    }).catch(function (err) { showToast('Không khôi phục được: ' + err.message); });
  }

  document.addEventListener('DOMContentLoaded', function () {
    document.getElementById('btn-theme').addEventListener('click', function () {
      var next = currentTheme() === 'dark' ? 'light' : 'dark';
      applyTheme(next);
      try { localStorage.setItem('toeic-theme', next); } catch (e) { /* ignore */ }
    });
    document.getElementById('btn-export').addEventListener('click', exportBackup);
    var input = document.getElementById('import-file');
    document.getElementById('btn-import').addEventListener('click', function () { input.click(); });
    input.addEventListener('change', function () { if (input.files[0]) importBackup(input.files[0]); input.value = ''; });
    document.getElementById('brand').addEventListener('click', function () { window.VNoteToeic.home(); });

    // Close dialogs on backdrop click / Esc.
    document.addEventListener('click', function (e) {
      if (e.target.classList && e.target.classList.contains('overlay')) e.target.classList.remove('open');
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') document.querySelectorAll('.overlay.open').forEach(function (o) { o.classList.remove('open'); });
    });

    window.VNoteToeic.render();
  });

  return { showToast: showToast };
})();
