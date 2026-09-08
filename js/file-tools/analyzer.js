window.VNoteFileAnalyzer = (function () {
  'use strict';

  var P = window.VNoteParsers;
  var U = window.VNoteUtil;
  var COLUMN_SAMPLE_CAP = 5000;
  var state = { file: null, signal: null };

  function els() {
    return {
      dropzone: document.getElementById('analyzer-dropzone'),
      input: document.getElementById('analyzer-input'),
      progressWrap: document.getElementById('analyzer-progress-wrap'),
      progressFill: document.getElementById('analyzer-progress-fill'),
      progressText: document.getElementById('analyzer-progress-text'),
      cancelBtn: document.getElementById('analyzer-cancel'),
      result: document.getElementById('analyzer-result'),
      hasHeader: document.getElementById('analyzer-has-header')
    };
  }

  function analyze(file) {
    var e = els();
    state.file = file;
    e.result.hidden = true;
    e.progressWrap.hidden = false;
    e.progressFill.style.width = '0%';
    e.progressText.textContent = 'Đang phân tích…';
    var hasHeader = e.hasHeader.checked;

    var worker = null;
    try {
      worker = new Worker('workers/analyzer-worker.js');
    } catch (err) {
      worker = null;
    }

    if (worker) {
      state.worker = worker;
      var gotResult = false;
      worker.onmessage = function (ev) {
        var msg = ev.data;
        if (msg.type === 'progress') {
          var pct = msg.total ? Math.round((msg.loaded / msg.total) * 100) : 100;
          e.progressFill.style.width = pct + '%';
          e.progressText.textContent = 'Đang phân tích (Web Worker)… ' + pct + '% (' + P.formatBytes(msg.loaded) + ' / ' + P.formatBytes(msg.total) + ')';
        } else if (msg.type === 'done') {
          gotResult = true;
          e.progressWrap.hidden = true;
          renderResult(Object.assign({ file: file }, msg.result));
          worker.terminate();
        } else if (msg.type === 'error') {
          gotResult = true;
          e.progressWrap.hidden = true;
          e.progressText.textContent = 'Lỗi khi đọc file';
          worker.terminate();
        }
      };
      worker.onerror = function () {
        if (gotResult) return;
        worker.terminate();
        analyzeMainThread(file, hasHeader);
      };
      worker.postMessage({ file: file, hasHeader: hasHeader });
    } else {
      analyzeMainThread(file, hasHeader);
    }
  }

  /** Fallback used when Web Workers are unavailable (e.g. index.html opened directly via file://). */
  function analyzeMainThread(file, hasHeader) {
    var e = els();
    state.signal = { aborted: false };

    var lineCount = 0, emptyLines = 0;
    var seen = new Map();
    var sampleLines = [];
    var columnValues = null;
    var delimiter = null;
    var headerCols = null;

    P.streamLines(file, {
      chunkSize: 8 * 1024 * 1024,
      signal: state.signal,
      onProgress: function (loaded, total) {
        var pct = total ? Math.round((loaded / total) * 100) : 100;
        e.progressFill.style.width = pct + '%';
        e.progressText.textContent = 'Đang phân tích… ' + pct + '% (' + P.formatBytes(loaded) + ' / ' + P.formatBytes(total) + ')';
      },
      onLine: function (line) {
        lineCount++;
        if (line.trim() === '') emptyLines++;
        var count = seen.get(line) || 0;
        seen.set(line, count + 1);

        if (sampleLines.length < 20) sampleLines.push(line);
        if (delimiter === null && sampleLines.length === 20) {
          delimiter = P.detectDelimiter(sampleLines);
          if (hasHeader) headerCols = sampleLines[0].split(delimiter);
          columnValues = [];
        }
        if (columnValues && columnValues.length < COLUMN_SAMPLE_CAP && !(hasHeader && lineCount === 1) && line !== '') {
          columnValues.push(line.split(delimiter));
        }
      }
    }).then(function (info) {
      if (delimiter === null && sampleLines.length) {
        delimiter = P.detectDelimiter(sampleLines);
        if (hasHeader) headerCols = sampleLines[0].split(delimiter);
      }
      var duplicates = 0;
      seen.forEach(function (c) { if (c > 1) duplicates += c - 1; });

      renderResult({
        file: file, encoding: info.encoding, lineEnding: P.detectLineEnding(sampleLines.join('\n')),
        lines: lineCount, emptyLines: emptyLines, duplicateLines: duplicates,
        delimiter: delimiter, columns: headerCols, columnValues: columnValues, hasHeader: hasHeader
      });
    }).catch(function (err) {
      if (err.name !== 'AbortError') console.error(err);
      e.progressText.textContent = err.name === 'AbortError' ? 'Đã huỷ' : 'Lỗi khi đọc file';
    }).then(function () {
      e.progressWrap.hidden = true;
    });
  }

  function renderResult(r) {
    var e = els();
    e.result.hidden = false;
    var colCount = r.columns ? r.columns.length : (r.columnValues && r.columnValues[0] ? r.columnValues[0].length : 0);

    var html = '<div class="stat-row" style="grid-template-columns: repeat(4, 1fr);">' +
      stat(r.file.name, 'Name') + stat(window.VNoteParsers.formatBytes(r.file.size), 'Size') +
      stat(r.encoding, 'Encoding') + stat(r.lineEnding, 'Line Ending') +
      '</div>' +
      '<div class="stat-row" style="grid-template-columns: repeat(4, 1fr);">' +
      stat(r.lines.toLocaleString('vi-VN'), 'Lines') + stat(colCount, 'Columns') +
      stat(r.delimiter ? window.VNoteParsers.delimLabel(r.delimiter) : '—', 'Delimiter') +
      stat(r.emptyLines.toLocaleString('vi-VN'), 'Empty Lines') +
      '</div>' +
      '<div class="stat-row" style="grid-template-columns: repeat(2, 1fr);">' +
      stat(r.duplicateLines.toLocaleString('vi-VN'), 'Duplicate Lines') +
      stat(r.hasHeader ? 'Yes' : 'No', 'Header Row') +
      '</div>';

    if (r.columnValues && r.columnValues.length && colCount > 0) {
      html += '<h3 style="margin:20px 0 10px;">Column Analysis' + (r.columnValues.length >= COLUMN_SAMPLE_CAP ? ' <span style="color:var(--text-muted); font-weight:400; font-size:12px;">(sampled from first ' + COLUMN_SAMPLE_CAP.toLocaleString('vi-VN') + ' rows)</span>' : '') + '</h3>';
      html += '<table class="table"><thead><tr><th>#</th><th>Name</th><th>Detected Type</th><th>Empty</th><th>Unique</th><th>Min</th><th>Max</th></tr></thead><tbody>';
      for (var c = 0; c < colCount; c++) {
        var values = r.columnValues.map(function (row) { return row[c] !== undefined ? row[c] : ''; });
        var type = window.VNoteParsers.sniffType(values);
        var emptyCount = values.filter(function (v) { return v === ''; }).length;
        var uniq = new Set(values.filter(function (v) { return v !== ''; }));
        var min = '', max = '';
        if (type === 'INTEGER' || type === 'DECIMAL') {
          var nums = values.filter(function (v) { return v !== ''; }).map(Number);
          if (nums.length) { min = Math.min.apply(null, nums); max = Math.max.apply(null, nums); }
        } else if (values.length) {
          var nonEmpty = values.filter(function (v) { return v !== ''; }).sort();
          if (nonEmpty.length) { min = nonEmpty[0]; max = nonEmpty[nonEmpty.length - 1]; }
        }
        html += '<tr><td>' + (c + 1) + '</td><td>' + U.escapeHtml(r.columns ? r.columns[c] : 'col_' + (c + 1)) + '</td>' +
          '<td><span class="badge">' + type + '</span></td><td>' + emptyCount + '</td><td>' + uniq.size + '</td>' +
          '<td>' + U.escapeHtml(String(min)) + '</td><td>' + U.escapeHtml(String(max)) + '</td></tr>';
      }
      html += '</tbody></table>';
    }

    e.result.innerHTML = html;

    window.VNoteDB.put('history', {
      id: window.VNoteDB.uid(), type: 'ANALYZE', input: r.file.name, output: '',
      result: r.lines + ' lines, ' + r.duplicateLines + ' duplicates', createdAt: new Date().toISOString()
    });
  }

  function stat(value, label) {
    return '<div class="stat-card"><div class="stat-value" style="font-size:15px;">' + window.VNoteUtil.escapeHtml(String(value)) + '</div><div class="stat-label">' + label + '</div></div>';
  }

  function bindOnce() {
    var e = els();
    P.setupDropzone(e.dropzone, e.input, function (files) { analyze(files[0]); });
    e.cancelBtn.addEventListener('click', function () {
      if (state.worker) { state.worker.terminate(); state.worker = null; e.progressWrap.hidden = true; }
      if (state.signal) state.signal.aborted = true;
    });
    e.hasHeader.addEventListener('change', function () { if (state.file) analyze(state.file); });
  }

  return { bindOnce: bindOnce };
})();
