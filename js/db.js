window.VNoteDB = (function () {
  'use strict';

  var DB_NAME = 'vnote-ultra';
  var DB_VERSION = 2;
  var RECORD_STORES = ['notes', 'tasks', 'projects', 'commands', 'snippets', 'troubleshooting', 'flashcards', 'tags', 'history', 'note_versions'];

  var dbPromise = null;

  function open() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise(function (resolve, reject) {
      var req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = function (e) {
        var db = e.target.result;
        RECORD_STORES.forEach(function (name) {
          if (!db.objectStoreNames.contains(name)) {
            db.createObjectStore(name, { keyPath: 'id' });
          }
        });
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }
      };
      req.onsuccess = function (e) { resolve(e.target.result); };
      req.onerror = function (e) { reject(e.target.error); };
    });
    return dbPromise;
  }

  function store(storeName, mode) {
    return open().then(function (db) {
      return db.transaction(storeName, mode).objectStore(storeName);
    });
  }

  function reqToPromise(req) {
    return new Promise(function (resolve, reject) {
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    });
  }

  function getAll(storeName) {
    return store(storeName, 'readonly').then(function (s) { return reqToPromise(s.getAll()); });
  }
  function get(storeName, id) {
    return store(storeName, 'readonly').then(function (s) { return reqToPromise(s.get(id)); });
  }
  function put(storeName, value) {
    return store(storeName, 'readwrite').then(function (s) { return reqToPromise(s.put(value)); });
  }
  function remove(storeName, id) {
    return store(storeName, 'readwrite').then(function (s) { return reqToPromise(s.delete(id)); });
  }
  function clearStore(storeName) {
    return store(storeName, 'readwrite').then(function (s) { return reqToPromise(s.clear()); });
  }

  function getSetting(key, fallback) {
    return get('settings', key).then(function (row) { return row ? row.value : fallback; });
  }
  function setSetting(key, value) {
    return put('settings', { key: key, value: value });
  }

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function exportAll() {
    var stores = RECORD_STORES.concat(['settings']);
    return Promise.all(stores.map(getAll)).then(function (results) {
      var dump = { app: 'vnote-ultra', version: DB_VERSION, exportedAt: new Date().toISOString(), data: {} };
      stores.forEach(function (name, i) { dump.data[name] = results[i]; });
      return dump;
    });
  }

  function importAll(dump, opts) {
    opts = opts || {};
    var freshIds = opts.freshIds !== false;
    if (!dump || !dump.data) return Promise.reject(new Error('Invalid backup file'));
    var stores = Object.keys(dump.data).filter(function (name) {
      return RECORD_STORES.concat(['settings']).indexOf(name) !== -1;
    });
    var writes = [];
    stores.forEach(function (name) {
      (dump.data[name] || []).forEach(function (row) {
        if (name !== 'settings' && freshIds) {
          row = Object.assign({}, row, { id: uid() });
        }
        writes.push(put(name, row));
      });
    });
    return Promise.all(writes);
  }

  return {
    open: open,
    getAll: getAll,
    get: get,
    put: put,
    remove: remove,
    clearStore: clearStore,
    getSetting: getSetting,
    setSetting: setSetting,
    uid: uid,
    exportAll: exportAll,
    importAll: importAll,
    RECORD_STORES: RECORD_STORES
  };
})();
