window.VNoteFileCleaner = (function () {
  'use strict';

  var P = window.VNoteParsers;
  var state = { file: null };

  function els() {
    return {
      dropzone: document.getElementById('cleaner-dropzone'),
      input: document.getElementById('cleaner-input'),
      filename: document.getElementById('cleaner-filename'),
      removeEmpty: document.getElementById('cleaner-remove-empty'),
      removeDup: document.getElementById('cleaner-remove-dup'),
      trim: document.getElementById('cleaner-trim'),
      removeBom: document.getElementById('cleaner-remove-bom'),
      normalizeEnding: document.getElementById('cleaner-normalize-ending'),
      sort: document.getElementById('cleaner-sort'),
      findInput: document.getElementById('cleaner-find'),
      replaceInput: document.getElementById('cleaner-replace'),
      useRegex: document.getElementById('cleaner-use-regex'),
      runBtn: document.getElementById('cleaner-run'),
      progressWrap: document.getElementById('cleaner-progress-wrap'),
      progressFill: document.getElementById('cleaner-progress-fill'),
      result: document.getElementById('cleaner-result')
    };
  }

  function loadFile(file) {
    state.file = file;
    var e = els();
    e.filename.textContent = file.name + ' (' + P.formatBytes(file.size) + ')';
    e.result.hidden = true;
  }

  function run() {
    var e = els();
    if (!state.file) return;
    e.progressWrap.hidden = false;
    e.progressFill.style.width = '0%';

    var find = e.findInput.value;
    var replace = e.replaceInput.value;
    var regex = null;
    if (find && e.useRegex.checked) {
      try { regex = new RegExp(find, 'g'); } catch (err) { alert('Regex không hợp lệ: ' + err.message); e.progressWrap.hidden = true; return; }
    }

    var inputCount = 0;
    var lines = [];
    var seen = new Set();

    P.streamLines(state.file, {
      onProgress: function (loaded, total) {
        var pct = total ? Math.round((loaded / total) * 100) : 100;
        e.progressFill.style.width = pct + '%';
      },
      onLine: function (line) {
        inputCount++;
        if (e.trim.checked) line = line.trim();
        if (find) line = regex ? line.replace(regex, replace) : line.split(find).join(replace);
        if (e.removeEmpty.checked && line === '') return;
        if (e.removeDup.checked) {
          if (seen.has(line)) return;
          seen.add(line);
        }
        lines.push(line);
      }
    }).then(function () {
      if (e.sort.checked) lines.sort();
      var text = lines.join(e.normalizeEnding.value === 'CRLF' ? '\r\n' : '\n');
      if (!e.removeBom.checked) { /* keep as-is, we never added a BOM */ }

      var blob = new Blob([text], { type: 'text/plain' });
      var outName = state.file.name.replace(/(\.[a-z0-9]+)?$/i, '_cleaned$1');
      window.VNoteUtil.downloadText(outName, text, 'text/plain');

      e.result.hidden = false;
      e.result.innerHTML = '✅ ' + inputCount.toLocaleString('vi-VN') + ' → ' + lines.length.toLocaleString('vi-VN') + ' dòng. Đã tải xuống <strong>' + outName + '</strong>.';

      window.VNoteDB.put('history', {
        id: window.VNoteDB.uid(), type: 'CLEAN', input: state.file.name, output: outName,
        result: inputCount + ' → ' + lines.length + ' lines', createdAt: new Date().toISOString()
      });
    }).catch(function (err) {
      e.result.hidden = false;
      e.result.innerHTML = '❌ Lỗi: ' + window.VNoteUtil.escapeHtml(err.message || String(err));
    }).then(function () { e.progressWrap.hidden = true; });
  }

  function bindOnce() {
    var e = els();
    P.setupDropzone(e.dropzone, e.input, function (files) { loadFile(files[0]); });
    e.runBtn.addEventListener('click', run);
  }

  return { bindOnce: bindOnce };
})();
