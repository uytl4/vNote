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
  // Fields: file (original Drive file name, used to match PDFs the user attaches offline),
  // set, n (test number), drive (PDF id), keyImg (answer-key image id),
  // full (PDF also contains the Listening part, so Reading starts mid-file).
  var SETS = {
    'ETS 2024': 'https://drive.google.com/drive/folders/1raFiG1EglJBeBOeR-ZOHSB0HaBobZcO7',
    'ETS 2023': 'https://drive.google.com/drive/folders/1sQOQVt2ZERpOyAK-VTG_VTJjsuCti8UB',
    'ETS 2022': 'https://drive.google.com/drive/folders/1NQBarMKQBfQYgl3jYpfMMTE-6rQJQ1xS'
  };
  var NOTE_FULL = 'File gồm cả Listening — cuộn xuống trang READING TEST (Part 5, câu 101) để bắt đầu.';
  var BUILTIN = [
    { file: 'TEST 1 RC (1).pdf', set: 'ETS 2024', n: 1, drive: '1Ui8fHZggVXv9O4qwykCmcm_Cnef2Rxfz' },
    { file: 'TEST 2 RC (1).pdf', set: 'ETS 2024', n: 2, drive: '1wuXjH-Xjeo4Z5FCJ_QUpRbJjqllXYoYR' },
    { file: 'TEST 3 RC (1).pdf', set: 'ETS 2024', n: 3, drive: '1DNq75hm_RmMALqOgVoSm4lgEt60Nngix' },
    { file: 'TEST 4 RC (1).pdf', set: 'ETS 2024', n: 4, drive: '1B1178RLdo5eqT-y_BGmsY3eAmUnO6PAN' },
    { file: 'TEST 5 RC (1).pdf', set: 'ETS 2024', n: 5, drive: '1V6CmirhNgZt7_kduLNs5tRwCf_THoGm6' },
    { file: 'TEST 6 RC (1).pdf', set: 'ETS 2024', n: 6, drive: '1OAeVzg8fp320VvPD4VrhMTMPwagzcLS_' },
    { file: 'TEST 7 RC (1).pdf', set: 'ETS 2024', n: 7, drive: '1a-lCLQuLKyIQDa6W3Xx0qpa-6OvjP9JN' },
    { file: 'TEST 8 RC (1).pdf', set: 'ETS 2024', n: 8, drive: '1QKruG4-ffEOJWFtSOFz8evuZ1oZ_vdN7' },
    { file: 'TEST 9 RC (1).pdf', set: 'ETS 2024', n: 9, drive: '1eVg-f7xZttTjl6XYDOaLE-pBuN9NDTqV' },
    { file: 'TEST 10 RC (1).pdf', set: 'ETS 2024', n: 10, drive: '1BMPqGApam4oCCbgk-li0Wx-dm2qODrLb' },
    { file: 'ETS 2024 - READING.pdf', set: 'ETS 2024', name: 'ETS 2024 · Reading (sách đầy đủ)', drive: '1cdubYVE5vl2_nRuaqggT0MwXS4s86PsG', note: 'Sách gồm nhiều đề — cuộn PDF tới đề bạn muốn làm.' },

    { file: 'ETS 2023 Test 1.pdf', set: 'ETS 2023', n: 1, drive: '16qYVEiNRuEdDWgRvErY3BUF1yXLaUOHJ', keyImg: '1r14gNAzuF0-HlQCBu4MY4OaTgdR66XNS', full: true },
    { file: 'Test 02 ETS 2023 Reading _ Listening.pdf', set: 'ETS 2023', n: 2, drive: '1uNvDZNGXybnoTWJUN3MmueemHA9eoZTW', keyImg: '1vCeaele6Euh-GZpBj0QHX726S8y0hl5A', full: true },
    { file: 'TEST 3.pdf', set: 'ETS 2023', n: 3, drive: '1jqIJ6J19sOUhTqnwBCdXnd3ei2FQccoo', keyImg: '15aNFON3oyYUN4V19Y7AitTwOHXErHjxr', full: true },
    { file: 'TEST 4.pdf', set: 'ETS 2023', n: 4, drive: '1YPMKKy-1V-Yxkjg6WL3vx_UhLjCd2KhV', keyImg: '1RjsOz0XtzpJEfxXi-7xjhHRbeOGwajN1', full: true },
    { file: 'TEST 5.pdf', set: 'ETS 2023', n: 5, drive: '1dICFpFwi8k0vJk59Z8Hgafkaeqf2TkmY', keyImg: '1WKZ9QwP3Cr-YeHoBrPSOEnWYfZbQ84FS', full: true },
    { file: 'TEST 6.pdf', set: 'ETS 2023', n: 6, drive: '1AKXbMgUoQW7D9tHrdoTaMMEc4r6d_eGD', keyImg: '1qHEZnDm3ibX3FpCsFHj4mcbEc32z_hal', full: true },
    { file: 'TEST 7.pdf', set: 'ETS 2023', n: 7, drive: '1k0X_UVYumKQ9qx-nqVByaRrq0ChSn6iL', keyImg: '1Fl0rtzRnatF58Mlit0Q6rf38eDjKtAFf', full: true },
    { file: 'TEST 8.pdf', set: 'ETS 2023', n: 8, drive: '1Ax_mJh6K5laajGL5HX6H9L2GLHVmi4qZ', keyImg: '1daAy5ZCascaJ8qg70OodpaWwWfyQCey8', full: true },
    { file: 'TEST 9.pdf', set: 'ETS 2023', n: 9, drive: '1FP0rSz2HACFibmW3ifLRSGnXT_tz8Wj3', keyImg: '1o7eDTGPj15fY5QAbpI7LM3Qt4NKzdpXa', full: true },
    { file: 'TEST 10.pdf', set: 'ETS 2023', n: 10, drive: '1gMaMkE9iKG1Kqckyw7lHv9ZyknUzLz90', keyImg: '1uDw2ow5rcsEJuwFohoXh3Uw4kIGgOdcP', full: true },
    { file: 'ETS 2023 RC.pdf', set: 'ETS 2023', name: 'ETS 2023 · Reading (sách RC đầy đủ)', drive: '1YK36D4ZBmGvSkFFkM-z_x6Xu93MLNdAU', note: 'Sách RC gồm 10 đề — cuộn PDF tới đề muốn làm. Đáp án có sẵn ở từng đề lẻ phía trên.' },

    { file: 'ETS 2022 Test 1.pdf', set: 'ETS 2022', n: 1, drive: '1Bylfa9G4C8foBpYKyJ6Ugun72e53BKd2', keyImg: '1jsxVGhph5p_OraUvHAJHaZKRnW5MCMae', full: true },
    { file: 'ETS 2022 Test 2.pdf', set: 'ETS 2022', n: 2, drive: '1WJNUPjXAlN-0LV0MtLh2nue3vDR7CIbh', keyImg: '1a1TUK4RHQNmoFTq9WkWNUzRgsO7wWyZo', full: true },
    { file: 'ETS 2022 Test 3.pdf', set: 'ETS 2022', n: 3, drive: '17rMleDnz3g3nM4UPV4tCn-EPa-8ympDd', keyImg: '12UtSGzhgSOwQvTvf6XvUgIkxXTVJRgeQ', full: true },
    { file: 'ETS 2022 Test 4.pdf', set: 'ETS 2022', n: 4, drive: '1De4e8lGtyHQ9HWM8nuh0NdBDCr51Gl-8', keyImg: '1sNiRk2Lt5yiiwOF88S3OxdBiAbl9FiFa', full: true },
    { file: 'ETS 2022 Test 5.pdf', set: 'ETS 2022', n: 5, drive: '1z7NtB6xCsC6y7w7hYGhsRJXlyAI9gq1h', keyImg: '1yPp5kf2_h8ZR52VL9xnYt69ZdSYlJBkz', full: true },
    { file: 'ETS 2022 Test 6.pdf', set: 'ETS 2022', n: 6, drive: '164s_IPua99RblDO1ETEHTgbKQk2vQax9', keyImg: '1rJkcW1_JgQjOZIba3PdGtbmW_taz0-iw', full: true },
    { file: 'ETS 2022 Test 7.pdf', set: 'ETS 2022', n: 7, drive: '1sbYbfLDm56O5gsw7TE-G-H5igIAJbCC1', keyImg: '1LvwDP9lSwWZoItillUseaBXmnWiLx0B8', full: true },
    { file: 'ETS 2022 Test 8.pdf', set: 'ETS 2022', n: 8, drive: '13l51L2M3n5rfIiCahiwpmWNyjrBMYNl6', keyImg: '1lyWJokzMoPD7f8o7CnQTspzg-fPRxqYu', full: true },
    { file: 'ETS 2022 Test 9.pdf', set: 'ETS 2022', n: 9, drive: '1wzqbS7gMBwyhh_7eDN6X2XoWixLrfj_z', keyImg: '1fJgoMnTebmxxNcsl331s_PzR7DUMYb68', full: true },
    { file: 'ETS 2022 Test 10.pdf', set: 'ETS 2022', n: 10, drive: '11lu4XEDgn8W9ETUap3qk9_W3T-GjiK5L', keyImg: '1kKEHwpyUbp5Ii8uVrfIc7RhgzR04fZfr', full: true }
  ];

  function keySourceOf(b) {
    var src = window.VNoteToeicKeySource && window.VNoteToeicKeySource[b.set.replace('ETS ', '')];
    return src || 'bundled';
  }

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
    viewer: null,
    filter: (function () { try { return localStorage.getItem('toeic-filter') || 'all'; } catch (e) { return 'all'; } })(),
    pageSaveTimer: null
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

  function driveSrc(test) {
    return 'https://drive.google.com/file/d/' + encodeURIComponent(test.driveId) + '/preview';
  }

  function isOnline() { return navigator.onLine !== false; }

  // Google Drive is opt-in only (button in the PDF pane); tests come from this device.
  var drive = { forced: false };

  /* ---------------------------------------------------------------- */
  /* Offline test pack (goi-de/): PDFs bundled next to index.html      */
  /* ---------------------------------------------------------------- */
  //
  // "📦 Xuất gói đề" writes every PDF stored in this browser into goi-de.zip:
  //   goi-de/index.js   → window.TOEIC_PACK_INDEX = [{ id, file, name, src }]
  //   goi-de/de-01.js … → (window.TOEIC_PACK_DATA ||= {})[id] = '<base64 PDF>'
  // Extracted next to index.html, every copy of the site (another PC, a USB stick, a web host)
  // then has the tests built in. Plain <script> files are used because browsers refuse
  // fetch() for file:// pages but still load scripts.
  var PACK_DIR = 'goi-de/';

  // Entries are { id, name, src, kind: 'pdf' | 'md' }. A PDF entry wins over a text (Markdown) entry.
  function packIndex() { return Array.isArray(window.TOEIC_PACK_INDEX) ? window.TOEIC_PACK_INDEX : []; }
  function packEntry(testId) {
    var all = packIndex().filter(function (e) { return e.id === testId; });
    return all.filter(function (e) { return (e.kind || 'pdf') === 'pdf'; })[0] || all[0] || null;
  }

  function loadScriptOnce(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = src;
      s.onload = function () { s.remove(); resolve(); };
      s.onerror = function () { s.remove(); reject(new Error('Không đọc được ' + src)); };
      document.head.appendChild(s);
    });
  }

  function b64ToBlob(b64) {
    var bin = atob(b64), n = bin.length, bytes = new Uint8Array(n);
    for (var i = 0; i < n; i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type: 'application/pdf' });
  }

  var packCache = {};
  /** Resolve a pack entry to { blob } (PDF) or { md } (Markdown text). */
  function loadPackData(entry) {
    var key = entry.src;
    if (packCache[key]) return Promise.resolve(packCache[key]);
    var store = window.TOEIC_PACK_DATA || {};
    var p = store[key] ? Promise.resolve() : loadScriptOnce(PACK_DIR + entry.src);
    return p.then(function () {
      var raw = window.TOEIC_PACK_DATA && window.TOEIC_PACK_DATA[key];
      if (!raw) throw new Error('Gói đề thiếu dữ liệu cho ' + entry.name);
      var res = typeof raw === 'string' ? { blob: b64ToBlob(raw) } : { md: raw.md };
      delete window.TOEIC_PACK_DATA[key];   // free the script copy
      packCache[key] = res;
      return res;
    });
  }

  // --- minimal ZIP writer (stored, no compression; PDFs are already compressed) ---
  var CRC_TABLE = (function () {
    var t = new Uint32Array(256);
    for (var n = 0; n < 256; n++) { var c = n; for (var k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
    return t;
  })();
  function crc32(bytes) {
    var c = 0xFFFFFFFF;
    for (var i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }
  function zipBuilder() {
    var parts = [], central = [], offset = 0, enc = new TextEncoder();
    function u16(v) { return [v & 255, (v >>> 8) & 255]; }
    function u32(v) { return [v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255]; }
    return {
      add: function (name, bytes) {
        var nameBytes = enc.encode(name), crc = crc32(bytes), size = bytes.length;
        var local = new Uint8Array([].concat([0x50, 0x4b, 0x03, 0x04], u16(20), u16(0x0800), u16(0), u16(0), u16(0x21),
          u32(crc), u32(size), u32(size), u16(nameBytes.length), u16(0)));
        parts.push(local, nameBytes, bytes);
        central.push(new Uint8Array([].concat([0x50, 0x4b, 0x01, 0x02], u16(20), u16(20), u16(0x0800), u16(0), u16(0), u16(0x21),
          u32(crc), u32(size), u32(size), u16(nameBytes.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset))), nameBytes);
        offset += local.length + nameBytes.length + size;
      },
      blob: function () {
        var cdSize = central.reduce(function (n, b) { return n + b.length; }, 0);
        var count = central.length / 2;
        var end = new Uint8Array([].concat([0x50, 0x4b, 0x05, 0x06], u16(0), u16(0), u16(count), u16(count), u32(cdSize), u32(offset), u16(0)));
        return new Blob(parts.concat(central, [end]), { type: 'application/zip' });
      }
    };
  }

  function blobToBase64(blob) {
    return new Promise(function (resolve, reject) {
      var r = new FileReader();
      r.onload = function () { resolve(String(r.result).replace(/^data:[^,]*,/, '')); };
      r.onerror = function () { reject(r.error); };
      r.readAsDataURL(blob);
    });
  }

  function exportPack() {
    DB.getAll(TESTS).then(function (tests) {
      var withFile = tests.filter(function (t) { return t.fileId; })
        .sort(function (a, b) { return (a.order != null ? a.order : 999) - (b.order != null ? b.order : 999); });
      if (!withFile.length) { alert('Chưa có đề nào được lưu trên máy.\nBấm "📁 Gắn đề từ máy" để thêm file PDF đề trước, rồi xuất gói.'); return; }
      toast('Đang tạo gói đề (' + withFile.length + ' đề)…');
      var zip = zipBuilder(), enc = new TextEncoder(), index = [];
      return withFile.reduce(function (p, t, i) {
        return p.then(function () { return DB.get(FILES, t.fileId); }).then(function (row) {
          if (!row) return;
          if (row.md) {
            var msrc = 'mdl-' + (i + 1 < 10 ? '0' : '') + (i + 1) + '.js';
            index.push({ id: t.id, kind: 'md', file: row.name || '', name: t.name, src: msrc });
            zip.add(PACK_DIR + msrc, enc.encode('(window.TOEIC_PACK_DATA=window.TOEIC_PACK_DATA||{})[' + JSON.stringify(msrc) + ']={md:' + JSON.stringify(row.md) + '};\n'));
            return;
          }
          if (!row.blob) return;
          return blobToBase64(row.blob).then(function (b64) {
            var src = 'pdf-' + (i + 1 < 10 ? '0' : '') + (i + 1) + '.js';
            index.push({ id: t.id, kind: 'pdf', file: row.name || t.file || '', name: t.name, src: src, size: row.blob.size });
            zip.add(PACK_DIR + src, enc.encode('(window.TOEIC_PACK_DATA=window.TOEIC_PACK_DATA||{})[' + JSON.stringify(src) + ']="' + b64 + '";\n'));
          });
        });
      }, Promise.resolve()).then(function () {
        // Keep text (Markdown) entries already in goi-de/ so extracting over it does not lose them.
        var exported = {};
        index.forEach(function (e) { exported[e.id] = true; });
        packIndex().forEach(function (e) { if (e.kind === 'md' && !exported[e.id]) index.push(e); });
        zip.add(PACK_DIR + 'index.js', enc.encode('// Gói đề offline cho TOEIC Reading — tạo ' + new Date().toISOString() + '\nwindow.TOEIC_PACK_INDEX = ' + JSON.stringify(index, null, 1) + ';\n'));
        zip.add(PACK_DIR + 'DOC-TOI.txt', enc.encode('Giải nén goi-de.zip vào CÙNG THƯ MỤC với index.html (sẽ có thư mục goi-de/ cạnh index.html).\r\nSau đó mở index.html: các đề trong gói dùng được ngay, không cần mạng, không cần gắn lại.\r\n'));
        var a = document.createElement('a');
        a.href = URL.createObjectURL(zip.blob());
        a.download = 'goi-de.zip';
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(function () { URL.revokeObjectURL(a.href); }, 60000);
        alert('Đã tạo goi-de.zip (' + index.length + ' đề).\n\nGiải nén vào cùng thư mục với index.html — sẽ có thư mục "goi-de" nằm cạnh index.html.\nTừ đó bộ web này (chép sang máy khác / USB / đưa lên web) có sẵn đề, không cần mạng.');
      });
    }).catch(function (err) { toast('Không tạo được gói đề: ' + (err && err.message || err)); });
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
          name: b.name || (b.set + ' · Test ' + b.n), set: b.set, driveId: b.drive, keyImg: b.keyImg || null, file: b.file || null,
          note: b.note || (b.full ? NOTE_FULL : ''), builtin: true, order: i
        };
        var row = have[id];
        if (!row) {
          var key = bundledKey(b);
          writes.push(DB.put(TESTS, Object.assign({ id: id, answerKey: key, keySource: keyCount({ answerKey: key }) ? keySourceOf(b) : null, createdAt: now, updatedAt: now }, meta)));
          return;
        }
        // Refresh catalog metadata; fill in a bundled key only if the user has none.
        var changed = Object.keys(meta).some(function (k) { return row[k] !== meta[k]; });
        Object.assign(row, meta);
        if (!keyCount(row)) {
          var k2 = bundledKey(b);
          if (keyCount({ answerKey: k2 })) { row.answerKey = k2; row.keySource = keySourceOf(b); changed = true; }
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
    unmountViewer();
    return loadAll().then(function (data) {
      var byTest = {};
      data.tests.forEach(function (t) { byTest[t.id] = t; });
      var readyCount = data.tests.filter(function (t) { return t.fileId || packEntry(t.id); }).length;
      var inProgress = data.attempts.filter(function (a) { return a.status === 'in-progress' && byTest[a.testId]; });
      var done = data.attempts.filter(function (a) { return a.status === 'done' && byTest[a.testId]; });

      function bestOf(t) {
        var best = null;
        done.forEach(function (a) {
          if (a.testId !== t.id) return;
          var sc = score(a, t);
          if (sc.keyed && (best === null || sc.correct / sc.keyed > best.ratio)) best = { ratio: sc.correct / sc.keyed, text: sc.correct + '/' + sc.keyed };
        });
        return best;
      }

      function card(t) {
        var attempts = done.filter(function (a) { return a.testId === t.id; });
        var best = bestOf(t);
        var kc = keyCount(t);
        var pe = packEntry(t.id);
        var ready = !!(t.fileId || pe);
        var keyChip = kc
          ? (t.keySource === 'ai'
            ? '<span class="chip chip-ai" title="Bộ đề gốc không có đáp án — do AI giải, có thể sai vài câu">🤖 Đáp án AI</span>'
            : '<span class="chip chip-ok" title="' + kc + ' câu' + (t.keySource === 'bundled' ? ', chép từ đáp án gốc' : '') + '">✓ Đáp án</span>')
          : '<span class="chip chip-warn">Chưa có đáp án</span>';
        var srcChip = t.fileId ? '<span class="chip chip-ok" title="Đã lưu trong máy — dùng offline">📱 Đề trên máy</span>'
          : pe ? (pe.kind === 'md'
            ? '<span class="chip chip-ok" title="Nội dung đề dạng chữ trong goi-de/ — dùng offline">📦 Đề dạng chữ</span>'
            : '<span class="chip chip-ok" title="PDF trong thư mục goi-de/ — dùng offline">📦 Có trong gói đề</span>')
          : '<span class="chip chip-warn" title="Gắn file đề (PDF hoặc .md) để làm bài">⚠ Chưa có đề</span>';
        var modeOpts = Object.keys(MODES).map(function (k) { return '<option value="' + k + '">' + MODES[k].label + '</option>'; }).join('');
        var link = openUrl(t);
        var pct = best ? Math.round(best.ratio * 100) : null;
        var num = t.builtin && /Test (\d+)$/.test(t.name) ? t.name.match(/Test (\d+)$/)[1] : null;
        var title = num ? 'Test ' + num : U.escapeHtml(t.name.replace(/^ETS \d{4} · /, ''));
        var ring = '<div class="tx-ring' + (pct === null ? ' is-empty' : '') + '" style="--p:' + (pct || 0) + '" title="' + (best ? 'Cao nhất ' + best.text : 'Chưa làm') + '">' +
          '<span>' + (pct === null ? '—' : pct + '%') + '</span></div>';
        return '<article class="card toeic-test-card tx-card' + (ready ? '' : ' is-locked') + '" data-name="' + U.escapeHtml(t.name.toLowerCase()) + '">' +
          '<div class="tx-card-top">' +
          '<div class="tx-card-title"><span class="tx-card-set">' + U.escapeHtml(t.builtin ? (t.set || '') : 'Đề tự thêm') + '</span>' +
          '<h4 class="toeic-test-name">' + title + '</h4></div>' + ring + '</div>' +
          '<div class="toeic-test-meta">' + srcChip + keyChip + '</div>' +
          (t.note ? '<p class="tx-card-note">' + U.escapeHtml(t.note) + '</p>' : '') +
          '<div class="tx-card-stat">' + (attempts.length ? attempts.length + ' lần làm' + (best ? ' · cao nhất <b>' + best.text + '</b>' : '') : 'Chưa làm lần nào') + '</div>' +
          '<div class="toeic-test-actions">' +
          '<select class="field-input" data-toeic-mode="' + t.id + '" aria-label="Phần thi">' + modeOpts + '</select>' +
          '<button class="btn btn-primary btn-sm" data-toeic-start="' + t.id + '">▶ Bắt đầu</button>' +
          '</div>' +
          '<div class="toeic-test-links">' +
          '<a class="toeic-link" href="javascript:void 0" data-toeic-key="' + t.id + '">🔑 ' + (kc ? 'Đáp án' : 'Nhập đáp án') + '</a>' +
          (t.fileId
            ? '<a class="toeic-link" href="javascript:void 0" data-toeic-detach="' + t.id + '" title="Xoá bản đề đã lưu trong máy">✕ Bỏ đề máy</a>'
            : '<a class="toeic-link" href="javascript:void 0" data-toeic-attach="' + t.id + '" title="Lưu file đề (PDF hoặc .md) vào máy để làm bài không cần mạng">📎 Gắn đề</a>') +
          (link ? '<a class="toeic-link" href="' + link + '" target="_blank" rel="noopener" title="Mở file gốc trên Google Drive (cần mạng)">↗ Bản gốc</a>' : '') +
          (t.builtin ? '' : '<a class="toeic-link toeic-link-danger" href="javascript:void 0" data-toeic-delete="' + t.id + '">🗑 Xoá</a>') +
          '</div></article>';
      }

      // Group cards by set (ETS 2024 / 2023 / 2022 / user-added), keeping catalog order.
      var groups = [], groupOf = {};
      data.tests.forEach(function (t) {
        var g = t.builtin ? (t.set || 'ETS 2024') : 'Đề tự thêm';
        if (!groupOf[g]) { groupOf[g] = []; groups.push(g); }
        groupOf[g].push(t);
      });
      var filter = state.filter && (state.filter === 'all' || groupOf[state.filter]) ? state.filter : 'all';
      var tabs = ['all'].concat(groups).map(function (g) {
        var n = g === 'all' ? data.tests.length : groupOf[g].length;
        return '<button class="tx-tab' + (g === filter ? ' is-active' : '') + '" role="tab" aria-selected="' + (g === filter) + '" data-toeic-tab="' + U.escapeHtml(g) + '">' +
          (g === 'all' ? 'Tất cả' : U.escapeHtml(g)) + '<span>' + n + '</span></button>';
      }).join('');
      var cards = groups.filter(function (g) { return filter === 'all' || g === filter; }).map(function (g) {
        var tests = groupOf[g];
        var ok = tests.filter(function (t) { return t.fileId || packEntry(t.id); }).length;
        return '<section class="toeic-set"><h3 class="toeic-set-title">' + U.escapeHtml(g) +
          '<span class="toeic-muted toeic-small">' + ok + '/' + tests.length + ' đề sẵn sàng</span></h3>' +
          '<div class="toeic-grid">' + tests.map(card).join('') + '</div></section>';
      }).join('');

      // Dashboard numbers
      var scored = done.map(function (a) { return { a: a, sc: score(a, byTest[a.testId]) }; }).filter(function (x) { return x.sc.keyed; });
      var avg = scored.length ? Math.round(scored.reduce(function (n, x) { return n + x.sc.correct / x.sc.keyed; }, 0) / scored.length * 100) : null;
      var bestFull = scored.filter(function (x) { return x.a.mode === 'full' && x.sc.keyed === 100; })
        .reduce(function (m, x) { return Math.max(m, estimateReading(x.sc.correct)); }, 0);
      var stat = function (v, l, sub) { return '<div class="tx-stat"><div class="tx-stat-v">' + v + '</div><div class="tx-stat-l">' + l + '</div>' + (sub ? '<div class="tx-stat-s">' + sub + '</div>' : '') + '</div>'; };

      var resumeHtml = inProgress.map(function (a) {
        var t = byTest[a.testId];
        var answered = Object.keys(a.answers || {}).length, total = a.to - a.from + 1;
        return '<div class="toeic-resume tx-resume">' +
          '<div class="tx-resume-main"><div class="tx-resume-k">⏸ Đang làm dở</div>' +
          '<div class="tx-resume-t">' + U.escapeHtml(t.name) + ' · ' + U.escapeHtml(MODES[a.mode].label) + '</div>' +
          '<div class="tx-progress"><div style="width:' + Math.round(answered / total * 100) + '%"></div></div>' +
          '<div class="toeic-muted toeic-small">Đã trả lời ' + answered + '/' + total + ' · đã dùng ' + fmtClock(a.elapsedSec || 0) + '</div></div>' +
          '<div class="tx-resume-act"><button class="btn btn-primary" data-toeic-resume="' + a.id + '">▶ Làm tiếp</button>' +
          '<button class="btn btn-ghost" data-toeic-discard="' + a.id + '">Bỏ</button></div></div>';
      }).join('');

      var historyRows = done.slice(0, 50).map(function (a) {
        var t = byTest[a.testId];
        var sc = score(a, t);
        var pct = sc.keyed ? Math.round(sc.correct / sc.keyed * 100) : null;
        var tone = pct === null ? '' : pct >= 80 ? ' is-good' : pct >= 50 ? ' is-mid' : ' is-low';
        var result = sc.keyed ? '<span class="tx-pill' + tone + '">' + sc.correct + '/' + sc.keyed + '</span>' + (a.mode === 'full' && sc.keyed === 100 ? ' <span class="toeic-muted">~' + estimateReading(sc.correct) + '</span>' : '') : '<span class="toeic-muted">chưa chấm</span>';
        return '<tr><td>' + U.formatDate(a.finishedAt || a.startedAt) + '</td><td><b>' + U.escapeHtml(t.name) + '</b></td>' +
          '<td>' + U.escapeHtml(MODES[a.mode].label) + '</td><td>' + result + '</td><td>' + fmtClock(a.elapsedSec || 0) + '</td>' +
          '<td class="tx-row-act"><button class="btn btn-sm" data-toeic-view="' + a.id + '">Xem lại</button> ' +
          '<button class="btn btn-sm btn-ghost" data-toeic-del-attempt="' + a.id + '" title="Xoá" aria-label="Xoá">✕</button></td></tr>';
      }).join('');

      root().innerHTML =
        '<header class="tx-hero">' +
        '<div class="tx-hero-text"><h1>Luyện TOEIC Reading</h1>' +
        '<p>Part 5–7 · câu 101–200 · 30 đề ETS 2022–2024 · chạy offline, có sẵn đáp án</p></div>' +
        '<div class="tx-hero-act">' +
        '<button class="btn" id="toeic-bulk-btn" title="Chọn nhiều file đề (PDF hoặc .md) — tự khớp với từng đề">📁 Gắn đề từ máy</button>' +
        '<button class="btn" id="toeic-pack-btn" title="Đóng gói các đề đã lưu thành thư mục goi-de/ đặt cạnh index.html">📦 Xuất gói đề</button>' +
        '<button class="btn btn-primary" id="toeic-add-btn">＋ Thêm đề</button></div>' +
        '<div class="tx-stats">' +
        stat(readyCount + '<small>/' + data.tests.length + '</small>', 'Đề sẵn sàng') +
        stat(done.length, 'Bài đã làm', inProgress.length ? inProgress.length + ' đang làm dở' : '') +
        stat(bestFull ? '~' + bestFull : '—', 'Reading cao nhất', bestFull ? 'thang 495, ước tính' : 'làm 1 đề Full để có điểm') +
        stat(avg === null ? '—' : avg + '%', 'Tỉ lệ đúng TB', scored.length ? scored.length + ' bài đã chấm' : '') +
        '</div></header>' +
        resumeHtml +
        (readyCount ? '' :
          '<div class="toeic-offline tx-callout"><strong>📦 Thiết lập bộ đề offline (làm 1 lần)</strong>' +
          '<ol><li>Có sẵn file đề trên máy (PDF hoặc .md), giữ nguyên tên file.</li>' +
          '<li>Bấm <em>📁 Gắn đề từ máy</em>, chọn tất cả — web tự nhận file nào của đề nào.</li>' +
          '<li>Tuỳ chọn: <em>📦 Xuất gói đề</em> rồi giải nén <code>goi-de.zip</code> cạnh <code>index.html</code> để mang cả bộ đề đi máy khác.</li></ol>' +
          'Đáp án đã có sẵn trong web.</div>') +
        '<div class="tx-toolbar">' +
        '<div class="tx-tabs" role="tablist" aria-label="Bộ đề">' + tabs + '</div>' +
        '<label class="tx-search"><span aria-hidden="true">🔍</span><input type="search" id="toeic-search" placeholder="Tìm đề… (vd: 2023 test 5)" autocomplete="off"></label>' +
        '</div>' +
        '<details class="toeic-help tx-help"><summary>Hướng dẫn &amp; phím tắt</summary><div>' +
        '<p><b>Làm bài:</b> chọn đề → chọn phần thi → <em>Bắt đầu</em>. Bài làm tự lưu, thoát ra làm tiếp được; hết giờ tự nộp.</p>' +
        '<p><b>Phím tắt:</b> <kbd>A</kbd>–<kbd>D</kbd> chọn đáp án · <kbd>↑</kbd>/<kbd>↓</kbd> chuyển câu · <kbd>F</kbd> đánh dấu. Trên điện thoại dùng thanh A B C D ở đáy màn hình.</p>' +
        '<p><b>Đáp án:</b> ETS 2023 &amp; 2022 chép từ đáp án gốc; ETS 2024 không có đáp án gốc nên do AI giải (🤖, có thể sai vài câu). Sửa bất kỳ lúc nào ở 🔑, kể cả nhập từ file.</p>' +
        '<p><b>Đề thi:</b> chạy hoàn toàn offline. Đề lấy từ file trên máy (📁) hoặc thư mục <code>goi-de/</code> cạnh index.html (📦). Google Drive chỉ dùng khi bạn bấm mở.</p>' +
        '</div></details>' +
        '<div id="toeic-cards">' + cards + '</div>' +
        '<p class="tx-empty" id="toeic-noresult" hidden>Không có đề nào khớp tìm kiếm.</p>' +
        '<section class="tx-history"><h3 class="toeic-set-title">Lịch sử làm bài</h3>' +
        (historyRows
          ? '<div class="table-wrap"><table class="table tx-table"><thead><tr><th>Ngày</th><th>Đề</th><th>Phần</th><th>Kết quả</th><th>Thời gian</th><th></th></tr></thead><tbody>' + historyRows + '</tbody></table></div>'
          : '<div class="tx-empty">Chưa có bài làm nào — chọn một đề ở trên để bắt đầu.</div>') +
        '</section>';
    });
  }

  function applySearch() {
    var q = (el('toeic-search') && el('toeic-search').value || '').toLowerCase().trim();
    var words = q.split(/\s+/).filter(Boolean);
    var shown = 0;
    root().querySelectorAll('.tx-card').forEach(function (c) {
      var hit = words.every(function (w) { return c.dataset.name.indexOf(w) !== -1; });
      c.hidden = !hit;
      if (hit) shown++;
    });
    root().querySelectorAll('.toeic-set').forEach(function (sec) {
      sec.hidden = !sec.querySelector('.tx-card:not([hidden])');
    });
    var nr = el('toeic-noresult');
    if (nr) nr.hidden = shown > 0;
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

  function examLayout(sheetHtml, barHtml, review) {
    // On phones the full answer sheet becomes a slide-up panel and a compact bar at the
    // bottom answers the current question, so the PDF can use the whole screen.
    var mbar = review ? '' :
      '<div class="toeic-mbar" id="toeic-mbar">' +
      '<button class="toeic-mbtn" data-mnav="-1" aria-label="Câu trước">‹</button>' +
      '<span class="toeic-mq" id="toeic-mq">101</span>' +
      OPTIONS.map(function (o) { return '<button class="toeic-mopt" data-mopt="' + o + '">' + o + '</button>'; }).join('') +
      '<button class="toeic-mbtn toeic-mflag" data-mflag="1" aria-label="Đánh dấu">⚑</button>' +
      '<button class="toeic-mbtn" data-mnav="1" aria-label="Câu sau">›</button>' +
      '<button class="toeic-mbtn toeic-msheet" data-msheet="1" aria-label="Phiếu trả lời">☰</button>' +
      '</div>';
    return '<div class="toeic-exam' + (review ? ' is-review' : ' is-exam') + '">' +
      '<div class="toeic-bar">' + barHtml + '</div>' +
      '<div class="toeic-body">' +
      '<div class="toeic-pdf" id="toeic-pdf"><div class="toeic-pdf-loading toeic-muted">Đang tải đề…</div></div>' +
      '<div class="toeic-sheet" id="toeic-sheet">' + (review ? '' : '<div class="toeic-sheet-head"><strong>Phiếu trả lời</strong><button class="btn btn-sm" data-msheet="1">Đóng</button></div>') + sheetHtml + '</div>' +
      '</div>' + mbar + '</div>';
  }

  function updateMobileBar() {
    var bar = el('toeic-mbar');
    if (!bar || !state.attempt) return;
    var q = state.current, a = state.attempt;
    el('toeic-mq').textContent = q;
    bar.querySelectorAll('[data-mopt]').forEach(function (b) { b.classList.toggle('selected', a.answers[q] === b.dataset.mopt); });
    bar.querySelector('[data-mflag]').classList.toggle('on', !!a.flags[q]);
  }

  function toggleSheet(force) {
    var exam = root().querySelector('.toeic-exam');
    if (!exam) return;
    var open = force != null ? force : !exam.classList.contains('sheet-open');
    exam.classList.toggle('sheet-open', open);
    if (open) focusQuestion(state.current);
  }

  function unmountViewer() {
    if (state.viewer) { state.viewer.destroy(); state.viewer = null; }
  }

  function savePage(test, n) {
    test.lastPage = n;
    clearTimeout(state.pageSaveTimer);
    state.pageSaveTimer = setTimeout(function () {
      DB.get(TESTS, test.id).then(function (t) { if (t) { t.lastPage = n; DB.put(TESTS, t); } });
    }, 800);
  }

  function mountViewer(box, test, blob) {
    state.viewer = window.VNotePdfView.mount(box, blob, {
      startPage: test.lastPage || 1,
      onPage: function (n) { savePage(test, n); }
    });
  }

  /**
   * Show the test PDF from this device: a PDF stored in the browser, else the offline pack
   * (goi-de/) shipped with the site. Google Drive is only used when the user asks for it.
   */
  function mountPdf() {
    var test = state.test;
    var box = el('toeic-pdf');
    if (!box) return;
    unmountViewer();
    var attachBtn = '<button class="btn btn-sm btn-primary" data-toeic-attach="' + test.id + '">📎 Chọn file đề trên máy (PDF / .md)</button>';
    var alive = function () { return box.isConnected && state.test === test; };
    if (test.fileId) {
      DB.get(FILES, test.fileId).then(function (row) {
        if (!alive()) return;
        if (!row || (!row.blob && !row.md)) {
          box.innerHTML = '<div class="toeic-pdf-loading">Không tìm thấy file đề đã lưu cho đề này.<br><br>' + attachBtn + '</div>';
          return;
        }
        if (row.md) {
          state.viewer = window.VNoteMdView.mount(box, row.md, {
            imgBase: PACK_DIR + 'anh/', startPage: test.lastPage || 1,
            onPage: function (n) { savePage(test, n); }
          });
          return;
        }
        mountViewer(box, test, row.blob);
      });
      return;
    }
    var entry = packEntry(test.id);
    if (entry) {
      box.innerHTML = '<div class="toeic-pdf-loading toeic-muted">Đang mở đề từ gói đề offline…</div>';
      loadPackData(entry).then(function (data) {
        if (!alive()) return;
        if (data.blob) return mountViewer(box, test, data.blob);
        state.viewer = window.VNoteMdView.mount(box, data.md, {
          imgBase: PACK_DIR + 'anh/', startPage: test.lastPage || 1,
          onPage: function (n) { savePage(test, n); }
        });
      })
        .catch(function (err) {
          if (alive()) box.innerHTML = '<div class="toeic-pdf-loading">' + U.escapeHtml(err.message) + '<br><br>' + attachBtn + '</div>';
        });
      return;
    }
    if (drive.forced && test.driveId) {
      var link = openUrl(test);
      box.innerHTML = '<iframe src="' + driveSrc(test) + '" title="' + U.escapeHtml(test.name) + '" allow="autoplay"></iframe>' +
        '<div class="toeic-pdf-tools">' +
        '<button class="toeic-pdf-open" data-toeic-attach="' + test.id + '">📎 Dùng file đề trên máy</button>' +
        (link ? '<a class="toeic-pdf-open" href="' + link + '" target="_blank" rel="noopener">↗ Mở tab mới</a>' : '') +
        '</div>';
      return;
    }
    box.innerHTML = '<div class="toeic-pdf-loading"><strong>Đề này chưa có trên máy.</strong><br>' +
      'Chọn file PDF của đề' + (test.file ? ' (<code>' + U.escapeHtml(test.file) + '</code>)' : '') +
      ' — web lưu lại để dùng offline.<br><br>' + attachBtn +
      (test.driveId ? ' <button class="btn btn-sm" data-toeic-forcedrive="1">Mở bằng Google Drive (cần mạng)</button>' : '') +
      '<p class="toeic-muted toeic-small">Phiếu trả lời và đồng hồ vẫn dùng bình thường.</p></div>';
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
    var ex = root().querySelector('.toeic-exam .toeic-bar');
    if (ex) ex.insertAdjacentHTML('afterend', '<div class="tx-exambar" aria-hidden="true"><div class="tx-exambar-time" id="toeic-timebar"></div><div class="tx-exambar-ans" id="toeic-ansbar"></div></div>');
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
    var a = state.attempt, done = Object.keys(a.answers).length;
    var n = el('toeic-answered');
    if (n) n.textContent = done;
    var bar = el('toeic-ansbar');
    if (bar) bar.style.width = (done / (a.to - a.from + 1) * 100) + '%';
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
      if (scroll !== false && sheet.offsetParent) row.scrollIntoView({ block: 'nearest' });
    }
    updateMobileBar();
  }

  function setAnswer(q, opt) {
    var a = state.attempt;
    if (!a || a.status !== 'in-progress') return;
    if (a.answers[q] === opt) delete a.answers[q]; else a.answers[q] = opt;
    var row = el('toeic-sheet').querySelector('[data-qrow="' + q + '"]');
    if (row) row.querySelectorAll('.toeic-opt').forEach(function (b) { b.classList.toggle('selected', b.dataset.opt === a.answers[q]); });
    updateProgress();
    updateMobileBar();
    saveAttempt();
  }

  function toggleFlag(q) {
    var a = state.attempt;
    if (a.flags[q]) delete a.flags[q]; else a.flags[q] = true;
    var row = el('toeic-sheet').querySelector('[data-qrow="' + q + '"]');
    if (row) row.classList.toggle('flagged', !!a.flags[q]);
    updateMobileBar();
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
      var tb = el('toeic-timebar');
      if (tb) tb.style.width = Math.min(100, a.elapsedSec / limit * 100) + '%';
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
      var verdict = pct >= 90 ? 'Xuất sắc! 🎉' : pct >= 75 ? 'Rất tốt 👍' : pct >= 55 ? 'Khá — tiếp tục luyện nhé' : 'Cần luyện thêm 💪';
      summary = '<div class="tx-result">' +
        '<div class="tx-ring tx-ring-lg" style="--p:' + pct + '"><span>' + pct + '%<small>' + sc.correct + '/' + sc.keyed + ' câu</small></span></div>' +
        '<div class="tx-result-text"><div class="tx-result-verdict">' + verdict + '</div>' +
        (a.mode === 'full' && sc.keyed === 100 ? '<div class="tx-result-est">Điểm Reading ước tính <b>~' + estimateReading(sc.correct) + '</b> / 495</div>' : '') +
        '<div class="toeic-muted toeic-small">' + U.escapeHtml(MODES[a.mode].label) + ' · thời gian ' + fmtClock(a.elapsedSec) + '</div></div></div>' +
        '<div class="stat-row toeic-stats">' +
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
        (t.keySource === 'ai' ? '<p class="toeic-ainote">🤖 Đáp án của đề này do AI giải (bộ đề gốc không có đáp án) nên có thể sai vài câu. Nếu thấy câu nào bị chấm sai, sửa ở 🔑 Sửa đáp án.</p>' : '') +
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
      examLayout(sheetHtml(true), bar, true);
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

  /* ---------------------------------------------------------------- */
  /* Offline PDFs stored on the device                                 */
  /* ---------------------------------------------------------------- */

  function normName(name) {
    return String(name || '').toLowerCase().replace(/\.(pdf|md|markdown|txt)$/, '').replace(/\(\d+\)/g, '').replace(/[^a-z0-9]/g, '');
  }

  /** Find the catalog test a downloaded file belongs to: exact Drive file name first, then by pattern. */
  function matchFile(fileName, tests) {
    var n = normName(fileName);
    var exact = tests.filter(function (t) { return t.file && normName(t.file) === n; });
    if (exact.length) return exact[0];
    var num = n.match(/test0*(\d{1,2})/);
    if (!num) return null;
    var k = +num[1];
    var year = /2022/.test(n) ? 'ETS 2022' : /2023/.test(n) ? 'ETS 2023' : /2024|rc/.test(n) ? 'ETS 2024' : null;
    if (!year) return null;
    return tests.filter(function (t) { return t.builtin && t.set === year && t.name === year + ' · Test ' + k; })[0] || null;
  }

  function storeFileFor(test, file) {
    var now = new Date().toISOString();
    var oldId = test.fileId;
    var fileId = DB.uid();
    // A test can be a PDF (stored as a Blob) or Markdown text of the test (stored as a string).
    var isText = /\.(md|markdown|txt)$/i.test(file.name) || /^text\//.test(file.type || '');
    var rowP = isText
      ? file.text().then(function (md) { return { id: fileId, name: file.name, md: md, size: file.size, createdAt: now }; })
      : Promise.resolve({ id: fileId, name: file.name, blob: file, size: file.size, createdAt: now });
    return rowP.then(function (row) { return DB.put(FILES, row); }).then(function () {
      test.fileId = fileId;
      test.lastPage = test.lastPage || 1;
      test.updatedAt = now;
      return DB.put(TESTS, test);
    }).then(function () { if (oldId) return DB.remove(FILES, oldId); });
  }

  function pickFiles(multiple, cb) {
    var input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/pdf,.pdf,.md,.markdown,text/markdown,text/plain';
    input.multiple = !!multiple;
    input.style.display = 'none';
    input.addEventListener('change', function () {
      var files = Array.prototype.slice.call(input.files || []);
      input.remove();
      if (files.length) cb(files);
    });
    document.body.appendChild(input);
    input.click();
  }

  function attachOne(testId) {
    pickFiles(false, function (files) {
      DB.get(TESTS, testId).then(function (t) {
        if (!t) return;
        toast('Đang lưu file vào máy…');
        return storeFileFor(t, files[0]).then(function () {
          toast('Đã lưu PDF cho ' + t.name + ' — dùng được khi offline');
          if (state.test && state.test.id === t.id) { state.test = t; mountPdf(); }
          else if (state.screen === 'list') renderList();
        });
      }).catch(function (err) { toast('Không lưu được file: ' + (err && err.message || err)); });
    });
  }

  function attachBulk() {
    pickFiles(true, function (files) {
      DB.getAll(TESTS).then(function (tests) {
        var matched = [], unmatched = [];
        files.forEach(function (f) {
          var t = matchFile(f.name, tests);
          if (t) matched.push([t, f]); else unmatched.push(f.name);
        });
        toast('Đang lưu ' + matched.length + ' file…');
        return matched.reduce(function (p, pair) {
          return p.then(function () { return storeFileFor(pair[0], pair[1]); });
        }, Promise.resolve()).then(function () {
          var msg = 'Đã gắn ' + matched.length + '/' + files.length + ' file đề:\n' +
            matched.map(function (m) { return '  ✓ ' + m[1].name + ' → ' + m[0].name; }).join('\n');
          if (unmatched.length) msg += '\n\nKhông nhận ra đề (dùng nút 📎 Gắn đề ở từng đề, hoặc ＋ Thêm đề):\n' + unmatched.map(function (n) { return '  • ' + n; }).join('\n');
          alert(msg);
          renderList();
        });
      }).catch(function (err) { toast('Không lưu được file: ' + (err && err.message || err)); });
    });
  }

  function detach(testId) {
    if (!confirm('Xoá bản PDF đã lưu trong trình duyệt cho đề này?' + (packEntry(testId) ? ' (Đề vẫn có trong gói đề goi-de/.)' : ''))) return;
    DB.get(TESTS, testId).then(function (t) {
      if (!t || !t.fileId) return;
      var fid = t.fileId;
      delete t.fileId;
      return DB.put(TESTS, t).then(function () { return DB.remove(FILES, fid); });
    }).then(renderList);
  }

  /** Load an answer key from a .txt/.csv/.json file into the key dialog (works offline). */
  function importKeyFile() {
    var input = document.createElement('input');
    input.type = 'file';
    input.accept = '.txt,.csv,.json,text/plain,application/json';
    input.style.display = 'none';
    input.addEventListener('change', function () {
      var f = input.files && input.files[0];
      input.remove();
      if (!f) return;
      f.text().then(function (txt) {
        var text = txt;
        try {
          var obj = JSON.parse(txt);
          if (obj && typeof obj === 'object') {
            var src = obj.answerKey || obj;
            text = Object.keys(src).map(function (q) { return q + ' ' + src[q]; }).join('\n');
          }
        } catch (e) { /* plain text */ }
        el('toeic-key-text').value = text;
        updateKeyPreview();
        toast('Đã đọc file ' + f.name + ' — kiểm tra rồi bấm Lưu');
      });
    });
    document.body.appendChild(input);
    input.click();
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

      if ((t = e.target.closest('[data-toeic-tab]'))) {
        state.filter = t.dataset.toeicTab;
        try { localStorage.setItem('toeic-filter', state.filter); } catch (err) { /* ignore */ }
        return renderList();
      }
      if (e.target.closest('#toeic-add-btn')) return openAddModal();
      if (e.target.closest('#toeic-bulk-btn')) return attachBulk();
      if (e.target.closest('#toeic-pack-btn')) return exportPack();
      if (e.target.closest('[data-toeic-forcedrive]')) { drive.forced = true; return mountPdf(); }
      if ((t = e.target.closest('[data-toeic-attach]'))) return attachOne(t.dataset.toeicAttach);
      if ((t = e.target.closest('[data-toeic-detach]'))) return detach(t.dataset.toeicDetach);
      if ((t = e.target.closest('[data-mopt]'))) {
        var cq = state.current, was = state.attempt.answers[cq] === t.dataset.mopt;
        setAnswer(cq, t.dataset.mopt);
        if (!was && cq < state.attempt.to) setTimeout(function () { focusQuestion(cq + 1); }, 180);
        return;
      }
      if ((t = e.target.closest('[data-mnav]'))) return focusQuestion(state.current + parseInt(t.dataset.mnav, 10));
      if (e.target.closest('[data-mflag]')) return toggleFlag(state.current);
      if (e.target.closest('[data-msheet]')) return toggleSheet();
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
        setAnswer(q, t.dataset.opt);
        if (root().querySelector('.toeic-exam.sheet-open')) setTimeout(function () { toggleSheet(false); }, 250);
        return;
      }
      if ((t = e.target.closest('[data-flag]'))) return toggleFlag(parseInt(t.dataset.flag, 10));
      if ((t = e.target.closest('[data-qrow]')) && state.screen === 'exam') {
        focusQuestion(parseInt(t.dataset.qrow, 10), false);
        var ex = root().querySelector('.toeic-exam.sheet-open');
        if (ex && e.target.closest('.toeic-opt')) setTimeout(function () { toggleSheet(false); }, 250);
        return;
      }

      if (e.target.closest('#toeic-submit')) return submit();
      if (e.target.closest('#toeic-exit')) return exitExam();
      if (e.target.closest('#toeic-back')) { state.attempt = null; return renderList(); }
      if (e.target.closest('#toeic-retry')) return startTest(state.attempt.testId, state.attempt.mode);
      if ((t = e.target.closest('[data-toeic-filter]'))) {
        state.reviewFilter = t.dataset.toeicFilter;
        return renderResult();
      }
    });

    document.addEventListener('input', function (e) { if (e.target && e.target.id === 'toeic-search') applySearch(); });
    el('toeic-key-text').addEventListener('input', updateKeyPreview);
    el('toeic-key-start').addEventListener('input', updateKeyPreview);
    el('toeic-key-save').addEventListener('click', saveKey);
    el('toeic-key-cancel').addEventListener('click', function () { el('overlay-toeic-key').classList.remove('open'); });
    el('toeic-key-clear').addEventListener('click', function () { el('toeic-key-text').value = ''; updateKeyPreview(); });
    if (el('toeic-key-file')) el('toeic-key-file').addEventListener('click', importKeyFile);

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

  function home() {
    if (state.screen === 'exam') return exitExam();
    state.attempt = null;
    return renderList();
  }

  return {
    matchFile: matchFile,
    render: render,
    home: home,
    parseKey: parseKey,
    estimateReading: estimateReading,
    extractDriveId: extractDriveId
  };
})();
