importScripts('../js/file-tools/parsers.js');

var P = self.VNoteParsers;
var ROW_CAP = 2000;

function normalizeLine(line, opts) {
  if (opts.trim) line = line.trim();
  if (opts.whitespace) line = line.replace(/\s+/g, '');
  if (opts.caseInsensitive) line = line.toLowerCase();
  return line;
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
      var key = opts.keyIndices.map(function (idx) { return normalizeLine(cols[idx] || '', opts); }).join('');
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

self.onmessage = function (e) {
  var fileA = e.data.fileA, fileB = e.data.fileB, mode = e.data.mode, opts = e.data.opts;
  var totalBytes = fileA.size + fileB.size;
  var loadedA = 0, loadedB = 0;

  function reportProgress() {
    var pct = totalBytes ? Math.round(((loadedA + loadedB) / totalBytes) * 100) : 100;
    self.postMessage({ type: 'progress', pct: pct });
  }

  function readAll(file, setLoaded) {
    var lines = [];
    return P.streamLines(file, {
      onProgress: function (l) { setLoaded(l); reportProgress(); },
      onLine: function (l) { lines.push(l); }
    }).then(function () { return lines; });
  }

  Promise.all([
    readAll(fileA, function (l) { loadedA = l; }),
    readAll(fileB, function (l) { loadedB = l; })
  ]).then(function (res) {
    var linesA = res[0], linesB = res[1];
    var result = mode === 'key' ? runKeyBasedCompare(linesA, linesB, opts) : runAlignedCompare(linesA, linesB, opts);
    self.postMessage({ type: 'done', result: result });
  }).catch(function (err) {
    self.postMessage({ type: 'error', message: err.message || String(err) });
  });
};
