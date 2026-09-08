window.VNoteFileSplitter = (function () {
  'use strict';

  var P = window.VNoteParsers;
  var state = { file: null, parts: [], signal: null };

  function els() {
    return {
      dropzone: document.getElementById('splitter-dropzone'),
      input: document.getElementById('splitter-input'),
      filename: document.getElementById('splitter-filename'),
      mode: document.getElementById('splitter-mode'),
      value: document.getElementById('splitter-value'),
      valueLabel: document.getElementById('splitter-value-label'),
      preserveHeader: document.getElementById('splitter-preserve-header'),
      runBtn: document.getElementById('splitter-run'),
      cancelBtn: document.getElementById('splitter-cancel'),
      progressWrap: document.getElementById('splitter-progress-wrap'),
      progressFill: document.getElementById('splitter-progress-fill'),
      progressText: document.getElementById('splitter-progress-text'),
      result: document.getElementById('splitter-result'),
      partsList: document.getElementById('splitter-parts'),
      downloadZip: document.getElementById('splitter-download-zip')
    };
  }

  function loadFile(file) {
    state.file = file;
    var e = els();
    e.filename.textContent = file.name + ' (' + P.formatBytes(file.size) + ')';
    e.result.hidden = true;
  }

  function baseAndExt(name) {
    var m = /^(.*?)(\.[a-z0-9]+)?$/i.exec(name);
    return { base: m[1], ext: m[2] || '' };
  }

  function run() {
    var e = els();
    if (!state.file) return;
    state.parts = [];
    e.result.hidden = true;
    e.progressWrap.hidden = false;
    e.progressFill.style.width = '0%';

    var mode = e.mode.value;
    var value = Number(e.value.value) || (mode === 'lines' ? 500000 : 50);
    var preserveHeader = e.preserveHeader.checked;
    var name = baseAndExt(state.file.name);

    var worker = null;
    try { worker = new Worker('workers/file-worker.js'); } catch (err) { worker = null; }

    if (worker) {
      state.worker = worker;
      var gotResult = false;
      worker.onmessage = function (ev) {
        var msg = ev.data;
        if (msg.type === 'progress') {
          e.progressFill.style.width = msg.pct + '%';
          e.progressText.textContent = 'Đang chia file (Web Worker)… ' + msg.pct + '%';
        } else if (msg.type === 'done') {
          gotResult = true;
          state.parts = msg.parts;
          e.progressWrap.hidden = true;
          renderResult();
          logHistory(msg.totalLines);
          worker.terminate();
        } else if (msg.type === 'error') {
          gotResult = true;
          e.progressWrap.hidden = true;
          e.result.hidden = false;
          e.result.innerHTML = '<p style="color:var(--danger)">Lỗi: ' + window.VNoteUtil.escapeHtml(msg.message) + '</p>';
          worker.terminate();
        }
      };
      worker.onerror = function () {
        if (gotResult) return;
        worker.terminate();
        runMainThread(mode, value, preserveHeader, name);
      };
      worker.postMessage({ file: state.file, mode: mode, value: value, preserveHeader: preserveHeader, baseName: name.base, ext: name.ext });
    } else {
      runMainThread(mode, value, preserveHeader, name);
    }
  }

  function logHistory(totalLines) {
    window.VNoteDB.put('history', {
      id: window.VNoteDB.uid(), type: 'SPLIT', input: state.file.name, output: state.parts.length + ' parts',
      result: totalLines + ' lines → ' + state.parts.length + ' files', createdAt: new Date().toISOString()
    });
  }

  /** Fallback used when Web Workers are unavailable (e.g. index.html opened directly via file://). */
  function runMainThread(mode, value, preserveHeader, name) {
    var e = els();
    state.signal = { aborted: false };
    var maxBytes = mode === 'size' ? value * 1024 * 1024 : Infinity;
    var maxLines = mode === 'lines' ? value : Infinity;
    var encoder = new TextEncoder();

    var headerLine = null, currentLines = [], currentBytes = 0, partIndex = 0, totalLines = 0;

    function flushPart() {
      if (!currentLines.length) return;
      partIndex++;
      var text = currentLines.join('\n') + '\n';
      var blob = new Blob([text], { type: 'text/plain' });
      state.parts.push({
        name: name.base + '_part_' + String(partIndex).padStart(3, '0') + name.ext,
        blob: blob, lines: currentLines.length, size: blob.size
      });
      currentLines = [];
      currentBytes = 0;
    }

    P.streamLines(state.file, {
      signal: state.signal,
      onProgress: function (loaded, total) {
        var pct = total ? Math.round((loaded / total) * 100) : 100;
        e.progressFill.style.width = pct + '%';
        e.progressText.textContent = 'Đang chia file… ' + pct + '%';
      },
      onLine: function (line, idx) {
        totalLines++;
        if (preserveHeader && idx === 0) { headerLine = line; return; }

        var lineBytes = encoder.encode(line).length + 1;
        var wouldExceedLines = currentLines.length >= maxLines;
        var wouldExceedBytes = (currentBytes + lineBytes) > maxBytes && currentLines.length > 0;
        if (wouldExceedLines || wouldExceedBytes) flushPart();

        if (preserveHeader && headerLine !== null && currentLines.length === 0) {
          currentLines.push(headerLine);
          currentBytes += encoder.encode(headerLine).length + 1;
        }
        currentLines.push(line);
        currentBytes += lineBytes;
      }
    }).then(function () {
      flushPart();
      renderResult();
      logHistory(totalLines);
    }).catch(function (err) {
      if (err.name !== 'AbortError') {
        e.result.hidden = false;
        e.result.innerHTML = '<p style="color:var(--danger)">Lỗi: ' + window.VNoteUtil.escapeHtml(err.message || String(err)) + '</p>';
      }
    }).then(function () { e.progressWrap.hidden = true; });
  }

  function renderResult() {
    var e = els();
    e.result.hidden = false;
    e.partsList.innerHTML = state.parts.map(function (p, i) {
      return '<tr><td>' + window.VNoteUtil.escapeHtml(p.name) + '</td><td>' + p.lines.toLocaleString('vi-VN') + '</td>' +
        '<td>' + P.formatBytes(p.size) + '</td><td><button class="btn btn-sm" data-download="' + i + '">Download</button></td></tr>';
    }).join('');
    e.partsList.querySelectorAll('[data-download]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var p = state.parts[Number(btn.dataset.download)];
        var url = URL.createObjectURL(p.blob);
        var a = document.createElement('a'); a.href = url; a.download = p.name;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
      });
    });
  }

  function downloadZip() {
    Promise.all(state.parts.map(function (p) { return p.blob.arrayBuffer().then(function (buf) { return { name: p.name, data: new Uint8Array(buf) }; }); }))
      .then(function (entries) {
        var zipBlob = window.VNoteZip.createZip(entries);
        var name = baseAndExt(state.file.name).base + '_split.zip';
        var url = URL.createObjectURL(zipBlob);
        var a = document.createElement('a'); a.href = url; a.download = name;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
      });
  }

  function bindOnce() {
    var e = els();
    P.setupDropzone(e.dropzone, e.input, function (files) { loadFile(files[0]); });
    e.mode.addEventListener('change', function () {
      e.valueLabel.textContent = e.mode.value === 'lines' ? 'Lines per file' : 'MB per file';
      e.value.value = e.mode.value === 'lines' ? 500000 : 50;
    });
    e.runBtn.addEventListener('click', run);
    e.cancelBtn.addEventListener('click', function () {
      if (state.worker) { state.worker.terminate(); state.worker = null; e.progressWrap.hidden = true; }
      if (state.signal) state.signal.aborted = true;
    });
    e.downloadZip.addEventListener('click', downloadZip);
  }

  return { bindOnce: bindOnce };
})();
