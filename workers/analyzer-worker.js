importScripts('../js/file-tools/parsers.js');

var P = self.VNoteParsers;
var COLUMN_SAMPLE_CAP = 5000;

self.onmessage = function (e) {
  var file = e.data.file;
  var hasHeader = e.data.hasHeader;

  var lineCount = 0, emptyLines = 0;
  var seen = new Map();
  var sampleLines = [];
  var columnValues = null, delimiter = null, headerCols = null;

  P.streamLines(file, {
    onProgress: function (loaded, total) { self.postMessage({ type: 'progress', loaded: loaded, total: total }); },
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

    self.postMessage({
      type: 'done',
      result: {
        encoding: info.encoding, lineEnding: P.detectLineEnding(sampleLines.join('\n')),
        lines: lineCount, emptyLines: emptyLines, duplicateLines: duplicates,
        delimiter: delimiter, columns: headerCols, columnValues: columnValues, hasHeader: hasHeader
      }
    });
  }).catch(function (err) {
    self.postMessage({ type: 'error', message: err.message || String(err) });
  });
};
