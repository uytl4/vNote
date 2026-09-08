window.VNoteFileConverter = (function () {
  'use strict';

  var P = window.VNoteParsers;
  var state = { file: null, signal: null };

  function els() {
    return {
      dropzone: document.getElementById('converter-dropzone'),
      input: document.getElementById('converter-input'),
      filename: document.getElementById('converter-filename'),
      fromFormat: document.getElementById('converter-from'),
      toFormat: document.getElementById('converter-to'),
      delimIn: document.getElementById('converter-delim-in'),
      delimOut: document.getElementById('converter-delim-out'),
      lineEnding: document.getElementById('converter-line-ending'),
      encodingOut: document.getElementById('converter-encoding-out'),
      runBtn: document.getElementById('converter-run'),
      progressWrap: document.getElementById('converter-progress-wrap'),
      progressFill: document.getElementById('converter-progress-fill'),
      progressText: document.getElementById('converter-progress-text'),
      result: document.getElementById('converter-result')
    };
  }

  function ext(name) { var m = /\.([a-z0-9]+)$/i.exec(name || ''); return m ? m[1].toLowerCase() : 'txt'; }
  function delimVal(v) { return v === 'TAB' ? '\t' : v; }

  function loadFile(file) {
    state.file = file;
    var e = els();
    e.filename.textContent = file.name + ' (' + P.formatBytes(file.size) + ')';
    var guessed = ext(file.name);
    if (['csv', 'tsv', 'txt', 'json', 'jsonl'].indexOf(guessed) !== -1) e.fromFormat.value = guessed;
    e.result.hidden = true;
  }

  function csvLinesToObjects(lines, delim) {
    var header = lines[0].split(delim);
    return lines.slice(1).filter(function (l) { return l !== ''; }).map(function (line) {
      var cols = line.split(delim);
      var obj = {};
      header.forEach(function (h, i) { obj[h] = cols[i] !== undefined ? cols[i] : ''; });
      return obj;
    });
  }

  function objectsToCsvLines(objects, delim) {
    if (!objects.length) return [''];
    var header = Object.keys(objects[0]);
    var lines = [header.join(delim)];
    objects.forEach(function (obj) {
      lines.push(header.map(function (h) { return obj[h] != null ? String(obj[h]) : ''; }).join(delim));
    });
    return lines;
  }

  function encodeOutput(text, encoding, lineEnding) {
    if (lineEnding === 'CRLF') text = text.replace(/\r\n|\n/g, '\r\n');
    else text = text.replace(/\r\n/g, '\n');

    if (encoding === 'UTF-16') {
      var buf = new Uint8Array(2 + text.length * 2);
      buf[0] = 0xFF; buf[1] = 0xFE;
      for (var i = 0; i < text.length; i++) {
        var code = text.charCodeAt(i);
        buf[2 + i * 2] = code & 0xff;
        buf[2 + i * 2 + 1] = (code >> 8) & 0xff;
      }
      return new Blob([buf], { type: 'application/octet-stream' });
    }
    return new Blob([text], { type: 'text/plain' });
  }

  function run() {
    var e = els();
    if (!state.file) return;
    var from = e.fromFormat.value, to = e.toFormat.value;
    var delimIn = delimVal(e.delimIn.value), delimOut = delimVal(e.delimOut.value);

    e.progressWrap.hidden = false;
    e.progressFill.style.width = '0%';
    state.signal = { aborted: false };
    var lines = [];

    P.streamLines(state.file, {
      signal: state.signal,
      onProgress: function (loaded, total) {
        var pct = total ? Math.round((loaded / total) * 100) : 100;
        e.progressFill.style.width = pct + '%';
        e.progressText.textContent = 'Đang đọc… ' + pct + '%';
      },
      onLine: function (line) { lines.push(line); }
    }).then(function () {
      while (lines.length && lines[lines.length - 1] === '') lines.pop();
      var outLines;

      if ((from === 'csv' || from === 'tsv' || from === 'txt') && (to === 'csv' || to === 'tsv' || to === 'txt')) {
        outLines = lines.map(function (l) { return from === 'txt' ? l : l.split(delimIn).join(delimOut); });
      } else if ((from === 'csv' || from === 'tsv') && (to === 'json' || to === 'jsonl')) {
        var objs = csvLinesToObjects(lines, delimIn);
        outLines = to === 'json' ? [JSON.stringify(objs, null, 2)] : objs.map(function (o) { return JSON.stringify(o); });
      } else if (from === 'json' && (to === 'csv' || to === 'tsv')) {
        var arr = JSON.parse(lines.join('\n'));
        outLines = objectsToCsvLines(Array.isArray(arr) ? arr : [arr], delimOut);
      } else if (from === 'jsonl' && (to === 'csv' || to === 'tsv')) {
        var objs2 = lines.filter(Boolean).map(function (l) { return JSON.parse(l); });
        outLines = objectsToCsvLines(objs2, delimOut);
      } else if (from === 'json' && to === 'jsonl') {
        var arr2 = JSON.parse(lines.join('\n'));
        outLines = (Array.isArray(arr2) ? arr2 : [arr2]).map(function (o) { return JSON.stringify(o); });
      } else if (from === 'jsonl' && to === 'json') {
        outLines = [JSON.stringify(lines.filter(Boolean).map(function (l) { return JSON.parse(l); }), null, 2)];
      } else {
        outLines = lines;
      }

      var text = outLines.join('\n');
      var blob = encodeOutput(text, e.encodingOut.value, e.lineEnding.value);
      var outName = state.file.name.replace(/\.[a-z0-9]+$/i, '') + '.' + to;
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a'); a.href = url; a.download = outName;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);

      e.result.hidden = false;
      e.result.innerHTML = '✅ Đã convert <strong>' + state.file.name + '</strong> → <strong>' + outName + '</strong> (' + P.formatBytes(blob.size) + ')';

      window.VNoteDB.put('history', {
        id: window.VNoteDB.uid(), type: 'CONVERT', input: state.file.name, output: outName,
        result: from.toUpperCase() + ' → ' + to.toUpperCase(), createdAt: new Date().toISOString()
      });
    }).catch(function (err) {
      e.result.hidden = false;
      e.result.innerHTML = '❌ Lỗi convert: ' + window.VNoteUtil.escapeHtml(err.message || String(err));
    }).then(function () { e.progressWrap.hidden = true; });
  }

  function bindOnce() {
    var e = els();
    P.setupDropzone(e.dropzone, e.input, function (files) { loadFile(files[0]); });
    e.runBtn.addEventListener('click', run);
  }

  return { bindOnce: bindOnce };
})();
