/*
 * TOEIC Reading test runner (Part 5–7, questions 101–200).
 *
 * The test books themselves are NOT copied into this app: each test points at a
 * PDF the user already has (a Google Drive file, embedded through Drive's
 * /preview viewer, or a local PDF stored in IndexedDB). The app supplies the
 * exam experience around it: answer sheet, countdown timer, autosave/resume,
 * scoring against an answer key the user enters, per-part breakdown, review
 * and attempt history.
 */
window.VNoteToeic = (function () {
  'use strict';

  var DB = window.VNoteDB;
  var U = window.VNoteUtil;
  var TESTS = 'toeic_tests';
  var ATTEMPTS = 'toeic_attempts';
  var FILES = 'toeic_files';
  var OPTIONS = ['A', 'B', 'C', 'D'];

  var PARTS = [
    { part: 5, from: 101, to: 130, label: 'Part 5 · Incomplete Sentences' },
    { part: 6, from: 131, to: 146, label: 'Part 6 · Text Completion' },
    { part: 7, from: 147, to: 200, label: 'Part 7 · Reading Comprehension' }
  ];

  var MODES = {
    full: { label: 'Full Reading (101–200)', from: 101, to: 200, minutes: 75 },
    p5: { label: 'Part 5 (101–130)', from: 101, to: 130, minutes: 15 },
    p6: { label: 'Part 6 (131–146)', from: 131, to: 146, minutes: 10 },
    p7: { label: 'Part 7 (147–200)', from: 147, to: 200, minutes: 55 }
  };

  // Tests from the shared Google Drive folders. Only file ids are stored here;
  // the content stays in Drive and is shown through Drive's own viewer.
  // Fields: set, n (test number), drive (PDF id), keyImg (answer-key image id),
  // full (PDF also contains the Listening part, so Reading starts mid-file).
  var SETS = {
    'ETS 2024': 'https://drive.google.com/drive/folders/1raFiG1EglJBeBOeR-ZOHSB0HaBobZcO7',
    'ETS 2023': 'https://drive.google.com/drive/folders/1sQOQVt2ZERpOyAK-VTG_VTJjsuCti8UB',
    'ETS 2022': 'https://drive.google.com/drive/folders/1NQBarMKQBfQYgl3jYpfMMTE-6rQJQ1xS'
  };
  var NOTE_FULL = 'File gồm cả Listening — cuộn xuống trang READING TEST (Part 5, câu 101) để bắt đầu.';
  var BUILTIN = [
    { set: 'ETS 2024', n: 1, drive: '1Ui8fHZggVXv9O4qwykCmcm_Cnef2Rxfz' },
    { set: 'ETS 2024', n: 2, drive: '1wuXjH-Xjeo4Z5FCJ_QUpRbJjqllXYoYR' },
    { set: 'ETS 2024', n: 3, drive: '1DNq75hm_RmMALqOgVoSm4lgEt60Nngix' },
    { set: 'ETS 2024', n: 4, drive: '1B1178RLdo5eqT-y_BGmsY3eAmUnO6PAN' },
    { set: 'ETS 2024', n: 5, drive: '1V6CmirhNgZt7_kduLNs5tRwCf_THoGm6' },
    { set: 'ETS 2024', n: 6, drive: '1OAeVzg8fp320VvPD4VrhMTMPwagzcLS_' },
    { set: 'ETS 2024', n: 7, drive: '1a-lCLQuLKyIQDa6W3Xx0qpa-6OvjP9JN' },
    { set: 'ETS 2024', n: 8, drive: '1QKruG4-ffEOJWFtSOFz8evuZ1oZ_vdN7' },
    { set: 'ETS 2024', n: 9, drive: '1eVg-f7xZttTjl6XYDOaLE-pBuN9NDTqV' },
    { set: 'ETS 2024', n: 10, drive: '1BMPqGApam4oCCbgk-li0Wx-dm2qODrLb' },
    { set: 'ETS 2024', name: 'ETS 2024 · Reading (sách đầy đủ)', drive: '1cdubYVE5vl2_nRuaqggT0MwXS4s86PsG', note: 'Sách gồm nhiều đề — cuộn PDF tới đề bạn muốn làm.' },

    { set: 'ETS 2023', n: 1, drive: '16qYVEiNRuEdDWgRvErY3BUF1yXLaUOHJ', keyImg: '1r14gNAzuF0-HlQCBu4MY4OaTgdR66XNS', full: true },
    { set: 'ETS 2023', n: 2, drive: '1uNvDZNGXybnoTWJUN3MmueemHA9eoZTW', keyImg: '1vCeaele6Euh-GZpBj0QHX726S8y0hl5A', full: true },
    { set: 'ETS 2023', n: 3, drive: '1jqIJ6J19sOUhTqnwBCdXnd3ei2FQccoo', keyImg: '15aNFON3oyYUN4V19Y7AitTwOHXErHjxr', full: true },
    { set: 'ETS 2023', n: 4, drive: '1YPMKKy-1V-Yxkjg6WL3vx_UhLjCd2KhV', keyImg: '1RjsOz0XtzpJEfxXi-7xjhHRbeOGwajN1', full: true },
    { set: 'ETS 2023', n: 5, drive: '1dICFpFwi8k0vJk59Z8Hgafkaeqf2TkmY', keyImg: '1WKZ9QwP3Cr-YeHoBrPSOEnWYfZbQ84FS', full: true },
    { set: 'ETS 2023', n: 6, drive: '1AKXbMgUoQW7D9tHrdoTaMMEc4r6d_eGD', keyImg: '1qHEZnDm3ibX3FpCsFHj4mcbEc32z_hal', full: true },
    { set: 'ETS 2023', n: 7, drive: '1k0X_UVYumKQ9qx-nqVByaRrq0ChSn6iL', keyImg: '1Fl0rtzRnatF58Mlit0Q6rf38eDjKtAFf', full: true },
    { set: 'ETS 2023', n: 8, drive: '1Ax_mJh6K5laajGL5HX6H9L2GLHVmi4qZ', keyImg: '1daAy5ZCascaJ8qg70OodpaWwWfyQCey8', full: true },
    { set: 'ETS 2023', n: 9, drive: '1FP0rSz2HACFibmW3ifLRSGnXT_tz8Wj3', keyImg: '1o7eDTGPj15fY5QAbpI7LM3Qt4NKzdpXa', full: true },
    { set: 'ETS 2023', n: 10, drive: '1gMaMkE9iKG1Kqckyw7lHv9ZyknUzLz90', keyImg: '1uDw2ow5rcsEJuwFohoXh3Uw4kIGgOdcP', full: true },
    { set: 'ETS 2023', name: 'ETS 2023 · Reading (sách RC đầy đủ)', drive: '1YK36D4ZBmGvSkFFkM-z_x6Xu93MLNdAU', note: 'Sách RC gồm 10 đề — cuộn PDF tới đề muốn làm. Đáp án có sẵn ở từng đề lẻ phía trên.' },

    { set: 'ETS 2022', n: 1, drive: '1Bylfa9G4C8foBpYKyJ6Ugun72e53BKd2', keyImg: '1jsxVGhph5p_OraUvHAJHaZKRnW5MCMae', full: true },
    { set: 'ETS 2022', n: 2, drive: '1WJNUPjXAlN-0LV0MtLh2nue3vDR7CIbh', keyImg: '1a1TUK4RHQNmoFTq9WkWNUzRgsO7wWyZo', full: true },
    { set: 'ETS 2022', n: 3, drive: '17rMleDnz3g3nM4UPV4tCn-EPa-8ympDd', keyImg: '12UtSGzhgSOwQvTvf6XvUgIkxXTVJRgeQ', full: true },
    { set: 'ETS 2022', n: 4, drive: '1De4e8lGtyHQ9HWM8nuh0NdBDCr51Gl-8', keyImg: '1sNiRk2Lt5yiiwOF88S3OxdBiAbl9FiFa', full: true },
    { set: 'ETS 2022', n: 5, drive: '1z7NtB6xCsC6y7w7hYGhsRJXlyAI9gq1h', keyImg: '1yPp5kf2_h8ZR52VL9xnYt69ZdSYlJBkz', full: true },
    { set: 'ETS 2022', n: 6, drive: '164s_IPua99RblDO1ETEHTgbKQk2vQax9', keyImg: '1rJkcW1_JgQjOZIba3PdGtbmW_taz0-iw', full: true },
    { set: 'ETS 2022', n: 7, drive: '1sbYbfLDm56O5gsw7TE-G-H5igIAJbCC1', keyImg: '1LvwDP9lSwWZoItillUseaBXmnWiLx0B8', full: true },
    { set: 'ETS 2022', n: 8, drive: '13l51L2M3n5rfIiCahiwpmWNyjrBMYNl6', keyImg: '1lyWJokzMoPD7f8o7CnQTspzg-fPRxqYu', full: true },
    { set: 'ETS 2022', n: 9, drive: '1wzqbS7gMBwyhh_7eDN6X2XoWixLrfj_z', keyImg: '1fJgoMnTebmxxNcsl331s_PzR7DUMYb68', full: true },
    { set: 'ETS 2022', n: 10, drive: '11lu4XEDgn8W9ETUap3qk9_W3T-GjiK5L', keyImg: '1kKEHwpyUbp5Ii8uVrfIc7RhgzR04fZfr', full: true }
  ];

  function bundledKey(b) {
    var str = b.n && window.VNoteToeicKeys && window.VNoteToeicKeys[b.set.replace('ETS ', '') + '-' + b.n];
    var key = {};
    if (str) for (var i = 0; i < str.length && i < 100; i++) key[101 + i] = str[i];
    return key;
  }

  // Approximate raw→scaled conversion for the Reading section (estimate only;
  // the real ETS conversion varies per test form).
  var READING_SCALE = [5, 15, 30, 55, 80, 105, 130, 155, 180, 205, 230, 255, 280, 305, 330, 360, 385, 415, 440, 470, 495];

  var state = {
    screen: 'list',      // list | exam | result
    attempt: null,
    test: null,
    current: null,       // currently focused question number
    timer: null,
    tickCount: 0,
    reviewFilter: 'all',
    objectUrls: {}
  };

  /* ---------------------------------------------------------------- */
  /* Helpers                                                           */
  /* ---------------------------------------------------------------- */

  function toast(msg) { if (window.VNoteApp) window.VNoteApp.showToast(msg); }
  function el(id) { return document.getElementById(id); }
  function root() { return el('toeic-root'); }
  function viewActive() {
    var v = document.querySelector('.view[data-view-id="toeic"]');
    return !!(v && v.classList.contains('active'));
  }

  function partOf(q) {
    for (var i = 0; i < PARTS.length; i++) if (q >= PARTS[i].from && q <= PARTS[i].to) return PARTS[i].part;
    return null;
  }

  function range(from, to) { var a = []; for (var i = from; i <= to; i++) a.push(i); return a; }

  function fmtClock(sec) {
    sec = Math.max(0, Math.floor(sec));
    var h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    var mm = (m < 10 ? '0' : '') + m, ss = (s < 10 ? '0' : '') + s;
    return h ? h + ':' + mm + ':' + ss : mm + ':' + ss;
  }

  function keyCount(test) { return test && test.answerKey ? Object.keys(test.answerKey).length : 0; }

  function estimateReading(correct) {
    var c = Math.max(0, Math.min(100, correct));
    var i = Math.floor(c / 5), r = (c % 5) / 5;
    var lo = READING_SCALE[i], hi = READING_SCALE[Math.min(i + 1, READING_SCALE.length - 1)];
    return Math.round((lo + (hi - lo) * r) / 5) * 5;
  }

  function extractDriveId(input) {
    var s = String(input || '').trim();
    var m = s.match(/\/d\/([A-Za-z0-9_-]{10,})/) || s.match(/[?&]id=([A-Za-z0-9_-]{10,})/);
    if (m) return m[1];
    return /^[A-Za-z0-9_-]{10,}$/.test(s) ? s : null;
  }

  /**
   * Parse an answer key. Accepts:
   *  - numbered pairs: "101 B, 102.D 103) A" or "1A 2C ..." (1–100 is shifted to 101–200)
   *  - a bare letter sequence: "BDACB..." assigned in order starting at `start`.
   */
  function parseKey(text, start) {
    var key = {};
    var s = String(text || '').toUpperCase();
    var re = /(\d{1,3})\s*[.):\-]?\s*\(?([ABCD])\)?(?![A-Z])/g, m, pairs = [];
    while ((m = re.exec(s))) pairs.push([parseInt(m[1], 10), m[2]]);
    if (pairs.length) {
      var allLow = pairs.every(function (p) { return p[0] <= 100; });
      pairs.forEach(function (p) {
        var q = allLow ? p[0] + 100 : p[0];
        if (q >= 101 && q <= 200) key[q] = p[1];
      });
      return key;
    }
    var letters = s.replace(/[^ABCD]/g, '');
    var q0 = parseInt(start, 10) || 101;
    for (var i = 0; i < letters.length && q0 + i <= 200; i++) key[q0 + i] = letters[i];
    return key;
  }

  function keyToText(key) {
    return range(101, 200).filter(function (q) { return key && key[q]; }).map(function (q) { return q + key[q]; })
      .reduce(function (lines, item, i) {
        if (i % 10 === 0) lines.push([]);
        lines[lines.length - 1].push(item);
        return lines;
      }, []).map(function (l) { return l.join(' '); }).join('\n');
  }

  function score(attempt, test) {
    var key = (test && test.answerKey) || {};
    var qs = range(attempt.from, attempt.to);
    var res = { correct: 0, wrong: 0, blank: 0, keyed: 0, total: qs.length, byPart: {} };
    PARTS.forEach(function (p) { res.byPart[p.part] = { correct: 0, total: 0, keyed: 0 }; });
    qs.forEach(function (q) {
      var bp = res.byPart[partOf(q)];
      bp.total++;
      var ans = attempt.answers[q];
      if (!ans) res.blank++;
      if (!key[q]) return;
      res.keyed++; bp.keyed++;
      if (ans === key[q]) { res.correct++; bp.correct++; } else if (ans) res.wrong++;
    });
    return res;
  }

  function pdfSrc(test) {
    if (test.driveId) return Promise.resolve('https://drive.google.com/file/d/' + encodeURIComponent(test.driveId) + '/preview');
    if (test.fileId) {
      if (state.objectUrls[test.fileId]) return Promise.resolve(state.objectUrls[test.fileId]);
      return DB.get(FILES, test.fileId).then(function (row) {
        if (!row || !row.blob) return null;
        var url = URL.createObjectURL(row.blob);
        state.objectUrls[test.fileId] = url;
        return url;
      });
    }
    return Promise.resolve(null);
  }

  function openUrl(test) {
    return test.driveId ? 'https://drive.google.com/file/d/' + encodeURIComponent(test.driveId) + '/view' : null;
  }

  /* ---------------------------------------------------------------- */
  /* Data                                                              */
  /* ---------------------------------------------------------------- */

  function ensureBuiltins() {
    return DB.getAll(TESTS).then(function (rows) {
      var have = {};
      rows.forEach(function (r) { have[r.id] = r; });
      var now = new Date().toISOString();
      var writes = [];
      BUILTIN.forEach(function (b, i) {
        var id = 'drive-' + b.drive;
        var meta = {
          name: b.name || (b.set + ' · Test ' + b.n), set: b.set, driveId: b.drive, keyImg: b.keyImg || null,
          note: b.note || (b.full ? NOTE_FULL : ''), builtin: true, order: i
        };
        var row = have[id];
        if (!row) {
          var key = bundledKey(b);
          writes.push(DB.put(TESTS, Object.assign({ id: id, answerKey: key, keySource: keyCount({ answerKey: key }) ? 'bundled' : null, createdAt: now, updatedAt: now }, meta)));
          return;
        }
        // Refresh catalog metadata; fill in a bundled key only if the user has none.
        var changed = Object.keys(meta).some(function (k) { return row[k] !== meta[k]; });
        Object.assign(row, meta);
        if (!keyCount(row)) {
          var k2 = bundledKey(b);
          if (keyCount({ answerKey: k2 })) { row.answerKey = k2; row.keySource = 'bundled'; changed = true; }
        }
        if (changed) writes.push(DB.put(TESTS, row));
      });
      return Promise.all(writes);
    });
  }

  function loadAll() {
    return ensureBuiltins().then(function () {
      return Promise.all([DB.getAll(TESTS), DB.getAll(ATTEMPTS)]);
    }).then(function (res) {
      var tests = res[0].sort(function (a, b) {
        if (!!a.builtin !== !!b.builtin) return a.builtin ? -1 : 1;
        return (a.order != null && b.order != null) ? a.order - b.order : (a.createdAt || '').localeCompare(b.createdAt || '');
      });
      var attempts = res[1].sort(function (a, b) { return (b.startedAt || '').localeCompare(a.startedAt || ''); });
      return { tests: tests, attempts: attempts };
    });
  }

  function saveAttempt() {
    if (!state.attempt) return Promise.resolve();
    state.attempt.updatedAt = new Date().toISOString();
    return DB.put(ATTEMPTS, state.attempt);
  }

  /* ---------------------------------------------------------------- */
  /* List screen                                                       */
  /* ---------------------------------------------------------------- */

  function render() {
    if (state.screen !== 'list') return Promise.resolve();
    return renderList();
  }

  function renderList() {
    state.screen = 'list';
    stopTimer();
    return loadAll().then(function (data) {
      var byTest = {};
      data.tests.forEach(function (t) { byTest[t.id] = t; });
      var inProgress = data.attempts.filter(function (a) { return a.status === 'in-progress' && byTest[a.testId]; });
      var done = data.attempts.filter(function (a) { return a.status === 'done' && byTest[a.testId]; });

      var resumeHtml = inProgress.map(function (a) {
        var t = byTest[a.testId];
        var answered = Object.keys(a.answers || {}).length;
        return '<div class="toeic-resume card">' +
          '<div><strong>⏸ Đang làm dở:</strong> ' + U.escapeHtml(t.name) + ' · ' + U.escapeHtml(MODES[a.mode].label) +
          ' <span class="toeic-muted">— đã trả lời ' + answered + '/' + (a.to - a.from + 1) + ', đã dùng ' + fmtClock(a.elapsedSec || 0) + '</span></div>' +
          '<div class="toolbar" style="margin:0;"><button class="btn btn-sm btn-primary" data-toeic-resume="' + a.id + '">▶ Tiếp tục</button>' +
          '<button class="btn btn-sm" data-toeic-discard="' + a.id + '">Bỏ</button></div></div>';
      }).join('');

      function card(t) {
        var attempts = done.filter(function (a) { return a.testId === t.id; });
        var best = null;
        attempts.forEach(function (a) {
          var sc = score(a, t);
          if (sc.keyed && (best === null || sc.correct / sc.keyed > best.ratio)) best = { ratio: sc.correct / sc.keyed, text: sc.correct + '/' + sc.keyed };
        });
        var kc = keyCount(t);
        var keyBadge = kc
          ? '<span class="badge badge-success">✓ Đáp án ' + kc + ' câu' + (t.keySource === 'bundled' ? ' (có sẵn)' : '') + '</span>'
          : '<span class="badge badge-warning">Chưa có đáp án</span>';
        var src = t.driveId ? '<span class="badge badge-accent">Google Drive</span>' : '<span class="badge">PDF máy</span>';
        var modeOpts = Object.keys(MODES).map(function (k) { return '<option value="' + k + '">' + MODES[k].label + '</option>'; }).join('');
        var link = openUrl(t);
        return '<div class="card toeic-test-card">' +
          '<div class="toeic-test-head"><div class="toeic-test-name">' + U.escapeHtml(t.name) + '</div>' + src + '</div>' +
          (t.note ? '<div class="toeic-muted toeic-small">' + U.escapeHtml(t.note) + '</div>' : '') +
          '<div class="toeic-test-meta">' + keyBadge +
          '<span class="toeic-muted toeic-small">' + attempts.length + ' lần làm' + (best ? ' · cao nhất ' + best.text : '') + '</span></div>' +
          '<div class="toeic-test-actions">' +
          '<select class="field-input" data-toeic-mode="' + t.id + '">' + modeOpts + '</select>' +
          '<button class="btn btn-primary btn-sm" data-toeic-start="' + t.id + '">▶ Bắt đầu</button>' +
          '</div>' +
          '<div class="toeic-test-links">' +
          '<a class="toeic-link" data-toeic-key="' + t.id + '">🔑 ' + (kc ? 'Sửa đáp án' : 'Nhập đáp án') + '</a>' +
          (link ? '<a class="toeic-link" href="' + link + '" target="_blank" rel="noopener">↗ Mở PDF</a>' : '') +
          (t.builtin ? '' : '<a class="toeic-link toeic-link-danger" data-toeic-delete="' + t.id + '">🗑 Xoá</a>') +
          '</div></div>';
      }

      // Group cards by set (ETS 2024 / 2023 / 2022 / user-added), keeping catalog order.
      var groups = [], groupOf = {};
      data.tests.forEach(function (t) {
        var g = t.builtin ? (t.set || 'ETS 2024') : 'Đề tự thêm';
        if (!groupOf[g]) { groupOf[g] = []; groups.push(g); }
        groupOf[g].push(t);
      });
      var cards = groups.map(function (g) {
        var tests = groupOf[g];
        var keyed = tests.filter(function (t) { return keyCount(t) >= 100; }).length;
        var src = SETS[g] ? ' · <a class="toeic-link" href="' + SETS[g] + '" target="_blank" rel="noopener">thư mục Drive ↗</a>' : '';
        return '<div class="toeic-set"><h3 class="toeic-set-title">' + U.escapeHtml(g) +
          '<span class="toeic-muted toeic-small"> — ' + tests.length + ' mục, ' + keyed + ' có đủ đáp án' + src + '</span></h3>' +
          '<div class="toeic-grid">' + tests.map(card).join('') + '</div></div>';
      }).join('');

      var historyRows = done.slice(0, 50).map(function (a) {
        var t = byTest[a.testId];
        var sc = score(a, t);
        var result = sc.keyed ? sc.correct + '/' + sc.keyed + (a.mode === 'full' && sc.keyed === 100 ? ' · ~' + estimateReading(sc.correct) : '') : '<span class="toeic-muted">chưa chấm</span>';
        return '<tr><td>' + U.formatDate(a.finishedAt || a.startedAt) + '</td><td>' + U.escapeHtml(t.name) + '</td>' +
          '<td>' + U.escapeHtml(MODES[a.mode].label) + '</td><td>' + result + '</td><td>' + fmtClock(a.elapsedSec || 0) + '</td>' +
          '<td style="white-space:nowrap;"><button class="btn btn-sm" data-toeic-view="' + a.id + '">Xem</button> ' +
          '<button class="btn btn-sm" data-toeic-del-attempt="' + a.id + '" title="Xoá">✕</button></td></tr>';
      }).join('');

      root().innerHTML =
        '<div class="view-header"><div><h1>📝 TOEIC Reading Test</h1>' +
        '<p>Thi thử Part 5–7 (câu 101–200): đề hiển thị từ PDF, phiếu trả lời, đồng hồ 75 phút, chấm điểm &amp; xem lại.</p></div>' +
        '<button class="btn btn-primary" id="toeic-add-btn">＋ Thêm đề</button></div>' +
        resumeHtml +
        '<div class="toeic-help card"><strong>Cách dùng:</strong> chọn đề → chọn phần thi → <em>Bắt đầu</em>. Đề hiển thị bên trái, phiếu trả lời bên phải. ' +
        'Phím tắt: <kbd>A</kbd>–<kbd>D</kbd> chọn đáp án, <kbd>↑</kbd>/<kbd>↓</kbd> chuyển câu, <kbd>F</kbd> đánh dấu. ' +
        'Bài làm được lưu tự động — có thể thoát và làm tiếp. ETS 2023 &amp; 2022 đã có sẵn đáp án Reading (chép từ ảnh đáp án trong Drive — nếu thấy sai, sửa ở 🔑). ' +
        'ETS 2024 không kèm đáp án: nhập đáp án (🔑) để chấm, có thể nhập cả sau khi nộp bài.</div>' +
        cards +
        '<h3 style="margin:24px 0 10px;">Lịch sử làm bài</h3>' +
        (historyRows
          ? '<table class="table"><thead><tr><th>Ngày</th><th>Đề</th><th>Phần</th><th>Kết quả</th><th>Thời gian</th><th></th></tr></thead><tbody>' + historyRows + '</tbody></table>'
          : '<p class="toeic-muted">Chưa có bài làm nào.</p>');
    });
  }

  /* ---------------------------------------------------------------- */
  /* Exam screen                                                       */
  /* ---------------------------------------------------------------- */

  function startTest(testId, mode) {
    var m = MODES[mode] || MODES.full;
    DB.getAll(ATTEMPTS).then(function (rows) {
      var existing = rows.find(function (a) { return a.testId === testId && a.status === 'in-progress'; });
      if (existing) {
        if (!confirm('Đề này đang có bài làm dở. Bỏ bài cũ và làm mới?')) return openAttempt(existing.id);
        return DB.remove(ATTEMPTS, existing.id).then(create);
      }
      return create();
    });
    function create() {
      var minutesRaw = prompt('Thời gian làm bài (phút, 0 = không giới hạn):', String(m.minutes));
      if (minutesRaw === null) return;
      var minutes = Math.max(0, parseInt(minutesRaw, 10) || 0);
      var now = new Date().toISOString();
      var attempt = {
        id: DB.uid(), testId: testId, mode: mode, from: m.from, to: m.to, timeLimitMin: minutes,
        answers: {}, flags: {}, elapsedSec: 0, status: 'in-progress', startedAt: now, updatedAt: now
      };
      return DB.put(ATTEMPTS, attempt).then(function () { openAttempt(attempt.id); });
    }
  }

  function openAttempt(attemptId) {
    return DB.get(ATTEMPTS, attemptId).then(function (attempt) {
      if (!attempt) return;
      return DB.get(TESTS, attempt.testId).then(function (test) {
        state.attempt = attempt;
        state.test = test;
        state.attempt.flags = state.attempt.flags || {};
        state.current = attempt.from;
        state.reviewFilter = 'all';
        if (attempt.status === 'done') renderResult();
        else renderExam();
      });
    });
  }

  function examLayout(sheetHtml, barHtml) {
    return '<div class="toeic-exam">' +
      '<div class="toeic-bar">' + barHtml + '</div>' +
      '<div class="toeic-body">' +
      '<div class="toeic-pdf" id="toeic-pdf"><div class="toeic-pdf-loading toeic-muted">Đang tải đề…</div></div>' +
      '<div class="toeic-sheet" id="toeic-sheet">' + sheetHtml + '</div>' +
      '</div></div>';
  }

  function mountPdf() {
    var test = state.test;
    pdfSrc(test).then(function (src) {
      var box = el('toeic-pdf');
      if (!box) return;
      if (!src) { box.innerHTML = '<div class="toeic-pdf-loading">Không tìm thấy file PDF của đề này.</div>'; return; }
      var link = openUrl(test);
      box.innerHTML = '<iframe src="' + src + '" title="' + U.escapeHtml(test.name) + '" allow="autoplay"></iframe>' +
        (link ? '<a class="toeic-pdf-open" href="' + link + '" target="_blank" rel="noopener">↗ Mở tab mới</a>' : '');
    });
  }

  function renderExam() {
    state.screen = 'exam';
    var a = state.attempt;
    var bar =
      '<div class="toeic-bar-title"><strong>' + U.escapeHtml(state.test.name) + '</strong><span class="toeic-muted"> · ' + U.escapeHtml(MODES[a.mode].label) + '</span></div>' +
      '<div class="toeic-timer" id="toeic-timer">--:--</div>' +
      '<div class="toeic-progress"><span id="toeic-answered">0</span>/' + (a.to - a.from + 1) + ' câu</div>' +
      '<div class="toolbar" style="margin:0;">' +
      '<button class="btn btn-sm" id="toeic-exit">⏸ Lưu &amp; thoát</button>' +
      '<button class="btn btn-sm btn-primary" id="toeic-submit">✔ Nộp bài</button></div>';
    root().innerHTML = examLayout(sheetHtml(false), bar);
    mountPdf();
    updateProgress();
    focusQuestion(state.current, false);
    startTimer();
  }

  function sheetHtml(review) {
    var a = state.attempt;
    var key = (state.test && state.test.answerKey) || {};
    var html = '';
    PARTS.forEach(function (p) {
      var from = Math.max(p.from, a.from), to = Math.min(p.to, a.to);
      if (from > to) return;
      var rows = range(from, to).filter(function (q) {
        if (!review || state.reviewFilter === 'all') return true;
        var ans = a.answers[q];
        if (state.reviewFilter === 'wrong') return key[q] && ans !== key[q];
        if (state.reviewFilter === 'blank') return !ans;
        if (state.reviewFilter === 'flag') return a.flags[q];
        return true;
      });
      if (!rows.length) return;
      html += '<div class="toeic-part-title">' + p.label + '</div>';
      html += rows.map(function (q) {
        var ans = a.answers[q];
        var cls = 'toeic-q' + (a.flags[q] ? ' flagged' : '');
        if (review && key[q]) cls += ans === key[q] ? ' is-correct' : ' is-wrong';
        var opts = OPTIONS.map(function (o) {
          var oc = 'toeic-opt';
          if (ans === o) oc += ' selected';
          if (review && key[q] === o) oc += ' key';
          return '<button class="' + oc + '" data-q="' + q + '" data-opt="' + o + '"' + (review ? ' disabled' : '') + '>' + o + '</button>';
        }).join('');
        var mark = '';
        if (review) mark = !key[q] ? '<span class="toeic-mark">·</span>' : ans === key[q] ? '<span class="toeic-mark ok">✓</span>' : ans ? '<span class="toeic-mark bad">✗</span>' : '<span class="toeic-mark" title="Bỏ trống">–</span>';
        return '<div class="' + cls + '" data-qrow="' + q + '"><span class="toeic-qn">' + q + '</span>' + opts +
          (review ? mark : '<button class="toeic-flag" data-flag="' + q + '" title="Đánh dấu (F)">⚑</button>') + '</div>';
      }).join('');
    });
    return html || '<p class="toeic-muted" style="padding:12px;">Không có câu nào khớp bộ lọc.</p>';
  }

  function updateProgress() {
    var n = el('toeic-answered');
    if (n) n.textContent = Object.keys(state.attempt.answers).length;
  }

  function focusQuestion(q, scroll) {
    var a = state.attempt;
    if (q < a.from) q = a.from;
    if (q > a.to) q = a.to;
    state.current = q;
    var sheet = el('toeic-sheet');
    if (!sheet) return;
    sheet.querySelectorAll('.toeic-q.current').forEach(function (r) { r.classList.remove('current'); });
    var row = sheet.querySelector('[data-qrow="' + q + '"]');
    if (row) {
      row.classList.add('current');
      if (scroll !== false) row.scrollIntoView({ block: 'nearest' });
    }
  }

  function setAnswer(q, opt) {
    var a = state.attempt;
    if (!a || a.status !== 'in-progress') return;
    if (a.answers[q] === opt) delete a.answers[q]; else a.answers[q] = opt;
    var row = el('toeic-sheet').querySelector('[data-qrow="' + q + '"]');
    if (row) row.querySelectorAll('.toeic-opt').forEach(function (b) { b.classList.toggle('selected', b.dataset.opt === a.answers[q]); });
    updateProgress();
    saveAttempt();
  }

  function toggleFlag(q) {
    var a = state.attempt;
    if (a.flags[q]) delete a.flags[q]; else a.flags[q] = true;
    var row = el('toeic-sheet').querySelector('[data-qrow="' + q + '"]');
    if (row) row.classList.toggle('flagged', !!a.flags[q]);
    saveAttempt();
  }

  function startTimer() {
    stopTimer();
    renderClock();
    state.timer = setInterval(function () {
      if (!state.attempt || state.screen !== 'exam') return stopTimer();
      if (!viewActive() || document.hidden) return; // pause while away
      state.attempt.elapsedSec = (state.attempt.elapsedSec || 0) + 1;
      renderClock();
      if (++state.tickCount % 5 === 0) saveAttempt();
      var limit = state.attempt.timeLimitMin * 60;
      if (limit && state.attempt.elapsedSec >= limit) {
        toast('⏰ Hết giờ! Bài đã được nộp tự động.');
        finish();
      }
    }, 1000);
  }

  function stopTimer() {
    if (state.timer) clearInterval(state.timer);
    state.timer = null;
  }

  function renderClock() {
    var t = el('toeic-timer');
    if (!t) return;
    var a = state.attempt;
    var limit = a.timeLimitMin * 60;
    if (limit) {
      var left = limit - a.elapsedSec;
      t.textContent = '⏱ ' + fmtClock(left);
      t.classList.toggle('warn', left <= 300);
    } else {
      t.textContent = '⏱ ' + fmtClock(a.elapsedSec) + ' (không giới hạn)';
    }
  }

  function submit() {
    var a = state.attempt;
    var total = a.to - a.from + 1;
    var answered = Object.keys(a.answers).length;
    var msg = answered < total ? 'Bạn còn ' + (total - answered) + ' câu chưa trả lời. Nộp bài?' : 'Nộp bài?';
    if (confirm(msg)) finish();
  }

  function finish() {
    stopTimer();
    var a = state.attempt;
    a.status = 'done';
    a.finishedAt = new Date().toISOString();
    saveAttempt().then(function () {
      logHistory();
      renderResult();
    });
  }

  function logHistory() {
    var a = state.attempt, sc = score(a, state.test);
    DB.put('history', {
      id: DB.uid(), type: 'TOEIC', createdAt: new Date().toISOString(),
      input: state.test.name + ' · ' + MODES[a.mode].label,
      output: sc.keyed ? sc.correct + '/' + sc.keyed + ' đúng' : 'Chưa có đáp án',
      result: 'Thời gian ' + fmtClock(a.elapsedSec)
    });
  }

  function exitExam() {
    stopTimer();
    saveAttempt().then(function () {
      toast('Đã lưu bài làm — có thể làm tiếp sau.');
      state.attempt = null;
      renderList();
    });
  }

  /* ---------------------------------------------------------------- */
  /* Result screen                                                     */
  /* ---------------------------------------------------------------- */

  function renderResult() {
    state.screen = 'result';
    stopTimer();
    var a = state.attempt, t = state.test;
    var sc = score(a, t);
    var total = a.to - a.from + 1;

    var summary;
    if (!sc.keyed) {
      summary = '<div class="card toeic-nokey"><h3>Đã nộp bài — chưa thể chấm điểm</h3>' +
        '<p>Đề này chưa có đáp án. Nhập đáp án để xem điểm và câu sai (bài làm của bạn đã được lưu).</p>' +
        '<button class="btn btn-primary" data-toeic-key="' + t.id + '">🔑 Nhập đáp án</button></div>';
    } else {
      var pct = Math.round(sc.correct / sc.keyed * 100);
      var est = a.mode === 'full' && sc.keyed === 100
        ? '<div class="stat-card"><div class="stat-value">~' + estimateReading(sc.correct) + '</div><div class="stat-label">Điểm Reading ước tính /495</div></div>' : '';
      summary = '<div class="stat-row toeic-stats">' +
        '<div class="stat-card"><div class="stat-value">' + sc.correct + '/' + sc.keyed + '</div><div class="stat-label">Câu đúng (' + pct + '%)</div></div>' +
        est +
        '<div class="stat-card"><div class="stat-value">' + sc.wrong + '</div><div class="stat-label">Câu sai</div></div>' +
        '<div class="stat-card"><div class="stat-value">' + sc.blank + '</div><div class="stat-label">Bỏ trống</div></div>' +
        '<div class="stat-card"><div class="stat-value">' + fmtClock(a.elapsedSec) + '</div><div class="stat-label">Thời gian làm</div></div>' +
        '</div>' +
        '<div class="toeic-parts">' + PARTS.map(function (p) {
          var bp = sc.byPart[p.part];
          if (!bp.total) return '';
          var ratio = bp.keyed ? bp.correct / bp.keyed : 0;
          return '<div class="toeic-part-bar"><div class="toeic-part-bar-label">' + p.label + '<span>' + bp.correct + '/' + bp.keyed + '</span></div>' +
            '<div class="toeic-meter"><div style="width:' + Math.round(ratio * 100) + '%"></div></div></div>';
        }).join('') + '</div>' +
        (sc.keyed < total ? '<p class="toeic-muted toeic-small">Đáp án mới có ' + sc.keyed + '/' + total + ' câu — các câu thiếu đáp án không được tính.</p>' : '');
    }

    var filters = [['all', 'Tất cả'], ['wrong', 'Sai + bỏ trống'], ['blank', 'Bỏ trống'], ['flag', 'Đã đánh dấu']].map(function (f) {
      return '<button class="btn btn-sm' + (state.reviewFilter === f[0] ? ' btn-primary' : '') + '" data-toeic-filter="' + f[0] + '">' + f[1] + '</button>';
    }).join('');

    var bar =
      '<div class="toeic-bar-title"><strong>Xem lại: ' + U.escapeHtml(t.name) + '</strong><span class="toeic-muted"> · ' + U.escapeHtml(MODES[a.mode].label) + '</span></div>' +
      '<div class="toolbar" style="margin:0;">' + filters + '</div>';

    root().innerHTML =
      '<div class="view-header"><div><h1>📊 Kết quả</h1><p>' + U.escapeHtml(t.name) + ' · ' + U.formatDate(a.finishedAt) + '</p></div>' +
      '<div class="toolbar" style="margin:0;">' +
      '<button class="btn" id="toeic-back">← Danh sách đề</button>' +
      '<button class="btn" data-toeic-key="' + t.id + '">🔑 ' + (keyCount(t) ? 'Sửa đáp án' : 'Nhập đáp án') + '</button>' +
      (t.keyImg ? '<a class="btn" href="https://drive.google.com/file/d/' + encodeURIComponent(t.keyImg) + '/view" target="_blank" rel="noopener">🖼 Ảnh đáp án</a>' : '') +
      '<button class="btn btn-primary" id="toeic-retry">↻ Làm lại</button></div></div>' +
      summary +
      examLayout(sheetHtml(true), bar);
    mountPdf();
  }

  /* ---------------------------------------------------------------- */
  /* Answer key & add-test modals                                      */
  /* ---------------------------------------------------------------- */

  var keyTestId = null;

  function openKeyModal(testId) {
    DB.get(TESTS, testId).then(function (t) {
      if (!t) return;
      keyTestId = testId;
      el('toeic-key-title').textContent = '🔑 Đáp án · ' + t.name;
      el('toeic-key-text').value = keyToText(t.answerKey);
      el('toeic-key-start').value = '101';
      var img = el('toeic-key-img');
      img.hidden = !t.keyImg;
      if (t.keyImg) img.href = 'https://drive.google.com/file/d/' + encodeURIComponent(t.keyImg) + '/view';
      updateKeyPreview();
      el('overlay-toeic-key').classList.add('open');
      setTimeout(function () { el('toeic-key-text').focus(); }, 0);
    });
  }

  function updateKeyPreview() {
    var key = parseKey(el('toeic-key-text').value, el('toeic-key-start').value);
    var n = Object.keys(key).length;
    var qs = Object.keys(key).map(Number).sort(function (a, b) { return a - b; });
    el('toeic-key-preview').textContent = n
      ? 'Nhận diện ' + n + ' câu (' + qs[0] + '–' + qs[qs.length - 1] + ')'
      : 'Chưa nhận diện được đáp án nào.';
  }

  function saveKey() {
    var key = parseKey(el('toeic-key-text').value, el('toeic-key-start').value);
    DB.get(TESTS, keyTestId).then(function (t) {
      t.answerKey = key;
      t.keySource = 'user';
      t.updatedAt = new Date().toISOString();
      return DB.put(TESTS, t).then(function () {
        el('overlay-toeic-key').classList.remove('open');
        toast('Đã lưu đáp án (' + Object.keys(key).length + ' câu)');
        if (state.test && state.test.id === t.id) state.test = t;
        if (state.screen === 'result') renderResult();
        else if (state.screen === 'list') renderList();
      });
    });
  }

  function openAddModal() {
    el('toeic-add-name').value = '';
    el('toeic-add-drive').value = '';
    el('toeic-add-file').value = '';
    el('overlay-toeic-add').classList.add('open');
    setTimeout(function () { el('toeic-add-name').focus(); }, 0);
  }

  function saveAddModal() {
    var name = el('toeic-add-name').value.trim();
    var driveInput = el('toeic-add-drive').value.trim();
    var file = el('toeic-add-file').files[0];
    var driveId = driveInput ? extractDriveId(driveInput) : null;
    if (driveInput && !driveId) { toast('Link Google Drive không hợp lệ'); return; }
    if (!driveId && !file) { toast('Hãy dán link Drive hoặc chọn file PDF'); return; }
    if (!name) name = file ? file.name.replace(/\.pdf$/i, '') : 'Đề TOEIC mới';
    var now = new Date().toISOString();
    var test = { id: DB.uid(), name: name, builtin: false, answerKey: {}, createdAt: now, updatedAt: now };
    var p;
    if (driveId) {
      test.driveId = driveId;
      p = Promise.resolve();
    } else {
      test.fileId = DB.uid();
      p = DB.put(FILES, { id: test.fileId, name: file.name, blob: file, createdAt: now });
    }
    p.then(function () { return DB.put(TESTS, test); }).then(function () {
      el('overlay-toeic-add').classList.remove('open');
      toast('Đã thêm đề: ' + name);
      renderList();
    }).catch(function (err) { toast('Không lưu được: ' + (err && err.message)); });
  }

  function deleteTest(testId) {
    if (!confirm('Xoá đề này và toàn bộ lịch sử làm bài của nó?')) return;
    Promise.all([DB.get(TESTS, testId), DB.getAll(ATTEMPTS)]).then(function (res) {
      var t = res[0];
      var ops = res[1].filter(function (a) { return a.testId === testId; }).map(function (a) { return DB.remove(ATTEMPTS, a.id); });
      ops.push(DB.remove(TESTS, testId));
      if (t && t.fileId) ops.push(DB.remove(FILES, t.fileId));
      return Promise.all(ops);
    }).then(renderList);
  }

  /* ---------------------------------------------------------------- */
  /* Events                                                            */
  /* ---------------------------------------------------------------- */

  function bind() {
    document.addEventListener('click', function (e) {
      var view = e.target.closest('.view[data-view-id="toeic"]');
      var inModal = e.target.closest('#overlay-toeic-key, #overlay-toeic-add');
      if (!view && !inModal) return;
      var t;

      if ((t = e.target.closest('[data-toeic-key]'))) return openKeyModal(t.dataset.toeicKey);
      if (!view) return;

      if (e.target.closest('#toeic-add-btn')) return openAddModal();
      if ((t = e.target.closest('[data-toeic-start]'))) {
        var sel = view.querySelector('[data-toeic-mode="' + t.dataset.toeicStart + '"]');
        return startTest(t.dataset.toeicStart, sel ? sel.value : 'full');
      }
      if ((t = e.target.closest('[data-toeic-resume]'))) return openAttempt(t.dataset.toeicResume);
      if ((t = e.target.closest('[data-toeic-view]'))) return openAttempt(t.dataset.toeicView);
      if ((t = e.target.closest('[data-toeic-discard]'))) {
        if (confirm('Bỏ bài làm dở này?')) DB.remove(ATTEMPTS, t.dataset.toeicDiscard).then(renderList);
        return;
      }
      if ((t = e.target.closest('[data-toeic-del-attempt]'))) {
        if (confirm('Xoá lần làm bài này khỏi lịch sử?')) DB.remove(ATTEMPTS, t.dataset.toeicDelAttempt).then(renderList);
        return;
      }
      if ((t = e.target.closest('[data-toeic-delete]'))) return deleteTest(t.dataset.toeicDelete);

      if ((t = e.target.closest('.toeic-opt[data-opt]'))) {
        var q = parseInt(t.dataset.q, 10);
        focusQuestion(q, false);
        return setAnswer(q, t.dataset.opt);
      }
      if ((t = e.target.closest('[data-flag]'))) return toggleFlag(parseInt(t.dataset.flag, 10));
      if ((t = e.target.closest('[data-qrow]')) && state.screen === 'exam') return focusQuestion(parseInt(t.dataset.qrow, 10), false);

      if (e.target.closest('#toeic-submit')) return submit();
      if (e.target.closest('#toeic-exit')) return exitExam();
      if (e.target.closest('#toeic-back')) { state.attempt = null; return renderList(); }
      if (e.target.closest('#toeic-retry')) return startTest(state.attempt.testId, state.attempt.mode);
      if ((t = e.target.closest('[data-toeic-filter]'))) {
        state.reviewFilter = t.dataset.toeicFilter;
        return renderResult();
      }
    });

    el('toeic-key-text').addEventListener('input', updateKeyPreview);
    el('toeic-key-start').addEventListener('input', updateKeyPreview);
    el('toeic-key-save').addEventListener('click', saveKey);
    el('toeic-key-cancel').addEventListener('click', function () { el('overlay-toeic-key').classList.remove('open'); });
    el('toeic-key-clear').addEventListener('click', function () { el('toeic-key-text').value = ''; updateKeyPreview(); });
    el('toeic-add-save').addEventListener('click', saveAddModal);
    el('toeic-add-cancel').addEventListener('click', function () { el('overlay-toeic-add').classList.remove('open'); });

    document.addEventListener('keydown', function (e) {
      if (state.screen !== 'exam' || !viewActive() || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.target.closest('input, textarea, select, [contenteditable="true"]')) return;
      if (document.querySelector('.overlay.open')) return;
      var k = e.key.toUpperCase();
      if (OPTIONS.indexOf(k) !== -1) {
        e.preventDefault();
        var q = state.current;
        var wasSame = state.attempt.answers[q] === k;
        setAnswer(q, k);
        if (!wasSame && q < state.attempt.to) focusQuestion(q + 1);
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
        e.preventDefault(); focusQuestion(state.current + 1);
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
        e.preventDefault(); focusQuestion(state.current - 1);
      } else if (k === 'F') {
        e.preventDefault(); toggleFlag(state.current);
      }
    });

    window.addEventListener('beforeunload', function () { if (state.screen === 'exam') saveAttempt(); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind);
  else bind();

  return {
    render: render,
    parseKey: parseKey,
    estimateReading: estimateReading,
    extractDriveId: extractDriveId
  };
})();
