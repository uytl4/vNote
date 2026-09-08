window.VNoteParsers = (function () {
  'use strict';

  var ENCODING_MAP = {
    'UTF-8': 'utf-8',
    'UTF-8 BOM': 'utf-8',
    'UTF-16 LE': 'utf-16le',
    'UTF-16 BE': 'utf-16be',
    'Windows-1252': 'windows-1252',
    'ANSI': 'windows-1252'
  };

  function jsEncodingName(label) { return ENCODING_MAP[label] || 'utf-8'; }

  function detectEncodingFromBytes(bytes) {
    if (bytes.length >= 3 && bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF) return 'UTF-8 BOM';
    if (bytes.length >= 2 && bytes[0] === 0xFF && bytes[1] === 0xFE) return 'UTF-16 LE';
    if (bytes.length >= 2 && bytes[0] === 0xFE && bytes[1] === 0xFF) return 'UTF-16 BE';
    var zeros = 0, sample = Math.min(bytes.length, 400);
    for (var i = 0; i < sample; i++) if (bytes[i] === 0) zeros++;
    if (sample > 20 && zeros / sample > 0.25) return 'UTF-16 LE';
    return 'UTF-8';
  }

  function detectLineEnding(text) {
    var crlf = (text.match(/\r\n/g) || []).length;
    var lf = (text.match(/(?<!\r)\n/g) || []).length;
    var cr = (text.match(/\r(?!\n)/g) || []).length;
    if (crlf >= lf && crlf >= cr && crlf > 0) return 'CRLF';
    if (cr > lf && cr > 0) return 'CR';
    return 'LF';
  }

  var DELIMS = [';', ',', '|', '\t'];
  function detectDelimiter(sampleLines) {
    var lines = sampleLines.filter(Boolean).slice(0, 20);
    if (!lines.length) return ';';
    var best = ';', bestScore = -1;
    DELIMS.forEach(function (d) {
      var counts = lines.map(function (l) { return l.split(d).length - 1; });
      var nonZero = counts.filter(function (c) { return c > 0; });
      if (!nonZero.length) return;
      var avg = nonZero.reduce(function (a, b) { return a + b; }, 0) / nonZero.length;
      var consistent = counts.every(function (c) { return c === counts[0]; });
      var score = avg * (consistent ? 2 : 1);
      if (score > bestScore) { bestScore = score; best = d; }
    });
    return bestScore > 0 ? best : ';';
  }

  function delimLabel(d) { return d === '\t' ? 'TAB' : d; }

  function sniffType(values) {
    var nonEmpty = values.filter(function (v) { return v !== '' && v != null; });
    if (!nonEmpty.length) return 'STRING';
    if (nonEmpty.every(function (v) { return /^-?\d+$/.test(v); })) return 'INTEGER';
    if (nonEmpty.every(function (v) { return /^-?\d+\.\d+$/.test(v); })) return 'DECIMAL';
    if (nonEmpty.every(function (v) { return /^\d{14}$/.test(v) || /^\d{4}-\d{2}-\d{2}([ T]\d{2}:\d{2}(:\d{2})?)?$/.test(v); })) return 'DATETIME';
    return 'STRING';
  }

  function formatBytes(n) {
    if (n < 1024) return n + ' B';
    var units = ['KB', 'MB', 'GB', 'TB'];
    var i = -1;
    do { n /= 1024; i++; } while (n >= 1024 && i < units.length - 1);
    return n.toFixed(n >= 100 ? 0 : n >= 10 ? 1 : 2) + ' ' + units[i];
  }

  function sleep0() { return new Promise(function (r) { setTimeout(r, 0); }); }

  /**
   * Stream a File line by line without loading the whole file into memory.
   * onLine(line, index) is called for every line; onProgress(loaded, total) periodically.
   * opts.signal: a plain {aborted:false} object checked cooperatively (not a real AbortController,
   * since we need to interrupt a manual chunk loop rather than a single fetch/read).
   */
  function streamLines(file, opts) {
    opts = opts || {};
    var chunkSize = opts.chunkSize || 8 * 1024 * 1024;
    var encodingLabel = opts.encoding;
    var offset = 0;
    var total = file.size;
    var carry = '';
    var lineIndex = 0;
    var decoder = null;

    function decodeStep(buf, isLast) {
      var bytes = new Uint8Array(buf);
      if (!decoder) {
        if (!encodingLabel) encodingLabel = detectEncodingFromBytes(bytes);
        decoder = new TextDecoder(jsEncodingName(encodingLabel), { fatal: false });
      }
      return decoder.decode(bytes, { stream: !isLast });
    }

    return new Promise(function (resolve, reject) {
      (function next() {
        if (opts.signal && opts.signal.aborted) { reject(makeAbortError()); return; }
        if (offset >= total) {
          if (carry.length) { opts.onLine(carry, lineIndex++); carry = ''; }
          if (opts.onProgress) opts.onProgress(total, total);
          resolve({ lines: lineIndex, encoding: encodingLabel || 'UTF-8' });
          return;
        }
        var end = Math.min(offset + chunkSize, total);
        var isLast = end >= total;
        file.slice(offset, end).arrayBuffer().then(function (buf) {
          offset = end;
          var text = decodeStep(buf, isLast);
          var combined = carry + text;
          var parts = combined.split(/\r\n|\r|\n/);
          carry = parts.pop();
          for (var i = 0; i < parts.length; i++) opts.onLine(parts[i], lineIndex++);
          if (opts.onProgress) opts.onProgress(offset, total);
          sleep0().then(next);
        }).catch(reject);
      })();
    });
  }

  /** Stream a File in raw byte chunks (no decoding) — used for hashing / binary splitting. */
  function streamBytes(file, opts) {
    opts = opts || {};
    var chunkSize = opts.chunkSize || 8 * 1024 * 1024;
    var offset = 0;
    var total = file.size;
    return new Promise(function (resolve, reject) {
      (function next() {
        if (opts.signal && opts.signal.aborted) { reject(makeAbortError()); return; }
        if (offset >= total) { if (opts.onProgress) opts.onProgress(total, total); resolve(); return; }
        var end = Math.min(offset + chunkSize, total);
        file.slice(offset, end).arrayBuffer().then(function (buf) {
          offset = end;
          opts.onChunk(new Uint8Array(buf));
          if (opts.onProgress) opts.onProgress(offset, total);
          sleep0().then(next);
        }).catch(reject);
      })();
    });
  }

  function makeAbortError() {
    var e = new Error('Aborted'); e.name = 'AbortError'; return e;
  }

  function setupDropzone(zone, input, onFiles) {
    zone.addEventListener('click', function (e) { if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'A') input.click(); });
    zone.addEventListener('dragover', function (e) { e.preventDefault(); zone.classList.add('dragover'); });
    zone.addEventListener('dragleave', function () { zone.classList.remove('dragover'); });
    zone.addEventListener('drop', function (e) {
      e.preventDefault();
      zone.classList.remove('dragover');
      if (e.dataTransfer.files.length) onFiles(e.dataTransfer.files);
    });
    input.addEventListener('change', function () {
      if (input.files.length) onFiles(input.files);
      input.value = '';
    });
  }

  return {
    setupDropzone: setupDropzone,
    detectEncodingFromBytes: detectEncodingFromBytes,
    jsEncodingName: jsEncodingName,
    detectLineEnding: detectLineEnding,
    detectDelimiter: detectDelimiter,
    delimLabel: delimLabel,
    sniffType: sniffType,
    formatBytes: formatBytes,
    streamLines: streamLines,
    streamBytes: streamBytes,
    sleep0: sleep0
  };
})();
