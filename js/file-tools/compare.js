window.VNoteFileCompare = (function () {
  'use strict';

  var P = window.VNoteParsers;
  var U = window.VNoteUtil;
  var ROW_CAP = 2000;
  var state = { fileA: null, fileB: null, signal: null, lastResult: null, mode: 'fulltext' };

  function els() {
    return {
      dzA: document.getElementById('compare-dropzone-a'), inputA: document.getElementById('compare-input-a'), nameA: document.getElementById('compare-filename-a'),
      dzB: document.getElementById('compare-dropzone-b'), inputB: document.getElementById('compare-input-b'), nameB: document.getElementById('compare-filename-b'),
      modeGroup: document.getElementById('compare-mode'),
      delimiter: document.getElementById('compare-delimiter'),
      hasHeader: document.getElementById('compare-has-header'),
      keyColumns: document.getElementById('compare-key-columns'),
      compareColumns: document.getElementById('compare-compare-columns'),
      keyColumnsWrap: document.getElementById('compare-key-columns-wrap'),
      optWhitespace: document.getElementById('compare-opt-whitespace'),
      optBlank: document.getElementById('compare-opt-blank'),
      optCase: document.getElementById('compare-opt-case'),
      optTrim: document.getElementById('compare-opt-trim'),
      optOrder: document.getElementById('compare-opt-order'),
      optDup: document.getElementById('compare-opt-dup'),
      runBtn: document.getElementById('compare-run'),
      cancelBtn: document.getElementById('compare-cancel'),
      progressWrap: document.getElementById('compare-progress-wrap'),
      progressFill: document.getElementById('compare-progress-fill'),
      progressText: document.getElementById('compare-progress-text'),
      result: document.getElementById('compare-result'),
      tabs: document.getElementById('compare-tabs'),
      table: document.getElementById('compare-table-body'),
      exportButtons: document.getElementById('compare-export')
    };
  }

  function activeDelimiter(sample) {
    var e = els();
    if (e.delimiter.value === 'auto') return P.detectDelimiter(sample || []);
    return e.delimiter.value === 'TAB' ? '\t' : e.delimiter.value;
  }

  function loadFile(which, file) {
    var e = els();
    if (which === 'A') { state.fileA = file; e.nameA.textContent = file.name + ' (' + P.formatBytes(file.size) + ')'; }
    else { state.fileB = file; e.nameB.textContent = file.name + ' (' + P.formatBytes(file.size) + ')'; }
    if (which === 'A') refreshColumnPickers();
  }

  function refreshColumnPickers() {
    var e = els();
    if (!state.fileA) return;
    state.fileA.slice(0, 65536).text().then(function (chunk) {
      var lines = chunk.split(/\r\n|\r|\n/).filter(Boolean).slice(0, 5);
      if (!lines.length) return;
      var delim = activeDelimiter(lines);
      var header = e.hasHeader.checked ? lines[0].split(delim) : lines[0].split(delim).map(function (_, i) { return 'col_' + (i + 1); });
      e.keyColumns.innerHTML = header.map(function (h, i) {
        return '<label class="chip"><input type="checkbox" class="key-col" value="' + i + '"' + (i === 0 ? ' checked' : '') + '> ' + U.escapeHtml(h) + '</label>';
      }).join('');
      e.compareColumns.innerHTML = header.map(function (h, i) {
        return '<label class="chip"><input type="checkbox" class="cmp-col" value="' + i + '" checked> ' + U.escapeHtml(h) + '</label>';
      }).join('');
    });
  }

  function normalizeLine(line, opts) {
    if (opts.trim) line = line.trim();
    if (opts.whitespace) line = line.replace(/\s+/g, '');
    if (opts.caseInsensitive) line = line.toLowerCase();
    return line;
  }

  function readAllLines(file, onProgress, signal) {
    var lines = [];
    return P.streamLines(file, { signal: signal, onProgress: onProgress, onLine: function (l) { lines.push(l); } }).then(function () { return lines; });
  }

  function runAlignedCompare(linesA, linesB, opts) {
    var rows = [];
    var same = 0, added = 0, deleted = 0, modified = 0;
    var delim = opts.delimiter;

    if (opts.ignoreOrder) {
      var mapA = new Map(), mapB = new Map();
      linesA.forEach(function (l) { var k = normalizeLine(l, opts); mapA.set(k, (mapA.get(k) || 0) + 1); });
      linesB.forEach(function (l) { var k = normalizeLine(l, opts); mapB.set(k, (mapB.get(k) || 0) + 1); });
      var allKeys = new Set([].concat(Array.from(mapA.keys()), Array.from(mapB.keys())));
      allKeys.forEach(function (k) {
        var ca = mapA.get(k) || 0, cb = mapB.get(k) || 0;
        var common = Math.min(ca, cb);
        same += common;
        if (ca > cb && rows.length < ROW_CAP) rows.push({ type: 'Deleted', a: k, b: '' });
        if (cb > ca && rows.length < ROW_CAP) rows.push({ type: 'Added', a: '', b: k });
        deleted += Math.max(0, ca - cb);
        added += Math.max(0, cb - ca);
      });
    } else {
      var max = Math.max(linesA.length, linesB.length);
      for (var i = 0; i < max; i++) {
        var a = i < linesA.length ? linesA[i] : null;
        var b = i < linesB.length ? linesB[i] : null;
        if (a === null) { added++; if (rows.length < ROW_CAP) rows.push({ type: 'Added', a: '', b: b }); continue; }
        if (b === null) { deleted++; if (rows.length < ROW_CAP) rows.push({ type: 'Deleted', a: a, b: '' }); continue; }
        var na = normalizeLine(a, opts), nb = normalizeLine(b, opts);
        if (opts.ignoreBlank && a.trim() === '' && b.trim() === '') { same++; continue; }
        if (na === nb) { same++; continue; }
        modified++;
        var diffCols = null;
        if (delim) {
          var colsA = a.split(delim), colsB = b.split(delim);
          diffCols = [];
          for (var c = 0; c < Math.max(colsA.length, colsB.length); c++) {
            var va = colsA[c] !== undefined ? colsA[c] : '', vb = colsB[c] !== undefined ? colsB[c] : '';
            if (normalizeLine(va, opts) !== normalizeLine(vb, opts)) diffCols.push({ index: c, a: va, b: vb });
          }
        }
        if (rows.length < ROW_CAP) rows.push({ type: 'Modified', a: a, b: b, diffCols: diffCols });
      }
    }
    return { same: same, added: added, deleted: deleted, modified: modified, duplicate: 0, rows: rows, totalA: linesA.length, totalB: linesB.length };
  }

  function runKeyBasedCompare(linesA, linesB, opts) {
    var delim = opts.delimiter;
    var startIdx = opts.hasHeader ? 1 : 0;
    var header = opts.hasHeader ? linesA[0].split(delim) : null;

    function buildMap(lines) {
      var map = new Map(); var dup = 0;
      for (var i = startIdx; i < lines.length; i++) {
        if (lines[i] === '' && opts.ignoreBlank) continue;
        var cols = lines[i].split(delim);
        var key = opts.keyIndices.map(function (idx) { return normalizeLine(cols[idx] || '', opts); }).join('');
        if (opts.ignoreDup && map.has(key)) { dup++; continue; }
        if (map.has(key)) dup++;
        map.set(key, cols);
      }
      return { map: map, dup: dup };
    }

    var A = buildMap(linesA), B = buildMap(linesB);
    var rows = [];
    var same = 0, added = 0, deleted = 0, modified = 0;
    var compareCols = opts.compareIndices;

    A.map.forEach(function (colsA, key) {
      if (!B.map.has(key)) { deleted++; if (rows.length < ROW_CAP) rows.push({ type: 'Deleted', key: key, a: colsA.join(delim), b: '' }); return; }
      var colsB = B.map.get(key);
      var diffCols = [];
      compareCols.forEach(function (idx) {
        var va = colsA[idx] !== undefined ? colsA[idx] : '', vb = colsB[idx] !== undefined ? colsB[idx] : '';
        if (normalizeLine(va, opts) !== normalizeLine(vb, opts)) diffCols.push({ index: idx, name: header ? header[idx] : 'col_' + (idx + 1), a: va, b: vb });
      });
      if (diffCols.length) { modified++; if (rows.length < ROW_CAP) rows.push({ type: 'Modified', key: key, a: colsA.join(delim), b: colsB.join(delim), diffCols: diffCols }); }
      else same++;
    });
    B.map.forEach(function (colsB, key) {
      if (!A.map.has(key)) { added++; if (rows.length < ROW_CAP) rows.push({ type: 'Added', key: key, a: '', b: colsB.join(delim) }); }
    });

    return { same: same, added: added, deleted: deleted, modified: modified, duplicate: A.dup + B.dup, rows: rows, totalA: linesA.length - startIdx, totalB: linesB.length - startIdx };
  }

  function buildOpts(sampleForDelim) {
    var e = els();
    var delim = activeDelimiter(sampleForDelim);
    var opts = {
      trim: e.optTrim.checked, whitespace: e.optWhitespace.checked, caseInsensitive: e.optCase.checked,
      ignoreBlank: e.optBlank.checked, ignoreOrder: e.optOrder.checked, ignoreDup: e.optDup.checked,
      delimiter: delim, hasHeader: e.hasHeader.checked
    };
    if (state.mode === 'key') {
      opts.keyIndices = Array.from(e.keyColumns.querySelectorAll('.key-col:checked')).map(function (c) { return Number(c.value); });
      opts.compareIndices = Array.from(e.compareColumns.querySelectorAll('.cmp-col:checked')).map(function (c) { return Number(c.value); });
    }
    return opts;
  }

  function finishResult(result) {
    var e = els();
    state.lastResult = result;
    renderResult(result, state.fileA.name, state.fileB.name);
    window.VNoteDB.put('history', {
      id: window.VNoteDB.uid(), type: 'COMPARE', input: state.fileA.name + ' vs ' + state.fileB.name, output: '',
      result: 'Same:' + result.same + ' Added:' + result.added + ' Deleted:' + result.deleted + ' Modified:' + result.modified,
      createdAt: new Date().toISOString()
    });
    e.progressWrap.hidden = true;
  }

  function run() {
    var e = els();
    if (!state.fileA || !state.fileB) { alert('Vui lòng chọn cả File A và File B.'); return; }
    e.result.hidden = true;
    e.progressWrap.hidden = false;
    e.progressFill.style.width = '0%';

    state.fileA.slice(0, 65536).text().then(function (chunk) {
      var sampleForDelim = chunk.split(/\r\n|\r|\n/).filter(Boolean).slice(0, 20);
      var opts = buildOpts(sampleForDelim);
      if (state.mode === 'key' && !opts.keyIndices.length) {
        alert('Vui lòng chọn ít nhất 1 Key Column.');
        e.progressWrap.hidden = true;
        return;
      }

      var worker = null;
      try { worker = new Worker('workers/compare-worker.js'); } catch (err) { worker = null; }

      if (worker) {
        state.worker = worker;
        var gotResult = false;
        worker.onmessage = function (ev) {
          var msg = ev.data;
          if (msg.type === 'progress') {
            e.progressFill.style.width = msg.pct + '%';
            e.progressText.textContent = 'Đang so sánh (Web Worker)… ' + msg.pct + '%';
          } else if (msg.type === 'done') {
            gotResult = true;
            finishResult(msg.result);
            worker.terminate();
          } else if (msg.type === 'error') {
            gotResult = true;
            e.progressWrap.hidden = true;
            e.result.hidden = false;
            e.result.innerHTML = '<p style="color:var(--danger)">Lỗi: ' + U.escapeHtml(msg.message) + '</p>';
            worker.terminate();
          }
        };
        worker.onerror = function () {
          if (gotResult) return;
          worker.terminate();
          runMainThread(opts);
        };
        worker.postMessage({ fileA: state.fileA, fileB: state.fileB, mode: state.mode, opts: opts });
      } else {
        runMainThread(opts);
      }
    });
  }

  /** Fallback used when Web Workers are unavailable (e.g. index.html opened directly via file://). */
  function runMainThread(opts) {
    var e = els();
    state.signal = { aborted: false };
    var totalBytes = state.fileA.size + state.fileB.size;
    var loadedA = 0, loadedB = 0;
    function updateProgress() {
      var pct = totalBytes ? Math.round(((loadedA + loadedB) / totalBytes) * 100) : 100;
      e.progressFill.style.width = pct + '%';
      e.progressText.textContent = 'Đang đọc file… ' + pct + '%';
    }

    Promise.all([
      readAllLines(state.fileA, function (l) { loadedA = l; updateProgress(); }, state.signal),
      readAllLines(state.fileB, function (l) { loadedB = l; updateProgress(); }, state.signal)
    ]).then(function (res) {
      var linesA = res[0], linesB = res[1];
      var result = state.mode === 'key' ? runKeyBasedCompare(linesA, linesB, opts) : runAlignedCompare(linesA, linesB, opts);
      finishResult(result);
    }).catch(function (err) {
      if (err.name !== 'AbortError') {
        e.result.hidden = false;
        e.result.innerHTML = '<p style="color:var(--danger)">Lỗi: ' + U.escapeHtml(err.message || String(err)) + '</p>';
      }
      e.progressWrap.hidden = true;
    });
  }

  var activeTab = 'All';
  function renderResult(r, nameA, nameB) {
    var e = els();
    e.result.hidden = false;
    activeTab = 'All';

    e.result.querySelector('#compare-stats').innerHTML =
      stat(r.totalA.toLocaleString('vi-VN'), nameA + ' lines') + stat(r.totalB.toLocaleString('vi-VN'), nameB + ' lines') +
      stat(r.same.toLocaleString('vi-VN'), 'Same', 'success') + stat(r.added.toLocaleString('vi-VN'), 'Added', 'success') +
      stat(r.deleted.toLocaleString('vi-VN'), 'Deleted', 'danger') + stat(r.modified.toLocaleString('vi-VN'), 'Modified', 'warning') +
      (r.duplicate ? stat(r.duplicate.toLocaleString('vi-VN'), 'Duplicate') : '');

    if (r.same === r.totalA && r.same === r.totalB && r.added === 0 && r.deleted === 0 && r.modified === 0) {
      e.result.querySelector('#compare-identical').hidden = false;
      e.result.querySelector('#compare-identical').textContent = '✅ Files are identical';
    } else {
      e.result.querySelector('#compare-identical').hidden = true;
    }

    if (r.rows.length >= ROW_CAP) {
      e.result.querySelector('#compare-cap-note').hidden = false;
      e.result.querySelector('#compare-cap-note').textContent = 'Đang hiển thị ' + ROW_CAP.toLocaleString('vi-VN') + ' dòng khác biệt đầu tiên (số liệu tổng vẫn chính xác).';
    } else {
      e.result.querySelector('#compare-cap-note').hidden = true;
    }

    renderTable();
  }

  function stat(value, label, cls) {
    return '<div class="stat-card"><div class="stat-value" style="font-size:16px;' + (cls === 'success' ? 'color:var(--success)' : cls === 'danger' ? 'color:var(--danger)' : cls === 'warning' ? 'color:var(--warning)' : '') + '">' + value + '</div><div class="stat-label">' + label + '</div></div>';
  }

  function renderTable() {
    var e = els();
    var r = state.lastResult;
    if (!r) return;
    var rows = activeTab === 'All' ? r.rows : r.rows.filter(function (row) { return row.type === activeTab; });
    e.tabs.querySelectorAll('.chip').forEach(function (c) { c.classList.toggle('active', c.dataset.tab === activeTab); });

    e.table.innerHTML = rows.slice(0, 500).map(function (row) {
      var cls = row.type === 'Added' ? 'diff-added' : row.type === 'Deleted' ? 'diff-deleted' : row.type === 'Modified' ? 'diff-modified' : '';
      var diffText = row.diffCols && row.diffCols.length
        ? row.diffCols.map(function (d) { return (d.name || ('#' + (d.index + 1))) + ': ' + U.escapeHtml(d.a) + ' → ' + U.escapeHtml(d.b); }).join('<br>')
        : '';
      return '<tr class="' + cls + '"><td>' + row.type + '</td><td style="font-family:var(--font-mono); font-size:11.5px;">' + U.escapeHtml(row.a || '') + '</td>' +
        '<td style="font-family:var(--font-mono); font-size:11.5px;">' + U.escapeHtml(row.b || '') + '</td><td>' + diffText + '</td></tr>';
    }).join('');
  }

  function exportRows(type, format) {
    var r = state.lastResult;
    if (!r) return;
    var rows = type === 'All' ? r.rows : r.rows.filter(function (row) { return row.type === type; });
    var text;
    if (format === 'json') text = JSON.stringify(rows, null, 2);
    else if (format === 'csv') text = 'type,a,b\n' + rows.map(function (row) { return [row.type, csvEscape(row.a), csvEscape(row.b)].join(','); }).join('\n');
    else text = rows.map(function (row) { return '[' + row.type + '] A: ' + (row.a || '') + ' | B: ' + (row.b || ''); }).join('\n');
    U.downloadText('compare_' + type.toLowerCase() + '.' + format, text, format === 'json' ? 'application/json' : 'text/plain');
  }
  function csvEscape(v) { return '"' + String(v || '').replace(/"/g, '""') + '"'; }

  function computeHashes() {
    if (!state.fileA || !state.fileB) { alert('Vui lòng chọn cả File A và File B.'); return; }
    var statusEl = document.getElementById('compare-hash-status');
    var resultEl = document.getElementById('compare-hash-result');
    statusEl.textContent = 'Đang tính hash…';
    resultEl.hidden = true;

    Promise.all([
      window.VNoteHash.hashFile(state.fileA, 'MD5'), window.VNoteHash.hashFile(state.fileA, 'SHA-256'),
      window.VNoteHash.hashFile(state.fileB, 'MD5'), window.VNoteHash.hashFile(state.fileB, 'SHA-256')
    ]).then(function (res) {
      statusEl.textContent = '';
      resultEl.hidden = false;
      document.getElementById('hash-a-md5').textContent = res[0];
      document.getElementById('hash-a-sha256').textContent = res[1];
      document.getElementById('hash-b-md5').textContent = res[2];
      document.getElementById('hash-b-sha256').textContent = res[3];
      var identical = res[0] === res[2] && res[1] === res[3];
      var note = document.getElementById('hash-identical-note');
      note.style.color = identical ? 'var(--success)' : 'var(--danger)';
      note.textContent = identical ? '✅ Files are identical (hash match)' : '❌ Files differ (hash mismatch)';
    });
  }

  function bindOnce() {
    var e = els();
    document.getElementById('compare-hash-btn').addEventListener('click', computeHashes);
    P.setupDropzone(e.dzA, e.inputA, function (files) { loadFile('A', files[0]); });
    P.setupDropzone(e.dzB, e.inputB, function (files) { loadFile('B', files[0]); });

    e.modeGroup.addEventListener('click', function (ev) {
      var chip = ev.target.closest('.chip'); if (!chip) return;
      e.modeGroup.querySelectorAll('.chip').forEach(function (c) { c.classList.remove('active'); });
      chip.classList.add('active');
      state.mode = chip.dataset.mode;
      e.keyColumnsWrap.hidden = state.mode !== 'key';
    });

    e.delimiter.addEventListener('change', refreshColumnPickers);
    e.hasHeader.addEventListener('change', refreshColumnPickers);
    e.runBtn.addEventListener('click', run);
    e.cancelBtn.addEventListener('click', function () {
      if (state.worker) { state.worker.terminate(); state.worker = null; e.progressWrap.hidden = true; }
      if (state.signal) state.signal.aborted = true;
    });

    e.tabs.addEventListener('click', function (ev) {
      var chip = ev.target.closest('.chip'); if (!chip) return;
      activeTab = chip.dataset.tab;
      renderTable();
    });

    e.exportButtons.addEventListener('click', function (ev) {
      var btn = ev.target.closest('[data-export]'); if (!btn) return;
      exportRows(btn.dataset.export, btn.dataset.format);
    });

    document.getElementById('btn-create-note-from-compare').addEventListener('click', function () {
      var r = state.lastResult;
      if (!r) return;
      var content = '# Compare Result\n\nFile A: ' + (state.fileA ? state.fileA.name : '') + ' (' + r.totalA + ' lines)\n' +
        'File B: ' + (state.fileB ? state.fileB.name : '') + ' (' + r.totalB + ' lines)\n\n' +
        '- Same: ' + r.same + '\n- Added: ' + r.added + '\n- Deleted: ' + r.deleted + '\n- Modified: ' + r.modified + (r.duplicate ? '\n- Duplicate: ' + r.duplicate : '') + '\n';
      window.VNoteDB.put('notes', {
        id: window.VNoteDB.uid(), title: 'File Compare Result — ' + new Date().toLocaleString('vi-VN'),
        category: 'Other', tags: ['file-compare'], priority: 'Low', status: 'Completed', content: content,
        pinned: false, favorite: false, deleted: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
      }).then(function () {
        window.VNoteApp.onDataChanged();
        window.VNoteApp.showToast('Đã tạo note từ kết quả compare');
      });
    });
  }

  return { bindOnce: bindOnce };
})();
