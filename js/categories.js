window.VNoteCategories = (function () {
  'use strict';

  var DB = window.VNoteDB;
  var U = window.VNoteUtil;
  var STORE = 'work_categories';
  var cache = [];

  function getAll() { return DB.getAll(STORE); }
  function getCached() { return cache; }
  function findCached(id) { return cache.find(function (c) { return c.id === id; }); }
  function findCachedByName(name) { return cache.find(function (c) { return c.name === name; }); }

  function refresh() {
    return getAll().then(function (rows) {
      cache = rows.sort(function (a, b) { return (a.order || 0) - (b.order || 0); });
      renderSidebar();
      return cache;
    });
  }

  function seedIfEmpty() {
    return getAll().then(function (rows) {
      if (rows.length) { return refresh().then(function () { return false; }); }
      var names = ['OCS', 'Kubernetes', 'Elasticsearch', 'Linux', 'Telecom', 'CDR', 'Other'];
      return Promise.all(names.map(function (name, i) {
        return DB.put(STORE, { id: DB.uid(), name: name, order: i });
      })).then(function () { return refresh(); }).then(function () { return true; });
    });
  }

  function create(name) {
    name = name.trim();
    if (!name) return Promise.resolve(null);
    var record = { id: DB.uid(), name: name, order: cache.length };
    return DB.put(STORE, record).then(function () { return refresh(); }).then(function () { return record; });
  }

  function rename(id, newName) {
    newName = newName.trim();
    if (!newName) return Promise.resolve();
    var cat = findCached(id);
    if (!cat || cat.name === newName) return Promise.resolve();
    var oldName = cat.name;
    cat.name = newName;
    return DB.put(STORE, cat).then(function () {
      return window.VNoteNotes.getAllActive();
    }).then(function (notes) {
      var affected = notes.filter(function (n) { return n.category === oldName; });
      return Promise.all(affected.map(function (n) {
        n.category = newName;
        return DB.put('notes', n);
      }));
    }).then(function () {
      window.VNoteApp.invalidateView('work-cat-' + id);
      return refresh();
    }).then(function () {
      window.VNoteApp.onDataChanged();
    });
  }

  function remove(id) {
    var cat = findCached(id);
    if (!cat) return Promise.resolve();
    return window.VNoteNotes.getAllActive().then(function (notes) {
      var affected = notes.filter(function (n) { return n.category === cat.name; });
      return Promise.all(affected.map(function (n) {
        n.category = 'General';
        return DB.put('notes', n);
      }));
    }).then(function () {
      return DB.remove(STORE, id);
    }).then(function () {
      window.VNoteApp.invalidateView('work-cat-' + id);
      return refresh();
    }).then(function () {
      window.VNoteApp.onDataChanged();
    });
  }

  /* ---------------- Sidebar rendering ---------------- */

  function renderSidebar() {
    var list = document.getElementById('work-categories-list');
    if (!list) return;
    list.innerHTML = cache.map(function (c) {
      return '<a class="nav-item nav-item--sub" data-view="work-cat-' + c.id + '">' + U.escapeHtml(c.name) + '</a>';
    }).join('');
    var activeView = document.querySelector('.view.active');
    if (activeView) {
      list.querySelectorAll('.nav-item').forEach(function (el) {
        el.classList.toggle('active', el.dataset.view === activeView.dataset.viewId);
      });
    }
  }

  /* ---------------- Manage modal ---------------- */

  function renderManageModal() {
    var list = document.getElementById('work-categories-manage-list');
    list.innerHTML = cache.map(function (c) {
      return '<div class="modal-item" style="cursor:default;">' +
        '<input class="field-input grow cat-rename-input" data-id="' + c.id + '" value="' + U.escapeHtml(c.name) + '">' +
        '<button class="btn btn-sm cat-delete-btn" data-id="' + c.id + '" style="margin-left:8px;">🗑️ Delete</button>' +
        '</div>';
    }).join('');

    list.querySelectorAll('.cat-rename-input').forEach(function (input) {
      input.addEventListener('change', function () { rename(input.dataset.id, input.value); });
      input.addEventListener('keydown', function (e) { if (e.key === 'Enter') input.blur(); });
    });
    list.querySelectorAll('.cat-delete-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var cat = findCached(btn.dataset.id);
        if (!cat) return;
        if (!confirm('Xoá mục "' + cat.name + '"? Các note đang thuộc mục này sẽ chuyển sang "General".')) return;
        remove(btn.dataset.id).then(renderManageModal);
      });
    });
  }

  function openManageModal() {
    renderManageModal();
    document.getElementById('overlay-work-categories').classList.add('open');
    document.getElementById('work-category-new-name').value = '';
  }

  function bindOnce() {
    document.getElementById('work-manage-btn').addEventListener('click', openManageModal);
    document.getElementById('work-categories-close').addEventListener('click', function () {
      document.getElementById('overlay-work-categories').classList.remove('open');
    });
    document.getElementById('work-category-add-btn').addEventListener('click', function () {
      var input = document.getElementById('work-category-new-name');
      create(input.value).then(function (record) {
        input.value = '';
        renderManageModal();
        if (record) window.VNoteApp.showToast('Đã thêm mục "' + record.name + '"');
      });
    });
    document.getElementById('work-category-new-name').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') document.getElementById('work-category-add-btn').click();
    });
  }

  return {
    getAll: getAll, getCached: getCached, findCached: findCached, findCachedByName: findCachedByName,
    refresh: refresh, seedIfEmpty: seedIfEmpty, create: create, rename: rename, remove: remove,
    renderSidebar: renderSidebar, bindOnce: bindOnce
  };
})();
