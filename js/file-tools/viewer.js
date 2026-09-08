window.VNoteFileViewer = (function () {
  'use strict';

  var P = window.VNoteParsers;
  var TEXT_EXT = ['txt', 'log', 'dat', 'csv', 'tsv', 'md', 'conf', 'config', 'ini', 'env', 'json', 'jsonl', 'xml', 'yaml', 'yml', 'js', 'ts', 'html', 'css', 'py', 'java', 'sh', 'sql'];
  var IMAGE_EXT = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'];
  var PREVIEW_CAP = 5 * 1024 * 1024;

  var state = { file: null, rawBuffer: null, showHex: false };

  function ext(name) { var m = /\.([a-z0-9]+)$/i.exec(name || ''); return m ? m[1].toLowerCase() : ''; }

  function els() {
    return {
      dropzone: document.getElementById('viewer-dropzone'),
      input: document.getElementById('viewer-input'),
      content: document.getElementById('viewer-content'),
      filename: document.getElementById('viewer-filename'),
      size: document.getElementById('viewer-size'),
      encoding: document.getElementById('viewer-encoding'),
      lineEnding: document.getElementById('viewer-line-ending'),
      encodingOverride: document.getElementById('viewer-encoding-override'),
      warning: document.getElementById('viewer-warning'),
      pre: document.getElementById('viewer-pre'),
      img: document.getElementById('viewer-img'),
      hexToggle: document.getElementById('viewer-hex-toggle'),
      zipList: document.getElementById('viewer-zip-list')
    };
  }

  function toHexDump(bytes, maxBytes) {
    var lines = [];
    var n = Math.min(bytes.length, maxBytes || 4096);
    for (var i = 0; i < n; i += 16) {
      var slice = bytes.subarray(i, Math.min(i + 16, n));
      var hex = '', ascii = '';
      for (var j = 0; j < 16; j++) {
        if (j < slice.length) {
          var b = slice[j];
          hex += (b < 16 ? '0' : '') + b.toString(16) + ' ';
          ascii += (b >= 32 && b < 127) ? String.fromCharCode(b) : '.';
        } else hex += '   ';
      }
      lines.push(i.toString(16).padStart(8, '0') + '  ' + hex + ' ' + ascii);
    }
    if (bytes.length > n) lines.push('… (' + P.formatBytes(bytes.length - n) + ' more, showing first ' + P.formatBytes(n) + ')');
    return lines.join('\n');
  }

  function renderZipListing(bytes) {
    var e = els();
    var entries = window.VNoteZip.listZipEntries(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
    if (!entries) { showText('(Không đọc được central directory của file ZIP)'); return; }
    var html = '<table class="table"><thead><tr><th>Name</th><th>Size</th><th>Method</th><th></th></tr></thead><tbody>' +
      entries.map(function (en, i) {
        return '<tr><td>' + window.VNoteUtil.escapeHtml(en.name) + '</td><td>' + P.formatBytes(en.size) + '</td>' +
          '<td>' + (en.method === 0 ? 'Stored' : 'Deflate') + '</td>' +
          '<td>' + (en.method === 0 ? '<button class="btn btn-sm zip-extract" data-idx="' + i + '">View</button>' : '<span style="color:var(--text-muted)">Không hỗ trợ xem trực tiếp (nén DEFLATE)</span>') + '</td></tr>';
      }).join('') + '</tbody></table>';
    e.pre.hidden = true;
    e.img.style.display = 'none';
    if (!e.zipList) {
      e.zipList = document.createElement('div');
      e.zipList.id = 'viewer-zip-list';
      e.pre.parentNode.insertBefore(e.zipList, e.pre);
    }
    e.zipList.hidden = false;
    e.zipList.innerHTML = html;
    e.zipList.querySelectorAll('.zip-extract').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var entry = entries[Number(btn.dataset.idx)];
        var data = window.VNoteZip.extractStoredEntry(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), entry);
        if (!data) return;
        var text = new TextDecoder('utf-8', { fatal: false }).decode(data);
        e.zipList.hidden = true;
        e.pre.hidden = false;
        e.pre.textContent = text;
      });
    });
  }

  function showText(text) {
    var e = els();
    if (e.zipList) e.zipList.hidden = true;
    e.pre.hidden = false;
    e.img.style.display = 'none';
    e.pre.textContent = text;
  }

  function decodeAndShow(encodingOverride) {
    var e = els();
    var bytes = new Uint8Array(state.rawBuffer);
    var encoding = encodingOverride || P.detectEncodingFromBytes(bytes);
    e.encoding.textContent = 'Encoding: ' + encoding;

    var name = state.file.name;
    var extension = ext(name);

    if (extension === 'zip') { renderZipListing(bytes); return; }

    var text;
    try {
      text = new TextDecoder(P.jsEncodingName(encoding), { fatal: false }).decode(bytes);
    } catch (err) {
      text = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
    }
    e.lineEnding.textContent = 'Line ending: ' + P.detectLineEnding(text.slice(0, 20000));

    if (extension === 'json' || extension === 'jsonl') {
      try {
        if (extension === 'json') showText(JSON.stringify(JSON.parse(text), null, 2));
        else showText(text.split(/\r\n|\r|\n/).filter(Boolean).map(function (l) { try { return JSON.stringify(JSON.parse(l), null, 2); } catch (e2) { return l; } }).join('\n---\n'));
      } catch (err) {
        showText(text);
        e.warning.hidden = false;
        e.warning.innerHTML = '<p style="margin:0 0 10px;">⚠️ JSON không hợp lệ — hiển thị dạng raw.</p>';
      }
    } else {
      var numbered = text.split(/\r\n|\r|\n/).map(function (l, i) { return String(i + 1).padStart(5, ' ') + '  ' + l; }).join('\n');
      showText(numbered);
    }
  }

  function loadFile(file) {
    state.file = file;
    var e = els();
    e.content.hidden = false;
    e.warning.hidden = true;
    e.warning.innerHTML = '';
    e.filename.textContent = file.name;
    e.size.textContent = P.formatBytes(file.size);
    e.encodingOverride.value = '';

    var extension = ext(file.name);

    if (IMAGE_EXT.indexOf(extension) !== -1) {
      var url = URL.createObjectURL(file);
      e.pre.hidden = true;
      if (e.zipList) e.zipList.hidden = true;
      e.img.style.display = 'block';
      e.img.src = url;
      e.encoding.textContent = ''; e.lineEnding.textContent = '';
      return;
    }

    var isKnownText = TEXT_EXT.indexOf(extension) !== -1 || extension === '';
    var readSize = Math.min(file.size, isKnownText ? 20 * 1024 * 1024 : 65536);
    var truncated = readSize < file.size;

    file.slice(0, readSize).arrayBuffer().then(function (buf) {
      state.rawBuffer = buf;
      if (truncated) {
        e.warning.hidden = false;
        e.warning.innerHTML = '<p style="margin:0;">⚠️ File lớn (' + P.formatBytes(file.size) + ') — chỉ hiển thị ' + P.formatBytes(readSize) + ' đầu tiên.</p>';
      }
      var bytes = new Uint8Array(buf);
      var looksBinary = !isKnownText && isProbablyBinary(bytes);
      if (looksBinary && ext(file.name) !== 'zip') {
        e.encoding.textContent = 'Binary'; e.lineEnding.textContent = '';
        showText(toHexDump(bytes, 8192));
      } else {
        decodeAndShow(null);
      }
    });
  }

  function isProbablyBinary(bytes) {
    var n = Math.min(bytes.length, 2000), controlCount = 0;
    for (var i = 0; i < n; i++) {
      var b = bytes[i];
      if (b === 0) return true;
      if (b < 9 || (b > 13 && b < 32)) controlCount++;
    }
    return n > 0 && controlCount / n > 0.1;
  }

  function bindOnce() {
    var e = els();
    P.setupDropzone(e.dropzone, e.input, function (files) { loadFile(files[0]); });
    e.encodingOverride.addEventListener('change', function () {
      if (state.rawBuffer) decodeAndShow(e.encodingOverride.value || null);
    });
    e.hexToggle.addEventListener('click', function () {
      if (!state.rawBuffer) return;
      state.showHex = !state.showHex;
      if (state.showHex) showText(toHexDump(new Uint8Array(state.rawBuffer), 16384));
      else decodeAndShow(e.encodingOverride.value || null);
    });
  }

  return { bindOnce: bindOnce };
})();
