window.VNoteFlashcards = (function () {
  'use strict';

  var DB = window.VNoteDB;
  var U = window.VNoteUtil;
  var STORE = 'flashcards';
  var state = { editingId: null, currentReviewId: null, showingAnswer: false };
  var INTERVAL_DAYS = [0, 1, 3, 7, 14];

  function todayStr() { return window.VNoteTasks.todayStr(); }
  function getAll() { return DB.getAll(STORE); }

  function isDue(card) { return !card.nextReview || card.nextReview <= todayStr(); }

  function render() {
    return getAll().then(function (rows) {
      var due = rows.filter(isDue);
      renderReviewCard(due[0] || null, rows.length);
      renderStudyDashboard(rows, due);
      renderCardList(rows);
      return rows;
    });
  }

  function renderReviewCard(card, total) {
    var box = document.getElementById('flashcard-review-box');
    if (!total) {
      box.innerHTML = '<div class="empty-state"><div class="empty-icon">🎴</div><h3>Chưa có flashcard nào</h3><p>Tạo flashcard đầu tiên để bắt đầu học.</p><button class="btn btn-primary" id="btn-new-flashcard-empty">＋ New Card</button></div>';
      var btn = document.getElementById('btn-new-flashcard-empty');
      if (btn) btn.addEventListener('click', function () { openEditor(null); });
      return;
    }
    if (!card) {
      box.innerHTML = '<div class="empty-state"><div class="empty-icon">🎉</div><h3>Hết thẻ cần ôn hôm nay</h3><p>Quay lại vào ngày mai, hoặc thêm flashcard mới.</p></div>';
      return;
    }
    state.currentReviewId = card.id;
    box.innerHTML =
      '<span class="badge badge-accent" style="margin-bottom:14px;">' + U.escapeHtml(card.category || 'General') + '</span>' +
      '<h2 style="margin:8px 0 20px;">' + U.escapeHtml(card.question) + '</h2>' +
      (state.showingAnswer
        ? '<p style="color:var(--text-secondary); margin-bottom:20px; white-space:pre-wrap;">' + U.escapeHtml(card.answer) + '</p>' +
          '<div class="toolbar" style="justify-content:center;">' +
          '<button class="btn btn-sm" data-grade="again">Again</button>' +
          '<button class="btn btn-sm" data-grade="hard">Hard</button>' +
          '<button class="btn btn-sm" data-grade="good">Good</button>' +
          '<button class="btn btn-sm" data-grade="easy">Easy</button>' +
          '</div>'
        : '<button class="btn" id="btn-show-answer">Show Answer</button>');

    if (!state.showingAnswer) {
      document.getElementById('btn-show-answer').addEventListener('click', function () {
        state.showingAnswer = true;
        render();
      });
    } else {
      box.querySelectorAll('[data-grade]').forEach(function (el) {
        el.addEventListener('click', function () { grade(card, el.dataset.grade); });
      });
    }
  }

  function grade(card, level) {
    var box = card.box || 1;
    if (level === 'again') box = 1;
    else if (level === 'hard') box = Math.max(1, box - 1);
    else if (level === 'good') box = Math.min(5, box + 1);
    else box = Math.min(5, box + 2);

    var days = INTERVAL_DAYS[box - 1] || 0;
    var next = new Date(Date.now() + days * 86400000);
    card.box = box;
    card.nextReview = next.getFullYear() + '-' + String(next.getMonth() + 1).padStart(2, '0') + '-' + String(next.getDate()).padStart(2, '0');
    card.reviewStatus = box >= 4 ? 'Learned' : 'Learning';

    bumpReviewedToday().then(function () {
      return DB.put(STORE, card);
    }).then(function () {
      state.showingAnswer = false;
      render();
    });
  }

  function bumpReviewedToday() {
    var key = 'flashcards.reviewedToday';
    return DB.getSetting(key, { date: '', count: 0 }).then(function (v) {
      var today = todayStr();
      if (v.date !== today) v = { date: today, count: 0 };
      v.count += 1;
      return DB.setSetting(key, v);
    });
  }

  function renderStudyDashboard(rows, due) {
    var el = document.getElementById('flashcard-study-stats');
    if (!el) return;
    DB.getSetting('flashcards.reviewedToday', { date: '', count: 0 }).then(function (v) {
      var reviewedToday = v.date === todayStr() ? v.count : 0;
      var categories = {};
      rows.forEach(function (c) { categories[c.category || 'General'] = categories[c.category || 'General'] || { learned: 0, total: 0 }; });
      rows.forEach(function (c) {
        var cat = categories[c.category || 'General'];
        cat.total++;
        if ((c.box || 1) >= 4) cat.learned++;
      });
      var learnedTopics = Object.keys(categories).filter(function (k) { return categories[k].learned === categories[k].total && categories[k].total > 0; }).length;
      var needReview = due.length;
      el.innerHTML =
        '<li class="list-row"><span class="title">Cards reviewed today</span><span class="meta">' + reviewedToday + '</span></li>' +
        '<li class="list-row"><span class="title">Total cards</span><span class="meta">' + rows.length + '</span></li>' +
        '<li class="list-row"><span class="title">Topics learned</span><span class="meta">' + learnedTopics + '</span></li>' +
        '<li class="list-row"><span class="title">Cards needing review</span><span class="meta">' + needReview + '</span></li>';
    });
  }

  function renderCardList(rows) {
    var body = document.getElementById('flashcards-tbody');
    if (!body) return;
    body.innerHTML = rows.map(function (c) {
      return '<tr><td><a class="fc-open" data-id="' + c.id + '">' + U.escapeHtml(c.question) + '</a></td>' +
        '<td>' + U.escapeHtml(c.category || '') + '</td>' +
        '<td><span class="badge">' + U.escapeHtml(c.difficulty || 'Medium') + '</span></td>' +
        '<td>' + U.escapeHtml(c.reviewStatus || 'New') + '</td>' +
        '<td>' + U.escapeHtml(c.nextReview || '—') + '</td>' +
        '<td><button class="btn btn-sm fc-trash" data-id="' + c.id + '">🗑️</button></td></tr>';
    }).join('');
    body.querySelectorAll('.fc-open').forEach(function (el) { el.addEventListener('click', function () { openEditor(el.dataset.id); }); });
    body.querySelectorAll('.fc-trash').forEach(function (el) { el.addEventListener('click', function (e) { e.stopPropagation(); DB.remove(STORE, el.dataset.id).then(render); }); });
  }

  var overlay, questionInput, answerInput, categoryInput, tagsInput, difficultySelect;
  function cacheEls() {
    overlay = document.getElementById('overlay-flashcard-editor');
    questionInput = document.getElementById('fc-question');
    answerInput = document.getElementById('fc-answer');
    categoryInput = document.getElementById('fc-category');
    tagsInput = document.getElementById('fc-tags');
    difficultySelect = document.getElementById('fc-difficulty');
  }

  function openEditor(id) {
    cacheEls();
    state.editingId = id || null;
    if (id) {
      DB.get(STORE, id).then(function (c) {
        if (!c) return;
        questionInput.value = c.question || ''; answerInput.value = c.answer || ''; categoryInput.value = c.category || '';
        tagsInput.value = (c.tags || []).join(', '); difficultySelect.value = c.difficulty || 'Medium';
        overlay.classList.add('open'); questionInput.focus();
      });
    } else {
      questionInput.value = ''; answerInput.value = ''; categoryInput.value = ''; tagsInput.value = ''; difficultySelect.value = 'Medium';
      overlay.classList.add('open'); questionInput.focus();
    }
  }
  function closeEditor() { overlay.classList.remove('open'); state.editingId = null; }

  function save() {
    cacheEls();
    var q = questionInput.value.trim();
    if (!q) { questionInput.focus(); return Promise.resolve(); }
    var now = new Date().toISOString();
    var record = {
      id: state.editingId || DB.uid(), question: q, answer: answerInput.value, category: categoryInput.value || 'General',
      tags: U.parseTags(tagsInput.value), difficulty: difficultySelect.value, box: 1, reviewStatus: 'New', createdAt: now
    };
    var chain = state.editingId ? DB.get(STORE, state.editingId) : Promise.resolve(null);
    return chain.then(function (existing) {
      if (existing) record = Object.assign({}, existing, record, { box: existing.box, reviewStatus: existing.reviewStatus, nextReview: existing.nextReview });
      return DB.put(STORE, record);
    }).then(function () { closeEditor(); return render(); }).then(function () { window.VNoteApp.onDataChanged(); });
  }

  function seedIfEmpty() {
    return getAll().then(function (rows) {
      if (rows.length) return false;
      var now = new Date().toISOString();
      var demo = [
        { question: 'What does `kubectl rollout restart` do?', answer: 'Restarts all pods of a deployment one by one, without downtime.', category: 'Kubernetes', difficulty: 'Easy' },
        { question: 'What is CCR/CCA in Diameter?', answer: 'Credit-Control-Request / Answer — used by OCS to authorize and charge sessions.', category: 'OCS', difficulty: 'Medium' },
        { question: 'What does an Elasticsearch yellow cluster status mean?', answer: 'All primary shards are allocated, but some replica shards are not.', category: 'Elasticsearch', difficulty: 'Medium' }
      ];
      return Promise.all(demo.map(function (d) {
        return DB.put(STORE, Object.assign({ id: DB.uid(), tags: [], box: 1, reviewStatus: 'New', createdAt: now }, d));
      })).then(function () { return true; });
    });
  }

  function clearAll() { return DB.clearStore(STORE); }

  function bindOnce() {
    cacheEls();
    document.getElementById('btn-new-flashcard').addEventListener('click', function () { openEditor(null); });
    document.getElementById('fc-cancel').addEventListener('click', closeEditor);
    document.getElementById('fc-save').addEventListener('click', save);
    document.getElementById('fc-delete').addEventListener('click', function () {
      if (state.editingId) DB.remove(STORE, state.editingId).then(function () { closeEditor(); render(); window.VNoteApp.onDataChanged(); });
      else closeEditor();
    });
  }

  return { render: render, openEditor: openEditor, getAll: getAll, seedIfEmpty: seedIfEmpty, clearAll: clearAll, bindOnce: bindOnce };
})();
